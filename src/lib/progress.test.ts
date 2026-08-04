import {
  calculateLessonProgress,
  calculateProgress,
  LESSON_PROGRESS_WEIGHTS,
} from '@/lib/progress';

describe('calculateProgress', () => {
  it('applique les pondérations des catégories présentes', () => {
    expect(
      calculateProgress([
        { itemProgress: [100, 50], weight: 40 },
        { itemProgress: [100], weight: 10 },
      ]),
    ).toBe(80);
  });

  it('redistribue le poids des catégories absentes', () => {
    expect(
      calculateProgress([
        { itemProgress: [50], weight: 40 },
        { itemProgress: [], weight: 30 },
        { itemProgress: [100], weight: 10 },
      ]),
    ).toBe(60);
  });

  it('borne les valeurs et retourne zéro sans élément suivi', () => {
    expect(
      calculateProgress([
        { itemProgress: [-20, 180], weight: 1 },
        { itemProgress: [], weight: 1 },
      ]),
    ).toBe(50);
    expect(calculateProgress([{ itemProgress: [], weight: 1 }])).toBe(0);
  });
});

describe('calculateLessonProgress', () => {
  const categories = [
    ['requiredTasks', LESSON_PROGRESS_WEIGHTS.tasks],
    ['requiredQuizzes', LESSON_PROGRESS_WEIGHTS.quizzes],
    ['requiredExercises', LESSON_PROGRESS_WEIGHTS.exercises],
  ] as const;

  it.each(Array.from({ length: 7 }, (_, index) => index + 1))(
    'redistribue les poids pour la combinaison de catégories %s',
    (mask) => {
      const input = {
        requiredConcepts: [true],
        requiredExercises: [] as boolean[],
        requiredQuizzes: [] as boolean[],
        requiredTasks: [] as boolean[],
      };
      let availableWeight = 0;
      let completedWeight = 0;

      categories.forEach(([key, weight], categoryIndex) => {
        if ((mask & (1 << categoryIndex)) === 0) return;

        input[key] = [categoryIndex % 2 === 0];
        availableWeight += weight;
        if (categoryIndex % 2 === 0) completedWeight += weight;
      });

      expect(calculateLessonProgress(input).percent).toBeCloseTo(
        (completedWeight / availableWeight) * 100,
      );
    },
  );

  it('ne compte pas les notions une seconde fois mais les conserve comme gate', () => {
    expect(
      calculateLessonProgress({
        requiredConcepts: [false],
        requiredExercises: [true],
        requiredQuizzes: [true],
        requiredTasks: [true],
      }),
    ).toEqual({ canComplete: false, percent: 100 });
  });

  it('autorise une leçon sans exigence et bloque tout élément requis manquant', () => {
    expect(
      calculateLessonProgress({
        requiredConcepts: [],
        requiredExercises: [],
        requiredQuizzes: [],
        requiredTasks: [],
      }),
    ).toEqual({ canComplete: true, percent: 0 });
    expect(
      calculateLessonProgress({
        requiredConcepts: [true],
        requiredExercises: [false],
        requiredQuizzes: [],
        requiredTasks: [],
      }).canComplete,
    ).toBe(false);
  });
});
