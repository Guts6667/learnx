import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { createNotesService } from './service.js';
import {
  createNoteSchema,
  invalidNoteRequest,
  noteListSchema,
  parseNoteIdentifier,
  parseNoteJson,
  updateNoteSchema,
} from './validation.js';

type GetNotesService = () => Promise<ReturnType<typeof createNotesService>>;

export function registerNoteCollectionRoutes(
  app: Hono<AuthEnvironment>,
  getService: GetNotesService,
) {
  app.get('/api/notes', async (context) => {
    const parsed = noteListSchema.safeParse(context.req.query());
    if (!parsed.success) throw invalidNoteRequest();
    const page = await (
      await getService()
    ).list({
      ...parsed.data,
      search: parsed.data.search || undefined,
      userId: context.get('user').id,
    });
    return context.json(page);
  });

  app.post('/api/notes', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const parsed = createNoteSchema.safeParse(
      await parseNoteJson(context.req.raw),
    );
    if (!parsed.success) throw invalidNoteRequest();
    const note = await (
      await getService()
    ).create(
      {
        creationKey: parsed.data.creationKey ?? null,
        lessonId: parsed.data.lessonId,
        markdown: parsed.data.markdown,
        sequenceItemId: parsed.data.sequenceItemId ?? null,
        title: parsed.data.title,
      },
      context.get('user').id,
    );
    return context.json({ note }, 201);
  });
}

export function registerNoteMemberRoutes(
  app: Hono<AuthEnvironment>,
  getService: GetNotesService,
) {
  app.get('/api/notes/:noteId', async (context) => {
    const note = await (
      await getService()
    ).read(
      parseNoteIdentifier(context.req.param('noteId')),
      context.get('user').id,
    );
    return context.json({ note });
  });

  app.patch('/api/notes/:noteId', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const noteId = parseNoteIdentifier(context.req.param('noteId'));
    const parsed = updateNoteSchema.safeParse(
      await parseNoteJson(context.req.raw),
    );
    if (!parsed.success) throw invalidNoteRequest();
    const note = await (
      await getService()
    ).update({ id: noteId, ...parsed.data }, context.get('user').id);
    return context.json({ note });
  });

  app.delete('/api/notes/:noteId', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    await (
      await getService()
    ).delete(
      parseNoteIdentifier(context.req.param('noteId')),
      context.get('user').id,
    );
    return context.body(null, 204);
  });
}
