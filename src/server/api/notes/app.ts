import { Hono } from 'hono';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { InvalidCursorError } from '../_lib/cursor-pagination.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { createPrismaNotesRepository } from './repository.js';
import {
  registerNoteCollectionRoutes,
  registerNoteMemberRoutes,
} from './routes.js';
import { createNotesService } from './service.js';
import type { NotesAppOptions, NotesRepository } from './types.js';
import { invalidNoteRequest } from './validation.js';

export type { NotesRepository } from './types.js';
export { createPrismaNotesRepository } from './repository.js';

async function getPrismaRepository(): Promise<NotesRepository> {
  const { prisma } = await import('../../prisma.js');
  return createPrismaNotesRepository(prisma);
}

function createNotesServiceAccessor(options: NotesAppOptions) {
  let defaultRepository: NotesRepository | undefined;
  return async () => {
    const repository =
      options.repository ?? (defaultRepository ??= await getPrismaRepository());
    return createNotesService(repository);
  };
}

function installNotesErrorHandling(app: Hono<AuthEnvironment>) {
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
}

export function createNotesApp(options: NotesAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const getService = createNotesServiceAccessor(options);
  // Scoped to the routes this app serves, never `*`: a wildcard guard runs for
  // every request reaching the app and so authenticates whatever is mounted
  // after it (V4.5-186). A route missing from this list is unguarded, and
  // `route-guards.test.ts` names it.
  const guardedPaths = ['/api/notes', '/api/notes/:noteId'] as const;

  for (const path of guardedPaths) {
    app.use(path, options.authentication ?? requireUser);
    app.use(path, requireCapability('learning.read'));
  }
  installNotesErrorHandling(app);
  registerNoteCollectionRoutes(app, getService);
  registerNoteMemberRoutes(app, getService);

  return app;
}

export const notesApp = createNotesApp();
