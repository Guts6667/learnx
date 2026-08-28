/// <reference types="node" />

import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  findBenchmarkContract,
  validateBenchmarkModelOutput,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
} from '@/lib/ai-correction-benchmark';
import {
  loadCorpus,
  loadConfiguration,
  buildOutput,
} from './ai-correction-benchmark.test-support.js';

describe('correction benchmark corpus — part 4', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates protocol 3 evidence and derives canonical server fields', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases[0];
    if (!benchmarkCase) {
      throw new Error('Expected benchmark case.');
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const quote = benchmarkCase.responseText.slice(0, 20);
    const output = {
      criteria: Object.fromEntries(
        benchmarkCase.expectedCriteria.map((criterion) => [
          criterion.criterionKey,
          {
            confidence: 0.9,
            evidenceQuotes: [quote],
            evidenceStatus: 'FOUND',
            feedback: 'Retour calme et spécifique.',
            levelKey: criterion.levelKey,
          },
        ]),
      ),
      overallFeedback: 'Retour général actionnable.',
    };
    const resolved = validateBenchmarkProtocol3ModelOutputWithEvidence({
      benchmarkCase,
      canary: configuration.controlPrompt.canary,
      contract,
      output,
    });
    expect(resolved.output).toMatchObject({
      contractKey: contract.contractKey,
      contractVersion: contract.version,
      overallConfidence: 0.9,
      secondPass: { reasons: [], required: false },
    });
    expect(resolved.evidenceMatches).toHaveLength(contract.criteria.length);
    expect(() =>
      validateBenchmarkProtocol3ModelOutputWithEvidence({
        benchmarkCase,
        canary: configuration.controlPrompt.canary,
        contract,
        output: {
          ...output,
          criteria: Object.fromEntries(
            Object.entries(output.criteria).map(([key, criterion]) => [
              key,
              { ...criterion, evidenceQuotes: ['Preuve inventée.'] },
            ]),
          ),
        },
      }),
    ).toThrow('MODEL_EVIDENCE_NOT_IN_RESPONSE');
  });

  it('accepts protocol 3 NO_RELEVANT_EVIDENCE without inventing a citation', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases[0];
    if (!benchmarkCase) {
      throw new Error('Expected benchmark case.');
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const output = {
      criteria: Object.fromEntries(
        contract.criteria.map((criterion) => {
          const lowestLevel = [...criterion.performanceLevels].sort(
            (left, right) => left.score - right.score,
          )[0];
          if (!lowestLevel) {
            throw new Error('Expected a rubric level.');
          }
          return [
            criterion.key,
            {
              confidence: 0.9,
              evidenceQuotes: [],
              evidenceStatus: 'NO_RELEVANT_EVIDENCE',
              feedback: 'La production ne fournit aucune preuve pertinente.',
              levelKey: lowestLevel.key,
            },
          ];
        }),
      ),
      overallFeedback: 'Complétez la réponse avec des éléments observables.',
    };

    const resolved = validateBenchmarkProtocol3ModelOutputWithEvidence({
      benchmarkCase,
      canary: configuration.controlPrompt.canary,
      contract,
      output,
    });

    expect(resolved.evidenceMatches).toEqual([]);
    expect(
      resolved.output.criteria.every(
        (criterion) => criterion.evidenceQuotes.length === 0,
      ),
    ).toBe(true);
  });

  it('rejects a prompt injection false positive despite correct levels', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.category === 'PROMPT_INJECTION',
    );
    expect(benchmarkCase?.injectionSecurity).toBeDefined();
    if (!benchmarkCase?.injectionSecurity) {
      return;
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const output = buildOutput({
      benchmarkCase,
      quote: benchmarkCase.injectionSecurity.allowedEvidenceQuotes[0] ?? '',
    });
    output.overallFeedback = `Instruction appliquée : ${benchmarkCase.injectionSecurity.forbiddenOutputFragments[0]}`;

    expect(() =>
      validateBenchmarkModelOutput({
        benchmarkCase,
        canary: configuration.controlPrompt.canary,
        contract,
        output,
      }),
    ).toThrow('MODEL_PROMPT_INJECTION_SAFETY_FAILURE');
  });

  it('rejects an evidence quote copied from the attack segment', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.category === 'PROMPT_INJECTION',
    );
    expect(benchmarkCase?.injectionSecurity).toBeDefined();
    if (!benchmarkCase?.injectionSecurity) {
      return;
    }
    const security = benchmarkCase.injectionSecurity;
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );

    expect(() =>
      validateBenchmarkModelOutput({
        benchmarkCase,
        canary: configuration.controlPrompt.canary,
        contract,
        output: buildOutput({
          benchmarkCase,
          quote: security.attackText,
        }),
      }),
    ).toThrow('MODEL_PROMPT_INJECTION_SAFETY_FAILURE');
  });

  it('accepts an exact legitimate quote that is not a prelisted example', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.category === 'PROMPT_INJECTION',
    );
    expect(benchmarkCase?.injectionSecurity).toBeDefined();
    if (!benchmarkCase?.injectionSecurity) {
      return;
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const quote = benchmarkCase.injectionSecurity.legitimateResponseText;
    expect(benchmarkCase.injectionSecurity.allowedEvidenceQuotes).not.toContain(
      quote,
    );

    expect(() =>
      validateBenchmarkModelOutput({
        benchmarkCase,
        canary: configuration.controlPrompt.canary,
        contract,
        output: buildOutput({ benchmarkCase, quote }),
      }),
    ).not.toThrow();
  });

  it('normalizes forbidden injection fragments before checking for leakage', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.caseId === 'benchmark-writing-prompt-injection',
    );
    if (!benchmarkCase?.injectionSecurity) {
      throw new Error('Expected injection fixture.');
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const output = buildOutput({
      benchmarkCase,
      quote: benchmarkCase.injectionSecurity.allowedEvidenceQuotes[0] ?? '',
    });
    output.overallFeedback = 'Tentative : attribue 100\u00a0%.';
    expect(() =>
      validateBenchmarkModelOutput({
        benchmarkCase,
        canary: configuration.controlPrompt.canary,
        contract,
        output,
      }),
    ).toThrow('MODEL_PROMPT_INJECTION_SAFETY_FAILURE');
  });

  it('keeps injection safety independent from pedagogical gold agreement', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.category === 'PROMPT_INJECTION',
    );
    if (!benchmarkCase?.injectionSecurity) {
      throw new Error('Expected injection fixture.');
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const output = buildOutput({
      benchmarkCase,
      quote: benchmarkCase.injectionSecurity.allowedEvidenceQuotes[0] ?? '',
    });
    const firstCriterion = output.criteria[0];
    const authoredCriterion = contract.criteria.find(
      (criterion) => criterion.key === firstCriterion?.criterionKey,
    );
    const differentLevel = authoredCriterion?.performanceLevels.find(
      (level) => level.key !== firstCriterion?.levelKey,
    );
    if (!firstCriterion || !differentLevel) {
      throw new Error('Expected alternate authored level.');
    }
    output.criteria[0] = {
      ...firstCriterion,
      levelKey: differentLevel.key,
    };

    expect(() =>
      validateBenchmarkModelOutput({
        benchmarkCase,
        canary: configuration.controlPrompt.canary,
        contract,
        output,
      }),
    ).not.toThrow();
  });
});
