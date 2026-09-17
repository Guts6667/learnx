/** Frozen designed-checker evidence. Aggregates are recomputed, never trusted. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  parseFalseAgreeProbe,
  type FalseAgreeProbe,
  type FalseAgreeProbeResult,
} from './ai-correction-false-agree-probe.js';

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const designedCheckerIdentitySchema = z
  .object({
    modelId: z.string().min(1),
    routeProviders: z.array(z.string().min(1)).min(1),
    promptSha256: sha256,
    requestProfileSha256: sha256,
  })
  .strict();
export type DesignedCheckerIdentity = z.infer<
  typeof designedCheckerIdentitySchema
>;
export function qualificationSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function designedCheckerIdentity<
  T extends { routeProviders: readonly string[] },
>(input: {
  modelId: string;
  instructions: readonly string[];
  requestProfile: T;
}): DesignedCheckerIdentity {
  return {
    modelId: input.modelId,
    routeProviders: [...input.requestProfile.routeProviders],
    promptSha256: qualificationSha256(JSON.stringify(input.instructions)),
    requestProfileSha256: qualificationSha256(
      JSON.stringify(input.requestProfile),
    ),
  };
}
const outcomeSchema = z
  .object({
    id: z.string().min(1),
    verdict: z.enum(['AGREED', 'DISAGREED', 'UNAVAILABLE']),
    costUsd: z.number().finite().nonnegative().nullable(),
  })
  .strict();
const evidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    measurementKind: z.enum(['LIVE', 'SYNTHETIC']),
    simulatesValidatedFamily: z.boolean(),
    qualificationRunId: z.string().min(1),
    createdAt: z.string().datetime(),
    checker: designedCheckerIdentitySchema,
    probeId: z.string().min(1),
    probeSha256: sha256,
    outcomes: z.array(outcomeSchema),
  })
  .strict();
export type DesignedProbeEvidence = z.infer<typeof evidenceSchema>;
export type DesignedProbeBinding = {
  checker: DesignedCheckerIdentity;
  qualificationRunId: string;
  measurementKind: DesignedProbeEvidence['measurementKind'];
  simulatesValidatedFamily: boolean;
};
export function validateDesignedProbeEvidence(input: {
  source: unknown;
  probe: FalseAgreeProbe;
  probeSha256: string;
  binding: DesignedProbeBinding;
}): { evidence: DesignedProbeEvidence; result: FalseAgreeProbeResult } {
  const evidence = evidenceSchema.parse(input.source);
  if (
    evidence.probeId !== input.probe.probeId ||
    evidence.probeSha256 !== input.probeSha256 ||
    evidence.qualificationRunId !== input.binding.qualificationRunId ||
    evidence.measurementKind !== input.binding.measurementKind ||
    evidence.simulatesValidatedFamily !==
      input.binding.simulatesValidatedFamily ||
    JSON.stringify(evidence.checker) !==
      JSON.stringify(designedCheckerIdentitySchema.parse(input.binding.checker))
  ) {
    throw new Error('DESIGNED_PROBE_IDENTITY_MISMATCH');
  }
  const ids = new Set(evidence.outcomes.map((outcome) => outcome.id));
  if (
    ids.size !== evidence.outcomes.length ||
    ids.size !== input.probe.cases.length ||
    input.probe.cases.some((probeCase) => !ids.has(probeCase.id))
  ) {
    throw new Error('DESIGNED_PROBE_CASE_COVERAGE_MISMATCH');
  }
  if (evidence.outcomes.some((outcome) => outcome.costUsd === null)) {
    throw new Error('DESIGNED_PROBE_UNRECONCILED_COST');
  }
  const falseAgreements = evidence.outcomes
    .filter((outcome) => outcome.verdict === 'AGREED')
    .map((outcome) => {
      const probeCase = input.probe.cases.find(
        (entry) => entry.id === outcome.id,
      );
      if (!probeCase) throw new Error('DESIGNED_PROBE_CASE_COVERAGE_MISMATCH');
      return {
        id: outcome.id,
        criterionKey: probeCase.criterionKey,
        falseBecause: probeCase.falseBecause,
      };
    });
  const unavailable = evidence.outcomes
    .filter((outcome) => outcome.verdict === 'UNAVAILABLE')
    .map((outcome) => outcome.id);
  const denominator = evidence.outcomes.length - unavailable.length;
  return {
    evidence,
    result: {
      checkerFalseAgreeDesigned: {
        denominator,
        numerator: falseAgreements.length,
        rate: denominator ? falseAgreements.length / denominator : null,
      },
      costUsd: evidence.outcomes.reduce(
        (sum, outcome) => sum + (outcome.costUsd ?? 0),
        0,
      ),
      falseAgreements,
      unavailable,
      unpricedCalls: [],
    },
  };
}
export async function readDesignedProbeEvidence(input: {
  evidencePath: string;
  probePath: string;
  binding: DesignedProbeBinding;
}): Promise<{
  evidence: DesignedProbeEvidence;
  result: FalseAgreeProbeResult;
}> {
  const [probeText, evidenceText] = await Promise.all([
    readFile(input.probePath, 'utf8'),
    readFile(input.evidencePath, 'utf8'),
  ]);
  return validateDesignedProbeEvidence({
    source: JSON.parse(evidenceText) as unknown,
    probe: parseFalseAgreeProbe(JSON.parse(probeText) as unknown),
    probeSha256: qualificationSha256(probeText),
    binding: input.binding,
  });
}
