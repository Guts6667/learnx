import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import type { AdminDependencies } from './app-contracts.js';
import { notFound, parseIdentifier } from './validation.js';

export function registerNavigationRoutes(
  app: Hono<AuthEnvironment>,
  dependencies: AdminDependencies,
) {
  app.get('/api/admin/programs', async (context) => {
    const programs = await (
      await dependencies.navigation()
    ).listPrograms(context.get('user').id);
    return context.json({ kind: 'PROGRAMS', programs });
  });

  app.get('/api/admin/programs/:programId', async (context) => {
    const program = await (
      await dependencies.navigation()
    ).findProgram(
      parseIdentifier(context.req.param('programId')),
      context.get('user').id,
    );
    if (!program) throw notFound();
    return context.json({ kind: 'PROGRAM', program });
  });

  app.get('/api/admin/stages/:stageId', async (context) => {
    const stage = await (
      await dependencies.navigation()
    ).findStage(
      parseIdentifier(context.req.param('stageId')),
      context.get('user').id,
    );
    if (!stage) throw notFound();
    return context.json({ kind: 'STAGE', stage });
  });

  app.get('/api/admin/modules/:moduleId', async (context) => {
    const module = await (
      await dependencies.navigation()
    ).findModule(
      parseIdentifier(context.req.param('moduleId')),
      context.get('user').id,
    );
    if (!module) throw notFound();
    return context.json({ kind: 'MODULE', module });
  });

  app.get('/api/admin/lessons/:lessonId', async (context) => {
    const lesson = await (
      await dependencies.navigation()
    ).findLesson(
      parseIdentifier(context.req.param('lessonId')),
      context.get('user').id,
    );
    if (!lesson) throw notFound();
    return context.json({ kind: 'LESSON', lesson });
  });
}

