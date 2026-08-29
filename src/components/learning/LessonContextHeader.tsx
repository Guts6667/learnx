import { ContextualNoteAction } from '@/components/learning/ContextualNoteAction';
import { PedagogicalNavigation } from '@/components/learning/PedagogicalNavigation';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  type LessonDetail,
  type LessonProgressResponse,
  useLessonProgressQuery,
} from '@/features/curriculum/queries';
import { lessonHref as buildLessonHref } from '@/lib/curriculum-navigation';
import { buildLessonActivitySequence } from '@/lib/lesson-activity-sequence';
import { useI18n } from '@/i18n';

export function lessonHref(lesson: LessonDetail): string {
  return buildLessonHref(lesson.module.stage.program.slug, lesson.slug);
}

export function lessonActivitySequence(
  lesson: LessonDetail,
  currentKey?: string,
  progress?: LessonProgressResponse,
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
      progress: progress
        ? {
            canComplete: progress.canComplete,
            conceptStatus: progress.conceptProgress,
            exerciseStatus: progress.exerciseSubmissions,
            lessonStatus: progress.lessonProgress.status,
            quizPassed: progress.quizPassed,
            resourceStatus: progress.resourceProgress,
            taskStatus: progress.taskCompletions,
          }
        : undefined,
      quizzes: lesson.quizzes,
      resources: lesson.resources,
      sequence: lesson.sequence,
      tasks: lesson.tasks,
    },
    currentKey,
  );
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
  const canonicalLessonHref = lessonHref(lesson);
  const { t } = useI18n();

  return (
    <header className="totem-learning-header space-y-4">
      {activityTitle ? (
        <a
          className="ui-link inline-flex min-h-11 max-w-full min-w-0 items-center break-words rounded-lg text-sm font-medium"
          href={canonicalLessonHref}
        >
          {t('learning.lessonWithTitle', { title: lesson.title })}
        </a>
      ) : null}
      <div className="totem-learning-header__title flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-full flex-1">
          <p className="page-eyebrow break-words">
            {activityTitle
              ? `${t('learning.lesson')} · ${lesson.title}`
              : t('learning.lesson')}
          </p>
          <h1 className="page-title break-words" id="lesson-title">
            {activityTitle ?? lesson.title}
          </h1>
        </div>
        {lesson.isPublished ? null : (
          <Badge tone="warning">{t('common.draft')}</Badge>
        )}
      </div>
      <div className="totem-learning-header__meta ui-text-muted text-sm">
        {lesson.estimatedMinutes === null ? null : (
          <span>{t('common.minutes', { count: lesson.estimatedMinutes })}</span>
        )}
      </div>
      {percent === undefined ? null : (
        <ProgressBar
          label={t('learning.progress', { count: Math.round(percent) })}
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
  const progressQuery = useLessonProgressQuery(lesson.id, lesson.isPublished);
  const sequence = lessonActivitySequence(
    lesson,
    currentKey,
    progressQuery.data,
  );

  return (
    <div className="space-y-6">
      {sequence.current ? (
        <ContextualNoteAction
          activity={sequence.current}
          key={currentKey}
          lesson={lesson}
        />
      ) : null}
      <PedagogicalNavigation
        activities={sequence.activities}
        continueActivity={sequence.next}
        currentKey={currentKey}
        lessonTitle={lesson.title}
        moduleTitle={lesson.module.title}
      />
    </div>
  );
}
