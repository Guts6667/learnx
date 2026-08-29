import type {
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/client.js';
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
import type { CreateNoteInput, NoteRecord, NotesRepository } from './types.js';
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
        ? [
            {
              module: {
                stage: {
                  program: {
                    ...(programId ? { id: programId } : {}),
                    ...previewProgramWhere(userId),
                  },
                },
              },
            },
          ]
        : []),
    ],
  };
}

type NoteCreateData = Omit<CreateNoteInput, 'includeOwnerPreview'>;

function creationKeyWhere(data: NoteCreateData) {
  return data.creationKey
    ? {
        userId_creationKey: {
          creationKey: data.creationKey,
          userId: data.userId,
        },
      }
    : null;
}

function assertSameNoteContext(note: NoteRecord, data: NoteCreateData) {
  if (
    note.lesson?.id !== data.lessonId ||
    note.sequenceItem?.id !== data.sequenceItemId
  ) {
    throw invalidNoteRequest();
  }
  return note;
}

async function assertLinkedContext(
  transaction: Prisma.TransactionClient,
  data: NoteCreateData,
  includeOwnerPreview: boolean,
) {
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
    const sequenceItem = await transaction.lessonSequenceItem.findFirst({
      where: { id: data.sequenceItemId, lessonId: data.lessonId ?? '' },
      select: { id: true },
    });
    if (!sequenceItem) throw noteNotFound();
  }
}

async function createNoteInTransaction(
  transaction: Prisma.TransactionClient,
  data: NoteCreateData,
  includeOwnerPreview: boolean,
) {
  const creationKey = creationKeyWhere(data);
  if (creationKey) {
    const existing = await transaction.note.findUnique({
      where: creationKey,
      select: noteSelect,
    });
    if (existing) return assertSameNoteContext(existing, data);
  }
  await assertLinkedContext(transaction, data, includeOwnerPreview);
  return transaction.note.create({ data, select: noteSelect });
}

async function createNote(client: PrismaClient, input: CreateNoteInput) {
  const { includeOwnerPreview = false, ...data } = input;
  try {
    return await runSerializableProgressTransaction(client, (transaction) =>
      createNoteInTransaction(transaction, data, includeOwnerPreview),
    );
  } catch (error) {
    const creationKey = creationKeyWhere(data);
    if (!creationKey || !hasPrismaErrorCode(error, 'P2002')) throw error;
    const concurrentNote = await client.note.findUnique({
      where: creationKey,
      select: noteSelect,
    });
    if (!concurrentNote) throw error;
    return assertSameNoteContext(concurrentNote, data);
  }
}

async function listNotes(
  client: PrismaClient,
  input: Parameters<NotesRepository['list']>[0],
) {
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
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { markdown: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(cursor && cursorDate
        ? {
            AND: [
              {
                OR: [
                  { updatedAt: { lt: cursorDate } },
                  { id: { lt: cursor.id }, updatedAt: cursorDate },
                ],
              },
            ],
          }
        : {}),
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
}

class PrismaNotesRepository implements NotesRepository {
  constructor(private readonly client: PrismaClient) {}

  create(input: CreateNoteInput) {
    return createNote(this.client, input);
  }

  async deleteOwned(noteId: string, userId: string) {
    const result = await this.client.note.deleteMany({
      where: { id: noteId, userId },
    });
    return result.count === 1;
  }

  async findLessonForUser(
    lessonId: string,
    userId: string,
    canPreview: boolean,
  ) {
    const lesson = await this.client.lesson.findFirst({
      where: linkedLessonWhere(lessonId, userId, canPreview),
      select: {
        id: true,
        module: { select: { stage: { select: { programId: true } } } },
      },
    });
    return lesson
      ? { id: lesson.id, programId: lesson.module.stage.programId }
      : null;
  }

  findOwned(noteId: string, userId: string) {
    return this.client.note.findFirst({
      where: { id: noteId, userId },
      select: noteSelect,
    });
  }

  list(input: Parameters<NotesRepository['list']>[0]) {
    return listNotes(this.client, input);
  }

  update(input: Parameters<NotesRepository['update']>[0]) {
    const { id, ...data } = input;
    return this.client.note.update({ where: { id }, data, select: noteSelect });
  }
}

export function createPrismaNotesRepository(
  client: PrismaClient,
): NotesRepository {
  return new PrismaNotesRepository(client);
}
