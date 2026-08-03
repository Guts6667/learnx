import { route } from 'preact-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import {
  type ContentBlockType,
  type LessonContentBlock,
  type LessonConceptSummary,
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
import { useNoteMutation, useNotesQuery } from '@/features/notes/queries';

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

function getSourceKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const sourceKeys = (value as Record<string, unknown>).sourceKeys;

  return Array.isArray(sourceKeys)
    ? sourceKeys.filter((key): key is string => typeof key === 'string')
    : [];
}

function BlockSources({ resources }: { resources: LessonResource[] }) {
  if (resources.length === 0) {
    return null;
  }

  return (
    <footer class="border-t border-slate-700 pt-3">
      <h4 class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        Sources de ce bloc
      </h4>
      <ul class="mt-2 space-y-2">
        {resources.map((resource) => {
          const url = getSafeExternalUrl(resource.url);

          return (
            <li class="text-sm leading-5 text-slate-400" key={resource.id}>
              <span class="font-medium text-slate-300">{resource.title}</span>
              {resource.author ? ` — ${resource.author}` : ''}
              {resource.citation ? ` · ${resource.citation}` : ''}
              {url ? (
                <>
                  {' · '}
                  <a
                    class="inline-flex min-h-11 items-center text-cyan-300 underline"
                    href={url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Voir la source
                  </a>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </footer>
  );
}

function ContentBlock({
  block,
  resourcesByKey,
}: {
  block: LessonContentBlock;
  resourcesByKey: Map<string, LessonResource>;
}) {
  if (block.type === 'DIVIDER') {
    return <hr aria-label="Séparation de contenu" class="border-slate-700" />;
  }

  const text = getText(block.content);
  const sourceResources = getSourceKeys(block.content)
    .map((key) => resourcesByKey.get(key))
    .filter((resource): resource is LessonResource => Boolean(resource));

  if (!text) {
    return null;
  }

  return (
    <Card class="space-y-2">
      <h3 class="text-sm font-semibold text-cyan-300">
        {contentBlockLabels[block.type]}
      </h3>
      <p class="whitespace-pre-line leading-7 text-slate-200">{text}</p>
      <BlockSources resources={sourceResources} />
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
        <Button
          disabled={isPending || progressStatus === 'COMPLETED'}
          isLoading={isPending}
          onClick={() => void onProgressChange('COMPLETED')}
          variant="secondary"
        >
          {progressStatus === 'COMPLETED'
            ? 'Ressource consultée'
            : 'Marquer comme consultée'}
        </Button>
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
        <Button
          disabled={isPending}
          isLoading={isPending}
          onClick={() =>
            void onStatusChange(status === 'DONE' ? 'TODO' : 'DONE')
          }
          variant="secondary"
        >
          {status === 'DONE'
            ? 'Marquer comme à faire'
            : 'Marquer comme terminée'}
        </Button>
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
            <Button
              disabled={mutation.isPending || lessonStatus !== 'AVAILABLE'}
              isLoading={mutation.isPending}
              onClick={() => void startLesson()}
            >
              Commencer la leçon
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                lessonStatus === 'COMPLETED' ||
                !canComplete
              }
              isLoading={mutation.isPending}
              onClick={() => void completeLesson()}
              variant="secondary"
            >
              Terminer la leçon
            </Button>
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

function ConceptAssessmentsSection({
  concepts,
  isPublished,
  lessonSlug,
  programSlug,
}: {
  concepts: LessonConceptSummary[];
  isPublished: boolean;
  lessonSlug: string;
  programSlug: string;
}) {
  return (
    <section aria-labelledby="concepts-title" class="space-y-3">
      <h2 class="text-xl font-semibold" id="concepts-title">
        Notions à maîtriser
      </h2>
      {concepts.length === 0 ? (
        <EmptyState
          description="Les notions évaluées apparaîtront ici."
          title="Aucune notion disponible"
        />
      ) : (
        concepts.map((concept) => (
          <Card class="space-y-3" key={concept.id}>
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-semibold">{concept.title}</h3>
              <Badge tone={concept.isRequired ? 'warning' : 'neutral'}>
                {concept.isRequired ? 'Obligatoire' : 'Optionnelle'}
              </Badge>
            </div>
            <p class="text-sm text-slate-400">
              Seuil de maîtrise : {Math.round(concept.masteryThreshold)} %
            </p>
            {concept.assessments.length === 0 ? (
              <p class="text-sm text-slate-400">
                Aucune mini-évaluation disponible.
              </p>
            ) : (
              <ul class="space-y-3">
                {concept.assessments.map((assessment) => {
                  const href = `/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(lessonSlug)}/assessment?assessmentId=${encodeURIComponent(assessment.id)}`;

                  return (
                    <li class="space-y-2" key={assessment.id}>
                      <p class="text-sm text-slate-300">
                        {assessment.title ?? `Évaluation — ${concept.title}`} ·{' '}
                        {assessment.questionCount ?? 0} questions
                      </p>
                      <a
                        class="inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950"
                        href={href}
                      >
                        {isPublished
                          ? 'Commencer la mini-évaluation'
                          : 'Prévisualiser et passer la mini-évaluation'}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))
      )}
    </section>
  );
}

function LessonNotesSection({
  lessonId,
  lessonTitle,
}: {
  lessonId: string;
  lessonTitle: string;
}) {
  const query = useNotesQuery('', lessonId);
  const mutation = useNoteMutation();

  async function createLinkedNote() {
    try {
      const note = await mutation.create({
        lessonId,
        title: `Notes — ${lessonTitle}`,
      });
      void route(`/notes/${encodeURIComponent(note.id)}`);
    } catch {
      // L’erreur normalisée est affichée dans la section.
    }
  }

  return (
    <section aria-labelledby="lesson-notes-title" class="space-y-3">
      <h2 class="text-xl font-semibold" id="lesson-notes-title">
        Notes
      </h2>
      <Button
        isLoading={mutation.isPending}
        onClick={() => void createLinkedNote()}
      >
        Nouvelle note liée à cette leçon
      </Button>
      {mutation.error || query.error ? (
        <ErrorState description="Les notes n’ont pas pu être chargées ou créées." />
      ) : null}
      {query.isPending ? (
        <Spinner label="Chargement des notes" size="sm" />
      ) : null}
      {query.data?.notes.length ? (
        <ul class="space-y-2">
          {query.data.notes.map((note) => (
            <li key={note.id}>
              <a
                class="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-cyan-300 underline"
                href={`/notes/${encodeURIComponent(note.id)}`}
              >
                <span>{note.title}</span>
                <span class="text-xs text-slate-400">Modifier</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
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
  const resourcesByKey = new Map(
    lesson.resources.flatMap((resource) =>
      resource.key ? [[resource.key, resource] as const] : [],
    ),
  );

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
            <ContentBlock
              block={block}
              key={block.id}
              resourcesByKey={resourcesByKey}
            />
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

      <ConceptAssessmentsSection
        concepts={lesson.concepts}
        isPublished={lesson.isPublished}
        lessonSlug={lesson.slug}
        programSlug={programSlug}
      />

      <LessonNotesSection lessonId={lesson.id} lessonTitle={lesson.title} />

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
