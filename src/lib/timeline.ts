const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export type TemporalStatus =
  | 'ahead'
  | 'behind'
  | 'completed_early'
  | 'completed_late'
  | 'completed_on_time'
  | 'on_track'
  | 'overdue';

export interface TimelineSnapshot {
  actualPercent: number;
  completedAt: Date | null;
  expectedPercent: number;
  progressDelta: number;
  startedAt: Date | null;
  targetEndAt: Date | null;
  temporalStatus: TemporalStatus | null;
}

interface TemporalStatusInput {
  actualProgress: number;
  completedAt: Date | null;
  now: Date;
  progressDelta: number;
  startedAt: Date | null;
  targetEndAt: Date | null;
}

interface TemporalStatusOptions {
  completedOnTimeToleranceMs?: number;
  progressThreshold?: number;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateTargetEndDate(
  startedAt: Date | null,
  durationDays: number | null,
): Date | null {
  if (
    !startedAt ||
    durationDays === null ||
    !Number.isFinite(durationDays) ||
    durationDays <= 0
  ) {
    return null;
  }

  return new Date(startedAt.getTime() + durationDays * DAY_IN_MILLISECONDS);
}

export function calculateExpectedProgress(
  startedAt: Date | null,
  targetEndAt: Date | null,
  now: Date,
): number {
  if (!startedAt || !targetEndAt) {
    return 0;
  }

  const totalPlannedMilliseconds = targetEndAt.getTime() - startedAt.getTime();

  if (totalPlannedMilliseconds <= 0) {
    return 0;
  }

  const elapsedMilliseconds = now.getTime() - startedAt.getTime();

  return roundPercent(
    clampPercent((elapsedMilliseconds / totalPlannedMilliseconds) * 100),
  );
}

export function calculateProgressDelta(
  actualProgress: number,
  expectedProgress: number,
): number {
  return roundPercent(
    clampPercent(actualProgress) - clampPercent(expectedProgress),
  );
}

export function calculateTemporalStatus(
  input: TemporalStatusInput,
  options: TemporalStatusOptions = {},
): TemporalStatus | null {
  if (!input.startedAt || !input.targetEndAt) {
    return null;
  }

  const completedOnTimeToleranceMs =
    options.completedOnTimeToleranceMs ?? DAY_IN_MILLISECONDS;
  const progressThreshold = options.progressThreshold ?? 10;

  if (input.completedAt) {
    const completionDelta =
      input.completedAt.getTime() - input.targetEndAt.getTime();

    if (Math.abs(completionDelta) <= completedOnTimeToleranceMs) {
      return 'completed_on_time';
    }

    return completionDelta < 0 ? 'completed_early' : 'completed_late';
  }

  if (
    input.now.getTime() > input.targetEndAt.getTime() &&
    clampPercent(input.actualProgress) < 100
  ) {
    return 'overdue';
  }

  if (input.progressDelta >= progressThreshold) {
    return 'ahead';
  }

  if (input.progressDelta <= -progressThreshold) {
    return 'behind';
  }

  return 'on_track';
}

export function calculateTimelineSnapshot(input: {
  actualProgress: number;
  completedAt: Date | null;
  now: Date;
  startedAt: Date | null;
  targetEndAt: Date | null;
}): TimelineSnapshot {
  const actualPercent = roundPercent(clampPercent(input.actualProgress));
  const expectedPercent = calculateExpectedProgress(
    input.startedAt,
    input.targetEndAt,
    input.now,
  );
  const progressDelta = calculateProgressDelta(actualPercent, expectedPercent);

  return {
    actualPercent,
    completedAt: input.completedAt,
    expectedPercent,
    progressDelta,
    startedAt: input.startedAt,
    targetEndAt: input.targetEndAt,
    temporalStatus: calculateTemporalStatus({
      actualProgress: actualPercent,
      completedAt: input.completedAt,
      now: input.now,
      progressDelta,
      startedAt: input.startedAt,
      targetEndAt: input.targetEndAt,
    }),
  };
}
