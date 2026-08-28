import { Hono } from 'hono';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import {
  assertCapability,
  requireCapability,
} from '../_lib/authorization.js';
import { InvalidCursorError } from '../_lib/cursor-pagination.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { createPrismaNotesRepository } from './repository.js';
import { serializeNote } from './service.js';
import type { NotesAppOptions, NotesRepository } from './types.js';
import {
  createNoteSchema,
  invalidNoteRequest,
  noteListSchema,
  noteNotFound,
  parseNoteIdentifier,
  parseNoteJson,
  updateNoteSchema,
} from './validation.js';

export type { NotesRepository } from './types.js';
export { createPrismaNotesRepository } from './repository.js';

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
      const apiError = invalidNoteRequest();
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
    const parsed = noteListSchema.safeParse(context.req.query());
    if (!parsed.success) throw invalidNoteRequest();
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
    const parsed = createNoteSchema.safeParse(
      await parseNoteJson(context.req.raw),
    );
    if (!parsed.success) throw invalidNoteRequest();

    const repository = await getRepository();
    const userId = context.get('user').id;
    const lesson = parsed.data.lessonId
      ? await repository.findLessonForUser(parsed.data.lessonId, userId, true)
      : null;
    if (parsed.data.lessonId && !lesson) throw noteNotFound();
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
    const note = await (await getRepository()).findOwned(
      parseNoteIdentifier(context.req.param('noteId')),
      context.get('user').id,
    );
    if (!note) throw noteNotFound();
    return context.json({ note: serializeNote(note) });
  });

  app.patch('/api/notes/:noteId', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const noteId = parseNoteIdentifier(context.req.param('noteId'));
    const parsed = updateNoteSchema.safeParse(
      await parseNoteJson(context.req.raw),
    );
    if (!parsed.success) throw invalidNoteRequest();
    const repository = await getRepository();
    if (!await repository.findOwned(noteId, context.get('user').id)) {
      throw noteNotFound();
    }
    const note = await repository.update({ id: noteId, ...parsed.data });
    return context.json({ note: serializeNote(note) });
  });

  app.delete('/api/notes/:noteId', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const deleted = await (await getRepository()).deleteOwned(
      parseNoteIdentifier(context.req.param('noteId')),
      context.get('user').id,
    );
    if (!deleted) throw noteNotFound();
    return context.body(null, 204);
  });

  return app;
}

export const notesApp = createNotesApp();
