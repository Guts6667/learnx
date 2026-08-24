import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  classifyEvidenceResearcherSpecAuthority,
  EVIDENCE_RESEARCHER_SPEC_AUTHORITY_TRANSITIONS,
} from './evidence-researcher-authority-compatibility.ts';

const currentSpecText = readFileSync(
  resolve(process.cwd(), 'docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
  'utf8',
);
const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
const transition = EVIDENCE_RESEARCHER_SPEC_AUTHORITY_TRANSITIONS[0];

if (!transition) throw new Error('TEST_AUTHORITY_TRANSITION_MISSING');

describe('evidence researcher authority compatibility', () => {
  it('classifies the frozen researcher proof against the exact superseding spec', () => {
    expect(sha256(currentSpecText)).toBe(transition.supersedingSpecSha256);
    expect(
      classifyEvidenceResearcherSpecAuthority({
        declaredPromptFingerprint:
          transition.frozenProtocolFingerprints[1] ?? '',
        declaredSpecSha256: transition.frozenSpecSha256,
        suppliedSpecText: currentSpecText,
      }),
    ).toBe('SUPERSEDED_HISTORICAL_AUTHORITY');
    expect(
      classifyEvidenceResearcherSpecAuthority({
        declaredPromptFingerprint:
          transition.frozenProtocolFingerprints[0] ?? '',
        declaredSpecSha256: transition.frozenSpecSha256,
        suppliedSpecText: currentSpecText,
      }),
    ).toBe('SUPERSEDED_HISTORICAL_AUTHORITY');
  });

  it('keeps exact authority validation available for newly frozen inputs', () => {
    expect(
      classifyEvidenceResearcherSpecAuthority({
        declaredPromptFingerprint: 'f'.repeat(64),
        declaredSpecSha256: sha256(currentSpecText),
        suppliedSpecText: currentSpecText,
      }),
    ).toBe('EXACT_AUTHORITY');
  });

  it('fails closed for document drift or an undeclared protocol identity', () => {
    expect(
      classifyEvidenceResearcherSpecAuthority({
        declaredPromptFingerprint:
          transition.frozenProtocolFingerprints[1] ?? '',
        declaredSpecSha256: transition.frozenSpecSha256,
        suppliedSpecText: `${currentSpecText}\n`,
      }),
    ).toBe('MISMATCH');
    expect(
      classifyEvidenceResearcherSpecAuthority({
        declaredPromptFingerprint: 'f'.repeat(64),
        declaredSpecSha256: transition.frozenSpecSha256,
        suppliedSpecText: currentSpecText,
      }),
    ).toBe('MISMATCH');
  });
});
