import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { validateEvidenceResearcherPanelCampaign } from '../../lib/evidence-researcher-panel-campaign.js';
import { compileExecutableRubric } from '../../lib/executable-rubric-engine.js';
import { validateExecutableRubricSemanticSelection } from '../../lib/executable-rubric-semantic-selection.js';
import type { ExecutableRubricSemanticCorpus } from '../../lib/executable-rubric-semantic-corpus.js';
import type { EvidenceResearcherOutput } from '../../lib/evidence-researcher-protocol.js';
import { runEvidenceResearcherPanel } from './evidence-researcher-panel.js';

const base = resolve('benchmarks/ai-correction/executable-rubric');

async function fixture() {
  const [
    attestationText,
    campaignText,
    historicText,
    revisedText,
    rubricText,
    selectionText,
    specText,
  ] = await Promise.all([
    readFile(
      resolve(
        base,
        'gemini-google-vertex-attestation-2026-08-14-reasoning.json',
      ),
      'utf8',
    ),
    readFile(
      resolve(base, 'gemini-evidence-researcher-panel.v1.3-v2.json'),
      'utf8',
    ),
    readFile(resolve(base, 'writing-fr-semantic-development.v1.json'), 'utf8'),
    readFile(
      resolve(base, 'writing-fr-semantic-three-case-development.v2.json'),
      'utf8',
    ),
    readFile(resolve(base, 'writing-recommendation-fr.v1.json'), 'utf8'),
    readFile(
      resolve(base, 'writing-fr-semantic-development.v2.manifest.json'),
      'utf8',
    ),
    readFile(resolve('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'), 'utf8'),
  ]);
  const rubric = JSON.parse(rubricText) as unknown;
  const compiled = compileExecutableRubric(rubric);
  const campaign = validateEvidenceResearcherPanelCampaign({
    campaign: JSON.parse(campaignText) as unknown,
    catalogAttestationText: attestationText,
    rubric,
    rubricFileText: rubricText,
    semanticSelectionText: selectionText,
    specText,
  });
  const corpus = validateExecutableRubricSemanticSelection({
    compiled,
    selection: JSON.parse(selectionText) as unknown,
    sources: [
      {
        path: 'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
        text: historicText,
      },
      {
        path: 'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
        text: revisedText,
      },
    ],
  });
  return { campaign, campaignFileText: campaignText, compiled, corpus };
}

function outputFor(
  caseItem: ExecutableRubricSemanticCorpus['cases'][number],
): EvidenceResearcherOutput {
  return {
    elements: caseItem.expectedElements.map((element) => ({
      confidence: 0.95,
      contradictions: [],
      elementKey: element.elementKey,
      evidenceQuotes: element.evidenceQuotes,
      status: element.status,
    })),
  };
}

function validResult(
  caseItem: ExecutableRubricSemanticCorpus['cases'][number],
  requestId: string,
) {
  return {
    latencyMs: 10,
    modelSnapshot: 'google/gemini-3.6-flash',
    observedProvider: 'Google',
    output: outputFor(caseItem),
    providerRequestId: requestId,
    providerRoute: 'Google',
    requestedRoute: 'google-vertex/global',
    status: 'VALID' as const,
    usage: {
      actualCostUsd: 0.001,
      costSource: 'ACTUAL' as const,
      inputTokens: 100,
      reasoningTokens: 0,
      visibleOutputTokens: 100,
    },
  };
}

describe('evidence researcher panel runner', () => {
  it('executes exactly the 20 preregistered cells and resumes with zero calls', async () => {
    const input = await fixture();
    const execute = vi.fn(({ caseItem, cellKey }) =>
      Promise.resolve(validResult(caseItem, `request-${cellKey}`)),
    );
    const first = await runEvidenceResearcherPanel({
      ...input,
      completionUsdPerToken: 0.00000375,
      onRawReceived: vi.fn(),
      promptUsdPerToken: 0.00000075,
      provider: { execute },
    });
    expect(first.state.completedCellKeys).toHaveLength(20);
    expect(first.state.attempts).toHaveLength(20);
    expect(first.ledger).toHaveLength(40);

    const resumedExecute = vi.fn();
    const resumed = await runEvidenceResearcherPanel({
      ...input,
      completionUsdPerToken: 0.00000375,
      onRawReceived: vi.fn(),
      promptUsdPerToken: 0.00000075,
      provider: { execute: resumedExecute },
      resume: first,
    });
    expect(resumedExecute).not.toHaveBeenCalled();
    expect(resumed.state.completedCellKeys).toHaveLength(20);
  });

  it('keeps an oracle disagreement usable and measurable', async () => {
    const input = await fixture();
    const execute = vi.fn(({ caseItem, cellKey }) => {
      const result = validResult(caseItem, `request-${cellKey}`);
      result.output.elements[0] = {
        confidence: 0.8,
        contradictions: [],
        elementKey: result.output.elements[0]?.elementKey ?? '',
        evidenceQuotes: [],
        status: 'AMBIGUOUS',
      };
      return Promise.resolve(result);
    });
    const result = await runEvidenceResearcherPanel({
      ...input,
      completionUsdPerToken: 0.00000375,
      onRawReceived: vi.fn(),
      promptUsdPerToken: 0.00000075,
      provider: { execute },
    });
    expect(result.state.completedCellKeys).toHaveLength(20);
    expect(
      result.state.attempts.every(
        ({ oracleAgreement }) => oracleAgreement === false,
      ),
    ).toBe(true);
  });

  it('stops a strict gate after the first oracle disagreement', async () => {
    const input = await fixture();
    const execute = vi.fn(({ caseItem, cellKey }) => {
      const result = validResult(caseItem, `request-${cellKey}`);
      result.output.elements[0] = {
        confidence: 0.8,
        contradictions: [],
        elementKey: result.output.elements[0]?.elementKey ?? '',
        evidenceQuotes: [],
        status: 'AMBIGUOUS',
      };
      return Promise.resolve(result);
    });

    const result = await runEvidenceResearcherPanel({
      ...input,
      completionUsdPerToken: 0.00000375,
      onRawReceived: vi.fn(),
      promptUsdPerToken: 0.00000075,
      provider: { execute },
      stopOnOracleDisagreement: true,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.state.completedCellKeys).toHaveLength(1);
    expect(result.state.attempts[0]?.oracleAgreement).toBe(false);
    expect(result.state.stoppedReason).toBe('ORACLE_DISAGREEMENT');
  });

  it('retries only a reconciled allowlisted transport error', async () => {
    const input = await fixture();
    let calls = 0;
    const execute = vi.fn(({ caseItem, cellKey }) => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve({
          errorCode: 'PROVIDER_HTTP_503',
          latencyMs: 5,
          modelSnapshot: 'google/gemini-3.6-flash',
          observedProvider: 'Google',
          providerRequestId: 'request-error',
          providerRoute: 'Google',
          rawModelOutput: '{}',
          requestedRoute: 'google-vertex/global',
          status: 'ERROR' as const,
          usage: {
            actualCostUsd: 0.0001,
            costSource: 'ACTUAL' as const,
            inputTokens: 0,
            reasoningTokens: 0,
            visibleOutputTokens: 0,
          },
        });
      }
      return Promise.resolve(
        validResult(caseItem, `request-${cellKey}-${calls}`),
      );
    });
    const result = await runEvidenceResearcherPanel({
      ...input,
      completionUsdPerToken: 0.00000375,
      onRawReceived: vi.fn(),
      promptUsdPerToken: 0.00000075,
      provider: { execute },
    });
    expect(result.state.completedCellKeys).toHaveLength(20);
    expect(result.state.attempts).toHaveLength(21);
    expect(result.state.attempts[0]?.retryReason).toBe('PROVIDER_HTTP_503');
  });

  it('stops without retry when cost reconciliation is missing', async () => {
    const input = await fixture();
    const result = await runEvidenceResearcherPanel({
      ...input,
      completionUsdPerToken: 0.00000375,
      onRawReceived: vi.fn(),
      promptUsdPerToken: 0.00000075,
      provider: {
        execute: vi.fn(() =>
          Promise.resolve({
            errorCode: 'PROVIDER_HTTP_503',
            latencyMs: 5,
            rawModelOutput: '{}',
            status: 'ERROR' as const,
          }),
        ),
      },
    });
    expect(result.state.attempts).toHaveLength(1);
    expect(result.state.stoppedReason).toBe('COST_RECONCILIATION_REQUIRED');
  });

  it('preserves a provider output error when no raw output exists', async () => {
    const input = await fixture();
    const onRawReceived = vi.fn();
    const result = await runEvidenceResearcherPanel({
      ...input,
      completionUsdPerToken: 0.00000375,
      onRawReceived,
      promptUsdPerToken: 0.00000075,
      provider: {
        execute: vi.fn(() =>
          Promise.resolve({
            errorCode: 'MODEL_OUTPUT_TRUNCATED',
            latencyMs: 1_392,
            modelSnapshot: 'google/gemini-3.6-flash',
            observedProvider: 'Google',
            providerRequestId: 'request-truncated',
            providerRoute: 'Google',
            requestedRoute: 'google-vertex/global',
            status: 'INVALID' as const,
            usage: {
              actualCostUsd: 0.032642,
              costSource: 'ACTUAL' as const,
              inputTokens: 3_821,
              reasoningTokens: 2_500,
              visibleOutputTokens: 0,
            },
          }),
        ),
      },
    });

    expect(onRawReceived).not.toHaveBeenCalled();
    expect(result.state.attempts).toHaveLength(1);
    expect(result.state.attempts[0]).toMatchObject({
      errorCode: 'MODEL_OUTPUT_TRUNCATED',
      providerRequestId: 'request-truncated',
      status: 'INVALID',
    });
    expect(result.state.stoppedReason).toBe('MODEL_OUTPUT_TRUNCATED');
  });
});
