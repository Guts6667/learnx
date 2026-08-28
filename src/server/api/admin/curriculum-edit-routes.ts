import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import type { AdminDependencies } from './app-contracts.js';
import {
  lessonNotReady,
  lessonUpdateSchema,
  moduleUpdateSchema,
  notFound,
  parseBody,
  parseIdentifier,
} from './validation.js';

export function registerCurriculumEditRoutes(
  app: Hono<AuthEnvironment>,
  dependencies: AdminDependencies,
) {
  app.patch('/api/admin/modules/:moduleId', async (context) => {
    assertCapability(context.get('user').role, 'program.admin.edit');
    const moduleId = parseIdentifier(context.req.param('moduleId'));
    const input = await parseBody(moduleUpdateSchema, context.req.raw);
    const result = await (
      await dependencies.curriculumEdit()
    ).updateModule(context.get('user').id, moduleId, input);
    if (result.kind !== 'APPLIED') throw notFound();
    return context.json({ module: result.value });
  });

  app.patch('/api/admin/lessons/:lessonId', async (context) => {
    assertCapability(context.get('user').role, 'program.admin.edit');
    const lessonId = parseIdentifier(context.req.param('lessonId'));
    const input = await parseBody(lessonUpdateSchema, context.req.raw);
    const result = await (
      await dependencies.curriculumEdit()
    ).updateLesson(context.get('user').id, lessonId, input);
    if (result.kind === 'LESSON_NOT_READY') throw lessonNotReady();
    if (result.kind !== 'APPLIED') throw notFound();
    return context.json({ lesson: result.value });
  });
}
