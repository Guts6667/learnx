import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

import {
  type CorrectionHistoryEntry,
  type CorrectionQuote,
  loadCorrectionHistory,
  requestCorrectionQuote,
  runCorrection,
} from '@/features/exercises/ai-correction';
import { type AiCorrectionValidationScope } from '@/features/exercises/queries';
import { AiCorrectionResult } from '@/features/exercises/AiCorrectionResult';
import { useI18n } from '@/i18n';

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

function CollectingPhaseNotice({
  scope,
}: {
  scope: AiCorrectionValidationScope | null;
}) {
  const { t } = useI18n();
  if (!scope || scope.validated) return null;
  return (
    <div className="correction-state__notice correction-state__notice--collecting">
      <strong>{t('aiCorrection.collectingLabel')}</strong>
      <p>{t('aiCorrection.collectingDescription')}</p>
    </div>
  );
}

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
  validationScope = null,
}: {
  submissionId: string;
  validationScope?: AiCorrectionValidationScope | null;
}) {
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
      <div className="correction-state correction-state--pending" role="status">
        <Spinner label={t('aiCorrection.historyPending')} size="sm" />
      </div>
    );
  }

  if (phase.kind === 'IDLE') {
    return (
      <section className="correction-state correction-state--idle">
        <div className="correction-state__heading">
          <div>
            <p className="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
            <h4>{t('aiCorrection.readyTitle')}</h4>
          </div>
          <span className="correction-state__doctrine">
            {t('aiCorrection.noProgressImpact')}
          </span>
        </div>
        <p>{t('aiCorrection.intro')}</p>
        <CollectingPhaseNotice scope={validationScope} />
        <div className="correction-contract correction-contract--preview">
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
        <p className="correction-state__notice">
          {t('aiCorrection.doctrineNotice')}{' '}
          <a href={locale === 'en' ? '/privacy' : '/confidentialite'}>
            {t('aiCorrection.privacyLink')}
          </a>
        </p>
        <Button onClick={() => void askQuote()}>
          {t('aiCorrection.seePrice')}
        </Button>
      </section>
    );
  }

  if (phase.kind === 'QUOTE_PENDING') {
    return (
      <div className="correction-state correction-state--pending" role="status">
        <Spinner label={t('aiCorrection.quotePending')} size="sm" />
      </div>
    );
  }

  if (phase.kind === 'RUN_PENDING') {
    const { quote } = phase;
    return (
      <section
        aria-live="polite"
        className="correction-state correction-state--running"
        role="status"
      >
        <div className="correction-state__heading">
          <div>
            <p className="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
            <h4>{t('aiCorrection.processingTitle')}</h4>
          </div>
          <Spinner label={t('aiCorrection.processingShort')} size="sm" />
        </div>
        <p>{t('aiCorrection.processingDescription')}</p>
        <div className="correction-contract">
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
      <section className="correction-state correction-state--consent">
        <div className="correction-state__heading">
          <div>
            <p className="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
            <h4>{t('aiCorrection.quoteTitle')}</h4>
          </div>
          <span className="correction-state__doctrine">
            {t('aiCorrection.noProgressImpact')}
          </span>
        </div>
        <p>
          {quote.action === 'RECONSIDERATION'
            ? t('aiCorrection.reconsiderationQuoteAction')
            : t('aiCorrection.quoteAction')}
        </p>
        <CollectingPhaseNotice scope={validationScope} />
        <div className="correction-contract">
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
        <p className="correction-state__notice">
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
      <section className="correction-state correction-state--error">
        <p className="page-eyebrow">{t('aiCorrection.assistedLabel')}</p>
        <h4>{t('aiCorrection.errorTitle')}</h4>
        <p className="ui-text-danger" role="alert">
          {phase.message}
        </p>
        <div className="correction-state__actions">
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

  return (
    <AiCorrectionResult
      history={phase.history}
      onReconsiderationArgumentChange={setReconsiderationArgument}
      onRequestReconsideration={(input) => void askQuote(input)}
      onSelectCorrection={(selectedIndex) =>
        setPhase({ ...phase, selectedIndex })
      }
      reconsiderationArgument={reconsiderationArgument}
      selectedIndex={phase.selectedIndex}
    />
  );
}
