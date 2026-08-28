import type { Prisma } from '../../../../generated/prisma/client.js';
import type { AssessmentQuestionKey } from '../../../lib/concept-assessments.js';
import type {
  AssessmentQuestionReadModel,
  AssessmentReadModel,
  AttemptReadModel,
} from './types.js';

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function toQuestionKey(
  question: AssessmentQuestionReadModel,
): AssessmentQuestionKey {
  return {
    acceptedAnswers: question.acceptedAnswers,
    explanation: question.explanation,
    id: question.id,
    options: question.options.map((option) => ({
      id: option.id,
      isCorrect: option.isCorrect,
    })),
    type: question.type,
  };
}

export function serializeAssessment(assessment: AssessmentReadModel) {
  return {
    concept: assessment.concept,
    id: assessment.id,
    isRequired: assessment.isRequired,
    position: assessment.position,
    questionCount: assessment.questions.length,
    questions: assessment.questions.map((question) => ({
      id: question.id,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        position: option.position,
      })),
      position: question.position,
      prompt: question.prompt,
      type: question.type,
    })),
    title: assessment.title,
  };
}

export function serializeAttempt(attempt: AttemptReadModel) {
  return {
    answers: attempt.answers,
    id: attempt.id,
    passed: attempt.passed,
    score: attempt.score,
    submittedAt: attempt.submittedAt,
    runSequence: attempt.runSequence ?? 1,
  };
}
