import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { LessonDetail } from '@/features/curriculum/queries';
import {
  activityKey,
  buildLessonActivitySequence,
} from '@/lib/lesson-activity-sequence';

export function lessonHref(lesson: LessonDetail): string {
  return `/program/${encodeURIComponent(lesson.module.stage.program.slug)}/lesson/${encodeURIComponent(lesson.slug)}`;
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
  const stage = lesson.module.stage;
  const module = lesson.module;

  return (
    <header class="space-y-4">
      <nav aria-label="Fil d’Ariane de la leçon">
        <ol class="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <li>
            <a class="text-cyan-300 underline" href={`/program/${program.slug}`}>
              {program.title}
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <a
              class="text-cyan-300 underline"
              href={`/program/${program.slug}/stage/${stage.slug}`}
            >
              {stage.title}
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <a
              class="text-cyan-300 underline"
              href={`/program/${program.slug}/module/${module.slug}`}
            >
              {module.title}
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" class="text-slate-200">
            {activityTitle ?? lesson.title}
          </li>
        </ol>
      </nav>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
            {activityTitle ? `Leçon · ${lesson.title}` : 'Leçon'}
          </p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight" id="lesson-title">
            {activityTitle ?? lesson.title}
          </h1>
        </div>
        {lesson.isPublished ? null : <Badge tone="warning">Brouillon</Badge>}
      </div>
      <div class="flex flex-wrap items-center gap-4 text-sm text-slate-300">
        {lesson.estimatedMinutes === null ? null : (
          <span>{lesson.estimatedMinutes} min</span>
        )}
        <a
          class="inline-flex min-h-11 items-center text-cyan-300 underline"
          href={`/program/${program.slug}/module/${module.slug}`}
        >
          Retour au module
        </a>
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
  const sequence = buildLessonActivitySequence(
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
      tasks: lesson.tasks,
    },
    currentKey,
  );

  return (
    <details class="rounded-xl border border-slate-800 px-4 py-3">
      <summary class="min-h-11 cursor-pointer py-2 font-semibold text-slate-200">
        Sommaire de la leçon
      </summary>
      <nav aria-label="Sommaire contextuel de la leçon">
        <ol class="space-y-2 pb-2">
          {sequence.activities.map((activity) => {
            const key = activityKey(activity.kind, activity.id);
            return (
              <li key={key}>
                <a
                  aria-current={key === currentKey ? 'step' : undefined}
                  class="inline-flex min-h-11 items-center text-sm text-cyan-300 underline"
                  href={activity.href}
                >
                  {activity.title}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </details>
  );
}
