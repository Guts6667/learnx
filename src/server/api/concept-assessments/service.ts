import {
  gradeConceptAssessment,
  type SubmittedAssessmentAnswer,
} from '../../../lib/concept-assessments.js';
import { toJsonValue, toQuestionKey } from './serialization.js';
import type {
  AssessmentReadModel,
  ConceptAssessmentRepository,
} from './types.js';
import { assessmentNotReady, invalidAssessmentRequest } from './validation.js';

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

interface SubmitAssessmentInput {
  answers: Array<{
    optionIds: string[];
    questionId: string;
    text?: string;
  }>;
  assessment: AssessmentReadModel;
  assessmentId: string;
  preview: boolean;
  repository: ConceptAssessmentRepository;
  submittedAt: Date;
  userId: string;
}

export async function submitConceptAssessment(input: SubmitAssessmentInput) {
  if (input.assessment.questions.length === 0) throw assessmentNotReady();

  let result;
  try {
    result = gradeConceptAssessment({
      answers: input.answers as SubmittedAssessmentAnswer[],
      masteryThreshold: input.assessment.concept.masteryThreshold,
      questions: input.assessment.questions.map(toQuestionKey),
    });
  } catch {
    throw invalidAssessmentRequest();
  }

  const recorded = await input.repository.recordAttempt({
    answers: toJsonValue(input.answers),
    assessmentId: input.assessmentId,
    conceptId: input.assessment.concept.id,
    dueAt: addDays(input.submittedAt, 1),
    lessonId: input.assessment.concept.lessonId,
    passed: result.passed,
    programId: input.assessment.concept.programId,
    preview: input.preview,
    score: result.score,
    submittedAt: input.submittedAt,
    userId: input.userId,
  });

  return { corrections: result.corrections, recorded };
}
