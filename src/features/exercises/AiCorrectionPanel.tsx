import { useEffect, useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

import {
  type CorrectionHistoryEntry,
  type CorrectionQuote,
  type CorrectionResult,
  loadCorrectionHistory,
  requestCorrectionQuote,
  runCorrection,
} from '@/features/exercises/ai-correction';
import { useI18n } from '@/i18n';
import { formatLocalizedDate } from '@/shared/locale';

type PanelPhase =
  | { kind: 'HISTORY_PENDING' }
  | { kind: 'IDLE' }
  | { kind: 'QUOTE_PENDING' }
  | {
      argument?: string;
      kind: 'CONSENT';
      quote: CorrectionQuote;
      sourceCorrectionId?: string;
    }
  | {
      argument?: string;
      kind: 'RUN_PENDING';
      quote: CorrectionQuote;
      sourceCorrectionId?: string;
    }
  | {
      history: CorrectionHistoryEntry[];
      kind: 'RESULT';
      selectedIndex: number;
    }
  | {
      argument?: string;
      kind: 'ERROR';
      message: string;
      quote?: CorrectionQuote;
      sourceCorrectionId?: string;
    };

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
  const { locale, t } = useI18n();
  const [phase, setPhase] = useState<PanelPhase>({ kind: 'HISTORY_PENDING' });
  const [reconsiderationArgument, setReconsiderationArgument] = useState('');

  useEffect(() => {
    let active = true;
    void loadCorrectionHistory(submissionId)
      .then((history) => {
        if (active) {
          setPhase(
            history.length > 0
              ? {
                  history,
                  kind: 'RESULT',
                  selectedIndex: history.length - 1,
                }
              : { kind: 'IDLE' },
          );
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

  async function askQuote(input?: {
    argument: string;
    sourceCorrectionId: string;
  }) {
    setPhase({ kind: 'QUOTE_PENDING' });
    try {
      const quote = await requestCorrectionQuote({
        ...(input
          ? {
              action: 'RECONSIDERATION' as const,
              argument: input.argument,
              sourceCorrectionId: input.sourceCorrectionId,
            }
          : {}),
        idempotencyKey: `${input ? 'reconsideration' : 'correction'}:${submissionId}:${Date.now()}`,
        targetId: submissionId,
      });
      setPhase({
        ...(input ?? {}),
        kind: 'CONSENT',
        quote,
      });
    } catch (error) {
      setPhase({
        ...(input ?? {}),
        kind: 'ERROR',
        message:
          error instanceof Error && error.message
            ? error.message
            : t('aiCorrection.quoteError'),
      });
    }
  }

  async function confirmAndRun(input: {
    argument?: string;
    quote: CorrectionQuote;
    sourceCorrectionId?: string;
  }) {
    const { quote } = input;
    setPhase({ ...input, kind: 'RUN_PENDING' });
    try {
      const result = await runCorrection({ quoteId: quote.id });
      const persistedHistory = await loadCorrectionHistory(submissionId).catch(
        () => [],
      );
      const history: CorrectionHistoryEntry[] =
        persistedHistory.length > 0
          ? persistedHistory
          : [
              {
                ...result,
                action:
                  quote.action === 'RECONSIDERATION'
                    ? 'RECONSIDERATION'
                    : 'STANDARD',
                createdAt: new Date().toISOString(),
                sourceCorrectionId: input.sourceCorrectionId ?? null,
              },
            ];
      setPhase({
        history,
        kind: 'RESULT',
        selectedIndex: history.length - 1,
      });
    } catch (error) {
      setPhase({
        ...input,
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
        <p>
          {quote.action === 'RECONSIDERATION'
            ? t('aiCorrection.reconsiderationQuoteAction')
            : t('aiCorrection.quoteAction')}
        </p>
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
          {quote.action === 'RECONSIDERATION'
            ? t('aiCorrection.reconsiderationConsentNotice')
            : t('aiCorrection.consentNotice')}
        </p>
        <Button onClick={() => void confirmAndRun(phase)}>
          {quote.action === 'RECONSIDERATION'
            ? t('aiCorrection.reconsiderationConfirm')
            : t('aiCorrection.confirm')}
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
              phase.quote
                ? void confirmAndRun({
                    argument: phase.argument,
                    quote: phase.quote,
                    sourceCorrectionId: phase.sourceCorrectionId,
                  })
                : phase.argument && phase.sourceCorrectionId
                  ? void askQuote({
                      argument: phase.argument,
                      sourceCorrectionId: phase.sourceCorrectionId,
                    })
                  : void askQuote()
            }
          >
            {t('common.retry')}
          </Button>
          {phase.quote ? (
            <Button
              variant="ghost"
              onClick={() =>
                phase.argument && phase.sourceCorrectionId
                  ? void askQuote({
                      argument: phase.argument,
                      sourceCorrectionId: phase.sourceCorrectionId,
                    })
                  : void askQuote()
              }
            >
              {t('aiCorrection.newQuote')}
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  const result = phase.history[phase.selectedIndex];
  if (!result) return null;
  const { correction, settlement } = result;
  const previous =
    phase.selectedIndex > 0 ? phase.history[phase.selectedIndex - 1] : null;

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

      {phase.history.length > 1 ? (
        <section
          aria-label={t('aiCorrection.historyTitle')}
          class="correction-history"
        >
          <div class="correction-history__heading">
            <h5>{t('aiCorrection.historyTitle')}</h5>
            <span>
              {t('aiCorrection.historyCount', {
                count: phase.history.length,
              })}
            </span>
          </div>
          <div class="correction-history__choices">
            {phase.history.map((entry, index) => (
              <Button
                aria-pressed={phase.selectedIndex === index}
                key={entry.correction.id}
                onClick={() => setPhase({ ...phase, selectedIndex: index })}
                variant={phase.selectedIndex === index ? 'secondary' : 'ghost'}
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

      {result.action === 'STANDARD' &&
      !phase.history.some(
        (entry) => entry.sourceCorrectionId === correction.id,
      ) ? (
        <section class="correction-reconsideration">
          <p class="page-eyebrow">
            {t('aiCorrection.reconsiderationEyebrow')}
          </p>
          <h5>{t('aiCorrection.reconsiderationTitle')}</h5>
          <p>{t('aiCorrection.reconsiderationDescription')}</p>
          <label for={`reconsideration-${correction.id}`}>
            {t('aiCorrection.reconsiderationArgumentLabel')}
          </label>
          <textarea
            aria-describedby={`reconsideration-help-${correction.id}`}
            id={`reconsideration-${correction.id}`}
            maxLength={500}
            minLength={20}
            onInput={(event) =>
              setReconsiderationArgument(event.currentTarget.value)
            }
            rows={4}
            value={reconsiderationArgument}
          />
          <div
            class="correction-reconsideration__help"
            id={`reconsideration-help-${correction.id}`}
          >
            <span>{t('aiCorrection.reconsiderationArgumentHelp')}</span>
            <span>{reconsiderationArgument.length}/500</span>
          </div>
          <Button
            disabled={
              reconsiderationArgument.trim().length < 20 ||
              reconsiderationArgument.trim().length > 500
            }
            onClick={() =>
              void askQuote({
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
    <div class="correction-comparison">
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
