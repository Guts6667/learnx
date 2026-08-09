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

function calculateValidationPercent(requirements: boolean[]): number {
  if (requirements.length === 0) return 0;

  const completed = requirements.filter(Boolean).length;
  return (completed / requirements.length) * 100;
}

export function calculateLessonProgress(
  input: LessonProgressInput,
): LessonProgressResult {
  const validationRequirements = [
    ...input.requiredTasks,
    ...input.requiredConcepts,
    ...input.requiredQuizzes,
    ...input.requiredExercises,
  ];
  const completionRequirements = [
    ...validationRequirements,
    ...input.requiredResources,
  ];

  return {
    canComplete: completionRequirements.every(Boolean),
    percent: calculateValidationPercent(validationRequirements),
  };
}
