import type { PrismaClient } from '../../../generated/prisma/client.js';
import { resolveExerciseCorrectionContract } from '../../lib/exercise-correction-contracts.js';
import { resolveStageAssessmentCorrectionContract } from '../../lib/stage-assessment-correction-contracts.js';
import type { AcceptedQuoteSnapshot } from './correction-orchestration-contracts.js';
import {
  withStoredConfidence,
  type StoredCorrection,
} from './correction-outcome.js';

export class PrismaCorrectionQuoteRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  private async loadSubmission(targetId: string, userId: string) {
    return this.prisma.exerciseSubmission.findFirst({
      include: {
        exercise: {
          include: {
            lesson: {
              select: {
                objectives: true,
                slug: true,
                summary: true,
                module: {
                  select: {
                    stage: { select: { program: { select: { slug: true } } } },
                  },
                },
              },
            },
          },
        },
      },
      where: { id: targetId, userId },
    });
  }

  /**
   * Scoped by userId inside the query, not checked after loading: a submission
   * belonging to someone else must be indistinguishable from one that does not
   * exist. The model carries @@unique([id, userId]) for exactly this.
   */
  private async loadStageAssessmentSubmission(
    targetId: string,
    userId: string,
  ) {
    return this.prisma.stageAssessmentSubmission.findFirst({
      include: {
        stageAssessment: {
          select: {
            description: true,
            instructions: true,
            position: true,
            rubric: true,
            title: true,
            stage: { select: { slug: true } },
          },
        },
      },
      where: { id: targetId, userId },
    });
  }

  private async loadReconsideration(
    quote: NonNullable<
      Awaited<ReturnType<PrismaClient['aiPricingQuote']['findFirst']>>
    >,
    submission: NonNullable<
      Awaited<ReturnType<PrismaCorrectionQuoteRepository['loadSubmission']>>
    >,
    taskContext: string,
    userId: string,
  ): Promise<AcceptedQuoteSnapshot | null> {
    if (!submission.exercise) return null;
    if (!quote.reconsiderationOfCorrectionId || !quote.reconsiderationArgument)
      return null;
    const source = await this.prisma.aiCorrection.findFirst({
      include: {
        creditReservation: { select: { settledAmount: true, status: true } },
        pricingQuote: { select: { action: true } },
        reconsideration: { select: { id: true } },
      },
      where: {
        exerciseSubmissionId: submission.id,
        id: quote.reconsiderationOfCorrectionId,
        userId,
      },
    });
    const structured = (source?.structuredResult ?? {}) as {
      correction?: StoredCorrection;
    };
    const sourceSubmission = (source?.submissionSnapshot ?? {}) as {
      text?: unknown;
    };
    const sourcePrompt = (source?.promptSnapshot ?? {}) as {
      exerciseInstructions?: unknown;
      taskContext?: unknown;
    };
    if (
      !source ||
      source.pricingQuote?.action !== 'STANDARD' ||
      source.reconsideration ||
      source.creditReservation?.status !== 'SETTLED' ||
      source.creditReservation.settledAmount === null ||
      !structured.correction ||
      typeof sourceSubmission.text !== 'string'
    )
      return null;
    return {
      action: 'RECONSIDERATION',
      quoteId: quote.id,
      userId: quote.userId,
      target: { id: submission.id, kind: 'EXERCISE_SUBMISSION' },
      language: quote.language,
      estimatedCredits: quote.estimatedCredits,
      maximumReservedCredits: quote.ceilingCredits,
      expiresAt: quote.expiresAt,
      promptVersion: quote.promptVersion,
      modelId: quote.modelId,
      provider: quote.provider,
      includesAutomaticSecondPass: quote.includesAutomaticSecondPass,
      contractKey: quote.contractKey,
      contractVersion: quote.contractVersion,
      requestFingerprint: quote.requestFingerprint,
      submissionText: sourceSubmission.text,
      exerciseInstructions:
        typeof sourcePrompt.exerciseInstructions === 'string'
          ? sourcePrompt.exerciseInstructions
          : submission.exercise.instructions,
      taskContext:
        typeof sourcePrompt.taskContext === 'string'
          ? sourcePrompt.taskContext
          : taskContext,
      contract: source.contractSnapshot,
      reconsideration: {
        argument: quote.reconsiderationArgument,
        previousCorrection: withStoredConfidence(structured.correction),
        sourceCorrectionId: source.id,
      },
    };
  }

  /**
   * Stage assessments resolve through their own contract rule, which refuses
   * anything but an explicit, published, bound contract. Today that means every
   * stage assessment refuses — no seeded assessment carries a v3 contract, and
   * none can be bound while stage assessments have no stable key. The promoted
   * identity's targetKindScope also still excludes STAGE_ASSESSMENT, so this
   * path is guarded twice over and cannot run until both are answered.
   */
  private async loadStageAssessmentQuote(
    quote: NonNullable<
      Awaited<ReturnType<PrismaClient['aiPricingQuote']['findFirst']>>
    >,
    userId: string,
  ): Promise<AcceptedQuoteSnapshot | null> {
    if (quote.action !== 'STANDARD') return null;
    const submission = await this.loadStageAssessmentSubmission(
      quote.targetId,
      userId,
    );
    if (!submission || submission.status !== 'SUBMITTED') return null;
    if (!submission.contentMarkdown) return null;

    const resolution = resolveStageAssessmentCorrectionContract({
      // No key convention exists yet, so nothing can be bound and the resolver
      // refuses. This is the one line that changes when the convention lands.
      activityKey: null,
      explicitContract: submission.stageAssessment.rubric,
      language: quote.language,
    });
    if (!resolution.eligible) return null;

    return {
      action: 'STANDARD',
      quoteId: quote.id,
      userId: quote.userId,
      target: { id: submission.id, kind: 'STAGE_ASSESSMENT_SUBMISSION' },
      language: quote.language,
      estimatedCredits: quote.estimatedCredits,
      maximumReservedCredits: quote.ceilingCredits,
      expiresAt: quote.expiresAt,
      promptVersion: quote.promptVersion,
      modelId: quote.modelId,
      provider: quote.provider,
      includesAutomaticSecondPass: quote.includesAutomaticSecondPass,
      contractKey: quote.contractKey,
      contractVersion: quote.contractVersion,
      requestFingerprint: quote.requestFingerprint,
      submissionText: submission.contentMarkdown,
      exerciseInstructions: submission.stageAssessment.instructions ?? '',
      taskContext: submission.stageAssessment.description,
      contract: resolution.contract,
    };
  }

  public readonly quotes = {
    loadAcceptedQuote: async (input: {
      quoteId: string;
      userId: string;
      now: Date;
    }): Promise<AcceptedQuoteSnapshot | null> => {
      const quote = await this.prisma.aiPricingQuote.findFirst({
        where: { id: input.quoteId, userId: input.userId },
      });
      if (!quote || quote.expiresAt.getTime() <= input.now.getTime()) {
        return null;
      }
      if (quote.targetKind === 'STAGE_ASSESSMENT_SUBMISSION') {
        return this.loadStageAssessmentQuote(quote, input.userId);
      }
      if (quote.targetKind !== 'EXERCISE_SUBMISSION') {
        return null;
      }
      const submission = await this.loadSubmission(
        quote.targetId,
        input.userId,
      );
      if (
        !submission ||
        submission.status !== 'SUBMITTED' ||
        !submission.exercise
      ) {
        return null;
      }
      const lessonObjectives = Array.isArray(
        submission.exercise.lesson.objectives,
      )
        ? submission.exercise.lesson.objectives.filter(
            (objective): objective is string => typeof objective === 'string',
          )
        : [];
      const taskContext = [
        submission.exercise.lesson.summary,
        ...lessonObjectives,
      ].join('\n');
      if (quote.action === 'RECONSIDERATION') {
        return this.loadReconsideration(
          quote,
          submission,
          taskContext,
          input.userId,
        );
      }
      if (quote.action !== 'STANDARD') return null;
      const contractResolution = resolveExerciseCorrectionContract({
        activityKey: submission.exercise.key,
        activityType: submission.exercise.activityType,
        explicitContract: submission.exercise.rubric,
        instructions: submission.exercise.instructions,
        language: quote.language,
        lessonObjectives,
        lessonSlug: submission.exercise.lesson.slug,
        lessonSummary: submission.exercise.lesson.summary,
        programSlug: submission.exercise.lesson.module.stage.program.slug,
        title: submission.exercise.title,
      });
      if (!contractResolution.eligible) return null;
      return {
        action: 'STANDARD',
        quoteId: quote.id,
        userId: quote.userId,
        target: { id: submission.id, kind: 'EXERCISE_SUBMISSION' },
        language: quote.language,
        estimatedCredits: quote.estimatedCredits,
        maximumReservedCredits: quote.ceilingCredits,
        expiresAt: quote.expiresAt,
        promptVersion: quote.promptVersion,
        modelId: quote.modelId,
        provider: quote.provider,
        includesAutomaticSecondPass: quote.includesAutomaticSecondPass,
        contractKey: quote.contractKey,
        contractVersion: quote.contractVersion,
        requestFingerprint: quote.requestFingerprint,
        submissionText: submission.contentMarkdown,
        exerciseInstructions: submission.exercise.instructions,
        taskContext,
        contract: contractResolution.contract,
      };
    },
    // Le schéma V4 conserve le devis comme snapshot immuable sans colonne
    // d'état. La consommation est matérialisée par l'AiCorrection unique
    // sur l'empreinte et par la réservation de crédits idempotente.
    markConsumed: async (): Promise<void> => {},
  };
}
