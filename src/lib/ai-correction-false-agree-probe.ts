/**
 * The designed false-agreement probe (V4.5, policy v5).
 *
 * `checker-false-agree-rate` counted only the occasions where a mutant made the
 * corrector fail, so its denominator was built by failures rather than by
 * design: it stood at 1 on 30 August, and 7 after the mutation coverage rose.
 * A denominator you cannot construct cannot carry a threshold, so policy v5
 * retired it to REPORTED and declared `checker-false-agree-designed` in its
 * place.
 *
 * This module builds that denominator. Each case is a fabricated correction
 * whose level is false given its own quotes — arithmetic that contradicts its
 * operands, a claim absent from the text, a quote asserting the opposite, or a
 * scope narrower than the level asserts. No primary call is made and no
 * learner response is graded: the probe asks the verifier one question it must
 * answer no to, twenty times.
 *
 * Every agreement is a false agreement. That is the whole measurement.
 */

import { z } from 'zod';

import type { RegressionCheckerPort } from './ai-correction-regression-run.js';

const probeCaseSchema = z
  .object({
    criterionKey: z.string().trim().min(1),
    criterionLabel: z.string().trim().min(1),
    /** Why a reader can call the level false from the quotes alone. */
    falseBecause: z.string().trim().min(1),
    id: z.string().trim().min(1),
    levelDescription: z.string().trim().min(1),
    levelKey: z.string().trim().min(1),
    levelLabel: z.string().trim().min(1),
    quotes: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

const probeSchema = z
  .object({
    cases: z.array(probeCaseSchema).min(1),
    expectedVerdict: z.literal('DISAGREED'),
    language: z.string().trim().min(1),
    note: z.string().trim().min(1),
    probeId: z.string().trim().min(1),
    schemaVersion: z.literal(1),
  })
  .strict()
  .superRefine((probe, context) => {
    const seen = new Set<string>();
    for (const probeCase of probe.cases) {
      if (seen.has(probeCase.id)) {
        context.addIssue({
          code: 'custom',
          message: `identifiant de cas dupliqué : ${probeCase.id}`,
        });
      }
      seen.add(probeCase.id);
    }
  });

export type FalseAgreeProbe = z.infer<typeof probeSchema>;

export function parseFalseAgreeProbe(source: unknown): FalseAgreeProbe {
  return probeSchema.parse(source);
}

export type FalseAgreeProbeResult = {
  /** Cases the verifier agreed with, named so a reader can look at each. */
  falseAgreements: { criterionKey: string; falseBecause: string; id: string }[];
  /** Verifier calls that reported no cost; reported, never fatal. */
  unpricedCalls: string[];
  checkerFalseAgreeDesigned: {
    denominator: number;
    numerator: number;
    rate: number | null;
  };
  costUsd: number;
  /** Cases the verifier could not answer at all, excluded from the rate. */
  unavailable: string[];
};

/**
 * Puts every case to the verifier and counts the ones it accepted.
 *
 * A verdict the port cannot produce is excluded rather than counted as a
 * rejection: a verifier that is down must not read as a verifier that says no.
 */
export async function runFalseAgreeProbe(input: {
  checker: RegressionCheckerPort;
  probe: FalseAgreeProbe;
}): Promise<FalseAgreeProbeResult> {
  const falseAgreements: FalseAgreeProbeResult['falseAgreements'] = [];
  const unavailable: string[] = [];
  const unpricedCalls: string[] = [];
  let costUsd = 0;
  let answered = 0;

  for (const probeCase of input.probe.cases) {
    const outcome = await input.checker.verify({
      criteria: [
        {
          criterionKey: probeCase.criterionKey,
          criterionLabel: probeCase.criterionLabel,
          levelDescription: probeCase.levelDescription,
          levelKey: probeCase.levelKey,
          levelLabel: probeCase.levelLabel,
          quotes: probeCase.quotes,
        },
      ],
      unitId: probeCase.id,
    });

    if (outcome.costUsd === null || outcome.costUsd === undefined) {
      unpricedCalls.push(probeCase.id);
    } else {
      costUsd += outcome.costUsd;
    }

    const verdict = outcome.verdicts[probeCase.criterionKey];
    if (verdict === undefined || verdict === 'UNAVAILABLE') {
      unavailable.push(probeCase.id);
      continue;
    }
    answered += 1;
    if (verdict === 'AGREED') {
      falseAgreements.push({
        criterionKey: probeCase.criterionKey,
        falseBecause: probeCase.falseBecause,
        id: probeCase.id,
      });
    }
  }

  return {
    checkerFalseAgreeDesigned: {
      denominator: answered,
      numerator: falseAgreements.length,
      rate: answered === 0 ? null : falseAgreements.length / answered,
    },
    costUsd,
    falseAgreements,
    unavailable,
    unpricedCalls,
  };
}
