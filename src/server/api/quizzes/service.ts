import {
  gradeConceptAssessment,
  type SubmittedAssessmentAnswer,
} from '../../../lib/concept-assessments.js';
import { toJsonValue, toQuestionKey } from './serialization.js';
import type { QuizReadModel, QuizRepository } from './types.js';
import { invalidQuizRequest, quizNotReady } from './validation.js';

interface SubmitQuizInput {
  answers: Array<{
    optionIds: string[];
    questionId: string;
    text?: string;
  }>;
  now: Date;
  quiz: QuizReadModel;
  quizId: string;
  repository: QuizRepository;
  userId: string;
}

export async function submitQuizAttempt(input: SubmitQuizInput) {
  if (input.quiz.questions.length === 0) throw quizNotReady();

  let result;
  try {
    result = gradeConceptAssessment({
      answers: input.answers as SubmittedAssessmentAnswer[],
      masteryThreshold: input.quiz.passingScore,
      questions: input.quiz.questions.map(toQuestionKey),
    });
  } catch {
    throw invalidQuizRequest();
  }

  const attempt = await input.repository.recordAttempt({
    answers: toJsonValue(input.answers),
    lessonId: input.quiz.lessonId,
    passed: result.passed,
    quizId: input.quizId,
    score: result.score,
    submittedAt: input.now,
    userId: input.userId,
  });

  return { attempt, corrections: result.corrections };
}
