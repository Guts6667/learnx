import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import {
  type ContentBlockType,
  type LessonContentBlock,
  type LessonExerciseSummary,
  type LessonResource,
  type LessonQuizSummary,
  type LessonTask,
  type ResourceProgressStatus,
  type TaskCompletionStatus,
  useLessonQuery,
  useLessonProgressMutation,
  useLessonProgressQuery,
} from '@/features/curriculum/queries';
import { ExerciseCard } from '@/features/exercises/ExerciseCard';

const contentBlockLabels: Record<ContentBlockType, string> = {
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
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(getText).filter(Boolean).join('\n');
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const text = record.text ?? record.content ?? record.markdown;

    if (typeof text === 'string') {
      return text;
    }
  }

  return '';
}

function getObjectives(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((objective): objective is string => typeof objective === 'string')
    .filter(Boolean);
}

function formatDuration(minutes: number | null): string | null {
  if (minutes === null) {
    return null;
  }

  return `${minutes} min`;
}

function getSafeExternalUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? parsedUrl.toString()
      : null;
  } catch {
    return null;
  }
}

function ContentBlock({ block }: { block: LessonContentBlock }) {
  if (block.type === 'DIVIDER') {
    return <hr aria-label="Séparation de contenu" class="border-slate-700" />;
  }

  const text = getText(block.content);

  if (!text) {
    return null;
  }

  return (
    <Card class="space-y-2">
      <h3 class="text-sm font-semibold text-cyan-300">
        {contentBlockLabels[block.type]}
      </h3>
      <p class="whitespace-pre-line leading-7 text-slate-200">{text}</p>
    </Card>
  );
}

function ResourceCard({
  isPending,
  onProgressChange,
  progressStatus,
  resource,
}: {
  isPending: boolean;
  onProgressChange?: (status: ResourceProgressStatus) => Promise<void>;
  progressStatus: ResourceProgressStatus;
  resource: LessonResource;
}) {
  const url = getSafeExternalUrl(resource.url);
  const duration = formatDuration(resource.estimatedMinutes);

  return (
    <Card class="space-y-2">
      <div class="flex items-start justify-between gap-3">
        <h3 class="font-semibold">{resource.title}</h3>
        <span class="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
          {resource.isRequired ? 'Obligatoire' : 'Optionnelle'}
        </span>
      </div>
      <p class="text-sm text-slate-400">
        {resource.type}
        {resource.author ? ` · ${resource.author}` : ''}
        {duration ? ` · ${duration}` : ''}
      </p>
      {resource.description ? (
        <p class="text-sm leading-6 text-slate-300">{resource.description}</p>
      ) : null}
      {resource.citation ? (
        <p class="text-sm italic text-slate-400">{resource.citation}</p>
      ) : null}
      {url ? (
        <a
          class="inline-flex min-h-11 items-center text-cyan-300 underline"
          href={url}
          rel="noreferrer"
          target="_blank"
        >
          Consulter la ressource
        </a>
      ) : null}
      {onProgressChange ? (
        <button
          class="min-h-11 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || progressStatus === 'COMPLETED'}
          onClick={() => void onProgressChange('COMPLETED')}
          type="button"
        >
          {progressStatus === 'COMPLETED'
            ? 'Ressource consultée'
            : 'Marquer comme consultée'}
        </button>
      ) : null}
    </Card>
  );
}

function TaskCard({
  isPending,
  onStatusChange,
  status,
  task,
}: {
  isPending: boolean;
  onStatusChange?: (status: TaskCompletionStatus) => Promise<void>;
  status: TaskCompletionStatus;
  task: LessonTask;
}) {
  return (
    <Card class="space-y-2">
      <div class="flex items-start justify-between gap-3">
        <h3 class="font-semibold">{task.title}</h3>
        <span class="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
          {task.isRequired ? 'Obligatoire' : 'Optionnelle'}
        </span>
      </div>
      <p class="text-sm text-slate-400">{task.type}</p>
      {task.description ? (
        <p class="text-sm leading-6 text-slate-300">{task.description}</p>
      ) : null}
      {onStatusChange ? (
        <button
          class="min-h-11 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={() =>
            void onStatusChange(status === 'DONE' ? 'TODO' : 'DONE')
          }
          type="button"
        >
          {status === 'DONE'
            ? 'Marquer comme à faire'
            : 'Marquer comme terminée'}
        </button>
      ) : null}
    </Card>
  );
}

function LessonActivityProgress({
  lessonId,
  resources,
  tasks,
}: {
  lessonId: string;
  resources: LessonResource[];
  tasks: LessonTask[];
}) {
  const query = useLessonProgressQuery(lessonId);
  const mutation = useLessonProgressMutation(lessonId);
  const progress = query.data;
  const percent = progress?.lessonProgress.percent ?? 0;
  const canComplete = progress?.canComplete ?? false;
  const lessonStatus = progress?.lessonProgress.status ?? 'AVAILABLE';

  async function updateTask(taskId: string, status: TaskCompletionStatus) {
    await mutation.mutateAsync(
      `/api/tasks/${encodeURIComponent(taskId)}`,
      'PATCH',
      {
        status,
      },
    );
  }

  async function updateResource(
    resourceId: string,
    status: ResourceProgressStatus,
  ) {
    await mutation.mutateAsync(
      `/api/resources/${encodeURIComponent(resourceId)}/progress`,
      'PATCH',
      { status },
    );
  }

  async function startLesson() {
    await mutation.mutateAsync(
      `/api/lessons/${encodeURIComponent(lessonId)}/start`,
      'POST',
    );
  }

  async function completeLesson() {
    await mutation.mutateAsync(
      `/api/lessons/${encodeURIComponent(lessonId)}/complete`,
      'POST',
    );
  }

  if (query.isPending) {
    return <Spinner label="Chargement de la progression" size="sm" />;
  }

  if (query.error || mutation.error) {
    return (
      <ErrorState description="La progression n’a pas pu être mise à jour." />
    );
  }

  return (
    <>
      <section aria-labelledby="lesson-progress-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="lesson-progress-title">
          Progression
        </h2>
        <Card class="space-y-4">
          <ProgressBar label="Progression de la leçon" value={percent} />
          <p class="text-sm text-slate-300">
            Statut :{' '}
            {lessonStatus === 'COMPLETED'
              ? 'Terminée'
              : lessonStatus === 'IN_PROGRESS'
                ? 'En cours'
                : 'À commencer'}
          </p>
          <div class="flex flex-wrap gap-3">
            <button
              class="min-h-11 rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={mutation.isPending || lessonStatus !== 'AVAILABLE'}
              onClick={() => void startLesson()}
              type="button"
            >
              Commencer la leçon
            </button>
            <button
              class="min-h-11 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                mutation.isPending ||
                lessonStatus === 'COMPLETED' ||
                !canComplete
              }
              onClick={() => void completeLesson()}
              type="button"
            >
              Terminer la leçon
            </button>
          </div>
          {!canComplete ? (
            <p class="text-sm text-slate-400">
              Terminez les activités suivies pour pouvoir terminer la leçon.
            </p>
          ) : null}
        </Card>
      </section>

      <section aria-labelledby="resources-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="resources-title">
          Ressources
        </h2>
        {resources.length === 0 ? (
          <EmptyState
            description="Les ressources associées apparaîtront ici."
            title="Aucune ressource disponible"
          />
        ) : (
          resources.map((resource) => (
            <ResourceCard
              isPending={mutation.isPending}
              key={resource.id}
              onProgressChange={(status) => updateResource(resource.id, status)}
              progressStatus={
                progress?.resourceProgress[resource.id] ?? 'NOT_STARTED'
              }
              resource={resource}
            />
          ))
        )}
      </section>

      <section aria-labelledby="tasks-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="tasks-title">
          Tâches
        </h2>
        {tasks.length === 0 ? (
          <EmptyState
            description="Les tâches associées apparaîtront ici."
            title="Aucune tâche disponible"
          />
        ) : (
          tasks.map((task) => (
            <TaskCard
              isPending={mutation.isPending}
              key={task.id}
              onStatusChange={(status) => updateTask(task.id, status)}
              status={progress?.taskCompletions[task.id] ?? 'TODO'}
              task={task}
            />
          ))
        )}
      </section>
    </>
  );
}

function DraftLessonActivities({
  resources,
  tasks,
}: {
  resources: LessonResource[];
  tasks: LessonTask[];
}) {
  return (
    <>
      <Card class="space-y-2 border border-amber-800/70 bg-amber-950/30">
        <h2 class="font-semibold text-amber-200">
          Prévisualisation en lecture seule
        </h2>
        <p class="text-sm leading-6 text-amber-100/80">
          La progression sera disponible lorsque cette leçon et sa hiérarchie
          seront publiées.
        </p>
      </Card>

      <section aria-labelledby="resources-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="resources-title">
          Ressources
        </h2>
        {resources.length === 0 ? (
          <EmptyState
            description="Les ressources associées apparaîtront ici."
            title="Aucune ressource disponible"
          />
        ) : (
          resources.map((resource) => (
            <ResourceCard
              isPending={false}
              key={resource.id}
              progressStatus="NOT_STARTED"
              resource={resource}
            />
          ))
        )}
      </section>

      <section aria-labelledby="tasks-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="tasks-title">
          Tâches
        </h2>
        {tasks.length === 0 ? (
          <EmptyState
            description="Les tâches associées apparaîtront ici."
            title="Aucune tâche disponible"
          />
        ) : (
          tasks.map((task) => (
            <TaskCard
              isPending={false}
              key={task.id}
              status="TODO"
              task={task}
            />
          ))
        )}
      </section>
    </>
  );
}

function QuizCard({
  isPublished,
  lessonSlug,
  programSlug,
  quiz,
}: {
  isPublished: boolean;
  lessonSlug: string;
  programSlug: string;
  quiz: LessonQuizSummary;
}) {
  const href = `/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(lessonSlug)}/quiz?quizId=${encodeURIComponent(quiz.id)}`;

  return (
    <Card class="space-y-3">
      <div class="flex items-start justify-between gap-3">
        <h3 class="font-semibold">{quiz.title}</h3>
        <Badge tone={quiz.isRequired ? 'warning' : 'neutral'}>
          {quiz.isRequired ? 'Obligatoire' : 'Optionnel'}
        </Badge>
      </div>
      {quiz.description ? (
        <p class="text-sm leading-6 text-slate-300">{quiz.description}</p>
      ) : null}
      <p class="text-sm text-slate-400">
        {quiz.questionCount} questions · seuil : {Math.round(quiz.passingScore)}{' '}
        %
      </p>
      {isPublished ? (
        <a
          class="inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950"
          href={href}
        >
          Commencer le quiz
        </a>
      ) : (
        <button
          class="min-h-11 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-400"
          disabled
          type="button"
        >
          Quiz disponible après publication
        </button>
      )}
    </Card>
  );
}

function AssessmentsSection({
  exercises,
  isPublished,
  lessonSlug,
  programSlug,
  quizzes,
}: {
  exercises: LessonExerciseSummary[];
  isPublished: boolean;
  lessonSlug: string;
  programSlug: string;
  quizzes: LessonQuizSummary[];
}) {
  return (
    <section aria-labelledby="assessments-title" class="space-y-3">
      <h2 class="text-xl font-semibold" id="assessments-title">
        Évaluations
      </h2>
      {quizzes.length === 0 ? (
        <Card class="space-y-3">
          <h3 class="font-semibold">Quiz</h3>
          <p class="text-sm text-slate-300">Aucun quiz n’est disponible.</p>
          <button
            class="min-h-11 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-400"
            disabled
            type="button"
          >
            Quiz indisponible
          </button>
        </Card>
      ) : (
        quizzes.map((quiz) => (
          <QuizCard
            isPublished={isPublished}
            key={quiz.id}
            lessonSlug={lessonSlug}
            programSlug={programSlug}
            quiz={quiz}
          />
        ))
      )}
      {exercises.length === 0 ? (
        <Card class="space-y-3">
          <h3 class="font-semibold">Exercice</h3>
          <p class="text-sm text-slate-300">Aucun exercice n’est disponible.</p>
          <button
            class="min-h-11 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-400"
            disabled
            type="button"
          >
            Exercice indisponible
          </button>
        </Card>
      ) : (
        exercises.map((exercise) => (
          <ExerciseCard
            exercise={exercise}
            isLessonPublished={isPublished}
            key={exercise.id}
          />
        ))
      )}
    </section>
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

  if (query.isPending) {
    return <Spinner label="Chargement de la leçon" />;
  }

  if (query.error) {
    return <ErrorState description="La leçon n’a pas pu être chargée." />;
  }

  const lesson = query.data?.lesson;

  if (!lesson) {
    return (
      <EmptyState
        description="Cette leçon est indisponible."
        title="Leçon introuvable"
      />
    );
  }

  const objectives = getObjectives(lesson.objectives);

  return (
    <article aria-labelledby="lesson-title" class="space-y-8">
      <header>
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Leçon
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <h1 id="lesson-title" class="text-3xl font-bold tracking-tight">
            {lesson.title}
          </h1>
          {lesson.isPublished ? null : <Badge tone="warning">Brouillon</Badge>}
        </div>
        {lesson.estimatedMinutes !== null ? (
          <p class="mt-3 text-sm text-slate-300">
            Durée indicative : {formatDuration(lesson.estimatedMinutes)}
          </p>
        ) : null}
        <p class="mt-3 leading-7 text-slate-300">{lesson.summary}</p>
      </header>

      <section aria-labelledby="objectives-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="objectives-title">
          Objectifs
        </h2>
        {objectives.length === 0 ? (
          <EmptyState
            description="Les objectifs de cette leçon seront ajoutés prochainement."
            title="Aucun objectif renseigné"
          />
        ) : (
          <ul class="space-y-2" role="list">
            {objectives.map((objective) => (
              <li class="rounded-xl bg-slate-900 px-4 py-3" key={objective}>
                {objective}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="content-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="content-title">
          Contenu
        </h2>
        {lesson.contentBlocks.length === 0 ? (
          <EmptyState
            description="Le contenu pédagogique sera ajouté prochainement."
            title="Aucun contenu disponible"
          />
        ) : (
          lesson.contentBlocks.map((block) => (
            <ContentBlock block={block} key={block.id} />
          ))
        )}
      </section>

      {lesson.isPublished ? (
        <LessonActivityProgress
          lessonId={lesson.id}
          resources={lesson.resources}
          tasks={lesson.tasks}
        />
      ) : (
        <DraftLessonActivities
          resources={lesson.resources}
          tasks={lesson.tasks}
        />
      )}

      <AssessmentsSection
        exercises={lesson.exercises}
        isPublished={lesson.isPublished}
        lessonSlug={lesson.slug}
        programSlug={programSlug}
        quizzes={lesson.quizzes}
      />
    </article>
  );
}
