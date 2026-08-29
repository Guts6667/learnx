import { Hono } from 'hono';

import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { getStageValidation } from '../_lib/stage-validation.js';
import {
  getProgramTimeline,
  getStageTimeline,
} from '../_lib/timeline-progress.js';
import { createCurriculumService } from './service.js';
import type { CurriculumAppOptions } from './types.js';
import {
  invalidCurriculumRequest,
  isPreviewRequest,
  programViewPreferenceSchema,
} from './validation.js';
import {
  readProgramViewPreference,
  saveProgramViewPreference,
} from './view-preference-repository.js';

export { getRecommendedExpandedStageId } from './serialization.js';

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../prisma.js');
  return prisma;
}

export function createCurriculumApp(options: CurriculumAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const getClient = options.getClient ?? getPrismaClient;
  const getService = async () =>
    createCurriculumService({
      client: await getClient(),
      readProgramTimeline: options.readProgramTimeline ?? getProgramTimeline,
      readProgramViewPreference:
        options.readProgramViewPreference ?? readProgramViewPreference,
      readStageTimeline: options.readStageTimeline ?? getStageTimeline,
      readStageValidation: options.readStageValidation ?? getStageValidation,
      saveProgramViewPreference:
        options.saveProgramViewPreference ?? saveProgramViewPreference,
    });

  app.use('*', options.authentication ?? requireUser);
  app.use('*', requireCapability('learning.read'));
  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }
    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.get('/api/programs', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const programs = await (
      await getService()
    ).listPrograms(context.get('user').id, preview);
    return context.json({ programs });
  });

  app.get('/api/programs/:programSlug', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const program = await (
      await getService()
    ).readProgram(
      context.req.param('programSlug'),
      context.get('user').id,
      preview,
    );
    return context.json({ program });
  });

  app.put('/api/programs/:programSlug/view-preference', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const parsedBody = programViewPreferenceSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsedBody.success) throw invalidCurriculumRequest();
    const viewPreference = await (
      await getService()
    ).saveViewPreference(
      context.req.param('programSlug'),
      context.get('user').id,
      parsedBody.data.expandedStageId,
      preview,
    );
    return context.json({ viewPreference });
  });

  app.get('/api/programs/:programSlug/stages/:stageSlug', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const stage = await (
      await getService()
    ).readStage(
      context.req.param('programSlug'),
      context.req.param('stageSlug'),
      context.get('user').id,
      preview,
    );
    return context.json({ stage });
  });

  app.get('/api/modules/:moduleSlug', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const module = await (
      await getService()
    ).readModule(
      context.req.param('moduleSlug'),
      context.get('user').id,
      preview,
    );
    return context.json({ module });
  });

  app.get('/api/lessons/:lessonSlug', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const lesson = await (
      await getService()
    ).readLesson(
      context.req.param('lessonSlug'),
      context.get('user').id,
      preview,
    );
    return context.json({ lesson });
  });

  return app;
}

export const curriculumApp = createCurriculumApp();
