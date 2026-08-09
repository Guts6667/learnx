import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { type PrismaClient } from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import {
  assertCapability,
  requireCapability,
} from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  cursorPageQuerySchema,
  encodeCursor,
  InvalidCursorError,
  parseCursor,
  toCursorPage,
  type CursorPage,
} from '../_lib/cursor-pagination.js';
import {
  learningProgramWhere,
  previewProgramWhere,
} from '../_lib/program-access-policy.js';
import { runSerializableProgressTransaction } from '../_lib/progress-recalculation.js';

interface NoteContext {
  id: string;
  slug: string;
  title: string;
}

interface NoteActivityContext {
  id: string;
  key: string;
  kind: string;
}

interface NoteRecord {
  createdAt: Date;
  id: string;
  lesson: NoteContext | null;
  markdown: string;
  program: NoteContext | null;
  sequenceItem: NoteActivityContext | null;
  title: string;
  updatedAt: Date;
}

interface CreateNoteInput {
  creationKey: string | null;
  includeOwnerPreview?: boolean;
  lessonId: string | null;
  markdown: string;
  programId: string | null;
  sequenceItemId: string | null;
  title: string;
  userId: string;
}

interface UpdateNoteInput {
  id: string;
  markdown?: string;
  title?: string;
}

export interface NotesRepository {
  create(input: CreateNoteInput): Promise<NoteRecord>;
  deleteOwned(noteId: string, userId: string): Promise<boolean>;
  findLessonForUser(
    lessonId: string,
    userId: string,
    canPreview: boolean,
  ): Promise<{ id: string; programId: string } | null>;
  findOwned(noteId: string, userId: string): Promise<NoteRecord | null>;
  list(input: {
    cursor?: string;
    lessonId?: string;
    pageSize: number;
    search?: string;
    userId: string;
  }): Promise<CursorPage<NoteRecord>>;
  update(input: UpdateNoteInput): Promise<NoteRecord>;
}

interface NotesAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  repository?: NotesRepository;
}

const identifierSchema = z.uuid();
const listSchema = cursorPageQuerySchema.extend({
  lessonId: identifierSchema.optional(),
  search: z.string().trim().max(100).optional(),
});
const createSchema = z.object({
  creationKey: identifierSchema.nullable().optional(),
  lessonId: identifierSchema.nullable().optional(),
  markdown: z.string().max(100_000).default(''),
  sequenceItemId: identifierSchema.nullable().optional(),
  title: z.string().trim().min(1).max(200).default('Nouvelle note'),
}).refine((input) => !input.sequenceItemId || Boolean(input.lessonId));
const updateSchema = z
  .object({
    markdown: z.string().max(100_000).optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((input) => input.markdown !== undefined || input.title !== undefined);

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

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function parseIdentifier(value: string): string {
  const result = identifierSchema.safeParse(value);

  if (!result.success) throw invalidRequest();

  return result.data;
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

function serializeNote(note: NoteRecord) {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
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

export function createPrismaNotesRepository(
  client: PrismaClient,
): NotesRepository {
  return {
    async create(input) {
      const { includeOwnerPreview = false, ...data } = input;
      const findByCreationKey = () =>
        data.creationKey
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
          throw invalidRequest();
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
              if (!lesson) throw notFound();
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
              if (!sequenceItem) throw notFound();
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

async function getPrismaRepository(): Promise<NotesRepository> {
  const { prisma } = await import('../../prisma.js');

  return createPrismaNotesRepository(prisma);
}

export function createNotesApp(options: NotesAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  let defaultRepository: NotesRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= await getPrismaRepository();
    return defaultRepository;
  };

  app.use('*', options.authentication ?? requireUser);
  app.use('*', requireCapability('learning.read'));
  app.onError((error, context) => {
    if (error instanceof InvalidCursorError) {
      const apiError = invalidRequest();
      return context.json(toApiErrorBody(apiError), apiError.status);
    }
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }

    console.error(error);
    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.get('/api/notes', async (context) => {
    const parsed = listSchema.safeParse(context.req.query());

    if (!parsed.success) throw invalidRequest();

    const page = await (await getRepository()).list({
      ...parsed.data,
      search: parsed.data.search || undefined,
      userId: context.get('user').id,
    });

    return context.json({
      nextCursor: page.nextCursor,
      notes: page.items.map(serializeNote),
    });
  });

  app.post('/api/notes', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const parsed = createSchema.safeParse(await parseJson(context.req.raw));

    if (!parsed.success) throw invalidRequest();

    const repository = await getRepository();
    const userId = context.get('user').id;
    const lesson = parsed.data.lessonId
      ? await repository.findLessonForUser(
          parsed.data.lessonId,
          userId,
          true,
        )
      : null;

    if (parsed.data.lessonId && !lesson) throw notFound();

    const note = await repository.create({
      creationKey: parsed.data.creationKey ?? null,
      includeOwnerPreview: true,
      lessonId: lesson?.id ?? null,
      markdown: parsed.data.markdown,
      programId: lesson?.programId ?? null,
      sequenceItemId: parsed.data.sequenceItemId ?? null,
      title: parsed.data.title,
      userId,
    });

    return context.json({ note: serializeNote(note) }, 201);
  });

  app.get('/api/notes/:noteId', async (context) => {
    const noteId = parseIdentifier(context.req.param('noteId'));
    const note = await (
      await getRepository()
    ).findOwned(noteId, context.get('user').id);

    if (!note) throw notFound();

    return context.json({ note: serializeNote(note) });
  });

  app.patch('/api/notes/:noteId', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const noteId = parseIdentifier(context.req.param('noteId'));
    const parsed = updateSchema.safeParse(await parseJson(context.req.raw));

    if (!parsed.success) throw invalidRequest();

    const repository = await getRepository();
    const note = await repository.findOwned(noteId, context.get('user').id);

    if (!note) throw notFound();

    const updatedNote = await repository.update({ id: noteId, ...parsed.data });

    return context.json({ note: serializeNote(updatedNote) });
  });

  app.delete('/api/notes/:noteId', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const noteId = parseIdentifier(context.req.param('noteId'));
    const deleted = await (
      await getRepository()
    ).deleteOwned(noteId, context.get('user').id);

    if (!deleted) throw notFound();

    return context.body(null, 204);
  });

  return app;
}

export const notesApp = createNotesApp();
