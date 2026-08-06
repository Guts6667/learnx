export type ModuleProgressStatus =
  | 'AVAILABLE'
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'LOCKED';

export interface ModuleLessonProgress {
  percent: number;
  status: 'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'NEEDS_REVIEW';
}

export interface ModuleProgress {
  percent: number;
  status: ModuleProgressStatus;
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

export function calculateModuleProgress(
  lessons: ModuleLessonProgress[],
  isLocked = false,
): ModuleProgress {
  if (lessons.length === 0) {
    return { percent: 0, status: isLocked ? 'LOCKED' : 'AVAILABLE' };
  }

  const percent =
    lessons.reduce((total, lesson) => total + clampPercent(lesson.percent), 0) /
    lessons.length;
  if (isLocked) return { percent, status: 'LOCKED' };
  const isCompleted = lessons.every(
    (lesson) => lesson.status === 'COMPLETED',
  );
  const hasStarted = lessons.some(
    (lesson) => lesson.percent > 0 || lesson.status !== 'AVAILABLE',
  );

  return {
    percent,
    status: isCompleted ? 'COMPLETED' : hasStarted ? 'IN_PROGRESS' : 'AVAILABLE',
  };
}
