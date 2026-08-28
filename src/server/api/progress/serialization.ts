import { LessonProgressStatus } from '../../../../generated/prisma/client.js';
import { calculateTimelineSnapshot } from '../../../lib/timeline.js';
import type { LessonProgressSnapshot } from '../_lib/progress-recalculation.js';

export function serializeTimeline(
  actualProgress: number,
  progress: {
    completedAt: Date | null;
    startedAt: Date | null;
    targetEndAt: Date | null;
  },
  now: Date,
) {
  return calculateTimelineSnapshot({
    actualProgress,
    completedAt: progress.completedAt,
    now,
    startedAt: progress.startedAt,
    targetEndAt: progress.targetEndAt,
  });
}

function getCurrentTarget(snapshot: LessonProgressSnapshot) {
  const currentItem = snapshot.lessonProgress?.currentSequenceItem;
  if (!currentItem) return null;
  const id = {
    CONCEPT_ASSESSMENT: currentItem.conceptAssessmentId,
    CONTENT: currentItem.contentBlockId,
    EXERCISE: currentItem.exerciseId,
    QUIZ: currentItem.quizId,
    RESOURCE: currentItem.resourceId,
    TASK: currentItem.taskId,
  }[currentItem.kind];
  return id ? { id, kind: currentItem.kind } : null;
}

export function serializeProgressSnapshot(snapshot: LessonProgressSnapshot) {
  return {
    conceptProgress: Object.fromEntries(snapshot.conceptStatusById),
    exerciseSubmissions: Object.fromEntries(snapshot.exerciseStatusById),
    lessonProgress: {
      completedAt: snapshot.lessonProgress?.completedAt ?? null,
      percent: snapshot.percent,
      startedAt: snapshot.lessonProgress?.startedAt ?? null,
      status: snapshot.lessonProgress?.status ?? LessonProgressStatus.AVAILABLE,
    },
    canComplete: snapshot.canComplete,
    currentActivity: getCurrentTarget(snapshot),
    quizPassed: Object.fromEntries(snapshot.quizPassedById),
    resourceProgress: Object.fromEntries(snapshot.resourceStatusById),
    taskCompletions: Object.fromEntries(snapshot.taskStatusById),
  };
}
