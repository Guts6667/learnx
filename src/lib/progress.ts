export interface ProgressCategory {
  itemProgress: number[];
  weight: number;
}

export const LESSON_PROGRESS_WEIGHTS = {
  exercises: 20,
  quizzes: 30,
  tasks: 40,
} as const;

export interface LessonProgressInput {
  requiredConcepts: boolean[];
  requiredExercises: boolean[];
  requiredQuizzes: boolean[];
  requiredResources: boolean[];
  requiredTasks: boolean[];
}

export interface LessonProgressResult {
  canComplete: boolean;
  percent: number;
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce((total, value) => total + clampPercent(value), 0) /
    values.length
  );
}

export function calculateProgress(categories: ProgressCategory[]): number {
  const availableCategories = categories.filter(
    (category) => category.weight > 0 && category.itemProgress.length > 0,
  );
  const totalWeight = availableCategories.reduce(
    (total, category) => total + category.weight,
    0,
  );

  if (totalWeight === 0) {
    return 0;
  }

  const progress = availableCategories.reduce(
    (total, category) =>
      total +
      calculateAverage(category.itemProgress) * (category.weight / totalWeight),
    0,
  );

  return clampPercent(progress);
}

function toItemProgress(items: boolean[]): number[] {
  return items.map((isComplete) => (isComplete ? 100 : 0));
}

export function calculateLessonProgress(
  input: LessonProgressInput,
): LessonProgressResult {
  const percent = calculateProgress([
    {
      itemProgress: toItemProgress(input.requiredTasks),
      weight: LESSON_PROGRESS_WEIGHTS.tasks,
    },
    {
      itemProgress: toItemProgress(input.requiredQuizzes),
      weight: LESSON_PROGRESS_WEIGHTS.quizzes,
    },
    {
      itemProgress: toItemProgress(input.requiredExercises),
      weight: LESSON_PROGRESS_WEIGHTS.exercises,
    },
  ]);
  const trackedRequirements = [
    ...input.requiredTasks,
    ...input.requiredQuizzes,
    ...input.requiredExercises,
  ];
  const completionRequirements = [
    ...trackedRequirements,
    ...input.requiredResources,
  ];

  return {
    canComplete:
      completionRequirements.every(Boolean) &&
      input.requiredConcepts.every(Boolean),
    percent,
  };
}
