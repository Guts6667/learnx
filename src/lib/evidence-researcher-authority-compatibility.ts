import { createHash } from 'node:crypto';

import { EVIDENCE_RESEARCHER_FROZEN_PROTOCOL_FINGERPRINTS } from './evidence-researcher-protocol.js';

export const EVIDENCE_RESEARCHER_SPEC_AUTHORITY_TRANSITIONS = Object.freeze([
  Object.freeze({
    frozenProtocolFingerprints: Object.freeze([
      EVIDENCE_RESEARCHER_FROZEN_PROTOCOL_FINGERPRINTS['1.1.0'],
      EVIDENCE_RESEARCHER_FROZEN_PROTOCOL_FINGERPRINTS['1.3.0'],
    ]),
    frozenSpecSha256:
      '2c5d8aa1dde3e83a3562bb86da19ab4b75024a890cb46ce88ee40e22cc51ffa7',
    status: 'SUPERSEDED_HISTORICAL' as const,
    supersedingSpecSha256:
      '5bac1fa5980a60a315537f6bd9c44555c5ed2cb8b2ccd25c8e7b4d71fe509175',
    supersedingSemanticProtocol: 'EVIDENCE_ASSIST_3_0' as const,
  }),
]);

export type EvidenceResearcherSpecAuthorityCompatibility =
  'EXACT_AUTHORITY' | 'MISMATCH' | 'SUPERSEDED_HISTORICAL_AUTHORITY';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function classifyEvidenceResearcherSpecAuthority(input: {
  declaredPromptFingerprint: string;
  declaredSpecSha256: string;
  suppliedSpecText: string;
}): EvidenceResearcherSpecAuthorityCompatibility {
  const suppliedSpecSha256 = sha256(input.suppliedSpecText);
  if (input.declaredSpecSha256 === suppliedSpecSha256) {
    return 'EXACT_AUTHORITY';
  }
  const transition = EVIDENCE_RESEARCHER_SPEC_AUTHORITY_TRANSITIONS.find(
    (candidate) =>
      candidate.frozenSpecSha256 === input.declaredSpecSha256 &&
      candidate.supersedingSpecSha256 === suppliedSpecSha256 &&
      candidate.frozenProtocolFingerprints.some(
        (fingerprint) => fingerprint === input.declaredPromptFingerprint,
      ),
  );
  return transition ? 'SUPERSEDED_HISTORICAL_AUTHORITY' : 'MISMATCH';
}
