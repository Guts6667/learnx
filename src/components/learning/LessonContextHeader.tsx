import { ContextualNoteAction } from '@/components/learning/ContextualNoteAction';
import { PedagogicalNavigation } from '@/components/learning/PedagogicalNavigation';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { LessonDetail } from '@/features/curriculum/queries';
import { lessonHref as buildLessonHref } from '@/lib/curriculum-navigation';
import { buildLessonActivitySequence } from '@/lib/lesson-activity-sequence';
import { useI18n } from '@/i18n';

export function lessonHref(lesson: LessonDetail): string {
  return buildLessonHref(lesson.module.stage.program.slug, lesson.slug);
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
  intro,
  lesson,
  percent,
}: {
  activityTitle?: string;
  intro?: string;
  lesson: LessonDetail;
  percent?: number;
}) {
  const canonicalLessonHref = lessonHref(lesson);
  const { t } = useI18n();
  const activityCount = lessonActivitySequence(lesson).activities.length;

  return (
    <header class="totem-learning-header">
      {activityTitle ? (
        <a
          class="totem-learning-header__lesson-link ui-link inline-flex min-h-11 max-w-full min-w-0 items-center break-words rounded-lg text-sm font-medium"
          href={canonicalLessonHref}
        >
          {t('learning.lessonWithTitle', { title: lesson.title })}
        </a>
      ) : null}
      <div class="totem-learning-header__primary">
        <div class="totem-learning-header__title flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 max-w-full flex-1">
            <p class="page-eyebrow break-words">
              {activityTitle
                ? t('learning.exerciseType')
                : `${t('learning.lesson')} · ${lesson.module.title}`}
            </p>
            <h1 id="lesson-title">{activityTitle ?? lesson.title}</h1>
          </div>
          {lesson.isPublished ? null : (
            <Badge tone="warning">{t('common.draft')}</Badge>
          )}
        </div>
        <p class="totem-learning-header__intro">{intro ?? lesson.summary}</p>
        <div class="totem-learning-header__meta">
          {lesson.estimatedMinutes === null ? null : (
            <span>
              {t('common.minutes', { count: lesson.estimatedMinutes })}
            </span>
          )}
          {percent === undefined ? null : (
            <span>
              {t('learning.progressShort', { count: Math.round(percent) })}
            </span>
          )}
        </div>
        {percent === undefined ? null : (
          <ProgressBar
            label={t('learning.progress', { count: Math.round(percent) })}
            value={percent}
          />
        )}
      </div>
      <aside class="totem-learning-head-summary">
        <p class="page-eyebrow">
          {activityTitle ? t('learning.context') : t('learning.position')}
        </p>
        <strong>
          {activityTitle ? lesson.title : lesson.module.stage.title}
        </strong>
        <p>
          {activityTitle
            ? lesson.module.title
            : lesson.module.stage.program.title}
        </p>
        <div class="totem-learning-head-summary__facts">
          <div>
            <span>{t('learning.activities')}</span>
            <strong>{activityCount}</strong>
          </div>
          <div>
            <span>{t('learning.progressLabel')}</span>
            <strong>
              {percent === undefined
                ? t('learning.nonBlocking')
                : `${Math.round(percent)} %`}
            </strong>
          </div>
        </div>
      </aside>
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
