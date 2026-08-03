import type { MiddlewareHandler } from 'hono';

import type { PrismaClient } from '../../generated/prisma/client';
import type { AuthEnvironment } from '../_lib/auth';
import {
  createNotesApp,
  createPrismaNotesRepository,
  type NotesRepository,
} from './app';

const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const otherUserId = 'f3c7c0f0-7cc6-49ec-b841-095696d75416';
const noteId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const lessonId = '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8';
const programId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';
const now = new Date('2026-08-03T10:00:00.000Z');

function authenticationFor(id: string): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Learner',
      email: 'learner@example.com',
      id,
      role: 'USER',
    });
    await next();
  };
}

function createRepository() {
  const owners = new Map<string, string>();
  const records = new Map<
    string,
    Awaited<ReturnType<NotesRepository['findOwned']>> & object
  >();
  const listCalls: Array<{
    lessonId: string | undefined;
    search: string | undefined;
    userId: string;
  }> = [];
  const repository: NotesRepository = {
    async create(input) {
      const id = records.size === 0 ? noteId : crypto.randomUUID();
      const record = {
        createdAt: now,
        id,
        lesson: input.lessonId
          ? { id: lessonId, slug: 'demarrer', title: 'Démarrer' }
          : null,
        markdown: input.markdown,
        program: input.programId
          ? { id: programId, slug: 'programme-test', title: 'Programme test' }
          : null,
        title: input.title,
        updatedAt: now,
      };

      owners.set(id, input.userId);
      records.set(id, record);
      return record;
    },
    async findLessonForUser(requestedLessonId, requestedUserId) {
      return requestedLessonId === lessonId && requestedUserId === userId
        ? { id: lessonId, programId }
        : null;
    },
    async findOwned(requestedNoteId, requestedUserId) {
      return owners.get(requestedNoteId) === requestedUserId
        ? (records.get(requestedNoteId) ?? null)
        : null;
    },
    async list(requestedUserId, search, requestedLessonId) {
      listCalls.push({
        lessonId: requestedLessonId,
        search,
        userId: requestedUserId,
      });
      return [...records.entries()]
        .filter(([id]) => owners.get(id) === requestedUserId)
        .map(([, record]) => record)
        .filter(
          (record) =>
            !requestedLessonId || record.lesson?.id === requestedLessonId,
        )
        .filter(
          (record) =>
            !search ||
            record.title.toLowerCase().includes(search.toLowerCase()) ||
            record.markdown.toLowerCase().includes(search.toLowerCase()),
        );
    },
    async update(input) {
      const current = records.get(input.id);

      if (!current) throw new Error('Missing test note.');

      const updated = { ...current, ...input, updatedAt: now };
      records.set(input.id, updated);
      return updated;
    },
  };

  return { listCalls, owners, records, repository };
}

function jsonRequest(body: unknown, method = 'POST') {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
  };
}

describe('notes API', () => {
  it('crée et liste une note personnelle appartenant à l’utilisateur', async () => {
    const { repository } = createRepository();
    const app = createNotesApp({
      authentication: authenticationFor(userId),
      repository,
    });
    const created = await app.request(
      'http://localhost/api/notes',
      jsonRequest({ markdown: 'Contenu', title: 'Ma note' }),
    );
    const listed = await app.request('http://localhost/api/notes');

    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      note: {
        lesson: null,
        markdown: 'Contenu',
        program: null,
        title: 'Ma note',
      },
    });
    expect(await listed.json()).toMatchObject({
      notes: [{ id: noteId, title: 'Ma note' }],
    });
  });

  it('relie une note à une leçon possédée et dérive le programme côté serveur', async () => {
    const { repository } = createRepository();
    const app = createNotesApp({
      authentication: authenticationFor(userId),
      repository,
    });
    const response = await app.request(
      'http://localhost/api/notes',
      jsonRequest({ lessonId, title: 'Note de leçon' }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      note: {
        lesson: { id: lessonId },
        program: { id: programId },
        title: 'Note de leçon',
      },
    });
  });

  it('refuse une leçon non possédée', async () => {
    const { repository } = createRepository();
    const app = createNotesApp({
      authentication: authenticationFor(otherUserId),
      repository,
    });
    const response = await app.request(
      'http://localhost/api/notes',
      jsonRequest({ lessonId, title: 'Intrusion' }),
    );

    expect(response.status).toBe(404);
  });

  it('recherche dans le titre et le Markdown et filtre par leçon', async () => {
    const { listCalls, repository } = createRepository();
    await repository.create({
      lessonId,
      markdown: 'Mémoire et attention',
      programId,
      title: 'Cognition',
      userId,
    });
    const app = createNotesApp({
      authentication: authenticationFor(userId),
      repository,
    });
    const response = await app.request(
      `http://localhost/api/notes?search=attention&lessonId=${lessonId}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      notes: [{ title: 'Cognition' }],
    });
    expect(listCalls).toEqual([{ lessonId, search: 'attention', userId }]);
  });

  it('autosauvegarde seulement une note possédée', async () => {
    const { repository } = createRepository();
    await repository.create({
      lessonId: null,
      markdown: '',
      programId: null,
      title: 'Brouillon',
      userId,
    });
    const ownerApp = createNotesApp({
      authentication: authenticationFor(userId),
      repository,
    });
    const otherApp = createNotesApp({
      authentication: authenticationFor(otherUserId),
      repository,
    });
    const updated = await ownerApp.request(
      `http://localhost/api/notes/${noteId}`,
      jsonRequest({ markdown: '# Texte', title: 'Titre final' }, 'PATCH'),
    );
    const forbidden = await otherApp.request(
      `http://localhost/api/notes/${noteId}`,
      jsonRequest({ title: 'Volée' }, 'PATCH'),
    );
    const reloaded = await ownerApp.request(
      `http://localhost/api/notes/${noteId}`,
    );

    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      note: { markdown: '# Texte', title: 'Titre final' },
    });
    expect(forbidden.status).toBe(404);
    expect(await reloaded.json()).toMatchObject({
      note: { markdown: '# Texte', title: 'Titre final' },
    });
  });

  it('refuse les requêtes anonymes et invalides', async () => {
    const { repository } = createRepository();
    const anonymousApp = createNotesApp({ repository });
    const app = createNotesApp({
      authentication: authenticationFor(userId),
      repository,
    });

    expect(
      (await anonymousApp.request('http://localhost/api/notes')).status,
    ).toBe(401);
    expect(
      (
        await app.request(
          'http://localhost/api/notes',
          jsonRequest({ title: '' }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          'http://localhost/api/notes/not-an-id',
          jsonRequest({ title: 'Titre' }, 'PATCH'),
        )
      ).status,
    ).toBe(400);
  });
});

describe('notes persistence', () => {
  it('filtre toujours la liste par userId', async () => {
    const findMany = vi.fn(async () => []);
    const client = { note: { findMany } } as unknown as PrismaClient;
    const repository = createPrismaNotesRepository(client);

    await repository.list(userId, 'mémoire', lessonId);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lessonId,
          userId,
          OR: expect.arrayContaining([
            { title: { contains: 'mémoire', mode: 'insensitive' } },
          ]),
        }),
      }),
    );
  });
});
