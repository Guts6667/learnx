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
  learningProgramWhere,
  previewProgramWhere,
} from '../_lib/program-access-policy.js';
import { runSerializableProgressTransaction } from '../_lib/progress-recalculation.js';

interface NoteContext {
  id: string;
  slug: string;
  title: string;
}

interface NoteRecord {
  createdAt: Date;
  id: string;
  lesson: NoteContext | null;
  markdown: string;
  program: NoteContext | null;
  title: string;
  updatedAt: Date;
}

interface CreateNoteInput {
  includeOwnerPreview?: boolean;
  lessonId: string | null;
  markdown: string;
  programId: string | null;
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
  list(
    userId: string,
    search: string | undefined,
    lessonId: string | undefined,
  ): Promise<NoteRecord[]>;
  update(input: UpdateNoteInput): Promise<NoteRecord>;
}

interface NotesAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  repository?: NotesRepository;
}

const identifierSchema = z.uuid();
const listSchema = z.object({
  lessonId: identifierSchema.optional(),
  search: z.string().trim().max(100).optional(),
});
const createSchema = z.object({
  lessonId: identifierSchema.nullable().optional(),
  markdown: z.string().max(100_000).default(''),
  title: z.string().trim().min(1).max(200).default('Nouvelle note'),
});
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
  title: true,
  updatedAt: true,
} as const;

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
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
      if (!data.lessonId || !data.programId) {
        return client.note.create({ data, select: noteSelect });
      }
      const lessonId = data.lessonId;
      const programId = data.programId;

      return runSerializableProgressTransaction(client, async (transaction) => {
        const lesson = await transaction.lesson.findFirst({
          where: linkedLessonWhere(
            lessonId,
            data.userId,
            includeOwnerPreview,
            programId,
          ),
          select: { id: true },
        });
        if (!lesson) throw notFound();

        return transaction.note.create({ data, select: noteSelect });
      });
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
    async list(userId, search, lessonId) {
      return client.note.findMany({
        where: {
          userId,
          ...(lessonId ? { lessonId } : {}),
          ...(search
            ? {
                OR: [
                  { title: { contains: search, mode: 'insensitive' } },
                  { markdown: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        select: noteSelect,
      });
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

    const notes = await (
      await getRepository()
    ).list(
      context.get('user').id,
      parsed.data.search || undefined,
      parsed.data.lessonId,
    );

    return context.json({ notes: notes.map(serializeNote) });
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
      includeOwnerPreview: true,
      lessonId: lesson?.id ?? null,
      markdown: parsed.data.markdown,
      programId: lesson?.programId ?? null,
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
