export function programHref(programSlug: string): string {
  return `/program/${encodeURIComponent(programSlug)}`;
}

export function programStageHref(
  programSlug: string,
  stageSlug: string,
): string {
  return `${programHref(programSlug)}?stage=${encodeURIComponent(stageSlug)}`;
}

export function lessonHref(programSlug: string, lessonSlug: string): string {
  return `${programHref(programSlug)}/lesson/${encodeURIComponent(lessonSlug)}`;
}
