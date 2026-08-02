import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { QuestionAssessmentExperience } from '@/features/assessments/QuestionAssessmentExperience';
import {
  useConceptAssessmentAttemptMutation,
  useConceptAssessmentAttemptsQuery,
  useConceptAssessmentQuery,
} from '@/features/concept-assessments/queries';
import { useLessonQuery } from '@/features/curriculum/queries';

export function ConceptAssessmentPage({
  assessmentId,
  lessonSlug,
  programSlug,
}: {
  assessmentId?: string;
  lessonSlug: string;
  programSlug: string;
}) {
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
  const lessonHref = `/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(lessonSlug)}`;

  if (lessonQuery.isPending) {
    return <Spinner label="Chargement de la mini-évaluation" />;
  }

  if (lessonQuery.error) {
    return (
      <ErrorState description="La mini-évaluation n’a pas pu être chargée." />
    );
  }

  if (!lesson || !selectedAssessment) {
    return (
      <EmptyState
        action={
          <a class="text-cyan-300 underline" href={lessonHref}>
            Retour à la leçon
          </a>
        }
        description="Aucune mini-évaluation correspondante n’est disponible pour cette leçon."
        title="Mini-évaluation introuvable"
      />
    );
  }

  if (assessmentQuery.isPending || attemptsQuery.isPending) {
    return <Spinner label="Chargement de la mini-évaluation" />;
  }

  if (
    assessmentQuery.error ||
    attemptsQuery.error ||
    !assessmentQuery.data?.assessment
  ) {
    return (
      <ErrorState description="La mini-évaluation n’a pas pu être chargée." />
    );
  }

  const assessment = assessmentQuery.data.assessment;
  const passingScore = assessment.concept.masteryThreshold;

  return (
    <article aria-labelledby="assessment-title" class="space-y-6">
      <header class="space-y-3">
        <a
          class="inline-flex min-h-11 items-center text-cyan-300 underline"
          href={lessonHref}
        >
          Retour à la leçon
        </a>
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Notion · {assessment.concept.title}
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-3xl font-bold tracking-tight" id="assessment-title">
            {assessment.title ?? `Évaluation — ${assessment.concept.title}`}
          </h1>
          <Badge tone={assessment.isRequired ? 'warning' : 'neutral'}>
            {assessment.isRequired ? 'Obligatoire' : 'Optionnelle'}
          </Badge>
          {preview ? <Badge tone="warning">Brouillon</Badge> : null}
        </div>
        {preview ? (
          <p class="text-sm text-amber-200">
            Prévisualisation propriétaire : cette évaluation n’est pas publique.
          </p>
        ) : null}
        <p class="text-sm text-slate-400">
          {assessment.questionCount} questions · seuil de maîtrise :{' '}
          {Math.round(passingScore)} %
        </p>
      </header>

      <QuestionAssessmentExperience
        assessment={{ ...assessment, passingScore }}
        attempts={attemptsQuery.data?.attempts ?? []}
        backHref={lessonHref}
        error={mutation.error}
        isPending={mutation.isPending}
        key={assessment.id}
        labels={{
          emptyDescription:
            'Cette mini-évaluation ne contient aucune question.',
          emptyTitle: 'Mini-évaluation indisponible',
          failure: 'Notion à retravailler',
          restart: 'Recommencer la mini-évaluation',
          success: 'Notion maîtrisée',
        }}
        onSubmit={mutation.submit}
      />
    </article>
  );
}
