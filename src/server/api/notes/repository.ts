import type { PrismaClient } from '../../../../generated/prisma/client.js';
import {
  encodeCursor,
  InvalidCursorError,
  parseCursor,
  toCursorPage,
} from '../_lib/cursor-pagination.js';
import {
  learningProgramWhere,
  previewProgramWhere,
} from '../_lib/program-access-policy.js';
import { runSerializableProgressTransaction } from '../_lib/progress-recalculation.js';
import type { NoteRecord, NotesRepository } from './types.js';
import { invalidNoteRequest, noteNotFound } from './validation.js';

const noteSelect = {
  createdAt: true,
  id: true,
  lesson: { select: { id: true, slug: true, title: true } },
  markdown: true,
  program: { select: { id: true, slug: true, title: true } },
  sequenceItem: { select: { id: true, key: true, kind: true } },
  title: true,
  updatedAt: true,
} as const;

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function linkedLessonWhere(
  lessonId: string,
  userId: string,
  includeOwnerPreview: boolean,
  programId?: string,
) {
  return {
    id: lessonId,
    OR: [
      {
        isPublished: true,
        module: {
          isPublished: true,
          stage: {
            isPublished: true,
            program: {
              ...(programId ? { id: programId } : {}),
              ...learningProgramWhere(userId),
            },
          },
        },
      },
      ...(includeOwnerPreview
        ? [{
            module: {
              stage: {
                program: {
                  ...(programId ? { id: programId } : {}),
                  ...previewProgramWhere(userId),
                },
              },
            },
          }]
        : []),
    ],
  };
}

export function createPrismaNotesRepository(
  client: PrismaClient,
): NotesRepository {
  return {
    async create(input) {
      const { includeOwnerPreview = false, ...data } = input;
      const findByCreationKey = () => data.creationKey
        ? client.note.findUnique({
            where: {
              userId_creationKey: {
                creationKey: data.creationKey,
                userId: data.userId,
              },
            },
            select: noteSelect,
          })
        : Promise.resolve(null);
      const assertSameContext = (note: NoteRecord) => {
        if (
          note.lesson?.id !== data.lessonId ||
          note.sequenceItem?.id !== data.sequenceItemId
        ) {
          throw invalidNoteRequest();
        }
        return note;
      };

      try {
        return await runSerializableProgressTransaction(
          client,
          async (transaction) => {
            if (data.creationKey) {
              const existing = await transaction.note.findUnique({
                where: {
                  userId_creationKey: {
                    creationKey: data.creationKey,
                    userId: data.userId,
                  },
                },
                select: noteSelect,
              });
              if (existing) return assertSameContext(existing);
            }

            if (data.lessonId && data.programId) {
              const lesson = await transaction.lesson.findFirst({
                where: linkedLessonWhere(
                  data.lessonId,
                  data.userId,
                  includeOwnerPreview,
                  data.programId,
                ),
                select: { id: true },
              });
              if (!lesson) throw noteNotFound();
            }

            if (data.sequenceItemId) {
              const sequenceItem =
                await transaction.lessonSequenceItem.findFirst({
                  where: {
                    id: data.sequenceItemId,
                    lessonId: data.lessonId ?? '',
                  },
                  select: { id: true },
                });
              if (!sequenceItem) throw noteNotFound();
            }

            return transaction.note.create({ data, select: noteSelect });
          },
        );
      } catch (error) {
        if (!data.creationKey || !hasPrismaErrorCode(error, 'P2002')) {
          throw error;
        }
        const concurrentNote = await findByCreationKey();
        if (!concurrentNote) throw error;
        return assertSameContext(concurrentNote);
      }
    },
    async deleteOwned(noteId, userId) {
      const result = await client.note.deleteMany({
        where: { id: noteId, userId },
      });
      return result.count === 1;
    },
    async findLessonForUser(lessonId, userId, canPreview) {
      const lesson = await client.lesson.findFirst({
        where: linkedLessonWhere(lessonId, userId, canPreview),
        select: {
          id: true,
          module: { select: { stage: { select: { programId: true } } } },
        },
      });
      return lesson
        ? { id: lesson.id, programId: lesson.module.stage.programId }
        : null;
    },
    async findOwned(noteId, userId) {
      return client.note.findFirst({
        where: { id: noteId, userId },
        select: noteSelect,
      });
    },
    async list(input) {
      const search = input.search?.trim() || undefined;
      const context = `${input.userId}:${input.lessonId ?? ''}:${search ?? ''}`;
      const cursor = parseCursor(input.cursor, 'notes', context);
      const cursorDate = cursor ? new Date(cursor.value) : undefined;
      if (cursorDate && Number.isNaN(cursorDate.getTime())) {
        throw new InvalidCursorError();
      }
      const records = await client.note.findMany({
        where: {
          userId: input.userId,
          ...(input.lessonId ? { lessonId: input.lessonId } : {}),
          ...(search ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { markdown: { contains: search, mode: 'insensitive' } },
              ],
            } : {}),
          ...(cursor && cursorDate ? {
              AND: [{
                OR: [
                  { updatedAt: { lt: cursorDate } },
                  { id: { lt: cursor.id }, updatedAt: cursorDate },
                ],
              }],
            } : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: noteSelect,
        take: input.pageSize + 1,
      });
      return toCursorPage(records, input.pageSize, (record) =>
        encodeCursor('notes', context, {
          id: record.id,
          value: record.updatedAt.toISOString(),
        }),
      );
    },
    async update(input) {
      const { id, ...data } = input;
      return client.note.update({
        where: { id },
        data,
        select: noteSelect,
      });
    },
  };
}
