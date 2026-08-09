import { ContextualNoteAction } from '@/components/learning/ContextualNoteAction';
import { PedagogicalNavigation } from '@/components/learning/PedagogicalNavigation';
import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { LessonDetail } from '@/features/curriculum/queries';
import { buildLessonActivitySequence } from '@/lib/lesson-activity-sequence';

export function lessonHref(lesson: LessonDetail): string {
  return `/program/${encodeURIComponent(lesson.module.stage.program.slug)}/lesson/${encodeURIComponent(lesson.slug)}`;
}

export function lessonActivitySequence(
  lesson: LessonDetail,
  currentKey?: string,
) {
  return buildLessonActivitySequence(
    {
      concepts: lesson.concepts,
      contentBlocks: lesson.contentBlocks,
      exercises: lesson.exercises,
      isPublished: lesson.isPublished,
      lessonSlug: lesson.slug,
      nextLesson: lesson.navigation.nextLesson,
      programSlug: lesson.module.stage.program.slug,
      quizzes: lesson.quizzes,
      resources: lesson.resources,
      sequence: lesson.sequence,
      tasks: lesson.tasks,
    },
    currentKey,
  );
}

export function nextLessonActivityHref(
  lesson: LessonDetail,
  currentKey: string,
): string | null {
  const activities = lessonActivitySequence(lesson).activities;
  const currentIndex = activities.findIndex(
    (activity) =>
      `${activity.kind.toLowerCase()}:${activity.id}` === currentKey,
  );
  return currentIndex < 0 ? null : (activities[currentIndex + 1]?.href ?? null);
}

export function LessonContextHeader({
  activityTitle,
  lesson,
  percent,
}: {
  activityTitle?: string;
  lesson: LessonDetail;
  percent?: number;
}) {
  const program = lesson.module.stage.program;
  const module = lesson.module;
  const canonicalLessonHref = lessonHref(lesson);
  const moduleHref = `/program/${encodeURIComponent(program.slug)}/module/${encodeURIComponent(module.slug)}`;

  useBackNavigationTarget(activityTitle ? canonicalLessonHref : moduleHref);

  return (
    <header class="space-y-4">
      {activityTitle ? (
        <a
          class="inline-flex min-h-11 max-w-full min-w-0 items-center break-words rounded-lg text-sm font-medium text-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          href={canonicalLessonHref}
        >
          Leçon : {lesson.title}
        </a>
      ) : null}
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 max-w-full flex-1">
          <p class="break-words text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
            {activityTitle ? `Leçon · ${lesson.title}` : 'Leçon'}
          </p>
          <h1
            class="mt-2 break-words text-3xl font-bold tracking-tight"
            id="lesson-title"
          >
            {activityTitle ?? lesson.title}
          </h1>
        </div>
        {lesson.isPublished ? null : <Badge tone="warning">Brouillon</Badge>}
      </div>
      <div class="text-sm text-slate-300">
        {lesson.estimatedMinutes === null ? null : (
          <span>{lesson.estimatedMinutes} min</span>
        )}
      </div>
      {percent === undefined ? null : (
        <ProgressBar
          label={`Progression de la leçon — ${Math.round(percent)} %`}
          value={percent}
        />
      )}
    </header>
  );
}

export function LessonActivitySummary({
  currentKey,
  lesson,
}: {
  currentKey: string;
  lesson: LessonDetail;
}) {
  const sequence = lessonActivitySequence(lesson, currentKey);

  return (
    <div class="space-y-6">
      {sequence.current ? (
        <ContextualNoteAction
          activity={sequence.current}
          key={currentKey}
          lesson={lesson}
        />
      ) : null}
      <PedagogicalNavigation
        activities={sequence.activities}
        currentKey={currentKey}
        lessonTitle={lesson.title}
        moduleTitle={lesson.module.title}
      />
    </div>
  );
}
