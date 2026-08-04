import { route } from 'preact-router';
import { useEffect, useMemo } from 'preact/hooks';

import { LessonContextHeader } from '@/components/learning/LessonContextHeader';
import { PedagogicalNavigation } from '@/components/learning/PedagogicalNavigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
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
import { useNoteMutation } from '@/features/notes/queries';
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
        <footer class="border-t border-slate-700 pt-3">
          <h3 class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Sources de ce bloc
          </h3>
          <ul class="mt-2 space-y-2 text-sm text-slate-400">
            {sources.map((source) => {
              const url = getSafeExternalUrl(source.url);
              return (
                <li key={source.id}>
                  {source.title}
                  {source.author ? ` — ${source.author}` : ''}
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
        </footer>
      )}
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
  const progressQuery = useLessonProgressQuery(lesson.id, lesson.isPublished);
  const mutation = useLessonProgressMutation(lesson.id);
  const noteMutation = useNoteMutation();
  const currentKey =
    new URLSearchParams(window.location.search).get('activity') ??
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
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-activity-key="${activityKey(current.kind, current.id)}"]`,
        )
        ?.focus();
    });
  }, [current, lesson.id]);

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

  async function continueLearning() {
    if (!current) return;
    if (current.kind === 'COMPLETE') {
      if (progress?.lessonProgress.status === 'COMPLETED') {
        void route(
          sequence.next?.href ??
            `/program/${encodeURIComponent(programSlug)}/module/${encodeURIComponent(lesson.module.slug)}`,
        );
        return;
      }
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

  async function createNote() {
    const note = await noteMutation.create({
      lessonId: lesson.id,
      title: `Notes — ${lesson.title}`,
    });
    void route(`/notes/${encodeURIComponent(note.id)}`);
  }

  const resourcesByKey = new Map(
    lesson.resources.flatMap((resource) =>
      resource.key ? ([[resource.key, resource]] as const) : [],
    ),
  );
  const block = lesson.contentBlocks.find((item) => item.id === current?.id);
  const task = lesson.tasks.find((item) => item.id === current?.id);
  const isCompletionActivity = current?.kind === 'COMPLETE';
  const isLessonCompleted = progress?.lessonProgress.status === 'COMPLETED';
  const continueLabel = isCompletionActivity
    ? isLessonCompleted && !sequence.next
      ? 'Retour au module'
      : isLessonCompleted
        ? 'Continuer'
        : 'Terminer la leçon'
    : 'Continuer';
  const isContinueDisabled = isCompletionActivity
    ? !lesson.isPublished || (!isLessonCompleted && !progress?.canComplete)
    : !sequence.next;

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
      {lesson.resources.length === 0 ? null : (
        <Card class="space-y-3">
          <h2 class="text-lg font-semibold" id="lesson-resources-title">
            Ressources de la leçon
          </h2>
          <ul class="space-y-2" aria-labelledby="lesson-resources-title">
            {lesson.resources.map((item) => {
              const href = getSafeExternalUrl(item.url);
              return (
                <li key={item.id}>
                  {href ? (
                    <a
                      class="inline-flex min-h-11 items-center text-cyan-300 underline"
                      href={href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span>{item.title}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
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
          {current &&
          !block &&
          !task &&
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
          <Button
            isLoading={noteMutation.isPending}
            onClick={() => void createNote()}
            variant="ghost"
          >
            Prendre une note liée
          </Button>
        </section>
      </div>
      {current ? (
        <PedagogicalNavigation
          activities={sequence.activities}
          continueActivity={sequence.next}
          continueLabel={continueLabel}
          currentKey={activityKey(current.kind, current.id)}
          isContinueDisabled={isContinueDisabled}
          isContinuePending={mutation.isPending}
          lessonTitle={lesson.title}
          moduleTitle={lesson.module.title}
          onContinue={() => void continueLearning()}
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

  if (query.isPending) return <Spinner label="Chargement de la leçon" />;
  if (query.error) {
    return <ErrorState description="La leçon n’a pas pu être chargée." />;
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
          <a
            class="inline-flex min-h-11 items-center text-cyan-300 underline"
            href={`/program/${encodeURIComponent(programSlug)}/stage/${encodeURIComponent(stage.slug)}`}
          >
            Voir les prérequis
          </a>
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
