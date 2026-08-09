import { calculateLessonProgress } from '@/lib/progress';

describe('calculateLessonProgress', () => {
  it('compte chaque validation obligatoire exactement une fois', () => {
    expect(
      calculateLessonProgress({
        requiredConcepts: [true, false],
        requiredExercises: [true, false],
        requiredQuizzes: [true],
        requiredResources: [],
        requiredTasks: [false],
      }),
    ).toEqual({ canComplete: false, percent: 50 });
  });

  it('fait progresser une mini-évaluation réussie et ignore un échec', () => {
    const base = {
      requiredExercises: [false],
      requiredQuizzes: [] as boolean[],
      requiredResources: [] as boolean[],
      requiredTasks: [false],
    };

    expect(
      calculateLessonProgress({ ...base, requiredConcepts: [false] }).percent,
    ).toBe(0);
    expect(
      calculateLessonProgress({ ...base, requiredConcepts: [true] }).percent,
    ).toBeCloseTo(100 / 3);
  });

  it('autorise une leçon sans exigence et bloque tout élément requis manquant', () => {
    expect(
      calculateLessonProgress({
        requiredConcepts: [],
        requiredExercises: [],
        requiredQuizzes: [],
        requiredResources: [],
        requiredTasks: [],
      }),
    ).toEqual({ canComplete: true, percent: 0 });
    expect(
      calculateLessonProgress({
        requiredConcepts: [true],
        requiredExercises: [false],
        requiredQuizzes: [],
        requiredResources: [],
        requiredTasks: [],
      }).canComplete,
    ).toBe(false);
  });

  it('bloque la terminaison sur une ressource obligatoire sans modifier le pourcentage', () => {
    expect(
      calculateLessonProgress({
        requiredConcepts: [true],
        requiredExercises: [true],
        requiredQuizzes: [true],
        requiredResources: [false],
        requiredTasks: [true],
      }),
    ).toEqual({ canComplete: false, percent: 100 });
  });

  it('atteint 100 uniquement lorsque toutes les validations sont réussies', () => {
    expect(
      calculateLessonProgress({
        requiredConcepts: [true],
        requiredExercises: [true],
        requiredQuizzes: [true],
        requiredResources: [],
        requiredTasks: [true],
      }),
    ).toEqual({ canComplete: true, percent: 100 });
  });
});
