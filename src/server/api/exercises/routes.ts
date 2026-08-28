import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { serializeExerciseSubmission } from './serialization.js';
import type { ExerciseService } from './types.js';
import {
  parseExerciseIdentifier,
  parseExerciseSubmissionBody,
} from './validation.js';

type GetService = () => Promise<ExerciseService>;

export function registerExerciseRoutes(
  app: Hono<AuthEnvironment>,
  getService: GetService,
): void {
  app.get('/api/exercises/:exerciseId', async (context) => {
    const exerciseId = parseExerciseIdentifier(context.req.param('exerciseId'));
    const exercise = await (
      await getService()
    ).getExercise(exerciseId, context.get('user').id);
    return context.json({
      exercise: {
        ...exercise,
        submission: exercise.submission
          ? serializeExerciseSubmission(exercise.submission)
          : null,
      },
    });
  });

  app.post('/api/exercises/:exerciseId/submissions', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const exerciseId = parseExerciseIdentifier(context.req.param('exerciseId'));
    const submission = await (
      await getService()
    ).createSubmission(exerciseId, context.get('user').id);
    return context.json(
      { submission: serializeExerciseSubmission(submission) },
      201,
    );
  });
}

export function registerExerciseSubmissionRoutes(
  app: Hono<AuthEnvironment>,
  getService: GetService,
): void {
  app.patch('/api/exercise-submissions/:submissionId', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const submissionId = parseExerciseIdentifier(
      context.req.param('submissionId'),
    );
    const input = await parseExerciseSubmissionBody(context.req.raw);
    const updated = await (
      await getService()
    ).saveSubmission(
      submissionId,
      input.contentMarkdown,
      context.get('user').id,
    );
    return context.json({ submission: serializeExerciseSubmission(updated) });
  });

  app.post(
    '/api/exercise-submissions/:submissionId/submit',
    async (context) => {
      assertCapability(context.get('user').role, 'learning.write.own');
      const submissionId = parseExerciseIdentifier(
        context.req.param('submissionId'),
      );
      const updated = await (
        await getService()
      ).submitSubmission(submissionId, context.get('user').id);
      return context.json({
        submission: serializeExerciseSubmission(updated),
      });
    },
  );
}
