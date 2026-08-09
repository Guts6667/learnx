export function adminProgramHref(programId: string): string {
  return `/admin/program/${encodeURIComponent(programId)}`;
}

export function adminStageHref(programId: string, stageId: string): string {
  return `${adminProgramHref(programId)}/stage/${encodeURIComponent(stageId)}`;
}

export function adminModuleHref(
  programId: string,
  stageId: string,
  moduleId: string,
): string {
  return `${adminStageHref(programId, stageId)}/module/${encodeURIComponent(moduleId)}`;
}

export function adminLessonHref(
  programId: string,
  stageId: string,
  moduleId: string,
  lessonId: string,
): string {
  return `${adminModuleHref(programId, stageId, moduleId)}/lesson/${encodeURIComponent(lessonId)}`;
}
