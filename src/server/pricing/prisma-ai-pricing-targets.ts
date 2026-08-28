import type { PrismaClient } from '../../../generated/prisma/client.js';
import { getCorrectionContractRuntimeEligibility } from '../../lib/ai-correction-contracts.js';
import { resolveExerciseCorrectionContract } from '../../lib/exercise-correction-contracts.js';
import { toIntlLocale } from '../../shared/locale.js';
import {
  AiPricingError,
  type AiPricingTarget,
  type PricingTargetSnapshot,
} from './ai-pricing.js';

function targetSnapshot(input: {
  contract: unknown;
  content: string | null;
  locale: string;
  target: AiPricingTarget;
}): PricingTargetSnapshot {
  const eligibility = getCorrectionContractRuntimeEligibility(input.contract);
  if (!eligibility.eligible) throw new AiPricingError('TARGET_NOT_ELIGIBLE');
  return {
    contract: eligibility.contract,
    inputChars: input.content?.length ?? 0,
    language: toIntlLocale(input.locale === 'en' ? 'en' : 'fr'),
    target: input.target,
  };
}

function exerciseTargetSnapshot(input: {
  activityKey: string;
  activityType: string;
  content: string | null;
  contract: unknown;
  instructions: string;
  lessonObjectives: unknown;
  lessonSlug: string;
  lessonSummary: string;
  locale: string;
  programSlug: string;
  target: AiPricingTarget;
  title: string;
}): PricingTargetSnapshot {
  const language = toIntlLocale(input.locale === 'en' ? 'en' : 'fr');
  const resolution = resolveExerciseCorrectionContract({
    activityKey: input.activityKey,
    activityType: input.activityType,
    explicitContract: input.contract,
    instructions: input.instructions,
    language,
    lessonObjectives: Array.isArray(input.lessonObjectives)
      ? input.lessonObjectives.filter(
          (objective): objective is string => typeof objective === 'string',
        )
      : [],
    lessonSlug: input.lessonSlug,
    lessonSummary: input.lessonSummary,
    programSlug: input.programSlug,
    title: input.title,
  });
  if (!resolution.eligible) throw new AiPricingError('TARGET_NOT_ELIGIBLE');
  return {
    contract: resolution.contract,
    inputChars: input.content?.length ?? 0,
    language,
    target: input.target,
  };
}

async function resolveReconsideration(
  prisma: PrismaClient,
  userId: string,
  target: Extract<AiPricingTarget, { kind: 'EXERCISE_SUBMISSION' }>,
) {
  const reconsideration = target.reconsideration;
  if (!reconsideration) return null;
  const source = await prisma.aiCorrection.findFirst({
    include: {
      creditReservation: { select: { settledAmount: true, status: true } },
      pricingQuote: { select: { action: true, language: true } },
      reconsideration: { select: { id: true } },
    },
    where: {
      exerciseSubmissionId: target.id,
      id: reconsideration.sourceCorrectionId,
      userId,
    },
  });
  const submission = (source?.submissionSnapshot ?? {}) as { text?: unknown };
  if (
    !source ||
    source.pricingQuote?.action !== 'STANDARD' ||
    source.reconsideration ||
    source.creditReservation?.status !== 'SETTLED' ||
    source.creditReservation.settledAmount === null ||
    typeof submission.text !== 'string'
  )
    return null;
  const eligibility = getCorrectionContractRuntimeEligibility(
    source.contractSnapshot,
  );
  if (!eligibility.eligible) return null;
  return {
    contract: eligibility.contract,
    inputChars: submission.text.length,
    language: source.pricingQuote.language,
    reconsideration,
    target,
  };
}

async function resolveExercise(
  prisma: PrismaClient,
  userId: string,
  target: Extract<AiPricingTarget, { kind: 'EXERCISE_SUBMISSION' }>,
) {
  if (target.reconsideration)
    return resolveReconsideration(prisma, userId, target);
  const submission = await prisma.exerciseSubmission.findFirst({
    where: { id: target.id, userId, status: { not: 'DRAFT' } },
    select: {
      contentMarkdown: true,
      exercise: {
        select: {
          activityType: true,
          instructions: true,
          key: true,
          rubric: true,
          title: true,
          lesson: {
            select: {
              objectives: true,
              slug: true,
              summary: true,
              module: {
                select: {
                  stage: {
                    select: {
                      program: { select: { locale: true, slug: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return submission
    ? exerciseTargetSnapshot({
        activityKey: submission.exercise.key,
        activityType: submission.exercise.activityType,
        content: submission.contentMarkdown,
        contract: submission.exercise.rubric,
        instructions: submission.exercise.instructions,
        lessonObjectives: submission.exercise.lesson.objectives,
        lessonSlug: submission.exercise.lesson.slug,
        lessonSummary: submission.exercise.lesson.summary,
        locale: submission.exercise.lesson.module.stage.program.locale,
        programSlug: submission.exercise.lesson.module.stage.program.slug,
        target,
        title: submission.exercise.title,
      })
    : null;
}

export async function resolvePricingTarget(
  prisma: PrismaClient,
  userId: string,
  target: AiPricingTarget,
): Promise<PricingTargetSnapshot | null> {
  if (target.kind === 'EXERCISE_SUBMISSION')
    return resolveExercise(prisma, userId, target);
  const submission = await prisma.stageAssessmentSubmission.findFirst({
    where: { id: target.id, userId, status: { not: 'DRAFT' } },
    select: {
      contentMarkdown: true,
      stageAssessment: {
        select: {
          rubric: true,
          stage: { select: { program: { select: { locale: true } } } },
        },
      },
    },
  });
  return submission
    ? targetSnapshot({
        content: submission.contentMarkdown,
        contract: submission.stageAssessment.rubric,
        locale: submission.stageAssessment.stage.program.locale,
        target,
      })
    : null;
}
