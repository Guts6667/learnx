export type ConceptQuestionKind =
  'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'SINGLE_CHOICE' | 'TRUE_FALSE';

export interface AssessmentOptionKey {
  id: string;
  isCorrect: boolean;
}

export interface AssessmentQuestionKey {
  acceptedAnswers: string[];
  explanation: string;
  id: string;
  options: AssessmentOptionKey[];
  type: ConceptQuestionKind;
}

export interface SubmittedAssessmentAnswer {
  optionIds: string[];
  questionId: string;
  text?: string;
}

export interface QuestionCorrection {
  acceptedAnswers: string[];
  correct: boolean;
  correctOptionIds: string[];
  explanation: string;
  questionId: string;
}

export interface AssessmentResult {
  corrections: QuestionCorrection[];
  passed: boolean;
  score: number;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function hasSameIds(left: string[], right: string[]): boolean {
  const uniqueLeft = new Set(left);
  const uniqueRight = new Set(right);

  if (
    uniqueLeft.size !== left.length ||
    uniqueRight.size !== right.length ||
    uniqueLeft.size !== uniqueRight.size
  ) {
    return false;
  }

  return [...uniqueLeft].every((id) => uniqueRight.has(id));
}

function gradeQuestion(
  question: AssessmentQuestionKey,
  answer: SubmittedAssessmentAnswer,
): QuestionCorrection {
  const optionIds = question.options.map((option) => option.id);
  const hasUnknownOption = answer.optionIds.some(
    (optionId) => !optionIds.includes(optionId),
  );

  if (hasUnknownOption) {
    throw new Error('An answer contains an unknown option.');
  }

  const correctOptionIds = question.options
    .filter((option) => option.isCorrect)
    .map((option) => option.id);
  const acceptedAnswers = question.acceptedAnswers;
  const correct =
    question.type === 'SHORT_ANSWER'
      ? Boolean(answer.text) &&
        acceptedAnswers
          .map(normalizeText)
          .includes(normalizeText(answer.text ?? ''))
      : hasSameIds(answer.optionIds, correctOptionIds);

  return {
    acceptedAnswers,
    correct,
    correctOptionIds,
    explanation: question.explanation,
    questionId: question.id,
  };
}

export function gradeConceptAssessment(input: {
  answers: SubmittedAssessmentAnswer[];
  masteryThreshold: number;
  questions: AssessmentQuestionKey[];
}): AssessmentResult {
  if (input.questions.length === 0) {
    throw new Error('An assessment must contain at least one question.');
  }

  const questionIds = new Set(input.questions.map((question) => question.id));
  const answerIds = new Set(input.answers.map((answer) => answer.questionId));

  if (
    questionIds.size !== input.questions.length ||
    answerIds.size !== input.answers.length ||
    questionIds.size !== answerIds.size ||
    ![...questionIds].every((id) => answerIds.has(id))
  ) {
    throw new Error('Every assessment question must be answered exactly once.');
  }

  const answersByQuestion = new Map(
    input.answers.map((answer) => [answer.questionId, answer]),
  );
  const corrections = input.questions.map((question) => {
    const answer = answersByQuestion.get(question.id);

    if (!answer) {
      throw new Error(
        'Every assessment question must be answered exactly once.',
      );
    }

    return gradeQuestion(question, answer);
  });
  const correctCount = corrections.filter(
    (correction) => correction.correct,
  ).length;
  const score = (correctCount / input.questions.length) * 100;

  return {
    corrections,
    passed: score >= input.masteryThreshold,
    score,
  };
}
