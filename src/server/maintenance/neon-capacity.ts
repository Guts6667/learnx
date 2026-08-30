/**
 * Decides whether an Integration run may create its Neon branch (V4.5-201).
 *
 * The constraint that matters is "no more than N branches in this Neon
 * project", never "one CI run at a time". Those are not the same thing, and
 * the difference caused an outage of the pipeline's own visibility.
 *
 * `integration.yml` used to express the constraint as a global GitHub
 * concurrency group with `cancel-in-progress: false`, on the belief that this
 * queues runs. It does not: GitHub keeps **one** pending run per group, so each
 * newly queued run cancels the one already waiting. Seven of ten Integration
 * runs on 30 August 2026 ended `cancelled`, including the runs for two merges
 * into `dev`. Nothing was red, because Integration is not a required check on
 * `dev` — so the pipeline silently stopped testing while every report stayed
 * green.
 *
 * Waiting therefore has to happen inside a job that is already running, where
 * it is visible in the log and cannot be cancelled by the next arrival. That is
 * what this decides, once per poll:
 *
 * - room to spare → PROCEED;
 * - full, but old `ci-*` branches are lying around → SWEEP them and look again;
 * - full, nothing sweepable → WAIT for a run in flight to release its branch.
 *
 * The sweep here is deliberate duplication of `neon-cleanup.yml`. That workflow
 * is scheduled, and a scheduled workflow only registers from the repository's
 * default branch, so it has never run once — it lives on `dev` and `main` has
 * never seen it. A guard that depends on a workflow nobody has registered is
 * not a guard; this one runs where the need actually appears.
 */

export interface NeonBranch {
  createdAt: string;
  id: string;
  name: string;
}

export type CapacityPlan =
  | { kind: 'PROCEED'; used: number }
  | { kind: 'SWEEP'; ids: string[] }
  | { kind: 'WAIT'; used: number };

/** Exactly the shape `integration.yml` gives its branches, and nothing else. */
const CI_BRANCH = /^ci-\d+-\d+$/u;

export function planNeonCapacity(input: {
  branches: readonly NeonBranch[];
  /** Maximum branches the plan allows. Free is 10. */
  ceiling: number;
  /** A `ci-*` branch older than this cannot still be in use. */
  maxAgeMinutes: number;
  now: Date;
}): CapacityPlan {
  const used = input.branches.length;

  // One slot is all a run needs, so strictly-less-than is the right test.
  if (used < input.ceiling) return { kind: 'PROCEED', used };

  const cutoff = input.now.getTime() - input.maxAgeMinutes * 60_000;
  const stale = input.branches.filter((branch) => {
    if (!CI_BRANCH.test(branch.name)) return false;
    const created = Date.parse(branch.createdAt);
    // An unparseable date is not evidence of age. Leave it alone.
    return Number.isFinite(created) && created < cutoff;
  });

  if (stale.length > 0) return { kind: 'SWEEP', ids: stale.map((b) => b.id) };

  return { kind: 'WAIT', used };
}
