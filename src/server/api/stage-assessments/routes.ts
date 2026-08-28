import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { serializeSubmission } from './serialization.js';
import type { StageAssessmentService } from './service.js';
import { parseIdentifier, parsePreview, parseUpdate } from './validation.js';

type GetService = () => Promise<StageAssessmentService>;

export function registerStageAssessmentRoutes(
  app: Hono<AuthEnvironment>,
  getService: GetService,
) {
  app.get('/api/stages/:stageId/assessment', async (context) => {
    const assessment = await (
      await getService()
    ).getAssessment(
      parseIdentifier(context.req.param('stageId')),
      context.get('user').id,
      parsePreview(context.req.url),
    );
    return context.json({
      assessment: {
        ...assessment,
        submission: assessment.submission
          ? serializeSubmission(assessment.submission)
          : null,
      },
    });
  });
  app.post(
    '/api/stage-assessments/:assessmentId/submissions',
    async (context) => {
      const user = context.get('user');
      assertCapability(user.role, 'learning.write.own');
      const submission = await (
        await getService()
      ).createSubmission(
        parseIdentifier(context.req.param('assessmentId')),
        user.id,
      );
      return context.json({ submission: serializeSubmission(submission) }, 201);
    },
  );
  app.patch(
    '/api/stage-assessment-submissions/:submissionId',
    async (context) => {
      const user = context.get('user');
      const submissionId = parseIdentifier(context.req.param('submissionId'));
      const update = await parseUpdate(context.req.raw);
      const service = await getService();
      if (update.action === 'save') {
        assertCapability(user.role, 'learning.write.own');
        return context.json({
          submission: serializeSubmission(
            await service.saveSubmission(submissionId, user.id, update),
          ),
        });
      }
      assertCapability(user.role, 'learning.submission.review');
      return context.json({
        submission: serializeSubmission(
          await service.reviewSubmission(submissionId, user.id, update),
        ),
      });
    },
  );
  app.post(
    '/api/stage-assessment-submissions/:submissionId/submit',
    async (context) => {
      const user = context.get('user');
      assertCapability(user.role, 'learning.write.own');
      const submission = await (
        await getService()
      ).submitSubmission(
        parseIdentifier(context.req.param('submissionId')),
        user.id,
      );
      return context.json({ submission: serializeSubmission(submission) });
    },
  );
}
