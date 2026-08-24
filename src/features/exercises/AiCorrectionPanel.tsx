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
  | { kind: 'ERROR'; message: string };

/**
 * Contrat avant engagement (EMOTIONAL_DESIGN_CONTRACT §5.10) : le panneau
 * énonce action, unité, plafond, prix estimé et scénario « à retravailler »
 * AVANT tout lancement payant ; le consentement est unique et explicite.
 * Après exécution : restitution par critère (« Extrait de votre réponse »),
 * acquis avant à renforcer, prochaine action, score indicatif secondaire —
 * aucun score exact global en cas de critères « à retravailler » — puis
 * récap plafond accepté / débité / libéré.
 */
export function AiCorrectionPanel({
  submissionId,
}: {
  submissionId: string;
}) {
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
      <div class="ui-control-surface space-y-2 rounded-lg p-4">
        <p class="ui-text-danger text-sm" role="alert">
          {phase.message}
        </p>
        <Button variant="secondary" onClick={() => setPhase({ kind: 'IDLE' })}>
          {t('navigation.back.label')}
        </Button>
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
  const delivered = correction.criteria.filter(
    (criterion) => !unsureKeys.has(criterion.key),
  );
  const acquired = delivered.filter(
    (criterion) => criterion.levelKey === 'mastered',
  );
  const toReinforce = delivered.filter(
    (criterion) => criterion.levelKey !== 'mastered',
  );

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <Badge tone="info">{t('aiCorrection.assistedLabel')}</Badge>
        <span class="ui-text-muted text-sm">{t('aiCorrection.noProgressImpact')}</span>
      </div>

      {acquired.length > 0 ? (
        <section class="space-y-2">
          <h4 class="text-sm font-semibold">{t('aiCorrection.acquired')}</h4>
          {acquired.map((criterion) => (
            <CriterionRow criterion={criterion} />
          ))}
        </section>
      ) : null}

      {toReinforce.length > 0 || correction.unsureCriteria.length > 0 ? (
        <section class="space-y-2">
          <h4 class="text-sm font-semibold">{t('aiCorrection.toReinforce')}</h4>
          {toReinforce.map((criterion) => (
            <CriterionRow criterion={criterion} />
          ))}
          {correction.unsureCriteria.map((key) => (
            <p
              class="ui-control-surface rounded-lg p-3 text-sm leading-6"
              key={key}
            >
              {t('aiCorrection.reworkCriterion', { criterion: key })}
            </p>
          ))}
        </section>
      ) : null}

      <section class="space-y-2">
        <h4 class="text-sm font-semibold">{t('aiCorrection.nextAction')}</h4>
        <p class="text-sm leading-6">{correction.overallFeedback}</p>
        {correction.indicativeScore !== null ? (
          <p class="ui-text-muted text-sm">
            {t('aiCorrection.indicativeScore', {
              score: correction.indicativeScore.toFixed(0),
            })}
          </p>
        ) : null}
      </section>

      <p class="ui-text-muted text-sm">
        {t('aiCorrection.settlementRecap', {
          reserved: settlement.reservedCredits,
          settled: settlement.settledCredits,
          released: settlement.releasedCredits,
        })}
      </p>
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
    <article class="ui-control-surface space-y-2 rounded-lg p-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium">{criterion.label}</span>
        <Badge tone={criterion.levelKey === 'mastered' ? 'success' : 'neutral'}>
          {criterion.levelLabel}
        </Badge>
      </div>
      <p class="text-sm leading-6">{criterion.feedback}</p>
      {criterion.evidenceQuotes.length > 0 ? (
        <div class="space-y-1">
          <p class="ui-text-muted text-xs uppercase tracking-wide">
            {t('aiCorrection.evidenceLabel')}
          </p>
          {criterion.evidenceQuotes.map((quote) => (
            <blockquote class="ui-prose border-l-2 border-current/30 pl-3 text-sm italic leading-6">
              {quote}
            </blockquote>
          ))}
        </div>
      ) : null}
    </article>
  );
}
