import type { Prisma } from '../../../../generated/prisma/client.js';
import type { AssessmentQuestionKey } from '../../../lib/concept-assessments.js';
import type {
  QuizAttemptReadModel,
  QuizQuestionReadModel,
  QuizReadModel,
} from './types.js';

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function toQuestionKey(
  question: QuizQuestionReadModel,
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

export function serializeQuiz(quiz: QuizReadModel) {
  return {
    description: quiz.description,
    id: quiz.id,
    isRequired: quiz.isRequired,
    lessonId: quiz.lessonId,
    passingScore: quiz.passingScore,
    position: quiz.position,
    questionCount: quiz.questions.length,
    questions: quiz.questions.map((question) => ({
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
    title: quiz.title,
  };
}

export function serializeAttempt(attempt: QuizAttemptReadModel) {
  return {
    answers: attempt.answers,
    id: attempt.id,
    passed: attempt.passed,
    score: attempt.score,
    submittedAt: attempt.submittedAt,
    runSequence: attempt.runSequence ?? 1,
  };
}
