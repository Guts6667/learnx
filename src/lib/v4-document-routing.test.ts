import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('V4 document routing and assigned execution queue', () => {
  it('routes active work through the canonical status register', () => {
    const index = read('docs/INDEX.md');
    const status = read('docs/V4_DOCUMENT_STATUS.md');

    expect(index).toContain('V4_DOCUMENT_STATUS.md');
    expect(status).toContain('V4_EVIDENCE_SEMANTIC_ARBITRATION.md');
    expect(status).toContain('V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md');
    expect(index).toContain('V4_003E_SONNET_5_SEMANTIC_NO_GO_REPORT.md');
    expect(status).toContain(
      '| `V4_003E_SONNET_5_SEMANTIC_NO_GO_REPORT.md` | `HISTORICAL_EVIDENCE` |',
    );
    expect(index).not.toContain('V4_009B_LIVE_GATE.md');
    expect(index).not.toContain('V4_009C_PREPARATION_REPORT.md');
    expect(index).not.toContain(
      'V4_EXECUTABLE_RUBRIC_GEMINI_PANEL_V2_PREPARATION.md',
    );
  });

  it.each([
    'docs/V4_009B_DIAGNOSTIC_EXTENSION_GATE.md',
    'docs/V4_009B_LIVE_GATE.md',
    'docs/V4_009C_PREPARATION_REPORT.md',
    'docs/V4_EXECUTABLE_RUBRIC_GEMINI_PANEL_V2_PREPARATION.md',
    'docs/V4_EXECUTABLE_RUBRIC_SONNET_5_BOUNDED_GATE_PREPARATION.md',
  ])('marks %s as a closed request before its historical body', (path) => {
    expect(read(path).slice(0, 700)).toContain('CLOSED_REQUEST');
  });

  it('routes the closed Gemini gate to reconciliation without execution authority', () => {
    const index = read('docs/INDEX.md');
    const backlog = read('BACKLOG_V4.md');
    const roadmap = read('docs/V4_ROADMAP.md');
    const status = read('docs/V4_DOCUMENT_STATUS.md');
    const manifest = JSON.parse(
      read('docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json'),
    ) as {
      activeExecutionQueue: {
        currentResponsibleAgent: string;
        currentTicket: string;
        modelCallsAllowed: boolean;
      };
      offlineCandidateQueue: {
        currentTicket: string;
        remediation: {
          financeArbitrationRequired: boolean;
          mode: string;
          modelCallsAllowed: boolean;
          newIdentityFingerprint: string | null;
          newIdentityRequired: boolean;
          newOwnerSingleUseAuthorizationRequired: boolean;
          transportRemediation: {
            candidateCause: string;
            networkOrModelCallsPerformed: number;
            status: string;
            wireDialect: string;
          };
        };
        candidates: Array<{
          candidate: string;
          financeApproval?: { status: string };
          identityFingerprint: string | null;
          networkCallsAllowed: boolean;
          ownerAuthorizationConsumed?: boolean;
          status: string;
          networkGateResult?: {
            actualCostUsd: number | null;
            financialState: string;
            modelCallsPerformed: number;
            status: string;
            unresolvedReservedCostUsd: number;
            usableWorkflows: number;
          };
        }>;
        guards: {
          modelCallsAllowed: boolean;
          panelAuthorized: boolean;
          holdoutAuthorized: boolean;
          liveActivationAllowed: boolean;
        };
      };
      deliveryState: {
        experimental: { pipelinePromoted: boolean };
        live: {
          eligibleActivities: number;
          publishedContracts: number;
          realNetworkDispatchAllowed: boolean;
          status: string;
        };
      };
      eligibility: {
        activitiesEligibleForLiveCorrection: number;
        pipelinePromoted: boolean;
        publishedV4Contracts: number;
      };
    };

    expect(backlog).toContain('V4-003A — Corpus mécanique successeur');
    expect(backlog).toContain('V4-003B — Audit autonome indépendant');
    expect(backlog).toContain(
      "V4-003A-R1 — Durcissement de l'oracle mécanique",
    );
    expect(backlog).toContain('V4-003B-R1 — Nouvel audit autonome indépendant');
    expect(index).toContain('V4_003A_MECHANICAL_ORACLE_REPORT.md');
    expect(index).toContain('V4_003B_INDEPENDENT_AUDIT_REPORT.md');
    expect(index).toContain('V4_003A_R1_ORACLE_HARDENING_REPORT.md');
    expect(index).toContain('V4_003B_R1_INDEPENDENT_AUDIT_REPORT.md');
    expect(index).toContain(
      'V4_003E_Q1_GEMINI_3_6_NETWORK_TRANSPORT_PREFLIGHT.md',
    );
    expect(status).toContain(
      '| `V4_003C_EXPERIMENT_IDENTITY_FREEZE_REPORT.md` | `HISTORICAL_EVIDENCE` |',
    );
    expect(status).toContain(
      '| `V4_009C_S2_OFFLINE_RUNNER_PREFLIGHT.md` | `HISTORICAL_EVIDENCE` |',
    );
    expect(status).toContain(
      '| `V4_009C_S2_NETWORK_GATE_REPORT.md` | `HISTORICAL_EVIDENCE` |',
    );
    expect(roadmap).toContain('| `V4-003E — Analyse et documentation` |');
    expect(roadmap).toContain('| `V4-003E-Q1 — Dossier Gemini 3.6` |');
    expect(roadmap).toContain('| `V4-003E-Q1-R1 — Remédiation Gemini 3.6` |');
    expect(backlog).toContain(
      '`V4-003E-Q1 — Dossier Gemini 3.6 Flash` | `DONE_NO_GO_TECHNICAL_RECONCILIATION_REQUIRED`',
    );
    expect(backlog).toContain(
      '`V4-003E-Q1-R1 — Remédiation hors ligne Gemini 3.6` | `ACTIVE_OFFLINE_REMEDIATION_NEW_IDENTITY_REQUIRED`',
    );
    expect(manifest.activeExecutionQueue).toEqual(
      expect.objectContaining({
        currentResponsibleAgent: 'AGENT-PROTOCOLE-IA',
        currentTicket: 'V4-003E-Q1-R1',
        modelCallsAllowed: false,
      }),
    );
    expect(manifest.offlineCandidateQueue).toMatchObject({
      currentTicket: 'V4-003E-Q1-R1',
      guards: {
        holdoutAuthorized: false,
        liveActivationAllowed: false,
        modelCallsAllowed: false,
        panelAuthorized: false,
      },
      remediation: {
        financeArbitrationRequired: true,
        mode: 'OFFLINE_ONLY',
        modelCallsAllowed: false,
        newIdentityFingerprint: null,
        newIdentityRequired: true,
        newOwnerSingleUseAuthorizationRequired: true,
        transportRemediation: {
          candidateCause: 'PATTERN_KEYWORD_HYPOTHESIS_NOT_PROVEN',
          networkOrModelCallsPerformed: 0,
          status: 'IMPLEMENTED_AND_TESTED_OFFLINE_NEW_IDENTITY_NOT_FROZEN',
          wireDialect: 'evidence-assist-wire/3.0.1',
        },
      },
    });

    const closedQ1 = manifest.offlineCandidateQueue.candidates.find(
      ({ candidate }) => candidate === 'GEMINI_3_6_FLASH',
    );
    expect(closedQ1).toMatchObject({
      financeApproval: {
        status:
          'APPROVAL_AND_NETWORK_AUTHORIZATION_CONSUMED_GATE_CLOSED_RECONCILIATION_REQUIRED',
      },
      identityFingerprint:
        'ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed',
      networkCallsAllowed: false,
      ownerAuthorizationConsumed: true,
      status:
        'GATE_CLOSED_NO_GO_TECHNICAL_PROVIDER_HTTP_400_RECONCILIATION_REQUIRED',
      networkGateResult: {
        actualCostUsd: null,
        financialState: 'RECONCILIATION_REQUIRED',
        modelCallsPerformed: 1,
        status: 'NO-GO_TECHNICAL_PROVIDER_HTTP_400',
        unresolvedReservedCostUsd: 0.1208415,
        usableWorkflows: 0,
      },
    });
    expect(manifest.deliveryState).toMatchObject({
      experimental: { pipelinePromoted: false },
      live: {
        eligibleActivities: 0,
        publishedContracts: 0,
        realNetworkDispatchAllowed: false,
        status: 'HARD_OFF',
      },
    });
    expect(manifest.eligibility).toEqual({
      activitiesEligibleForLiveCorrection: 0,
      pipelinePromoted: false,
      publishedV4Contracts: 0,
    });
  });

  it('keeps one current remediation truth and supersedes the old semantic pipeline', () => {
    const backlog = read('BACKLOG_V4.md');
    const roadmap = read('docs/V4_ROADMAP.md');
    const index = read('docs/INDEX.md');
    const documentStatus = read('docs/V4_DOCUMENT_STATUS.md');
    const funnel = read('docs/V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md');
    const engine = read('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md');
    const adr = read('ADR_003_AI_CORRECTION_FINANCING_TRUST_BOUNDARIES.md');
    const manifestText = read('docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json');
    const reconciledSources = [
      backlog,
      roadmap,
      index,
      documentStatus,
      funnel,
      engine,
      adr,
    ];

    for (const source of [backlog, roadmap, index, funnel]) {
      expect(source).toContain('V4-003E-Q1-R1');
    }
    expect(index).toContain(
      'V4_003E_Q1_GEMINI_3_6_COST_RECONCILIATION.md',
    );
    expect(backlog).toContain(
      'V4_003E_Q1_GEMINI_3_6_COST_RECONCILIATION.md',
    );
    expect(roadmap).toContain(
      'gemini-3-6-google-vertex-attestation-2026-08-22.json',
    );
    expect(roadmap).toContain('ni une nouvelle identité');
    expect(roadmap).toContain('ni un arbitrage Finance, ni un GO réseau');
    expect(documentStatus).toContain(
      '`V4_003E_SONNET_5_SEMANTIC_NO_GO_REPORT.md` | `HISTORICAL_EVIDENCE`',
    );
    expect(documentStatus).not.toContain(
      '`V4_003E_SONNET_5_SEMANTIC_NO_GO_REPORT.md` | `CURRENT_STATUS`',
    );
    expect(documentStatus).toContain(
      '`V4_003E_Q1_GEMINI_3_6_COST_RECONCILIATION.md` | `CURRENT_STATUS`',
    );
    expect(funnel).toContain(
      '`v4-writing-framework-selection-fr@1.0.0-draft`, DRAFT, `EVIDENCE_ASSIST_ONLY`',
    );
    expect(backlog).toContain(
      'même si le diagnostic ne conduisait finalement à aucun autre changement du',
    );
    expect(backlog).toContain(
      '## V4-009B — Preuve historique du gate composite remplacé',
    );
    expect(backlog).toContain(
      'Exécuter un seul rôle evidence-assist candidate-only.',
    );
    expect(backlog).toContain(
      'persistance du brut append-only, validation serveur, certificat et feedback',
    );
    expect(adr).toContain('### 6.1 Correction formative evidence-assist');
    expect(adr).toMatch(
      /Une nouvelle analyse volontaire crée une\s+opération versionnée indépendante\./u,
    );
    expect(adr).not.toContain(
      'elle devient la décision courante pour\nscore et progression',
    );
    expect(manifestText).toContain(
      'PUBLIC_CATALOG_AND_DOCUMENTATION_READ_ONLY_NO_INFERENCE',
    );
    expect(manifestText).toContain(
      'conservativeWriteOffRequiresSeparateFinanceAuthorization',
    );
    expect(manifestText).toContain('evidence-assist-wire/3.0.1');
    expect(manifestText).toContain('PATTERN_KEYWORD_HYPOTHESIS_NOT_PROVEN');
    expect(manifestText.match(/"currentTicket":/g)).toHaveLength(2);
    expect(manifestText.match(/"currentTicket": "V4-003E-Q1-R1"/g)).toHaveLength(
      2,
    );

    for (const staleStatus of [
      'V4-003E_LOCAL_PENDING_INTEGRATION',
      'DONE_LOCAL_PENDING_INTEGRATION',
      'APPROVED_NETWORK_NOT_AUTHORIZED',
    ]) {
      expect([...reconciledSources, manifestText].join('\n')).not.toContain(
        staleStatus,
      );
    }

    expect(engine).toContain('EXPLICITLY_REFUTED');
    expect(engine).toContain('EVIDENCE_FOR_ELEMENT');
    expect(engine).toContain('EVIDENCE_AGAINST_ELEMENT');
    expect(engine).toContain('ABSTAIN');
    expect(engine).toContain('SUPERSEDED_HISTORICAL');
    expect(engine).not.toContain('Le moteur reconnaît quatre statuts');
    expect(engine).not.toContain('- statut proposé ;');
    expect(engine).not.toContain(
      '- spans exacts `start`, `end`, `sha256` dans `responseText` ;',
    );

    expect(adr).toContain('EXPLICITLY_REFUTED');
    expect(adr).toContain('SUPERSEDED_HISTORICAL');
    expect(adr).not.toContain('règles de seconde passe');
    expect(adr).not.toContain(
      "possibilité d'une seconde passe automatique incluse dans le plafond",
    );
    expect(adr).not.toContain('taux de seconde passe');
    expect(adr).not.toContain('modèles primaire et de seconde passe');

    expect(funnel).not.toContain('writing-go-no-go-recommendation-fr.v2');
    expect(funnel).not.toContain(
      '`V4-002A` : choisir l\'activité réelle, sa consigne et son objectif observable',
    );
  });

  it('routes Totem through one validated design authority without opening implementation', () => {
    const index = read('docs/INDEX.md');
    const backlog = read('BACKLOG_V4.md');
    const roadmap = read('docs/V4_ROADMAP.md');
    const status = read('docs/V4_DOCUMENT_STATUS.md');
    const totem = read('docs/V4_TOTEM_DESIGN_IMPLEMENTATION_PLAN.md');

    expect(index).toContain('V4_TOTEM_DESIGN_IMPLEMENTATION_PLAN.md');
    expect(status).toContain('ACTIVE_DESIGN_AUTHORITY');
    expect(totem).toContain('DESIGN_VALIDATED');
    expect(totem).toContain('NOT_STARTED_NOT_AUTHORIZED_BY_THIS_DOCUMENT');
    expect(totem).toContain('320, 390, 720, 1440 et 1920');
    expect(totem).toContain('Aucun prix, capacité, allocation');

    for (const ticket of [
      'V4-016D',
      'V4-016E',
      'V4-016F',
      'V4-016H',
      'V4-016I',
    ]) {
      expect(backlog).toContain(`## ${ticket}`);
      expect(roadmap).toContain(ticket);
    }

    expect(roadmap).toContain('V4-003B-R1');
    expect(roadmap).toContain('DESIGN_VALIDATED_WAIT_GO');
  });
});
