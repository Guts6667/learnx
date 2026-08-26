import { useEffect, useState } from 'react';

import { QueryState } from '@/components/learnx/QueryState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import {
  type StageAssessmentDetail,
  type StageAssessmentStatus,
  useStageAssessmentMutation,
  useStageAssessmentQuery,
} from '@/features/stage-assessments/queries';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/catalogs';

const typeLabelKeys: Record<string, MessageKey> = {
  CASE_STUDY: 'stageAssessment.type.caseStudy',
  CUMULATIVE_EXAM: 'stageAssessment.type.cumulativeExam',
  ORAL: 'stageAssessment.type.oral',
  PRACTICAL_EXERCISE: 'stageAssessment.type.practicalExercise',
  PROJECT: 'stageAssessment.type.project',
  SIMULATION: 'stageAssessment.type.simulation',
  WRITTEN_ASSIGNMENT: 'stageAssessment.type.writtenAssignment',
};

const statusLabelKeys: Record<StageAssessmentStatus, MessageKey> = {
  DRAFT: 'stageAssessment.status.draft',
  NEEDS_REVISION: 'stageAssessment.status.needsRevision',
  SUBMITTED: 'stageAssessment.status.submitted',
  VALIDATED: 'stageAssessment.status.validated',
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
  const { t } = useI18n();
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
        {t('stageAssessment.start')}
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <Badge tone={statusTones[submission.status]}>
        {t(statusLabelKeys[submission.status])}
      </Badge>
      {submission.reviewFeedback ? (
        <p className="ui-feedback ui-feedback--warning text-sm">
          {t('stageAssessment.feedback', {
            feedback: submission.reviewFeedback,
          })}
        </p>
      ) : null}
      {editable ? (
        <>
          <Textarea
            className="[&_textarea]:min-h-40"
            id="assessment-content"
            label={t('stageAssessment.answer')}
            onInput={(event) => setContentMarkdown(event.currentTarget.value)}
            value={contentMarkdown}
          />
          <TextField
            id="assessment-attachment"
            label={t('stageAssessment.attachment')}
            onInput={(event) => setAttachmentUrl(event.currentTarget.value)}
            type="url"
            value={attachmentUrl}
          />
          <div className="flex flex-wrap gap-3">
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
              {t('stageAssessment.saveDraft')}
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
              {t('stageAssessment.submit')}
            </Button>
          </div>
        </>
      ) : (
        <p className="ui-text-muted text-sm">
          {submission.status === 'VALIDATED'
            ? t('stageAssessment.result', {
                result:
                  submission.score === null
                    ? t(statusLabelKeys.VALIDATED)
                    : `${submission.score} %`,
              })
            : t('stageAssessment.awaitingReview')}
        </p>
      )}
      {mutation.error ? (
        <p role="alert" className="ui-text-danger text-sm">
          {t('stageAssessment.saveError')}
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
  const { t } = useI18n();

  if (query.isPending) {
    return (
      <QueryState
        error={query.error}
        errorDescription={t('stageAssessment.unavailable')}
        isPending={query.isPending}
        loadingLabel={t('stageAssessment.loading')}
        onRetry={query.reload}
        retryLabel={t('common.retry')}
      />
    );
  }
  if (query.error) {
    return (
      <QueryState
        error={query.error}
        errorDescription={t('stageAssessment.unavailable')}
        isPending={false}
        loadingLabel={t('stageAssessment.loading')}
        onRetry={query.reload}
        retryLabel={t('common.retry')}
      />
    );
  }

  if (!query.data) {
    return <ErrorState description={t('stageAssessment.unavailable')} />;
  }

  const assessment = query.data.assessment;
  const sections = assessment.instructions
    ? splitAssessmentSections(assessment.instructions)
    : [];
  const rubric = getRubricCriteria(assessment.rubric);

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">{t('stageAssessment.final')}</h2>
        {isStagePublished ? null : (
          <Badge tone="warning">{t('common.draft')}</Badge>
        )}
      </div>
      <div>
        <h3 className="font-semibold">{assessment.title}</h3>
        <p className="ui-text-muted mt-2 text-sm">
          {t('stageAssessment.type', {
            type: typeLabelKeys[assessment.type]
              ? t(typeLabelKeys[assessment.type])
              : assessment.type,
          })}
        </p>
        {assessment.passingScore === null ? null : (
          <p className="ui-text-muted mt-1 text-sm">
            {t('assessment.passingScore', { count: assessment.passingScore })}
          </p>
        )}
      </div>
      {assessment.description ? (
        <Section aria-labelledby={`assessment-objective-${assessment.id}`}>
          <h3
            className="text-lg font-semibold"
            id={`assessment-objective-${assessment.id}`}
          >
            {t('stageAssessment.objective')}
          </h3>
          <SafeMarkdown className="mt-3" content={assessment.description} />
        </Section>
      ) : null}
      {sections.map((section, index) => (
        <Section
          aria-labelledby={`assessment-section-${assessment.id}-${index}`}
          key={`${section.title}-${index}`}
        >
          <h3
            className="ui-text text-lg font-semibold"
            id={`assessment-section-${assessment.id}-${index}`}
          >
            {section.title}
          </h3>
          <SafeMarkdown className="mt-3" content={section.content} />
        </Section>
      ))}
      {rubric.length > 0 ? (
        <Section aria-labelledby={`assessment-rubric-${assessment.id}`}>
          <h3
            className="text-lg font-semibold"
            id={`assessment-rubric-${assessment.id}`}
          >
            {t('stageAssessment.rubric')}
          </h3>
          <ol className="ui-list mt-4">
            {rubric.map((criterion, index) => (
              <li
                className="ui-list-row block"
                key={`${criterion.criterion}-${index}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="ui-text font-semibold">
                    {criterion.criterion}
                  </h4>
                  {criterion.weight === null ? null : (
                    <Badge tone="info">{criterion.weight} %</Badge>
                  )}
                </div>
                {criterion.requirements.length > 0 ? (
                  <ul className="ui-text-muted mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
                    {criterion.requirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
      {isStagePublished ? (
        <AssessmentForm assessment={assessment} />
      ) : (
        <p className="ui-text-warning text-sm">
          {t('stageAssessment.preview')}
        </p>
      )}
    </Card>
  );
}
