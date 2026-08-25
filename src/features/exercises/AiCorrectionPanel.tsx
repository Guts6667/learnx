import { useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

import {
  type CorrectionQuote,
  type CorrectionResult,
  requestCorrectionQuote,
  runCorrection,
} from '@/features/exercises/ai-correction';
import { useI18n } from '@/i18n';

type PanelPhase =
  | { kind: 'IDLE' }
  | { kind: 'QUOTE_PENDING' }
  | { kind: 'CONSENT'; quote: CorrectionQuote }
  | { kind: 'RUN_PENDING'; quote: CorrectionQuote }
  | { kind: 'RESULT'; result: CorrectionResult }
  | { kind: 'ERROR'; message: string; quote?: CorrectionQuote };

/**
 * Contrat avant engagement (EMOTIONAL_DESIGN_CONTRACT §5.10) : le panneau
 * énonce action, unité, plafond, prix estimé et scénario « à retravailler »
 * AVANT tout lancement payant ; le consentement est unique et explicite.
 * Après exécution : restitution par critère (« Extrait de votre réponse »),
 * acquis avant à renforcer, prochaine action, score indicatif secondaire —
 * aucun score exact global en cas de critères « à retravailler » — puis
 * récap plafond accepté / débité / libéré.
 */
export function AiCorrectionPanel({ submissionId }: { submissionId: string }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<PanelPhase>({ kind: 'IDLE' });

  async function askQuote() {
    setPhase({ kind: 'QUOTE_PENDING' });
    try {
      const quote = await requestCorrectionQuote({
        idempotencyKey: `correction:${submissionId}:${Date.now()}`,
        targetId: submissionId,
      });
      setPhase({ kind: 'CONSENT', quote });
    } catch (error) {
      setPhase({
        kind: 'ERROR',
        message:
          error instanceof Error && error.message
            ? error.message
            : t('aiCorrection.quoteError'),
      });
    }
  }

  async function confirmAndRun(quote: CorrectionQuote) {
    setPhase({ kind: 'RUN_PENDING', quote });
    try {
      const result = await runCorrection({ quoteId: quote.id });
      setPhase({ kind: 'RESULT', result });
    } catch (error) {
      setPhase({
        kind: 'ERROR',
        message:
          error instanceof Error && error.message
            ? error.message
            : t('aiCorrection.runError'),
        quote,
      });
    }
  }

  if (phase.kind === 'IDLE') {
    return (
      <div class="ui-control-surface space-y-3 rounded-lg p-4">
        <div class="flex items-center gap-2">
          <Badge tone="info">{t('aiCorrection.assistedLabel')}</Badge>
        </div>
        <p class="text-sm leading-6">{t('aiCorrection.intro')}</p>
        <p class="ui-text-muted text-sm leading-6">
          {t('aiCorrection.doctrineNotice')}
        </p>
        <Button variant="secondary" onClick={() => void askQuote()}>
          {t('aiCorrection.seePrice')}
        </Button>
      </div>
    );
  }

  if (phase.kind === 'QUOTE_PENDING') {
    return <Spinner label={t('aiCorrection.quotePending')} size="sm" />;
  }

  if (phase.kind === 'CONSENT' || phase.kind === 'RUN_PENDING') {
    const { quote } = phase;
    return (
      <div class="ui-control-surface space-y-3 rounded-lg p-4">
        <div class="flex items-center gap-2">
          <Badge tone="info">{t('aiCorrection.assistedLabel')}</Badge>
        </div>
        <p class="text-sm leading-6">{t('aiCorrection.quoteAction')}</p>
        <p class="text-sm leading-6">
          {t('aiCorrection.quoteSummary', {
            estimated: quote.estimatedCredits,
            maximum: quote.maximumReservedCredits,
          })}
        </p>
        <p class="ui-text-muted text-sm leading-6">
          {t('aiCorrection.consentNotice')}
        </p>
        <div>
          <Button
            isLoading={phase.kind === 'RUN_PENDING'}
            onClick={() => void confirmAndRun(quote)}
          >
            {t('aiCorrection.confirm')}
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'ERROR') {
    return (
      <div class="ui-control-surface space-y-3 rounded-lg p-4">
        <p class="ui-text-danger text-sm" role="alert">
          {phase.message}
        </p>
        <div class="flex flex-wrap gap-3">
          <Button
            onClick={() =>
              phase.quote ? void confirmAndRun(phase.quote) : void askQuote()
            }
          >
            {t('common.retry')}
          </Button>
          {phase.quote ? (
            <Button variant="ghost" onClick={() => void askQuote()}>
              {t('aiCorrection.newQuote')}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const { result } = phase;
  const { correction, settlement } = result;

  if (correction.status === 'FAILED') {
    return (
      <div class="ui-control-surface space-y-3 rounded-lg p-4">
        <div class="flex items-center gap-2">
          <Badge tone="info">{t('aiCorrection.assistedLabel')}</Badge>
        </div>
        <p class="text-sm leading-6">{t('aiCorrection.unavailable')}</p>
        <p class="ui-text-muted text-sm leading-6">
          {t('aiCorrection.settlementRecap', {
            reserved: settlement.reservedCredits,
            settled: settlement.settledCredits,
            released: settlement.releasedCredits,
          })}
        </p>
      </div>
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
  const acquired = delivered.filter(
    (criterion) => criterion.levelKey === 'mastered',
  );
  const toReinforce = delivered.filter(
    (criterion) => criterion.levelKey !== 'mastered',
  );
  const priorityCriterion = toReinforce[0];
  const priorityUnsureKey = correction.unsureCriteria[0];
  const priorityText = priorityCriterion
    ? priorityCriterion.feedback
    : priorityUnsureKey
      ? correction.overallFeedback
      : correction.overallFeedback;

  return (
    <div class="totem-correction-layout">
      <div class="totem-correction-main">
        <section class="totem-correction-appreciation">
          <p class="page-eyebrow">{t('aiCorrection.appreciation')}</p>
          <h2>{t('aiCorrection.resultTitle')}</h2>
          {correction.overallFeedback ? (
            <p>{correction.overallFeedback}</p>
          ) : null}
          {correction.indicativeScore !== null ? (
            <span class="totem-correction-score">
              {t('aiCorrection.indicativeScore', {
                score: correction.indicativeScore.toFixed(0),
              })}
            </span>
          ) : null}
        </section>

        {priorityText ? (
          <aside class="totem-correction-priority">
            <p class="page-eyebrow">{t('aiCorrection.priority')}</p>
            <p>{priorityText}</p>
          </aside>
        ) : null}

        {acquired.length > 0 ? (
          <section aria-labelledby="correction-acquired">
            <h3 class="totem-correction-section-title" id="correction-acquired">
              {t('aiCorrection.acquired')}
            </h3>
            {acquired.map((criterion) => (
              <CriterionRow criterion={criterion} key={criterion.key} />
            ))}
          </section>
        ) : null}

        {toReinforce.length > 0 || correction.unsureCriteria.length > 0 ? (
          <section aria-labelledby="correction-reinforce">
            <h3
              class="totem-correction-section-title"
              id="correction-reinforce"
            >
              {t('aiCorrection.toReinforce')}
            </h3>
            {toReinforce.map((criterion) => (
              <CriterionRow criterion={criterion} key={criterion.key} />
            ))}
            {correction.unsureCriteria.map((key) => (
              <p class="totem-correction-unsure" key={key}>
                {t('aiCorrection.reworkCriterion', {
                  criterion: unsureLabels.get(key) ?? key,
                })}
              </p>
            ))}
          </section>
        ) : null}
      </div>

      <aside class="totem-correction-transparency">
        <p class="page-eyebrow">{t('aiCorrection.transparency')}</p>
        <div>
          <strong>{t('learning.progressLabel')}</strong>
          <span>{t('aiCorrection.noProgressImpact')}</span>
        </div>
        <div>
          <strong>{t('aiCorrection.verification')}</strong>
          <span>{t('aiCorrection.verificationIncluded')}</span>
        </div>
        <p>
          {t('aiCorrection.settlementRecap', {
            reserved: settlement.reservedCredits,
            settled: settlement.settledCredits,
            released: settlement.releasedCredits,
          })}
        </p>
      </aside>
    </div>
  );
}

function CriterionRow({
  criterion,
}: {
  criterion: CorrectionResult['correction']['criteria'][number];
}) {
  const { t } = useI18n();
  return (
    <article class="totem-correction-criterion">
      <div class="totem-correction-criterion__head">
        <h4>{criterion.label}</h4>
        <span>{criterion.levelLabel}</span>
      </div>
      <p>{criterion.feedback}</p>
      {criterion.evidenceQuotes.length > 0 ? (
        <div class="totem-correction-evidence">
          <strong>{t('aiCorrection.evidenceLabel')}</strong>
          {criterion.evidenceQuotes.map((quote) => (
            <blockquote key={quote}>{quote}</blockquote>
          ))}
        </div>
      ) : null}
    </article>
  );
}
