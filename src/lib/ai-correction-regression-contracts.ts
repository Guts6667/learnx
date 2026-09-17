/** Shared data and verifier port contracts; no runner or metric implementation dependencies. */
import type { CriterionConfidence } from './ai-correction-confidence.js';
import type { EvidenceGuardViolation } from './ai-correction-evidence-guards.js';
import type {
  RegressionMutantExpectation,
  RegressionMutantKind,
} from './ai-correction-regression-mutants.js';

/** The independent verifier's answer, as recorded on an observation. */
export type RegressionCheckerVerdict = 'AGREED' | 'DISAGREED' | 'UNAVAILABLE';

/** One criterion as the run delivered it. */
export type RegressionCriterionObservation = {
  checkerVerdict: RegressionCheckerVerdict;
  evidenceQuotes?: string[];
  confidence: CriterionConfidence;
  criterionKey: string;
  /**
   * The criterion was delivered, but its evidence was refused (V4.5-177).
   *
   * `levelKey` still carries the level the model pronounced, because dropping
   * it would put our judgement where the model's belongs. Metrics that ask
   * "was the model right" must not read it as a graded answer.
   */
  evidenceWithdrawn?: boolean;
  levelKey: string;
};

/**
 * One delivered correction: a baseline (unmutated) case or a mutant, at one
 * repetition.
 */
export type RegressionObservation = {
  caseId: string;
  criteria: RegressionCriterionObservation[];
  /**
   * D0 violations found before any verifier ran (V4.5-210).
   *
   * Two failure modes need no model to catch and no verifier can catch: a
   * criterion the output never returned, and a top level whose quotes do not
   * occur in the response. They are counted here so the gate can read them,
   * and stay outside the verifier's own denominator.
   */
  evidenceGuardViolations?: EvidenceGuardViolation[];
  /** Set when the observation is of a mutant rather than the baseline. */
  expectation?: RegressionMutantExpectation;
  kind?: RegressionMutantKind;
  mutantId?: string;
  /** The output quoted text it was told never to quote (injection canary). */
  quotedForbiddenSegment?: boolean;
  repetition: number;
};

/** The ordering a criterion's levels have in its contract, lowest first. */
type RegressionCriterionScale = {
  criterionKey: string;
  /** Level keys ordered by ascending score. */
  orderedLevelKeys: string[];
};

/** Everything the metrics need about one pooled case. */
export type RegressionCaseScale = {
  caseId: string;
  criteria: RegressionCriterionScale[];
  /** The MODEL_AUTHORED gold, for the reported agreement metric. */
  expectedCriteria: { criterionKey: string; levelKey: string }[];
};

/** A rate with the counts it was computed from. */
export type RegressionRate = {
  denominator: number;
  numerator: number;
  /** null when the denominator is zero: not measured, not perfect. */
  rate: number | null;
};

/**
 * The independent verifier, as the suite needs it.
 *
 * Shared independently of runner and metric implementations so the suite has
 * no dependency on a module that dispatches paid calls: offline tests inject a
 * stub, and V4.5-121 injects the promoted checker.
 */
export interface RegressionCheckerPort {
  verify(input: {
    /**
     * Everything the closed question needs: the rubric wording as well as the
     * level chosen. Sending only keys would force the adapter to re-derive the
     * rubric, which is how a verifier ends up asked about a level description
     * that is not the one the correction was graded against.
     */
    criteria: {
      criterionKey: string;
      criterionLabel: string;
      levelDescription: string;
      levelKey: string;
      levelLabel: string;
      quotes: string[];
    }[];
    unitId: string;
  }): Promise<{
    /**
     * What the provider actually charged, when it says so. The checker spends
     * real money and must therefore reconcile against the run's budget guard
     * like any other call; `null` means the provider returned no cost, which
     * the caller treats as a reason to stop rather than as zero.
     */
    costUsd: number | null;
    verdicts: Record<string, RegressionCheckerVerdict>;
  }>;
}
