import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

import {
  type CorrectionHistoryEntry,
  type CorrectionResult,
} from '@/features/exercises/ai-correction';
import { useI18n } from '@/i18n';
import { formatLocalizedDate } from '@/shared/locale';

type AiCorrectionResultProps = {
  history: CorrectionHistoryEntry[];
  onReconsiderationArgumentChange: (argument: string) => void;
  onRequestReconsideration: (input: {
    argument: string;
    sourceCorrectionId: string;
  }) => void;
  onSelectCorrection: (index: number) => void;
  reconsiderationArgument: string;
  selectedIndex: number;
};

export function AiCorrectionResult({
  history,
  onReconsiderationArgumentChange,
  onRequestReconsideration,
  onSelectCorrection,
  reconsiderationArgument,
  selectedIndex,
}: AiCorrectionResultProps) {
  const { locale, t } = useI18n();
  const result = history[selectedIndex];
  if (!result) return null;

  const { correction, settlement } = result;
  const previous = selectedIndex > 0 ? history[selectedIndex - 1] : null;

  if (correction.status === 'FAILED') {
    return (
      <section className="correction-state correction-state--unavailable">
        <p className="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
        <h4>{t('aiCorrection.unavailableTitle')}</h4>
        <p>{t('aiCorrection.unavailable')}</p>
        <p className="correction-settlement">
          {t('aiCorrection.settlementRecap', {
            reserved: settlement.reservedCredits,
            settled: settlement.settledCredits,
            released: settlement.releasedCredits,
          })}
        </p>
      </section>
    );
  }

  const unsureKeys = new Set(correction.unsureCriteria);
  const unsureLabels = new Map(
    (correction.unsureCriterionDetails ?? []).map(({ key, label }) => [
      key,
      label,
    ]),
  );
  const delivered = correction.criteria.filter(
    (criterion) => !unsureKeys.has(criterion.key),
  );
  // V4.5-113 : un critère en confiance basse ne porte aucun niveau, il ne peut
  // donc être ni « acquis » ni « à renforcer ». Il forme son propre groupe.
  const toCheck = delivered.filter(
    (criterion) => criterion.confidence === 'LOW',
  );
  const levelled = delivered.filter(
    (criterion) => criterion.confidence !== 'LOW',
  );
  const acquired = levelled.filter(
    (criterion) => criterion.levelKey === 'mastered',
  );
  const toReinforce = levelled.filter(
    (criterion) => criterion.levelKey !== 'mastered',
  );

  return (
    <section className="correction-result">
      <header className="correction-result__header">
        <div>
          <p className="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
          <h4>{t('aiCorrection.resultTitle')}</h4>
        </div>
        <span>{t('aiCorrection.noProgressImpact')}</span>
      </header>

      {history.length > 1 ? (
        <section
          aria-label={t('aiCorrection.historyTitle')}
          className="correction-history"
        >
          <div className="correction-history__heading">
            <h5>{t('aiCorrection.historyTitle')}</h5>
            <span>
              {t('aiCorrection.historyCount', {
                count: history.length,
              })}
            </span>
          </div>
          <div className="correction-history__choices">
            {history.map((entry, index) => (
              <Button
                aria-pressed={selectedIndex === index}
                key={entry.correction.id}
                onClick={() => onSelectCorrection(index)}
                variant={selectedIndex === index ? 'secondary' : 'ghost'}
              >
                {t('aiCorrection.historyEntry', {
                  date: formatLocalizedDate(entry.createdAt, locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                  index: index + 1,
                })}
                {entry.action === 'RECONSIDERATION'
                  ? ` · ${t('aiCorrection.reconsiderationShort')}`
                  : null}
              </Button>
            ))}
          </div>
          {previous ? (
            <CorrectionComparison current={result} previous={previous} />
          ) : null}
        </section>
      ) : null}

      {acquired.length > 0 ? (
        <CriterionGroup
          criteria={acquired}
          title={t('aiCorrection.acquired')}
        />
      ) : null}

      {toCheck.length > 0 ? (
        <section className="correction-result__group">
          <h5>{t('aiCorrection.toCheck')}</h5>
          {toCheck.map((criterion) => (
            <LowConfidenceCriterionRow
              criterion={criterion}
              key={criterion.key}
            />
          ))}
        </section>
      ) : null}

      {toReinforce.length > 0 || correction.unsureCriteria.length > 0 ? (
        <section className="correction-result__group">
          <h5>{t('aiCorrection.toReinforce')}</h5>
          {toReinforce.map((criterion) => (
            <CriterionRow criterion={criterion} key={criterion.key} />
          ))}
          {correction.unsureCriteria.map((key) => (
            <article
              className="correction-criterion correction-criterion--unsure"
              key={key}
            >
              <div className="correction-criterion__heading">
                <strong>{unsureLabels.get(key) ?? key}</strong>
                <Badge tone="warning">{t('aiCorrection.reworkLabel')}</Badge>
              </div>
              <p>
                {t('aiCorrection.reworkCriterion', {
                  criterion: unsureLabels.get(key) ?? key,
                })}
              </p>
            </article>
          ))}
        </section>
      ) : null}

      <section className="correction-result__priority">
        <p className="page-eyebrow">{t('aiCorrection.priority')}</p>
        <h5>{t('aiCorrection.nextAction')}</h5>
        {correction.overallFeedback ? (
          <p>{correction.overallFeedback}</p>
        ) : null}
      </section>

      <footer className="correction-result__footer">
        {correction.indicativeScore !== null ? (
          <p className="correction-result__score">
            {t('aiCorrection.indicativeScore', {
              score: correction.indicativeScore.toFixed(0),
            })}
          </p>
        ) : (
          <p className="correction-result__score">
            {t('aiCorrection.scoreWithheld')}
          </p>
        )}
        <p className="correction-settlement">
          {t('aiCorrection.settlementRecap', {
            reserved: settlement.reservedCredits,
            settled: settlement.settledCredits,
            released: settlement.releasedCredits,
          })}
        </p>
      </footer>

      {result.action === 'STANDARD' &&
      !history.some((entry) => entry.sourceCorrectionId === correction.id) ? (
        <section className="correction-reconsideration">
          <p className="page-eyebrow">
            {t('aiCorrection.reconsiderationEyebrow')}
          </p>
          <h5>{t('aiCorrection.reconsiderationTitle')}</h5>
          <p>{t('aiCorrection.reconsiderationDescription')}</p>
          <Textarea
            className="correction-reconsideration__field"
            description={`${t('aiCorrection.reconsiderationArgumentHelp')} ${reconsiderationArgument.length}/500`}
            id={`reconsideration-${correction.id}`}
            label={t('aiCorrection.reconsiderationArgumentLabel')}
            maxLength={500}
            minLength={20}
            onInput={(event) =>
              onReconsiderationArgumentChange(event.currentTarget.value)
            }
            rows={4}
            value={reconsiderationArgument}
          />
          <Button
            disabled={
              reconsiderationArgument.trim().length < 20 ||
              reconsiderationArgument.trim().length > 500
            }
            onClick={() =>
              onRequestReconsideration({
                argument: reconsiderationArgument.trim(),
                sourceCorrectionId: correction.id,
              })
            }
            variant="secondary"
          >
            {t('aiCorrection.reconsiderationQuote')}
          </Button>
        </section>
      ) : null}
    </section>
  );
}

function CriterionGroup({
  criteria,
  title,
}: {
  criteria: CorrectionResult['correction']['criteria'];
  title: string;
}) {
  return (
    <section className="correction-result__group">
      <h5>{title}</h5>
      {criteria.map((criterion) => (
        <CriterionRow criterion={criterion} key={criterion.key} />
      ))}
    </section>
  );
}

function CorrectionComparison({
  current,
  previous,
}: {
  current: CorrectionResult;
  previous: CorrectionResult;
}) {
  const { t } = useI18n();
  const previousByKey = new Map(
    previous.correction.criteria.map((criterion) => [criterion.key, criterion]),
  );
  const changes = current.correction.criteria.flatMap((criterion) => {
    const prior = previousByKey.get(criterion.key);
    if (!prior || prior.levelKey === criterion.levelKey) return [];
    return [
      {
        current: criterion.levelLabel,
        key: criterion.key,
        label: criterion.label,
        previous: prior.levelLabel,
      },
    ];
  });

  return (
    <div className="correction-comparison">
      <h6>{t('aiCorrection.comparisonTitle')}</h6>
      {changes.length > 0 ? (
        <ul>
          {changes.map((change) => (
            <li key={change.key}>
              <strong>{change.label}</strong>
              <span>
                {t('aiCorrection.comparisonChange', {
                  current: change.current,
                  previous: change.previous,
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('aiCorrection.comparisonStable')}</p>
      )}
    </div>
  );
}

/**
 * Confiance basse (V4.5-110/113) : on montre ce que l'apprenant a écrit et on
 * dit que le système ne conclut pas. Aucun niveau, et surtout aucun retour
 * prescriptif — le retour du modèle sur ce critère n'est pas assez fiable pour
 * être présenté comme une consigne.
 */
function LowConfidenceCriterionRow({
  criterion,
}: {
  criterion: CorrectionResult['correction']['criteria'][number];
}) {
  const { t } = useI18n();
  return (
    <article className="correction-criterion correction-criterion--unsure">
      <div className="correction-criterion__heading">
        <strong>{criterion.label}</strong>
        <Badge tone="warning">{t('aiCorrection.toCheckLabel')}</Badge>
      </div>
      <p>{t('aiCorrection.toCheckExplanation')}</p>
      {criterion.evidenceQuotes.length > 0 ? (
        <div className="correction-criterion__evidence">
          <p>{t('aiCorrection.evidenceLabel')}</p>
          {criterion.evidenceQuotes.map((quote) => (
            <blockquote key={quote}>{quote}</blockquote>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CriterionRow({
  criterion,
}: {
  criterion: CorrectionResult['correction']['criteria'][number];
}) {
  const { t } = useI18n();
  return (
    <article className="correction-criterion">
      <div className="correction-criterion__heading">
        <strong>{criterion.label}</strong>
        <Badge tone={criterion.levelKey === 'mastered' ? 'success' : 'neutral'}>
          {criterion.levelLabel}
        </Badge>
      </div>
      <p>{criterion.feedback}</p>
      {criterion.evidenceQuotes.length > 0 ? (
        <div className="correction-criterion__evidence">
          <p>{t('aiCorrection.evidenceLabel')}</p>
          {criterion.evidenceQuotes.map((quote) => (
            <blockquote key={quote}>{quote}</blockquote>
          ))}
        </div>
      ) : null}
    </article>
  );
}
