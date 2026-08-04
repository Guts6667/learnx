import { useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import type { LessonExerciseSummary } from '@/features/curriculum/queries';
import {
  type ExerciseDetail,
  useExerciseMutation,
  useExerciseQuery,
} from '@/features/exercises/queries';

function formatSubmissionDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function ExerciseEditor({
  backHref,
  exercise,
  nextHref,
}: {
  backHref?: string;
  exercise: ExerciseDetail;
  nextHref?: string | null;
}) {
  const mutation = useExerciseMutation(exercise.id);
  const submission = exercise.submission;
  const [contentMarkdown, setContentMarkdown] = useState(
    submission?.contentMarkdown ?? '',
  );

  if (!submission) {
    return (
      <Button
        isLoading={mutation.isPending}
        onClick={() => void mutation.createDraft()}
      >
        Commencer l’exercice
      </Button>
    );
  }

  if (submission.status === 'SUBMITTED') {
    return (
      <div class="space-y-3">
        <Badge tone="success">Soumis</Badge>
        <p class="text-sm text-slate-300">
          Envoyé le{' '}
          {submission.submittedAt
            ? formatSubmissionDate(submission.submittedAt)
            : 'date inconnue'}
        </p>
        <pre class="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-3 font-sans text-sm leading-6 text-slate-300">
          {submission.contentMarkdown}
        </pre>
        {backHref ? (
          <nav aria-label="Suite de la leçon" class="flex flex-wrap gap-3">
            <a
              class="inline-flex min-h-11 items-center rounded-xl bg-slate-800 px-4 text-sm font-semibold"
              href={backHref}
            >
              Retour à la leçon
            </a>
            {nextHref ? (
              <a
                class="inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950"
                href={nextHref}
              >
                Activité suivante
              </a>
            ) : null}
          </nav>
        ) : null}
      </div>
    );
  }

  const submissionId = submission.id;

  async function saveDraft() {
    await mutation.save(submissionId, contentMarkdown);
  }

  async function submitExercise() {
    await mutation.save(submissionId, contentMarkdown);
    await mutation.submit(submissionId);
  }

  return (
    <div class="space-y-4">
      <Badge tone="neutral">Brouillon</Badge>
      <Textarea
        description="Vous pouvez utiliser la syntaxe Markdown. Le brouillon est conservé comme texte brut."
        label="Votre réponse en Markdown"
        maxLength={100_000}
        onInput={(event) => setContentMarkdown(event.currentTarget.value)}
        value={contentMarkdown}
      />
      <div class="flex flex-wrap gap-3">
        <Button
          isLoading={mutation.isPending}
          onClick={() => void saveDraft()}
          variant="secondary"
        >
          Enregistrer le brouillon
        </Button>
        <Button
          disabled={!contentMarkdown.trim()}
          isLoading={mutation.isPending}
          onClick={() => void submitExercise()}
        >
          Soumettre l’exercice
        </Button>
      </div>
      {mutation.error ? (
        <p class="text-sm text-red-300" role="alert">
          L’exercice n’a pas pu être enregistré.
        </p>
      ) : null}
    </div>
  );
}

function PublishedExerciseCard({
  backHref,
  exerciseId,
  nextHref,
}: {
  backHref?: string;
  exerciseId: string;
  nextHref?: string | null;
}) {
  const query = useExerciseQuery(exerciseId);

  if (query.isPending) {
    return <Spinner label="Chargement de l’exercice" size="sm" />;
  }

  if (query.error || !query.data?.exercise) {
    return <ErrorState description="L’exercice est indisponible." />;
  }

  return (
    <ExerciseEditor
      backHref={backHref}
      exercise={query.data.exercise}
      nextHref={nextHref}
    />
  );
}

export function ExerciseCard({
  exercise,
  isLessonPublished,
  backHref,
  nextHref,
}: {
  backHref?: string;
  exercise: LessonExerciseSummary;
  isLessonPublished: boolean;
  nextHref?: string | null;
}) {
  return (
    <Card class="space-y-4">
      <div class="flex items-start justify-between gap-3">
        <h3 class="font-semibold">{exercise.title}</h3>
        <Badge tone={exercise.isRequired ? 'warning' : 'neutral'}>
          {exercise.isRequired ? 'Obligatoire' : 'Optionnel'}
        </Badge>
      </div>
      <SafeMarkdown content={exercise.instructions} />
      {isLessonPublished ? (
        <PublishedExerciseCard
          backHref={backHref}
          exerciseId={exercise.id}
          nextHref={nextHref}
        />
      ) : (
        <div class="space-y-2">
          <Badge tone="warning">Brouillon</Badge>
          <p class="text-sm text-amber-200">
            Prévisualisation en lecture seule. La rédaction sera disponible
            après publication de la leçon.
          </p>
        </div>
      )}
    </Card>
  );
}
