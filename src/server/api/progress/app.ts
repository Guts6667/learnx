import { Hono } from 'hono';

import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  getLessonProgressSnapshot,
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';
import {
  getProgramTimeline,
  getStageTimeline,
} from '../_lib/timeline-progress.js';
import {
  registerActivityRoutes,
  registerLessonRoutes,
  registerTimelineRoutes,
} from './routes.js';
import { createProgressService } from './service.js';
import type { ProgressAppOptions } from './types.js';

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../prisma.js');
  return prisma;
}

function normalizeProgressError(error: Error, ephemeral: boolean): ApiError {
  if (error instanceof ApiError) return error;
  if (ephemeral) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'UNKNOWN';
    console.error(`[integration:progress] ${code}: ${error.message}`);
  }
  return new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
}

export function createProgressApp(options: ProgressAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const getClient = options.getClient ?? getPrismaClient;
  const getService = async () =>
    createProgressService({
      client: await getClient(),
      readLessonSnapshot: getLessonProgressSnapshot,
      readProgramTimeline: getProgramTimeline,
      readStageTimeline: getStageTimeline,
      recalculateLesson: recalculateLessonProgress,
      runTransaction: runSerializableProgressTransaction,
    });

  app.use('*', options.authentication ?? requireUser);
  app.use('*', requireCapability('learning.read'));
  app.onError((error, context) => {
    const apiError = normalizeProgressError(
      error,
      process.env.LEARNX_INTEGRATION_DATABASE === 'ephemeral',
    );
    return context.json(toApiErrorBody(apiError), apiError.status);
  });
  registerTimelineRoutes(app, getService);
  registerLessonRoutes(app, getService);
  registerActivityRoutes(app, getService);
  return app;
}

export const progressApp = createProgressApp();
