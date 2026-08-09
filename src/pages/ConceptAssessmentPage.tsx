import { Badge } from '@/components/ui/Badge';
import { useEffect } from 'preact/hooks';
import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import {
  LessonContextHeader,
  LessonActivitySummary,
  lessonHref,
} from '@/components/learning/LessonContextHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { Spinner } from '@/components/ui/Spinner';
import { QuestionAssessmentExperience } from '@/features/assessments/QuestionAssessmentExperience';
import {
  useConceptAssessmentAttemptMutation,
  useConceptAssessmentAttemptsQuery,
  useConceptAssessmentQuery,
} from '@/features/concept-assessments/queries';
import { useLessonQuery } from '@/features/curriculum/queries';
import { activityKey, rememberActivity } from '@/lib/lesson-activity-sequence';
import { lessonHref as buildLessonHref } from '@/lib/curriculum-navigation';
import { useI18n } from '@/i18n';

export function ConceptAssessmentPage({
  assessmentId,
  lessonSlug,
  programSlug,
}: {
  assessmentId?: string;
  lessonSlug: string;
  programSlug: string;
}) {
  const { t } = useI18n();
  const lessonQuery = useLessonQuery(lessonSlug);
  const lesson = lessonQuery.data?.lesson;
  const selectedAssessment = assessmentId
    ? lesson?.concepts
        .flatMap((concept) => concept.assessments)
        .find((assessment) => assessment.id === assessmentId)
    : lesson?.concepts.flatMap((concept) => concept.assessments)[0];
  const selectedAssessmentId = selectedAssessment?.id ?? null;
  const preview = lesson ? !lesson.isPublished : false;
  const assessmentQuery = useConceptAssessmentQuery(
    selectedAssessmentId,
    preview,
  );
  const attemptsQuery = useConceptAssessmentAttemptsQuery(
    selectedAssessmentId,
    preview,
  );
  const mutation = useConceptAssessmentAttemptMutation(
    selectedAssessmentId,
    preview,
  );
  const fallbackLessonHref = buildLessonHref(programSlug, lessonSlug);
  useBackNavigationTarget({
    href: fallbackLessonHref,
    labelKey: 'navigation.back.lesson',
  });

  useEffect(() => {
    if (lesson && selectedAssessment) {
      rememberActivity(
        lesson.id,
        activityKey('CONCEPT_ASSESSMENT', selectedAssessment.id),
      );
    }
  }, [lesson, selectedAssessment]);

  if (lessonQuery.isPending) {
    return <Spinner label={t('conceptAssessment.loading')} />;
  }

  if (lessonQuery.error) {
    return (
      <ErrorState description={t('conceptAssessment.loadError')} />
    );
  }

  if (!lesson || !selectedAssessment) {
    return (
      <EmptyState
        action={
          <NavigationAction href={fallbackLessonHref} variant="secondary">
            {t('assessment.openLesson')}
          </NavigationAction>
        }
        description={t('conceptAssessment.notFound.description')}
        title={t('conceptAssessment.notFound.title')}
      />
    );
  }

  if (assessmentQuery.isPending || attemptsQuery.isPending) {
    return <Spinner label={t('conceptAssessment.loading')} />;
  }

  if (
    assessmentQuery.error ||
    attemptsQuery.error ||
    !assessmentQuery.data?.assessment
  ) {
    return (
      <ErrorState description={t('conceptAssessment.loadError')} />
    );
  }

  const assessment = assessmentQuery.data.assessment;
  const passingScore = assessment.concept.masteryThreshold;
  const key = activityKey('CONCEPT_ASSESSMENT', assessment.id);
  const backHref = `${lessonHref(lesson)}?activity=${encodeURIComponent(key)}`;
  const title =
    assessment.title ??
    t('conceptAssessment.defaultTitle', { title: assessment.concept.title });

  return (
    <article class="mx-auto w-full max-w-5xl space-y-6">
      <LessonContextHeader activityTitle={title} lesson={lesson} />
      <section
        class="space-y-3"
        aria-label={t('conceptAssessment.info')}
      >
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          {t('conceptAssessment.concept', { title: assessment.concept.title })}
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <Badge tone={assessment.isRequired ? 'warning' : 'neutral'}>
            {assessment.isRequired
              ? t('common.required')
              : t('conceptAssessment.optional')}
          </Badge>
          {preview ? <Badge tone="warning">{t('common.draft')}</Badge> : null}
        </div>
        {preview ? (
          <p class="text-sm text-amber-200">
            {t('conceptAssessment.preview')}
          </p>
        ) : null}
        <p class="text-sm text-slate-400">
          {t('conceptAssessment.scoreSummary', {
            questions: t('assessment.questionCount', {
              count: assessment.questionCount,
            }),
            score: Math.round(passingScore),
          })}
        </p>
      </section>

      <QuestionAssessmentExperience
        assessment={{ ...assessment, passingScore }}
        attempts={attemptsQuery.data?.attempts ?? []}
        backHref={backHref}
        error={mutation.error}
        hasMoreAttempts={attemptsQuery.hasMore}
        isPending={mutation.isPending}
        isLoadingMoreAttempts={attemptsQuery.isLoadingMore}
        key={assessment.id}
        labels={{
          emptyDescription: t('conceptAssessment.empty.description'),
          emptyTitle: t('conceptAssessment.empty.title'),
          failure: t('conceptAssessment.failure'),
          restart: t('conceptAssessment.restart'),
          success: t('conceptAssessment.success'),
        }}
        onSubmit={mutation.submit}
        onLoadMoreAttempts={attemptsQuery.loadMore}
      />
      <LessonActivitySummary currentKey={key} lesson={lesson} />
    </article>
  );
}
