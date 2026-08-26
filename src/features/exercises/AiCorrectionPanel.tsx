import { useEffect, useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

import {
  type CorrectionQuote,
  type CorrectionResult,
  loadLatestCorrection,
  requestCorrectionQuote,
  runCorrection,
} from '@/features/exercises/ai-correction';
import { useI18n } from '@/i18n';

type PanelPhase =
  | { kind: 'HISTORY_PENDING' }
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
  const [phase, setPhase] = useState<PanelPhase>({ kind: 'HISTORY_PENDING' });

  useEffect(() => {
    let active = true;
    void loadLatestCorrection(submissionId)
      .then((result) => {
        if (active) {
          setPhase(result ? { kind: 'RESULT', result } : { kind: 'IDLE' });
        }
      })
      .catch(() => {
        // Une indisponibilité de l'historique ne doit pas empêcher un nouveau
        // devis. Le serveur conserve l'idempotence et interdit le double débit.
        if (active) setPhase({ kind: 'IDLE' });
      });
    return () => {
      active = false;
    };
  }, [submissionId]);

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

  if (phase.kind === 'HISTORY_PENDING') {
    return (
      <div class="correction-state correction-state--pending" role="status">
        <Spinner label={t('aiCorrection.historyPending')} size="sm" />
      </div>
    );
  }

  if (phase.kind === 'IDLE') {
    return (
      <section class="correction-state correction-state--idle">
        <div class="correction-state__heading">
          <div>
            <p class="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
            <h4>{t('aiCorrection.readyTitle')}</h4>
          </div>
          <span class="correction-state__doctrine">
            {t('aiCorrection.noProgressImpact')}
          </span>
        </div>
        <p>{t('aiCorrection.intro')}</p>
        <div class="correction-contract correction-contract--preview">
          <div>
            <span>{t('aiCorrection.contractCostLabel')}</span>
            <strong>{t('aiCorrection.contractCostPending')}</strong>
          </div>
          <div>
            <span>{t('aiCorrection.contractFailureLabel')}</span>
            <strong>{t('aiCorrection.contractFailureValue')}</strong>
          </div>
          <div>
            <span>{t('aiCorrection.contractProgressLabel')}</span>
            <strong>{t('aiCorrection.noProgressImpact')}</strong>
          </div>
        </div>
        <p class="correction-state__notice">
          {t('aiCorrection.doctrineNotice')}
        </p>
        <Button onClick={() => void askQuote()}>
          {t('aiCorrection.seePrice')}
        </Button>
      </section>
    );
  }

  if (phase.kind === 'QUOTE_PENDING') {
    return (
      <div class="correction-state correction-state--pending" role="status">
        <Spinner label={t('aiCorrection.quotePending')} size="sm" />
      </div>
    );
  }

  if (phase.kind === 'RUN_PENDING') {
    const { quote } = phase;
    return (
      <section
        aria-live="polite"
        class="correction-state correction-state--running"
        role="status"
      >
        <div class="correction-state__heading">
          <div>
            <p class="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
            <h4>{t('aiCorrection.processingTitle')}</h4>
          </div>
          <Spinner label={t('aiCorrection.processingShort')} size="sm" />
        </div>
        <p>{t('aiCorrection.processingDescription')}</p>
        <ol class="correction-progress">
          <li data-state="complete">{t('aiCorrection.processingReceived')}</li>
          <li data-state="active">{t('aiCorrection.processingCriteria')}</li>
          <li>{t('aiCorrection.processingEvidence')}</li>
          <li>{t('aiCorrection.processingSynthesis')}</li>
        </ol>
        <div class="correction-contract">
          <div>
            <span>{t('aiCorrection.contractCeilingLabel')}</span>
            <strong>{quote.maximumReservedCredits}</strong>
          </div>
          <div>
            <span>{t('aiCorrection.verification')}</span>
            <strong>{t('aiCorrection.verificationIncluded')}</strong>
          </div>
        </div>
      </section>
    );
  }

  if (phase.kind === 'CONSENT') {
    const { quote } = phase;
    return (
      <section class="correction-state correction-state--consent">
        <div class="correction-state__heading">
          <div>
            <p class="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
            <h4>{t('aiCorrection.quoteTitle')}</h4>
          </div>
          <span class="correction-state__doctrine">
            {t('aiCorrection.noProgressImpact')}
          </span>
        </div>
        <p>{t('aiCorrection.quoteAction')}</p>
        <div class="correction-contract">
          <div>
            <span>{t('aiCorrection.contractEstimateLabel')}</span>
            <strong>{quote.estimatedCredits}</strong>
          </div>
          <div>
            <span>{t('aiCorrection.contractCeilingLabel')}</span>
            <strong>{quote.maximumReservedCredits}</strong>
          </div>
          <div>
            <span>{t('aiCorrection.verification')}</span>
            <strong>{t('aiCorrection.verificationIncluded')}</strong>
          </div>
        </div>
        <p class="correction-state__notice">
          {t('aiCorrection.consentNotice')}
        </p>
        <Button onClick={() => void confirmAndRun(quote)}>
          {t('aiCorrection.confirm')}
        </Button>
      </section>
    );
  }

  if (phase.kind === 'ERROR') {
    return (
      <section class="correction-state correction-state--error">
        <p class="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
        <h4>{t('aiCorrection.errorTitle')}</h4>
        <p class="ui-text-danger" role="alert">
          {phase.message}
        </p>
        <div class="correction-state__actions">
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
      </section>
    );
  }

  const { result } = phase;
  const { correction, settlement } = result;

  if (correction.status === 'FAILED') {
    return (
      <section class="correction-state correction-state--unavailable">
        <p class="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
        <h4>{t('aiCorrection.unavailableTitle')}</h4>
        <p>{t('aiCorrection.unavailable')}</p>
        <p class="correction-settlement">
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
  const acquired = delivered.filter(
    (criterion) => criterion.levelKey === 'mastered',
  );
  const toReinforce = delivered.filter(
    (criterion) => criterion.levelKey !== 'mastered',
  );

  return (
    <section class="correction-result">
      <header class="correction-result__header">
        <div>
          <p class="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
          <h4>{t('aiCorrection.resultTitle')}</h4>
        </div>
        <span>{t('aiCorrection.noProgressImpact')}</span>
      </header>

      {acquired.length > 0 ? (
        <section class="correction-result__group">
          <h5>{t('aiCorrection.acquired')}</h5>
          {acquired.map((criterion) => (
            <CriterionRow criterion={criterion} />
          ))}
        </section>
      ) : null}

      {toReinforce.length > 0 || correction.unsureCriteria.length > 0 ? (
        <section class="correction-result__group">
          <h5>{t('aiCorrection.toReinforce')}</h5>
          {toReinforce.map((criterion) => (
            <CriterionRow criterion={criterion} />
          ))}
          {correction.unsureCriteria.map((key) => (
            <article
              class="correction-criterion correction-criterion--unsure"
              key={key}
            >
              <div class="correction-criterion__heading">
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

      <section class="correction-result__priority">
        <p class="page-eyebrow">{t('aiCorrection.priority')}</p>
        <h5>{t('aiCorrection.nextAction')}</h5>
        {correction.overallFeedback ? (
          <p>{correction.overallFeedback}</p>
        ) : null}
      </section>

      <footer class="correction-result__footer">
        {correction.indicativeScore !== null ? (
          <p class="correction-result__score">
            {t('aiCorrection.indicativeScore', {
              score: correction.indicativeScore.toFixed(0),
            })}
          </p>
        ) : null}
        <p class="correction-settlement">
          {t('aiCorrection.settlementRecap', {
            reserved: settlement.reservedCredits,
            settled: settlement.settledCredits,
            released: settlement.releasedCredits,
          })}
        </p>
      </footer>
    </section>
  );
}

function CriterionRow({
  criterion,
}: {
  criterion: CorrectionResult['correction']['criteria'][number];
}) {
  const { t } = useI18n();
  return (
    <article class="correction-criterion">
      <div class="correction-criterion__heading">
        <strong>{criterion.label}</strong>
        <Badge tone={criterion.levelKey === 'mastered' ? 'success' : 'neutral'}>
          {criterion.levelLabel}
        </Badge>
      </div>
      <p>{criterion.feedback}</p>
      {criterion.evidenceQuotes.length > 0 ? (
        <div class="correction-criterion__evidence">
          <p>{t('aiCorrection.evidenceLabel')}</p>
          {criterion.evidenceQuotes.map((quote) => (
            <blockquote>{quote}</blockquote>
          ))}
        </div>
      ) : null}
    </article>
  );
}
