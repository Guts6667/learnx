import type { MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../_lib/auth';
import {
  createStageAssessmentsApp,
  type StageAssessmentRepository,
} from './app';

const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const otherUserId = 'f3c7c0f0-7cc6-49ec-b841-095696d75416';
const stageId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';
const assessmentId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const submissionId = '5cb04580-f91c-46e8-a5d3-d70be5043c1b';
const now = new Date('2026-08-02T23:30:00.000Z');

function authentication(
  id = userId,
  role: 'ADMIN' | 'USER' = 'USER',
): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Learner',
      email: 'learner@example.com',
      id,
      role,
    });
    await next();
  };
}

function createRepository() {
  let published = true;
  let submission = {
    attachmentUrl: null as string | null,
    contentMarkdown: null as string | null,
    createdAt: now,
    id: submissionId,
    reviewFeedback: null as string | null,
    reviewedAt: null as Date | null,
    score: null as number | null,
    stageAssessmentId: assessmentId,
    status: 'DRAFT' as 'DRAFT' | 'NEEDS_REVISION' | 'SUBMITTED' | 'VALIDATED',
    submittedAt: null as Date | null,
    updatedAt: now,
    userId,
  };
  const repository: StageAssessmentRepository = {
    async createOrGetSubmission(requestedAssessmentId, requestedUserId) {
      if (
        requestedAssessmentId !== assessmentId ||
        requestedUserId !== userId
      ) {
        throw new Error('Unexpected create.');
      }
      return submission;
    },
    async findAssessmentForUser(requestedStageId, requestedUserId, preview) {
      if (
        requestedStageId !== stageId ||
        requestedUserId !== userId ||
        (!published && !preview)
      ) {
        return null;
      }
      return {
        description: null,
        id: assessmentId,
        instructions: null,
        isRequired: true,
        passingScore: 70,
        position: 1,
        rubric: null,
        stageId,
        submission,
        title: 'Évaluation finale',
        type: 'CASE_STUDY',
      };
    },
    async findOwnedSubmission(requestedSubmissionId, requestedUserId) {
      return requestedSubmissionId === submissionId &&
        requestedUserId === submission.userId
        ? submission
        : null;
    },
    async findPublishedAssessmentForUser(
      requestedAssessmentId,
      requestedUserId,
    ) {
      return published &&
        requestedAssessmentId === assessmentId &&
        requestedUserId === userId
        ? { id: assessmentId }
        : null;
    },
    async findSubmissionForReview(requestedSubmissionId) {
      return requestedSubmissionId === submissionId
        ? { passingScore: 70, stageId, submission }
        : null;
    },
    async reviewSubmission(input) {
      submission = {
        ...submission,
        reviewFeedback: input.reviewFeedback,
        reviewedAt: input.reviewedAt,
        score: input.score,
        status: input.status,
      };
      return submission;
    },
    async saveSubmission(input) {
      submission = {
        ...submission,
        attachmentUrl: input.attachmentUrl ?? submission.attachmentUrl,
        contentMarkdown: input.contentMarkdown ?? submission.contentMarkdown,
      };
      return submission;
    },
    async submitSubmission(_id, submittedAt) {
      submission = { ...submission, status: 'SUBMITTED', submittedAt };
      return submission;
    },
  };

  return {
    getSubmission: () => submission,
    repository,
    setPublished(value: boolean) {
      published = value;
    },
    setSubmissionStatus(
      status: 'DRAFT' | 'NEEDS_REVISION' | 'SUBMITTED' | 'VALIDATED',
    ) {
      submission = { ...submission, status };
    },
  };
}

function jsonRequest(method: 'PATCH' | 'POST', body?: unknown) {
  return {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined ? undefined : { 'content-type': 'application/json' },
    method,
  };
}

describe('stage assessment API', () => {
  it('only exposes a draft assessment through owner preview', async () => {
    const state = createRepository();
    state.setPublished(false);
    const app = createStageAssessmentsApp({
      authentication: authentication(),
      repository: state.repository,
    });

    expect(
      (await app.request(`/api/stages/${stageId}/assessment`)).status,
    ).toBe(404);
    const preview = await app.request(
      `/api/stages/${stageId}/assessment?preview=true`,
    );
    expect(preview.status).toBe(200);
    await expect(preview.json()).resolves.toMatchObject({
      assessment: { id: assessmentId, title: 'Évaluation finale' },
    });
  });

  it('does not create a submission for another owner or a draft stage', async () => {
    const state = createRepository();
    const otherApp = createStageAssessmentsApp({
      authentication: authentication(otherUserId),
      repository: state.repository,
    });
    expect(
      (
        await otherApp.request(
          `/api/stage-assessments/${assessmentId}/submissions`,
          jsonRequest('POST'),
        )
      ).status,
    ).toBe(404);

    state.setPublished(false);
    const ownerApp = createStageAssessmentsApp({
      authentication: authentication(),
      repository: state.repository,
    });
    expect(
      (
        await ownerApp.request(
          `/api/stage-assessments/${assessmentId}/submissions`,
          jsonRequest('POST'),
        )
      ).status,
    ).toBe(404);
  });

  it('saves and submits owned work', async () => {
    const state = createRepository();
    const app = createStageAssessmentsApp({
      authentication: authentication(),
      now: () => now,
      repository: state.repository,
    });
    const saveResponse = await app.request(
      `/api/stage-assessment-submissions/${submissionId}`,
      jsonRequest('PATCH', {
        action: 'save',
        contentMarkdown: 'Mon étude de cas',
      }),
    );
    expect(saveResponse.status).toBe(200);

    const submitResponse = await app.request(
      `/api/stage-assessment-submissions/${submissionId}/submit`,
      jsonRequest('POST'),
    );
    expect(submitResponse.status).toBe(200);
    expect(state.getSubmission()).toMatchObject({
      contentMarkdown: 'Mon étude de cas',
      status: 'SUBMITTED',
      submittedAt: now,
    });
  });

  it('rejects an empty submission and editing after submission', async () => {
    const state = createRepository();
    const app = createStageAssessmentsApp({
      authentication: authentication(),
      repository: state.repository,
    });
    expect(
      (
        await app.request(
          `/api/stage-assessment-submissions/${submissionId}/submit`,
          jsonRequest('POST'),
        )
      ).status,
    ).toBe(409);

    state.setSubmissionStatus('SUBMITTED');
    expect(
      (
        await app.request(
          `/api/stage-assessment-submissions/${submissionId}`,
          jsonRequest('PATCH', {
            action: 'save',
            contentMarkdown: 'Modification tardive',
          }),
        )
      ).status,
    ).toBe(409);
  });

  it('reserves validation and revision requests for administrators', async () => {
    const state = createRepository();
    state.setSubmissionStatus('SUBMITTED');
    const learnerApp = createStageAssessmentsApp({
      authentication: authentication(),
      repository: state.repository,
    });
    expect(
      (
        await learnerApp.request(
          `/api/stage-assessment-submissions/${submissionId}`,
          jsonRequest('PATCH', { action: 'validate', score: 82 }),
        )
      ).status,
    ).toBe(403);

    const refreshValidation = vi.fn(async () => undefined);
    const adminApp = createStageAssessmentsApp({
      authentication: authentication(userId, 'ADMIN'),
      now: () => now,
      refreshValidation,
      repository: state.repository,
    });
    const revisionResponse = await adminApp.request(
      `/api/stage-assessment-submissions/${submissionId}`,
      jsonRequest('PATCH', {
        action: 'request_revision',
        reviewFeedback: 'Développez la comparaison.',
        score: 55,
      }),
    );
    expect(revisionResponse.status).toBe(200);
    expect(state.getSubmission()).toMatchObject({
      reviewFeedback: 'Développez la comparaison.',
      reviewedAt: now,
      score: 55,
      status: 'NEEDS_REVISION',
    });
    expect(refreshValidation).toHaveBeenCalledWith(stageId, userId, now);
  });

  it('does not review work that is not submitted', async () => {
    const state = createRepository();
    const app = createStageAssessmentsApp({
      authentication: authentication(userId, 'ADMIN'),
      repository: state.repository,
    });
    const response = await app.request(
      `/api/stage-assessment-submissions/${submissionId}`,
      jsonRequest('PATCH', { action: 'validate', score: 90 }),
    );
    expect(response.status).toBe(409);
  });

  it('does not validate a score below the success threshold', async () => {
    const state = createRepository();
    state.setSubmissionStatus('SUBMITTED');
    const app = createStageAssessmentsApp({
      authentication: authentication(userId, 'ADMIN'),
      repository: state.repository,
    });
    const response = await app.request(
      `/api/stage-assessment-submissions/${submissionId}`,
      jsonRequest('PATCH', { action: 'validate', score: 69 }),
    );
    expect(response.status).toBe(400);
    expect(state.getSubmission().status).toBe('SUBMITTED');
  });
});
