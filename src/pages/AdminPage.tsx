import { useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import {
  type AdminLesson,
  type AdminModule,
  type AdminStage,
  useAdminCurriculumMutation,
  useAdminCurriculumQuery,
} from '@/features/admin/queries';
import { useSessionQuery } from '@/features/auth/session';
import { ApiClientError } from '@/lib/api-client';

function StatusBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <Badge tone={isPublished ? 'success' : 'warning'}>
      {isPublished ? 'Publié' : 'Brouillon'}
    </Badge>
  );
}

function getMutationError(error: unknown): string {
  if (error instanceof ApiClientError && error.code === 'LESSON_NOT_READY') {
    return 'Publication impossible : publiez au moins une leçon prête et vérifiez les évaluations des notions obligatoires.';
  }
  if (
    error instanceof ApiClientError &&
    error.code === 'ASSESSMENT_NOT_READY'
  ) {
    return 'Publication impossible : l’étape doit avoir une évaluation finale et au moins un module publié contenant une leçon prête.';
  }

  return 'La modification n’a pas pu être enregistrée.';
}

function LessonEditor({ lesson }: { lesson: AdminLesson }) {
  const mutation = useAdminCurriculumMutation();
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary);
  const [position, setPosition] = useState(String(lesson.position));

  async function save() {
    try {
      await mutation.updateLesson(lesson.id, {
        position: Number(position),
        summary: summary.trim(),
        title: title.trim(),
      });
    } catch {
      // L’erreur normalisée est présentée sous le formulaire.
    }
  }

  async function togglePublication() {
    try {
      await mutation.updateLesson(lesson.id, {
        isPublished: !lesson.isPublished,
      });
    } catch {
      // L’erreur normalisée est présentée sous le formulaire.
    }
  }

  return (
    <li>
      <Card class="space-y-4 border-slate-700 bg-slate-950/50">
        <div class="flex items-center justify-between gap-3">
          <h4 class="font-semibold">Leçon — {lesson.title}</h4>
          <StatusBadge isPublished={lesson.isPublished} />
        </div>
        <TextField
          label="Titre de la leçon"
          maxLength={200}
          onInput={(event) => setTitle(event.currentTarget.value)}
          value={title}
        />
        <Textarea
          label="Résumé de la leçon"
          maxLength={5_000}
          onInput={(event) => setSummary(event.currentTarget.value)}
          value={summary}
        />
        <TextField
          label="Ordre de la leçon"
          min={0}
          max={10_000}
          onInput={(event) => setPosition(event.currentTarget.value)}
          type="number"
          value={position}
        />
        {mutation.error ? (
          <ErrorState description={getMutationError(mutation.error)} />
        ) : null}
        <div class="flex flex-wrap gap-3">
          <Button
            disabled={!title.trim() || !summary.trim() || !position}
            isLoading={mutation.isPending}
            onClick={() => void save()}
            variant="secondary"
          >
            Enregistrer la leçon
          </Button>
          <Button
            isLoading={mutation.isPending}
            onClick={() => void togglePublication()}
            variant={lesson.isPublished ? 'danger' : 'primary'}
          >
            {lesson.isPublished ? 'Dépublier la leçon' : 'Publier la leçon'}
          </Button>
        </div>
      </Card>
    </li>
  );
}

function ModuleEditor({ module }: { module: AdminModule }) {
  const mutation = useAdminCurriculumMutation();
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description);
  const [position, setPosition] = useState(String(module.position));

  async function save() {
    try {
      await mutation.updateModule(module.id, {
        description: description.trim(),
        position: Number(position),
        title: title.trim(),
      });
    } catch {
      // L’erreur normalisée est présentée sous le formulaire.
    }
  }

  async function togglePublication() {
    try {
      await mutation.updateModule(module.id, {
        isPublished: !module.isPublished,
      });
    } catch {
      // L’erreur normalisée est présentée sous le formulaire.
    }
  }

  return (
    <Card class="space-y-5">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-xl font-semibold">Module — {module.title}</h3>
        <StatusBadge isPublished={module.isPublished} />
      </div>
      <TextField
        label="Titre du module"
        maxLength={200}
        onInput={(event) => setTitle(event.currentTarget.value)}
        value={title}
      />
      <Textarea
        label="Résumé du module"
        maxLength={5_000}
        onInput={(event) => setDescription(event.currentTarget.value)}
        value={description}
      />
      <TextField
        label="Ordre du module"
        min={0}
        max={10_000}
        onInput={(event) => setPosition(event.currentTarget.value)}
        type="number"
        value={position}
      />
      {mutation.error ? (
        <ErrorState description={getMutationError(mutation.error)} />
      ) : null}
      <div class="flex flex-wrap gap-3">
        <Button
          disabled={!title.trim() || !description.trim() || !position}
          isLoading={mutation.isPending}
          onClick={() => void save()}
          variant="secondary"
        >
          Enregistrer le module
        </Button>
        <Button
          isLoading={mutation.isPending}
          onClick={() => void togglePublication()}
          variant={module.isPublished ? 'danger' : 'primary'}
        >
          {module.isPublished ? 'Dépublier le module' : 'Publier le module'}
        </Button>
      </div>

      <div class="space-y-3 border-t border-slate-800 pt-5">
        <h4 class="text-lg font-semibold">Leçons</h4>
        {module.lessons.length ? (
          <ul class="space-y-4">
            {module.lessons.map((lesson) => (
              <LessonEditor key={lesson.id} lesson={lesson} />
            ))}
          </ul>
        ) : (
          <p class="text-sm text-slate-400">Aucune leçon dans ce module.</p>
        )}
      </div>
    </Card>
  );
}

function StageEditor({ stage }: { stage: AdminStage }) {
  const mutation = useAdminCurriculumMutation();

  async function togglePublication() {
    try {
      await mutation.updateStage(stage.id, !stage.isPublished);
    } catch {
      // L’erreur normalisée est présentée sous l’action.
    }
  }

  return (
    <section class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-semibold text-cyan-200">{stage.title}</h3>
          <StatusBadge isPublished={stage.isPublished} />
        </div>
        <Button
          isLoading={mutation.isPending}
          onClick={() => void togglePublication()}
          size="sm"
          variant={stage.isPublished ? 'danger' : 'primary'}
        >
          {stage.isPublished ? 'Dépublier l’étape' : 'Publier l’étape'}
        </Button>
      </div>
      {mutation.error ? (
        <ErrorState description={getMutationError(mutation.error)} />
      ) : null}
      {stage.modules.map((module) => (
        <ModuleEditor key={module.id} module={module} />
      ))}
    </section>
  );
}

export function AdminPage() {
  const session = useSessionQuery();
  const isAdmin = session.data?.user?.role === 'ADMIN';
  const query = useAdminCurriculumQuery(isAdmin);

  if (query.isPending)
    return <Spinner label="Chargement de l’administration" />;
  if (query.error) {
    return (
      <ErrorState description="Les contenus administrables n’ont pas pu être chargés." />
    );
  }

  const programs = query.data?.programs ?? [];

  return (
    <section aria-labelledby="admin-title" class="space-y-6">
      <header class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Zone sécurisée
        </p>
        <h1 class="text-3xl font-bold tracking-tight" id="admin-title">
          Administration
        </h1>
        <p class="leading-7 text-slate-300">
          Modifiez et publiez les modules et leçons de vos programmes.
        </p>
      </header>

      {!programs.length ? (
        <EmptyState
          description="Créez d’abord un programme pour administrer son contenu."
          title="Aucun contenu administrable"
        />
      ) : null}

      {programs.map((program) => (
        <section class="space-y-5" key={program.id}>
          <h2 class="text-2xl font-bold">{program.title}</h2>
          {program.stages.map((stage) => (
            <StageEditor key={stage.id} stage={stage} />
          ))}
        </section>
      ))}
    </section>
  );
}
