import type { MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AuthEnvironment } from '../_lib/auth.js';
import { createNotesApp, type NotesRepository } from './app.js';

const userId = '11111111-1111-4111-8111-111111111111';
const noteId = '22222222-2222-4222-8222-222222222222';
const lessonId = '33333333-3333-4333-8333-333333333333';

function authentication(): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Test',
      email: 'test@example.com',
      id: userId,
      locale: 'fr',
      role: 'USER',
    });
    await next();
  };
}

function note(
  overrides: Partial<Awaited<ReturnType<NotesRepository['findOwned']>>> = {},
) {
  return {
    createdAt: new Date('2026-08-28T08:00:00.000Z'),
    id: noteId,
    lesson: null,
    markdown: 'Contenu',
    program: null,
    sequenceItem: null,
    title: 'Titre',
    updatedAt: new Date('2026-08-28T09:00:00.000Z'),
    ...overrides,
  };
}

function repository(): NotesRepository {
  return {
    create: vi.fn().mockResolvedValue(note()),
    deleteOwned: vi.fn().mockResolvedValue(true),
    findLessonForUser: vi.fn().mockResolvedValue({
      id: lessonId,
      programId: 'program-1',
    }),
    findOwned: vi.fn().mockResolvedValue(note()),
    list: vi.fn().mockResolvedValue({ items: [note()], nextCursor: null }),
    update: vi.fn().mockResolvedValue(note({ title: 'Modifié' })),
  };
}

describe('Notes API contract', () => {
  it('protège les notes avant toute lecture du repository', async () => {
    const data = repository();
    const response = await createNotesApp({ repository: data }).request(
      '/api/notes',
    );

    expect(response.status).toBe(401);
    expect(data.list).not.toHaveBeenCalled();
  });

  it('conserve pagination, filtres et sérialisation ISO', async () => {
    const data = repository();
    const response = await createNotesApp({
      authentication: authentication(),
      repository: data,
    }).request(`/api/notes?lessonId=${lessonId}&search=%20preuve%20`);

    expect(response.status).toBe(200);
    expect(data.list).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId,
        search: 'preuve',
        userId,
      }),
    );
    await expect(response.json()).resolves.toEqual({
      nextCursor: null,
      notes: [
        expect.objectContaining({
          createdAt: '2026-08-28T08:00:00.000Z',
          updatedAt: '2026-08-28T09:00:00.000Z',
        }),
      ],
    });
  });

  it('valide le contexte avant de créer une note idempotente', async () => {
    const data = repository();
    const creationKey = '44444444-4444-4444-8444-444444444444';
    const response = await createNotesApp({
      authentication: authentication(),
      repository: data,
    }).request('/api/notes', {
      body: JSON.stringify({
        creationKey,
        lessonId,
        markdown: 'Preuve',
        title: 'Observation',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(201);
    expect(data.findLessonForUser).toHaveBeenCalledWith(lessonId, userId, true);
    expect(data.create).toHaveBeenCalledWith({
      creationKey,
      includeOwnerPreview: true,
      lessonId,
      markdown: 'Preuve',
      programId: 'program-1',
      sequenceItemId: null,
      title: 'Observation',
      userId,
    });
  });

  it('refuse une mutation vide avant la mise à jour', async () => {
    const data = repository();
    const response = await createNotesApp({
      authentication: authentication(),
      repository: data,
    }).request(`/api/notes/${noteId}`, {
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    });

    expect(response.status).toBe(400);
    expect(data.update).not.toHaveBeenCalled();
  });

  it('préserve le 404 propriétaire et la suppression 204', async () => {
    const missing = repository();
    vi.mocked(missing.findOwned).mockResolvedValue(null);
    const app = createNotesApp({
      authentication: authentication(),
      repository: missing,
    });
    expect((await app.request(`/api/notes/${noteId}`)).status).toBe(404);

    const data = repository();
    const deleted = await createNotesApp({
      authentication: authentication(),
      repository: data,
    }).request(`/api/notes/${noteId}`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);
    expect(data.deleteOwned).toHaveBeenCalledWith(noteId, userId);
  });
});
