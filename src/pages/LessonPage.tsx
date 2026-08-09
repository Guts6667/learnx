import { route } from 'preact-router';
import { useEffect, useMemo, useRef } from 'preact/hooks';

import { ContextualNoteAction } from '@/components/learning/ContextualNoteAction';
import { LessonContextHeader } from '@/components/learning/LessonContextHeader';
import { PedagogicalNavigation } from '@/components/learning/PedagogicalNavigation';
import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
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
import {
  activityKey,
  buildLessonActivitySequence,
  type LessonActivity,
  readRememberedActivity,
  rememberActivity,
} from '@/lib/lesson-activity-sequence';

const contentBlockLabels: Record<LessonContentBlock['type'], string> = {
  CALLOUT: 'À retenir',
  DEFINITION: 'Définition',
  DIVIDER: 'Séparation',
  EMBED: 'Contenu intégré',
  EXAMPLE: 'Exemple',
  OBJECTIVE: 'Objectif',
  QUOTE: 'Citation',
  RICH_TEXT: 'Contenu',
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
  block,
  resourcesByKey,
}: {
  block: LessonContentBlock;
  resourcesByKey: Map<string, LessonResource>;
}) {
  if (block.type === 'DIVIDER') return <hr class="border-slate-700" />;
  const sources = getSourceKeys(block.content)
    .map((key) => resourcesByKey.get(key))
    .filter((resource): resource is LessonResource => Boolean(resource));

  return (
    <Card class="space-y-4">
      <p class="text-sm font-semibold text-cyan-300">
        {contentBlockLabels[block.type]}
      </p>
      <SafeMarkdown content={getText(block.content)} />
      {sources.length === 0 ? null : (
        <details class="border-t border-slate-700 pt-3">
          <summary class="min-h-11 cursor-pointer py-3 text-sm font-semibold text-slate-300 focus-visible:outline-2 focus-visible:outline-cyan-300">
            Sources de ce contenu
          </summary>
          <ul class="mt-2 space-y-2 text-sm text-slate-400">
            {sources.map((source) => {
              const url = getSafeExternalUrl(source.url);
              return (
                <li key={source.id}>
                  {source.title}
                  {source.author ? ` — ${source.author}` : ''}
                  {source.citation ? ` — ${source.citation}` : ''}
                  {url ? (
                    <a
                      class="ml-2 text-cyan-300 underline"
                      href={url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ouvrir la source
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </Card>
  );
}

function resourceVerb(type: string): string {
  if (type === 'VIDEO') return 'Regarder';
  if (type === 'PODCAST') return 'Écouter';
  if (['COURSE', 'TOOL', 'WEBSITE'].includes(type)) return 'Explorer';
  return 'Lire';
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
  const guidance = resource.guidance;
  const unavailable = ['broken', 'restricted'].includes(
    guidance?.urlStatus ?? 'ok',
  );
  const href = unavailable ? null : getSafeExternalUrl(resource.url);
  const alternativeHref = getSafeExternalUrl(alternative?.url ?? null);
  const verb = resourceVerb(resource.type);

  return (
    <Card class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <Badge tone={resource.isRequired ? 'warning' : 'neutral'}>
          {resource.isRequired ? 'Obligatoire' : 'Pour aller plus loin'}
        </Badge>
        <Badge tone={status === 'COMPLETED' ? 'success' : 'neutral'}>
          {status === 'COMPLETED' ? 'Consultée' : 'À consulter'}
        </Badge>
      </div>
      {guidance?.objective ? (
        <div>
          <h3 class="font-semibold text-slate-100">Objectif</h3>
          <p class="mt-1 leading-7 text-slate-300">{guidance.objective}</p>
        </div>
      ) : null}
      {guidance?.scope ? (
        <p class="text-sm text-slate-300">
          <strong>Périmètre :</strong> {guidance.scope}
        </p>
      ) : null}
      <p class="leading-7 text-slate-300">
        {guidance?.instructions ?? resource.description}
      </p>
      {unavailable ? (
        <div
          role="status"
          class="space-y-2 rounded-lg border border-amber-700 p-3"
        >
          <p>Cette ressource est actuellement indisponible.</p>
          {alternativeHref ? (
            <a
              class="inline-flex min-h-11 items-center text-cyan-300 underline"
              href={alternativeHref}
              rel="noreferrer"
              target="_blank"
            >
              Ouvrir l’alternative : {alternative?.title}
            </a>
          ) : null}
        </div>
      ) : href ? (
        <a
          class="inline-flex min-h-11 items-center rounded-lg border border-cyan-600 px-4 py-2 font-semibold text-cyan-200 no-underline focus-visible:outline-2 focus-visible:outline-cyan-300"
          href={href}
          onClick={() => void onOpen?.()}
          rel="noreferrer"
          target="_blank"
        >
          {verb === 'Lire' ? 'Ouvrir la lecture' : `${verb} la ressource`}
        </a>
      ) : (
        <p role="status">Aucun lien sûr n’est disponible.</p>
      )}
      {onComplete && status !== 'COMPLETED' ? (
        <Button
          isLoading={isPending}
          onClick={() => void onComplete()}
          variant="secondary"
        >
          Marquer comme consultée
        </Button>
      ) : null}
    </Card>
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
  return (
    <Card class="space-y-4">
      <Badge tone={task.isRequired ? 'warning' : 'neutral'}>
        {task.isRequired ? 'Obligatoire' : 'Optionnelle'}
      </Badge>
      <p class="leading-7 text-slate-300">{task.description}</p>
      {(task.resources ?? []).length === 0 ? null : (
        <ul class="space-y-2" aria-label="Supports de la tâche">
          {(task.resources ?? []).map((resource) => {
            const href = getSafeExternalUrl(resource.url);
            return (
              <li key={resource.id}>
                {href ? (
                  <a
                    class="inline-flex min-h-11 items-center text-cyan-300 underline"
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
            ? 'Marquer comme à faire'
            : 'Marquer comme terminé'}
        </Button>
      ) : null}
    </Card>
  );
}

function SecondaryActivity({ activity }: { activity: LessonActivity }) {
  return (
    <Card class="space-y-3">
      <Badge tone={activity.required ? 'warning' : 'neutral'}>
        {activity.required ? 'Obligatoire' : 'Optionnel'}
      </Badge>
      <p class="leading-7 text-slate-300">
        Cette activité s’ouvre dans une vue dédiée tout en conservant le
        contexte de la leçon.
      </p>
    </Card>
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
    return <Spinner label="Chargement du parcours de la leçon" />;
  }
  if (lesson.isPublished && progressQuery.error) {
    return navigator.onLine ? (
      <ErrorState description="Le parcours de la leçon n’a pas pu être chargé." />
    ) : (
      <EmptyState
        description="Reconnectez-vous puis rechargez cette activité. Aucune progression n’a été simulée."
        title="Leçon indisponible hors ligne"
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
        ? 'Leçon suivante'
        : 'Terminer la leçon'
    : 'Continuer';
  const isContinueDisabled = isCompletionActivity
    ? !lesson.isPublished || (!isLessonCompleted && !progress?.canComplete)
    : !sequence.next;
  const completedLessonHref =
    sequence.next?.href ??
    programStageHref(programSlug, lesson.module.stage.slug);

  return (
    <article
      class="mx-auto w-full max-w-6xl space-y-6"
      aria-labelledby="lesson-title"
    >
      <LessonContextHeader
        lesson={lesson}
        percent={progress?.lessonProgress.percent ?? 0}
      />
      {lesson.isPublished ? null : (
        <Card class="border border-amber-800/70 bg-amber-950/30">
          <p class="font-semibold text-amber-200">
            Prévisualisation en lecture seule
          </p>
          <p class="mt-2 text-sm text-amber-100/80">
            La séquence est consultable, mais aucune progression ne sera créée.
          </p>
        </Card>
      )}
      <p class="leading-7 text-slate-300">{lesson.summary}</p>
      <div class="grid gap-6">
        <section class="space-y-4" aria-labelledby="current-activity-title">
          {current ? (
            <div
              data-activity-key={activityKey(current.kind, current.id)}
              tabIndex={-1}
            >
              <p class="text-sm font-semibold text-cyan-300">{current.label}</p>
              <h2 class="mt-2 text-2xl font-bold" id="current-activity-title">
                {current.title}
              </h2>
              {current.estimatedMinutes === null ? null : (
                <p class="mt-2 text-sm text-slate-400">
                  Durée indicative : {current.estimatedMinutes} min
                </p>
              )}
            </div>
          ) : null}
          {block ? (
            <ContentActivity block={block} resourcesByKey={resourcesByKey} />
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
              <p class="text-sm text-slate-300">
                {progress?.canComplete
                  ? 'Toutes les activités obligatoires sont validées.'
                  : 'Des activités obligatoires restent à terminer.'}
              </p>
            </Card>
          ) : null}
          {mutation.error ? (
            <ErrorState description="La progression n’a pas pu être mise à jour." />
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

  if (query.isPending) return <Spinner label="Chargement de la leçon" />;
  if (query.error) {
    return navigator.onLine ? (
      <ErrorState description="La leçon n’a pas pu être chargée." />
    ) : (
      <EmptyState
        description="Reconnectez-vous puis relancez cette activité. Aucune progression n’a été simulée."
        title="Leçon indisponible hors ligne"
      />
    );
  }
  if (!query.data?.lesson) {
    return (
      <EmptyState
        description="Cette leçon est indisponible."
        title="Leçon introuvable"
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
            Voir les prérequis
          </NavigationAction>
        }
        description="Terminez les prérequis de l’étape précédente avant de commencer cette leçon."
        title="Leçon verrouillée"
      />
    );
  }

  return (
    <LessonWorkspace lesson={query.data.lesson} programSlug={programSlug} />
  );
}
