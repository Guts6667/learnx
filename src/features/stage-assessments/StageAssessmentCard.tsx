import { useEffect, useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import {
  type StageAssessmentDetail,
  type StageAssessmentStatus,
  useStageAssessmentMutation,
  useStageAssessmentQuery,
} from '@/features/stage-assessments/queries';

const typeLabels: Record<string, string> = {
  CASE_STUDY: 'Étude de cas',
  CUMULATIVE_EXAM: 'Examen cumulatif',
  ORAL: 'Oral',
  PRACTICAL_EXERCISE: 'Exercice pratique',
  PROJECT: 'Projet',
  SIMULATION: 'Simulation',
  WRITTEN_ASSIGNMENT: 'Devoir écrit',
};

const statusLabels: Record<StageAssessmentStatus, string> = {
  DRAFT: 'Brouillon',
  NEEDS_REVISION: 'À réviser',
  SUBMITTED: 'Soumise',
  VALIDATED: 'Validée',
};

const statusTones = {
  DRAFT: 'neutral',
  NEEDS_REVISION: 'warning',
  SUBMITTED: 'info',
  VALIDATED: 'success',
} as const;

interface AssessmentSection {
  content: string;
  title: string;
}

interface RubricCriterion {
  criterion: string;
  requirements: string[];
  weight: number | null;
}

function splitAssessmentSections(markdown: string): AssessmentSection[] {
  const sections: AssessmentSection[] = [];
  let title = 'Consignes';
  let content: string[] = [];

  function commitSection() {
    const value = content.join('\n').trim();
    if (value) sections.push({ content: value, title });
    content = [];
  }

  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^#{1,3}\s+(.+)$/.exec(line.trim());
    if (heading) {
      commitSection();
      title = heading[1]?.trim() || 'Section';
    } else {
      content.push(line);
    }
  }
  commitSection();
  return sections;
}

function getRubricCriteria(value: unknown): RubricCriterion[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.criterion !== 'string') return [];
    return [
      {
        criterion: record.criterion,
        requirements: Array.isArray(record.requirements)
          ? record.requirements.filter(
              (requirement): requirement is string =>
                typeof requirement === 'string',
            )
          : [],
        weight: typeof record.weight === 'number' ? record.weight : null,
      },
    ];
  });
}

function AssessmentForm({ assessment }: { assessment: StageAssessmentDetail }) {
  const mutation = useStageAssessmentMutation(assessment);
  const submission = assessment.submission;
  const [attachmentUrl, setAttachmentUrl] = useState(
    submission?.attachmentUrl ?? '',
  );
  const [contentMarkdown, setContentMarkdown] = useState(
    submission?.contentMarkdown ?? '',
  );
  const editable =
    submission?.status === 'DRAFT' || submission?.status === 'NEEDS_REVISION';

  useEffect(() => {
    setAttachmentUrl(submission?.attachmentUrl ?? '');
    setContentMarkdown(submission?.contentMarkdown ?? '');
  }, [submission?.attachmentUrl, submission?.contentMarkdown]);

  if (!submission) {
    return (
      <Button
        isLoading={mutation.isPending}
        onClick={() => mutation.createDraft()}
      >
        Commencer l’évaluation
      </Button>
    );
  }

  return (
    <div class="space-y-4">
      <Badge tone={statusTones[submission.status]}>
        {statusLabels[submission.status]}
      </Badge>
      {submission.reviewFeedback ? (
        <p class="rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-100">
          Retour : {submission.reviewFeedback}
        </p>
      ) : null}
      {editable ? (
        <>
          <Textarea
            class="[&_textarea]:min-h-40"
            id="assessment-content"
            label="Votre réponse"
            onInput={(event) => setContentMarkdown(event.currentTarget.value)}
            value={contentMarkdown}
          />
          <TextField
            id="assessment-attachment"
            label="Lien vers une pièce jointe"
            onInput={(event) => setAttachmentUrl(event.currentTarget.value)}
            type="url"
            value={attachmentUrl}
          />
          <div class="flex flex-wrap gap-3">
            <Button
              isLoading={mutation.isPending}
              onClick={() =>
                mutation.save(submission.id, {
                  attachmentUrl: attachmentUrl.trim() || null,
                  contentMarkdown: contentMarkdown.trim() || null,
                })
              }
              variant="secondary"
            >
              Enregistrer le brouillon
            </Button>
            <Button
              isLoading={mutation.isPending}
              onClick={async () => {
                await mutation.save(submission.id, {
                  attachmentUrl: attachmentUrl.trim() || null,
                  contentMarkdown: contentMarkdown.trim() || null,
                });
                await mutation.submit(submission.id);
              }}
            >
              Soumettre
            </Button>
          </div>
        </>
      ) : (
        <p class="text-sm text-slate-300">
          {submission.status === 'VALIDATED'
            ? `Résultat : ${submission.score ?? 'validé'}${submission.score === null ? '' : ' %'}`
            : 'Votre travail a été envoyé et attend une validation.'}
        </p>
      )}
      {mutation.error ? (
        <p role="alert" class="text-sm text-red-300">
          L’action n’a pas pu être enregistrée.
        </p>
      ) : null}
    </div>
  );
}

export function StageAssessmentCard({
  isStagePublished,
  stageId,
}: {
  isStagePublished: boolean;
  stageId: string;
}) {
  const query = useStageAssessmentQuery(stageId);

  if (query.isPending)
    return <Spinner label="Chargement de l’évaluation finale" />;
  if (query.error || !query.data) {
    return <ErrorState description="L’évaluation finale est indisponible." />;
  }

  const assessment = query.data.assessment;
  const sections = assessment.instructions
    ? splitAssessmentSections(assessment.instructions)
    : [];
  const rubric = getRubricCriteria(assessment.rubric);

  return (
    <Card class="space-y-6">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-xl font-semibold">Évaluation finale</h2>
        {isStagePublished ? null : <Badge tone="warning">Brouillon</Badge>}
      </div>
      <div>
        <h3 class="font-semibold">{assessment.title}</h3>
        <p class="mt-2 text-sm text-slate-300">
          Type : {typeLabels[assessment.type] ?? assessment.type}
        </p>
        {assessment.passingScore === null ? null : (
          <p class="mt-1 text-sm text-slate-300">
            Seuil de réussite : {assessment.passingScore} %
          </p>
        )}
      </div>
      {assessment.description ? (
        <section aria-labelledby={`assessment-objective-${assessment.id}`}>
          <h3
            class="text-lg font-semibold"
            id={`assessment-objective-${assessment.id}`}
          >
            Objectif
          </h3>
          <SafeMarkdown class="mt-3" content={assessment.description} />
        </section>
      ) : null}
      {sections.map((section, index) => (
        <section
          aria-labelledby={`assessment-section-${assessment.id}-${index}`}
          class="border-t border-slate-800 pt-5"
          key={`${section.title}-${index}`}
        >
          <h3
            class="text-lg font-semibold text-slate-100"
            id={`assessment-section-${assessment.id}-${index}`}
          >
            {section.title}
          </h3>
          <SafeMarkdown class="mt-3" content={section.content} />
        </section>
      ))}
      {rubric.length > 0 ? (
        <section
          aria-labelledby={`assessment-rubric-${assessment.id}`}
          class="border-t border-slate-800 pt-5"
        >
          <h3
            class="text-lg font-semibold"
            id={`assessment-rubric-${assessment.id}`}
          >
            Grille d’évaluation
          </h3>
          <ol class="mt-4 grid gap-3 md:grid-cols-2">
            {rubric.map((criterion, index) => (
              <li
                class="rounded-xl border border-slate-700 bg-slate-950/55 p-4"
                key={`${criterion.criterion}-${index}`}
              >
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <h4 class="font-semibold text-slate-100">
                    {criterion.criterion}
                  </h4>
                  {criterion.weight === null ? null : (
                    <Badge tone="info">{criterion.weight} %</Badge>
                  )}
                </div>
                {criterion.requirements.length > 0 ? (
                  <ul class="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                    {criterion.requirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {isStagePublished ? (
        <AssessmentForm assessment={assessment} />
      ) : (
        <p class="text-sm text-amber-200">
          Prévisualisation en lecture seule. La soumission sera disponible après
          publication de l’étape.
        </p>
      )}
    </Card>
  );
}
