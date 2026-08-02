import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import {
  type ContentBlockType,
  type LessonContentBlock,
  type LessonResource,
  type LessonTask,
  useLessonQuery,
} from '@/features/curriculum/queries';

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

function ResourceCard({ resource }: { resource: LessonResource }) {
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
    </Card>
  );
}

function TaskCard({ task }: { task: LessonTask }) {
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
    </Card>
  );
}

function AssessmentPlaceholders() {
  return (
    <section aria-labelledby="assessments-title" class="space-y-3">
      <h2 class="text-xl font-semibold" id="assessments-title">
        Évaluations
      </h2>
      <Card class="space-y-3">
        <h3 class="font-semibold">Quiz</h3>
        <p class="text-sm text-slate-300">Le quiz sera bientôt disponible.</p>
        <button
          class="min-h-11 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-400"
          disabled
          type="button"
        >
          Quiz indisponible
        </button>
      </Card>
      <Card class="space-y-3">
        <h3 class="font-semibold">Exercice</h3>
        <p class="text-sm text-slate-300">
          L’exercice sera bientôt disponible.
        </p>
        <button
          class="min-h-11 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-400"
          disabled
          type="button"
        >
          Exercice indisponible
        </button>
      </Card>
    </section>
  );
}

export function LessonPage({ lessonSlug }: { lessonSlug: string }) {
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
        <h1 id="lesson-title" class="mt-3 text-3xl font-bold tracking-tight">
          {lesson.title}
        </h1>
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

      <section aria-labelledby="resources-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="resources-title">
          Ressources
        </h2>
        {lesson.resources.length === 0 ? (
          <EmptyState
            description="Les ressources associées apparaîtront ici."
            title="Aucune ressource disponible"
          />
        ) : (
          lesson.resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))
        )}
      </section>

      <AssessmentPlaceholders />

      <section aria-labelledby="tasks-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="tasks-title">
          Tâches
        </h2>
        {lesson.tasks.length === 0 ? (
          <EmptyState
            description="Les tâches associées apparaîtront ici."
            title="Aucune tâche disponible"
          />
        ) : (
          lesson.tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </section>
    </article>
  );
}
