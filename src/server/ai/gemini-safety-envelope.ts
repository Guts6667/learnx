import type { CorrectionBenchmarkCorpus } from '../../lib/ai-correction-benchmark.js';
import { validateBenchmarkProtocol3ModelOutputWithEvidence } from '../../lib/ai-correction-benchmark.js';
import type { CorrectionContract } from '../../lib/ai-correction-contracts.js';

export const GEMINI_SAFETY_ENVELOPE_VERSION = '1.0.0';

const UNTRUSTED_INSTRUCTION_PATTERNS = [
  /(?:ignore|oublie|remplace|révèle|revele)\b.{0,80}\b(?:instruction|prompt|grille|critère|system)/iu,
  /(?:attribue|donne)\b.{0,40}\b(?:100\s*%|tout est maîtrisé|mastered)/iu,
] as const;

export function normalizeBoundedSafetyText(value: string, maximum: number): string {
  if (value.length > maximum) throw new Error('SAFETY_INPUT_LIMIT_EXCEEDED');
  return value
    .normalize('NFC')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\u00a0', ' ')
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"');
}

export interface DeterministicSafetyInput {
  canary: string;
  responseText: string;
  taskContext: string;
  taskPrompt: string;
}

export interface DeterministicSafetyEnvelope {
  canary: string;
  envelopeVersion: typeof GEMINI_SAFETY_ENVELOPE_VERSION;
  riskSignals: readonly string[];
  segments: {
    responseText: string;
    taskContext: string;
    taskPrompt: string;
  };
}

export function createDeterministicSafetyEnvelope(
  input: DeterministicSafetyInput,
): DeterministicSafetyEnvelope {
  const responseText = normalizeBoundedSafetyText(input.responseText, 30_000);
  const taskContext = normalizeBoundedSafetyText(input.taskContext, 20_000);
  const taskPrompt = normalizeBoundedSafetyText(input.taskPrompt, 20_000);
  const riskSignals = UNTRUSTED_INSTRUCTION_PATTERNS.some((pattern) =>
    pattern.test(responseText),
  )
    ? ['UNTRUSTED_INSTRUCTION_SIGNAL']
    : [];
  return {
    canary: normalizeBoundedSafetyText(input.canary, 256),
    envelopeVersion: GEMINI_SAFETY_ENVELOPE_VERSION,
    riskSignals,
    segments: { responseText, taskContext, taskPrompt },
  };
}

export function validateDeterministicSafetyOutput(input: {
  benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
  canary: string;
  contract: CorrectionContract;
  output: unknown;
}) {
  const text = collectStrings(input.output)
    .join('\n')
    .normalize('NFC')
    .toLocaleLowerCase();
  if (text.includes(input.canary.normalize('NFC').toLocaleLowerCase())) {
    throw new Error('MODEL_CANARY_LEAK');
  }
  return validateBenchmarkProtocol3ModelOutputWithEvidence(input);
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}
