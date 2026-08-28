import { navigate as route } from '@/app/navigation';
import { useEffect, useMemo, useRef } from 'react';

import { ContextualNoteAction } from '@/components/learning/ContextualNoteAction';
import { LessonContextHeader } from '@/components/learning/LessonContextHeader';
import { LessonActivitySurface } from '@/components/learning/LessonActivitySurface';
import { PedagogicalNavigation } from '@/components/learning/PedagogicalNavigation';
import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { QueryState } from '@/components/learnx/QueryState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { Spinner } from '@/components/ui/Spinner';
import {
  type LessonContentBlock,
  type LessonDetail,
  type LessonProgressResponse,
  type LessonResource,
  type LessonTask,
  type TaskCompletionStatus,
  useLessonProgressMutation,
  useLessonProgressQuery,
  useLessonQuery,
} from '@/features/curriculum/queries';
import { programStageHref } from '@/lib/curriculum-navigation';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/catalogs';
import {
  activityKey,
  buildLessonActivitySequence,
  type LessonActivity,
  readRememberedActivity,
  rememberActivity,
} from '@/lib/lesson-activity-sequence';

const contentBlockLabelKeys: Record<LessonContentBlock['type'], MessageKey> = {
  CALLOUT: 'learning.content.callout',
  DEFINITION: 'learning.content.definition',
  DIVIDER: 'learning.content.divider',
  EMBED: 'learning.content.embed',
  EXAMPLE: 'learning.content.example',
  OBJECTIVE: 'learning.content.objective',
  QUOTE: 'learning.content.quote',
  RICH_TEXT: 'learning.content.richText',
};

function getText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return value.map(getText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const text = record.text ?? record.content ?? record.markdown;
    return typeof text === 'string' ? text : '';
  }
  return '';
}

function getSourceKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const sourceKeys = (value as Record<string, unknown>).sourceKeys;
  return Array.isArray(sourceKeys)
    ? sourceKeys.filter((key): key is string => typeof key === 'string')
    : [];
}

function getSafeExternalUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function ContentActivity({
  activityTitle,
  block,
  resourcesByKey,
}: {
  activityTitle: string;
  block: LessonContentBlock;
  resourcesByKey: Map<string, LessonResource>;
}) {
  const { t } = useI18n();
  if (block.type === 'DIVIDER')
    return <hr className="border-[var(--color-border)]" />;
  const sources = getSourceKeys(block.content)
    .map((key) => resourcesByKey.get(key))
    .filter((resource): resource is LessonResource => Boolean(resource));

  return (
    <LessonActivitySurface className="totem-learning-content-block space-y-4">
      <p className="text-sm font-semibold text-[var(--color-accent-text)]">
        {t(contentBlockLabelKeys[block.type])}
      </p>
      <SafeMarkdown
        content={getText(block.content)}
        headingStartLevel={3}
        omitFirstHeadingWhenEqual={activityTitle}
      />
      {sources.length === 0 ? null : (
        <details className="border-t border-[var(--color-border)] pt-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--color-text-muted)]">
            {t('learning.sources')}
          </summary>
          <ul className="mt-2 space-y-2 text-sm text-[var(--color-text-muted)]">
            {sources.map((source) => {
              const url = getSafeExternalUrl(source.url);
              return (
                <li key={source.id}>
                  {source.title}
                  {source.author ? ` — ${source.author}` : ''}
                  {source.citation ? ` — ${source.citation}` : ''}
                  {url ? (
                    <a
                      className="ml-2 text-[var(--color-action)] underline"
                      href={url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {t('learning.source.open')}
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </LessonActivitySurface>
  );
}

function resourceVerbKey(type: string): MessageKey {
  if (type === 'VIDEO') return 'learning.resource.watch';
  if (type === 'PODCAST') return 'learning.resource.listen';
  if (['COURSE', 'TOOL', 'WEBSITE'].includes(type)) {
    return 'learning.resource.explore';
  }
  return 'learning.resource.read';
}

function ResourceActivity({
  alternative,
  isPending,
  onOpen,
  onComplete,
  resource,
  status,
}: {
  alternative?: LessonResource;
  isPending: boolean;
  onOpen?: () => Promise<void>;
  onComplete?: () => Promise<void>;
  resource: LessonResource;
  status: 'COMPLETED' | 'NOT_STARTED' | 'STARTED';
}) {
  const { t } = useI18n();
  const guidance = resource.guidance;
  const unavailable = ['broken', 'restricted'].includes(
    guidance?.urlStatus ?? 'ok',
  );
  const href = unavailable ? null : getSafeExternalUrl(resource.url);
  const alternativeHref = getSafeExternalUrl(alternative?.url ?? null);
  const verb = t(resourceVerbKey(resource.type));

  return (
    <LessonActivitySurface className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={resource.isRequired ? 'warning' : 'neutral'}>
          {resource.isRequired
            ? t('common.required')
            : t('learning.resource.further')}
        </Badge>
        <Badge tone={status === 'COMPLETED' ? 'success' : 'neutral'}>
          {status === 'COMPLETED'
            ? t('learning.resource.consulted')
            : t('learning.resource.toConsult')}
        </Badge>
      </div>
      {guidance?.objective ? (
        <div>
          <h3 className="ui-text font-semibold">
            {t('learning.resource.objective')}
          </h3>
          <p className="ui-reading-copy mt-1">{guidance.objective}</p>
        </div>
      ) : null}
      {guidance?.scope ? (
        <p className="ui-text-muted text-sm">
          <strong>{t('learning.resource.scope')}</strong> {guidance.scope}
        </p>
      ) : null}
      <p className="ui-reading-copy">
        {guidance?.instructions ?? resource.description}
      </p>
      {unavailable ? (
        <div
          role="status"
          className="ui-feedback ui-feedback--warning space-y-2"
        >
          <p>{t('learning.resource.unavailable')}</p>
          {alternativeHref ? (
            <a
              className="ui-link inline-flex min-h-11 items-center"
              href={alternativeHref}
              rel="noreferrer"
              target="_blank"
            >
              {t('learning.resource.openAlternative', {
                title: alternative?.title ?? '',
              })}
            </a>
          ) : null}
        </div>
      ) : href ? (
        <div className="lesson-resource-actions">
          <a
            className="ui-action ui-action--primary ui-action--md"
            href={href}
            onClick={() => void onOpen?.()}
            rel="noreferrer"
            target="_blank"
          >
            {resourceVerbKey(resource.type) === 'learning.resource.read'
              ? t('learning.resource.openReading')
              : t('learning.resource.open', { verb })}
          </a>
          {onComplete && status !== 'COMPLETED' ? (
            <Button
              isLoading={isPending}
              onClick={() => void onComplete()}
              variant="secondary"
            >
              {t('learning.resource.markConsulted')}
            </Button>
          ) : null}
        </div>
      ) : (
        <p role="status">{t('learning.source.none')}</p>
      )}
      {!href && onComplete && status !== 'COMPLETED' ? (
        <Button
          isLoading={isPending}
          onClick={() => void onComplete()}
          variant="secondary"
        >
          {t('learning.resource.markConsulted')}
        </Button>
      ) : null}
    </LessonActivitySurface>
  );
}

function TaskActivity({
  isPending,
  onToggle,
  status,
  task,
}: {
  isPending: boolean;
  onToggle?: () => Promise<void>;
  status: TaskCompletionStatus;
  task: LessonTask;
}) {
  const { t } = useI18n();
  return (
    <LessonActivitySurface className="space-y-4">
      <Badge tone={task.isRequired ? 'warning' : 'neutral'}>
        {task.isRequired ? t('common.required') : t('learning.task.optional')}
      </Badge>
      <p className="ui-reading-copy">{task.description}</p>
      {(task.resources ?? []).length === 0 ? null : (
        <ul className="space-y-2" aria-label={t('learning.task.supports')}>
          {(task.resources ?? []).map((resource) => {
            const href = getSafeExternalUrl(resource.url);
            return (
              <li key={resource.id}>
                {href ? (
                  <a
                    className="ui-link inline-flex min-h-11 items-center"
                    href={href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {resource.title}
                  </a>
                ) : (
                  <span>{resource.title}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {onToggle ? (
        <Button
          isLoading={isPending}
          onClick={() => void onToggle()}
          variant="secondary"
        >
          {status === 'DONE'
            ? t('learning.task.markTodo')
            : t('learning.task.markComplete')}
        </Button>
      ) : null}
    </LessonActivitySurface>
  );
}

function SecondaryActivity({ activity }: { activity: LessonActivity }) {
  const { t } = useI18n();
  return (
    <LessonActivitySurface className="space-y-3">
      <Badge tone={activity.required ? 'warning' : 'neutral'}>
        {activity.required
          ? t('common.required')
          : t('learning.secondary.optional')}
      </Badge>
      <p className="ui-reading-copy">{t('learning.secondary.description')}</p>
    </LessonActivitySurface>
  );
}

function sequenceInput(
  lesson: LessonDetail,
  progress: LessonProgressResponse | undefined,
  programSlug: string,
) {
  return {
    concepts: lesson.concepts,
    contentBlocks: lesson.contentBlocks,
    exercises: lesson.exercises,
    isPublished: lesson.isPublished,
    lessonSlug: lesson.slug,
    nextLesson: lesson.navigation.nextLesson,
    programSlug,
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
  };
}

function LessonWorkspace({
  lesson,
  programSlug,
}: {
  lesson: LessonDetail;
  programSlug: string;
}) {
  const { t } = useI18n();
  const progressQuery = useLessonProgressQuery(lesson.id, lesson.isPublished);
  const mutation = useLessonProgressMutation(lesson.id);
  const lastReportedActivity = useRef<string | null>(null);
  const serverActivity = progressQuery.data?.currentActivity;
  const currentKey =
    new URLSearchParams(window.location.search).get('activity') ??
    (serverActivity
      ? activityKey(serverActivity.kind, serverActivity.id)
      : null) ??
    readRememberedActivity(lesson.id);
  const sequence = useMemo(
    () =>
      buildLessonActivitySequence(
        sequenceInput(lesson, progressQuery.data, programSlug),
        currentKey,
      ),
    [currentKey, lesson, programSlug, progressQuery.data],
  );
  const current = sequence.current;
  const progress = progressQuery.data;

  useEffect(() => {
    if (!current) return;
    rememberActivity(lesson.id, activityKey(current.kind, current.id));
    const key = activityKey(current.kind, current.id);
    if (
      lesson.isPublished &&
      current.kind !== 'COMPLETE' &&
      lastReportedActivity.current !== key
    ) {
      lastReportedActivity.current = key;
      void mutation
        .mutateAsync(
          `/api/lessons/${encodeURIComponent(lesson.id)}/location`,
          'PATCH',
          { id: current.id, kind: current.kind },
        )
        .catch(() => {
          lastReportedActivity.current = null;
        });
    }
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-activity-key="${activityKey(current.kind, current.id)}"]`,
        )
        ?.focus();
    });
  }, [current, lesson.id, lesson.isPublished]);

  if (lesson.isPublished && progressQuery.isPending) {
    return <Spinner label={t('learning.pathLoading')} />;
  }
  if (lesson.isPublished && progressQuery.error) {
    return navigator.onLine ? (
      <ErrorState description={t('learning.pathError')} />
    ) : (
      <EmptyState
        description={t('learning.offline.description')}
        title={t('learning.offline.title')}
      />
    );
  }

  async function updateTask(task: LessonTask) {
    const currentStatus = progress?.taskCompletions[task.id] ?? 'TODO';
    await mutation.mutateAsync(
      `/api/tasks/${encodeURIComponent(task.id)}`,
      'PATCH',
      {
        status: currentStatus === 'DONE' ? 'TODO' : 'DONE',
      },
    );
  }

  async function updateResource(
    resource: LessonResource,
    status: 'COMPLETED' | 'STARTED',
  ) {
    await mutation.mutateAsync(
      `/api/resources/${encodeURIComponent(resource.id)}/progress`,
      'PATCH',
      { status },
    );
  }

  async function continueLearning() {
    if (!current) return;
    if (current.kind === 'COMPLETE') {
      if (progress?.canComplete) {
        await mutation.mutateAsync(
          `/api/lessons/${encodeURIComponent(lesson.id)}/complete`,
          'POST',
        );
      }
      return;
    }
    if (progress?.lessonProgress.status === 'AVAILABLE') {
      await mutation.mutateAsync(
        `/api/lessons/${encodeURIComponent(lesson.id)}/start`,
        'POST',
      );
    }
    void route(sequence.next?.href ?? current.href);
  }

  const resourcesByKey = new Map(
    lesson.resources.flatMap((resource) =>
      resource.key ? ([[resource.key, resource]] as const) : [],
    ),
  );
  const block = lesson.contentBlocks.find((item) => item.id === current?.id);
  const task = lesson.tasks.find((item) => item.id === current?.id);
  const resource = lesson.resources.find((item) => item.id === current?.id);
  const isCompletionActivity = current?.kind === 'COMPLETE';
  const isLessonCompleted = progress?.lessonProgress.status === 'COMPLETED';
  const continueLabel = isCompletionActivity
    ? isLessonCompleted && !sequence.next
      ? t('learning.returnProgram')
      : isLessonCompleted
        ? t('learning.nextLesson')
        : t('learning.finishLesson')
    : t('common.continue');
  const isContinueDisabled = isCompletionActivity
    ? !lesson.isPublished || (!isLessonCompleted && !progress?.canComplete)
    : !sequence.next;
  const completedLessonHref =
    sequence.next?.href ??
    programStageHref(programSlug, lesson.module.stage.slug);

  return (
    <article
      className="totem-learning-page page-layout page-layout--reading space-y-6"
      aria-labelledby="lesson-title"
    >
      <LessonContextHeader
        lesson={lesson}
        percent={progress?.lessonProgress.percent ?? 0}
      />
      {lesson.isPublished ? null : (
        <Card tone="muted">
          <p className="ui-text-warning font-semibold">
            {t('learning.draftPreview')}
          </p>
          <p className="ui-text-muted mt-2 text-sm">
            {t('learning.previewDescription')}
          </p>
        </Card>
      )}
      <p className="totem-learning-summary ui-reading-copy">{lesson.summary}</p>
      <div className="totem-learning-layout grid gap-6">
        <section
          className="totem-learning-activity space-y-4"
          aria-labelledby="current-activity-title"
        >
          {current ? (
            <div
              data-activity-key={activityKey(current.kind, current.id)}
              tabIndex={-1}
            >
              <p className="page-eyebrow">{current.label}</p>
              <h2
                className="mt-2 text-2xl font-bold"
                id="current-activity-title"
              >
                {current.title}
              </h2>
              {current.estimatedMinutes === null ? null : (
                <p className="ui-text-muted mt-2 text-sm">
                  {t('learning.duration', { count: current.estimatedMinutes })}
                </p>
              )}
            </div>
          ) : null}
          {block ? (
            <ContentActivity
              activityTitle={current?.title ?? ''}
              block={block}
              resourcesByKey={resourcesByKey}
            />
          ) : null}
          {task ? (
            <TaskActivity
              isPending={mutation.isPending}
              onToggle={lesson.isPublished ? () => updateTask(task) : undefined}
              status={progress?.taskCompletions[task.id] ?? 'TODO'}
              task={task}
            />
          ) : null}
          {resource ? (
            <ResourceActivity
              alternative={
                resource.guidance?.alternativeResourceKey
                  ? resourcesByKey.get(resource.guidance.alternativeResourceKey)
                  : undefined
              }
              isPending={mutation.isPending}
              onComplete={
                lesson.isPublished
                  ? () => updateResource(resource, 'COMPLETED')
                  : undefined
              }
              onOpen={
                lesson.isPublished
                  ? () => updateResource(resource, 'STARTED')
                  : undefined
              }
              resource={resource}
              status={progress?.resourceProgress[resource.id] ?? 'NOT_STARTED'}
            />
          ) : null}
          {current &&
          !block &&
          !task &&
          !resource &&
          current.kind !== 'COMPLETE' ? (
            <SecondaryActivity activity={current} />
          ) : null}
          {current?.kind === 'COMPLETE' ? (
            <Card>
              <p className="ui-text-muted text-sm">
                {progress?.canComplete
                  ? t('learning.allRequiredComplete')
                  : t('learning.requiredRemaining')}
              </p>
            </Card>
          ) : null}
          {mutation.error ? (
            <ErrorState description={t('learning.progressUpdateError')} />
          ) : null}
          {current ? (
            <ContextualNoteAction
              activity={current}
              key={activityKey(current.kind, current.id)}
              lesson={lesson}
            />
          ) : null}
        </section>
      </div>
      {current ? (
        <PedagogicalNavigation
          activities={sequence.activities}
          continueActivity={sequence.next}
          continueHref={
            isCompletionActivity && isLessonCompleted
              ? completedLessonHref
              : undefined
          }
          continueLabel={continueLabel}
          currentKey={activityKey(current.kind, current.id)}
          isContinueDisabled={isContinueDisabled}
          isContinuePending={mutation.isPending}
          lessonTitle={lesson.title}
          moduleTitle={lesson.module.title}
          onContinue={
            isCompletionActivity && isLessonCompleted
              ? undefined
              : () => void continueLearning()
          }
        />
      ) : null}
    </article>
  );
}

export function LessonPage({
  lessonSlug,
  programSlug,
}: {
  lessonSlug: string;
  programSlug: string;
}) {
  const { t } = useI18n();
  const query = useLessonQuery(lessonSlug);
  const stageSlug = query.data?.lesson.module.stage.slug;
  useBackNavigationTarget(
    stageSlug
      ? {
          href: programStageHref(programSlug, stageSlug),
          labelKey: 'navigation.back.program',
        }
      : null,
  );

  if (query.isPending) return <Spinner label={t('common.loading')} />;
  if (query.error) {
    return navigator.onLine ? (
      <QueryState
        error={query.error}
        errorDescription={t('learning.loadError')}
        isPending={query.isPending}
        loadingLabel={t('common.loading')}
        onRetry={query.reload}
        retryLabel={t('common.retry')}
      />
    ) : (
      <EmptyState
        description={t('learning.offline.description')}
        title={t('learning.offline.title')}
      />
    );
  }
  if (!query.data?.lesson) {
    return (
      <EmptyState
        description={t('learning.notFound.description')}
        title={t('learning.notFound.title')}
      />
    );
  }

  if (query.data.lesson.isLocked) {
    const stage = query.data.lesson.module.stage;
    return (
      <EmptyState
        action={
          <NavigationAction
            href={`/program/${encodeURIComponent(programSlug)}/stage/${encodeURIComponent(stage.slug)}`}
            variant="secondary"
          >
            {t('learning.viewPrerequisites')}
          </NavigationAction>
        }
        description={t('learning.locked.description')}
        title={t('learning.locked.title')}
      />
    );
  }

  return (
    <LessonWorkspace lesson={query.data.lesson} programSlug={programSlug} />
  );
}
