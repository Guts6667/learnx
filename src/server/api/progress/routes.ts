import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { serializeProgressSnapshot } from './serialization.js';
import type { createProgressService } from './service.js';
import {
  assertProgressIdentifier,
  invalidProgressRequest,
  lessonLocationSchema,
  parseProgressBody,
  resourceStatusSchema,
  scheduleSchema,
  taskStatusSchema,
} from './validation.js';

type ProgressService = ReturnType<typeof createProgressService>;
type GetProgressService = () => Promise<ProgressService>;

async function parseSchedule(request: Request): Promise<Date> {
  const input = scheduleSchema.safeParse(await parseProgressBody(request));
  if (!input.success) throw invalidProgressRequest();
  return new Date(input.data.targetEndAt);
}

export function registerTimelineRoutes(
  app: Hono<AuthEnvironment>,
  getService: GetProgressService,
): void {
  app.post('/api/programs/:programId/start', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const result = await (
      await getService()
    ).startProgram(
      assertProgressIdentifier(context.req.param('programId')),
      context.get('user').id,
      new Date(),
    );
    return context.json(result);
  });
  app.patch('/api/programs/:programId/schedule', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const result = await (
      await getService()
    ).scheduleProgram(
      assertProgressIdentifier(context.req.param('programId')),
      context.get('user').id,
      await parseSchedule(context.req.raw),
      new Date(),
    );
    return context.json(result);
  });
  app.post('/api/stages/:stageId/start', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const result = await (
      await getService()
    ).startStage(
      assertProgressIdentifier(context.req.param('stageId')),
      context.get('user').id,
      new Date(),
    );
    return context.json(result);
  });
  app.patch('/api/stages/:stageId/schedule', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const result = await (
      await getService()
    ).scheduleStage(
      assertProgressIdentifier(context.req.param('stageId')),
      context.get('user').id,
      await parseSchedule(context.req.raw),
      new Date(),
    );
    return context.json(result);
  });
}

export function registerLessonRoutes(
  app: Hono<AuthEnvironment>,
  getService: GetProgressService,
): void {
  app.get('/api/lessons/:lessonId/progress', async (context) => {
    const snapshot = await (
      await getService()
    ).getLessonProgress(
      assertProgressIdentifier(context.req.param('lessonId')),
      context.get('user').id,
    );
    return context.json(serializeProgressSnapshot(snapshot));
  });
  app.post('/api/lessons/:lessonId/start', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const snapshot = await (
      await getService()
    ).startLesson(
      assertProgressIdentifier(context.req.param('lessonId')),
      context.get('user').id,
      new Date(),
    );
    return context.json(serializeProgressSnapshot(snapshot));
  });
  app.post('/api/lessons/:lessonId/complete', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const snapshot = await (
      await getService()
    ).completeLesson(
      assertProgressIdentifier(context.req.param('lessonId')),
      context.get('user').id,
      new Date(),
    );
    return context.json(serializeProgressSnapshot(snapshot));
  });
  app.patch('/api/lessons/:lessonId/location', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const input = lessonLocationSchema.safeParse(
      await parseProgressBody(context.req.raw),
    );
    if (!input.success) throw invalidProgressRequest();
    const snapshot = await (
      await getService()
    ).saveLessonLocation(
      assertProgressIdentifier(context.req.param('lessonId')),
      context.get('user').id,
      input.data,
      new Date(),
    );
    return context.json(serializeProgressSnapshot(snapshot));
  });
}

export function registerActivityRoutes(
  app: Hono<AuthEnvironment>,
  getService: GetProgressService,
): void {
  app.patch('/api/tasks/:taskId', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const input = taskStatusSchema.safeParse(
      await parseProgressBody(context.req.raw),
    );
    if (!input.success) throw invalidProgressRequest();
    const snapshot = await (
      await getService()
    ).updateTask(
      assertProgressIdentifier(context.req.param('taskId')),
      context.get('user').id,
      input.data.status,
      new Date(),
    );
    return context.json(serializeProgressSnapshot(snapshot));
  });
  app.patch('/api/resources/:resourceId/progress', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const input = resourceStatusSchema.safeParse(
      await parseProgressBody(context.req.raw),
    );
    if (!input.success) throw invalidProgressRequest();
    const snapshot = await (
      await getService()
    ).updateResource(
      assertProgressIdentifier(context.req.param('resourceId')),
      context.get('user').id,
      input.data.status,
      new Date(),
    );
    return context.json(serializeProgressSnapshot(snapshot));
  });
}
