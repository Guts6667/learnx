export type EditorialTaskType =
  | 'reading'
  | 'watching'
  | 'listening'
  | 'reflection'
  | 'checklist'
  | 'writing'
  | 'practice'
  | 'project';
export type CanonicalActivityKind = 'TASK' | 'EXERCISE';

const passiveTaskTypes = new Set<EditorialTaskType>([
  'reading',
  'watching',
  'listening',
  'checklist',
]);

export function getCanonicalActivityKind(
  type: EditorialTaskType,
): CanonicalActivityKind {
  return passiveTaskTypes.has(type) ? 'TASK' : 'EXERCISE';
}

export function belongsToCurrentModuleRun(
  completedAt: Date | null,
  currentRunStartedAt: Date,
): boolean {
  return completedAt !== null && completedAt >= currentRunStartedAt;
}
