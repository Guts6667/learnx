import { gradeConceptAssessment } from '@/lib/concept-assessments';

const questions = [
  {
    acceptedAnswers: [],
    explanation: 'La proposition est vraie.',
    id: 'true-false',
    options: [
      { id: 'true', isCorrect: true },
      { id: 'false', isCorrect: false },
    ],
    type: 'TRUE_FALSE' as const,
  },
  {
    acceptedAnswers: [],
    explanation: 'Une seule option convient.',
    id: 'single',
    options: [
      { id: 'single-a', isCorrect: false },
      { id: 'single-b', isCorrect: true },
    ],
    type: 'SINGLE_CHOICE' as const,
  },
  {
    acceptedAnswers: [],
    explanation: 'Deux options conviennent.',
    id: 'multiple',
    options: [
      { id: 'multiple-a', isCorrect: true },
      { id: 'multiple-b', isCorrect: false },
      { id: 'multiple-c', isCorrect: true },
    ],
    type: 'MULTIPLE_CHOICE' as const,
  },
  {
    acceptedAnswers: ['Données empiriques'],
    explanation: 'La connaissance repose sur des données empiriques.',
    id: 'short',
    options: [],
    type: 'SHORT_ANSWER' as const,
  },
];

describe('concept assessment grading', () => {
  it('corrige les quatre formats et applique le seuil', () => {
    const result = gradeConceptAssessment({
      answers: [
        { optionIds: ['true'], questionId: 'true-false' },
        { optionIds: ['single-b'], questionId: 'single' },
        {
          optionIds: ['multiple-c', 'multiple-a'],
          questionId: 'multiple',
        },
        {
          optionIds: [],
          questionId: 'short',
          text: '  DONNÉES   EMPIRIQUES ',
        },
      ],
      masteryThreshold: 70,
      questions,
    });

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.corrections.every((correction) => correction.correct)).toBe(
      true,
    );
  });

  it('exige une correspondance exacte pour les choix multiples', () => {
    const result = gradeConceptAssessment({
      answers: [
        { optionIds: ['true'], questionId: 'true-false' },
        { optionIds: ['single-b'], questionId: 'single' },
        { optionIds: ['multiple-a'], questionId: 'multiple' },
        { optionIds: [], questionId: 'short', text: 'réponse incorrecte' },
      ],
      masteryThreshold: 70,
      questions,
    });

    expect(result.score).toBe(50);
    expect(result.passed).toBe(false);
  });

  it('refuse les réponses manquantes, dupliquées ou inconnues', () => {
    expect(() =>
      gradeConceptAssessment({
        answers: [{ optionIds: ['true'], questionId: 'true-false' }],
        masteryThreshold: 70,
        questions,
      }),
    ).toThrow('Every assessment question must be answered exactly once.');

    expect(() =>
      gradeConceptAssessment({
        answers: [
          { optionIds: ['unknown'], questionId: 'true-false' },
          { optionIds: ['single-b'], questionId: 'single' },
          { optionIds: ['multiple-a', 'multiple-c'], questionId: 'multiple' },
          { optionIds: [], questionId: 'short', text: 'données empiriques' },
        ],
        masteryThreshold: 70,
        questions,
      }),
    ).toThrow('An answer contains an unknown option.');
  });
});
