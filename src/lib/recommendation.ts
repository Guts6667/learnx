export type RecommendationKind =
  | 'OVERDUE_REVIEW'
  | 'DUE_TODAY_REVIEW'
  | 'INCOMPLETE_TASK'
  | 'REQUIRED_QUIZ'
  | 'REQUIRED_EXERCISE'
  | 'NEXT_LESSON'
  | 'NEXT_MODULE'
  | 'NEXT_STAGE';

export interface RecommendationCandidate {
  estimatedMinutes: number | null;
  href: string;
  kind: RecommendationKind;
  lessonTitle: string | null;
  moduleTitle: string | null;
  order: number;
  programId: string;
  programSlug: string;
  programTitle: string;
  stageTitle: string | null;
  title: string;
}

const recommendationPriority: Record<RecommendationKind, number> = {
  OVERDUE_REVIEW: 1,
  DUE_TODAY_REVIEW: 2,
  INCOMPLETE_TASK: 3,
  REQUIRED_QUIZ: 4,
  REQUIRED_EXERCISE: 5,
  NEXT_LESSON: 6,
  NEXT_MODULE: 7,
  NEXT_STAGE: 8,
};

export function selectDailyRecommendation(
  candidates: RecommendationCandidate[],
): RecommendationCandidate | null {
  return (
    [...candidates].sort(
      (left, right) =>
        recommendationPriority[left.kind] -
          recommendationPriority[right.kind] || left.order - right.order,
    )[0] ?? null
  );
}

export function getDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function classifyReviewDate(
  dueAt: Date,
  now: Date,
  timeZone: string,
): 'DUE_TODAY_REVIEW' | 'FUTURE_REVIEW' | 'OVERDUE_REVIEW' {
  const dueKey = getDateKey(dueAt, timeZone);
  const todayKey = getDateKey(now, timeZone);

  if (dueKey < todayKey) return 'OVERDUE_REVIEW';
  if (dueKey === todayKey) return 'DUE_TODAY_REVIEW';
  return 'FUTURE_REVIEW';
}
