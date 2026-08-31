/**
 * Run lock and spend envelope for the regression suite (V4.5-123).
 *
 * Both exist because of what happened on 29 August 2026: a launch command was
 * pasted twice, two runs started two seconds apart, and each honoured its own
 * 12.60 USD cap — so the pair was authorised to spend 25.20 USD. A human kill
 * is what bounded it, not the machinery.
 *
 * The lesson is that the budget guard protects **a run**, and nobody was
 * protecting **the envelope**. Two mechanisms follow from that:
 *
 * - a **lock** on the regression directory, so a second run refuses to start
 *   while a first is alive. Pasting a command twice is an ordinary thing to do;
 *   the system should survive it rather than depend on someone noticing;
 * - an **envelope** measured against the provider's own usage rather than a
 *   per-process counter. A counter inside a process cannot see another process;
 *   the provider's total can. Spend is therefore `usage now − usage when the
 *   envelope was opened`, which stays true across crashes, duplicates and
 *   machines.
 */

import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export class RegressionEnvelopeError extends Error {}

const runLockSchema = z
  .object({
    pid: z.number().int().positive(),
    resultsDirectory: z.string().trim().min(1),
    schemaVersion: z.literal(1),
    startedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

type RunLock = z.infer<typeof runLockSchema>;

export const RUN_LOCK_FILE = '.run-lock.json';

/**
 * Whether a process is still alive.
 *
 * `kill(pid, 0)` signals nothing; it only asks whether the process exists. A
 * lock left behind by a killed run must not block the next one for ever, and a
 * lock held by a live run must not be stolen.
 */
export function processIsAlive(
  pid: number,
  probe: (pid: number) => void = (value) => process.kill(value, 0),
): boolean {
  try {
    probe(pid);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else: still alive.
    return (error as { code?: string }).code === 'EPERM';
  }
}

export type LockAcquisition =
  | { acquired: true; tookOverStaleLock: RunLock | null }
  | { acquired: false; heldBy: RunLock };

/**
 * Takes the run lock, or refuses because another run holds it.
 *
 * A stale lock — one whose process is gone — is taken over rather than treated
 * as fatal, and the fact is reported so the caller can record that a previous
 * run died without releasing it.
 */
export async function acquireRunLock(input: {
  directory: string;
  now?: () => Date;
  pid?: number;
  processIsAlive?: (pid: number) => boolean;
  resultsDirectory: string;
}): Promise<LockAcquisition> {
  const lockPath = path.join(input.directory, RUN_LOCK_FILE);
  const alive = input.processIsAlive ?? processIsAlive;
  let stale: RunLock | null = null;

  try {
    const existing = runLockSchema.parse(
      JSON.parse(await readFile(lockPath, 'utf8')) as unknown,
    );
    if (alive(existing.pid)) {
      return { acquired: false, heldBy: existing };
    }
    stale = existing;
  } catch (error) {
    if (
      (error as { code?: string }).code !== 'ENOENT' &&
      error instanceof z.ZodError
    ) {
      // An unreadable lock is treated as stale rather than as a reason to
      // refuse for ever, but the caller is told it was there.
      stale = null;
    }
  }

  const lock: RunLock = {
    pid: input.pid ?? process.pid,
    resultsDirectory: input.resultsDirectory,
    schemaVersion: 1,
    startedAt: (input.now?.() ?? new Date()).toISOString(),
  };
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return { acquired: true, tookOverStaleLock: stale };
}

/** Releases the lock, ignoring an already-removed file. */
export async function releaseRunLock(directory: string): Promise<void> {
  try {
    await unlink(path.join(directory, RUN_LOCK_FILE));
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error;
  }
}

const spendEnvelopeSchema = z
  .object({
    /** The owner decision that authorised this envelope. */
    decisionId: z.string().trim().min(1),
    envelopeUsd: z.number().positive(),
    openedAt: z.iso.datetime({ offset: true }),
    /** Provider lifetime usage when the envelope was opened. */
    openingProviderUsageUsd: z.number().nonnegative(),
    schemaVersion: z.literal(1),
    /**
     * The `decisionId` this envelope replaces, when it replaces one.
     *
     * `benchmarks/**` is append-only, so an envelope is never rewritten: a new
     * decision arrives as a new file naming the one it supersedes, and the old
     * file stays on disk as the record of what was authorised at the time. The
     * head of that chain is the envelope in force; a superseded one is readable
     * for ever and applied never.
     */
    supersedes: z.string().trim().min(1).optional(),
  })
  .strict();

export type SpendEnvelope = z.infer<typeof spendEnvelopeSchema>;

const SPEND_ENVELOPE_FILE = 'spend-envelope.v1.json';

/** Matches every envelope file, whatever its version suffix. */
const SPEND_ENVELOPE_PATTERN = /^spend-envelope\.v(\d+)\.json$/;

export type EnvelopeState = {
  envelopeUsd: number;
  /** Provider usage now, or null when it could not be read. */
  providerUsageUsd: number | null;
  remainingUsd: number | null;
  /** Which side of the reconciliation the figure came from. */
  spentSource: 'PROVIDER_DELTA' | 'LEDGER' | 'UNMEASURED';
  spentUsd: number | null;
};

/**
 * How much of the envelope is left, measured against the provider.
 *
 * Returns `null` figures when the provider's usage cannot be read: an envelope
 * that cannot be measured is not an envelope with room, and the caller must
 * refuse rather than assume.
 */
export function envelopeState(input: {
  envelope: SpendEnvelope;
  /**
   * Spend this machine recorded in its own ledgers since the envelope opened.
   *
   * Load-bearing, not a fallback. OpenRouter's `total_usage` was observed not
   * to move at all in the minutes after fifteen paid calls on 30 August 2026,
   * so a provider delta alone reports zero spend however much a run buys — an
   * envelope that always looks empty is worse than no envelope, because it
   * reassures. The two sources are combined by taking the larger: the provider
   * sees other machines, the ledger sees the present instant, and neither alone
   * sees both.
   */
  ledgerSpentUsd?: number;
  providerUsageUsd: number | null;
}): EnvelopeState {
  const ledger = Math.max(0, input.ledgerSpentUsd ?? 0);
  if (input.providerUsageUsd === null) {
    // The local ledger cannot see another machine, so it is a floor and never a
    // measurement. Authorising against a floor would defeat the point of an
    // envelope, which exists precisely for the spend this process cannot see.
    // Unmeasurable therefore still authorises nothing.
    return {
      envelopeUsd: input.envelope.envelopeUsd,
      providerUsageUsd: null,
      remainingUsd: null,
      spentSource: 'UNMEASURED',
      spentUsd: null,
    };
  }
  const providerDelta = Math.max(
    0,
    input.providerUsageUsd - input.envelope.openingProviderUsageUsd,
  );
  const spentUsd = Math.max(providerDelta, ledger);
  return {
    envelopeUsd: input.envelope.envelopeUsd,
    providerUsageUsd: input.providerUsageUsd,
    remainingUsd: input.envelope.envelopeUsd - spentUsd,
    spentUsd,
    spentSource: providerDelta >= ledger ? 'PROVIDER_DELTA' : 'LEDGER',
  };
}

/**
 * Spend this machine has recorded since the envelope opened.
 *
 * Sums every results ledger written at or after the envelope's opening
 * instant. Directory names are ISO timestamps, so the comparison is a string
 * comparison on a sortable format rather than a parse.
 */
export async function ledgerSpendSince(input: {
  directory: string;
  openedAt: string;
  readDirectory?: (path: string) => Promise<string[]>;
  readLedger?: (path: string) => Promise<string>;
}): Promise<number> {
  const resultsRoot = path.join(input.directory, 'results');
  const list = input.readDirectory ?? ((target) => readdir(target));
  const read = input.readLedger ?? ((target) => readFile(target, 'utf8'));

  let entries: string[];
  try {
    entries = await list(resultsRoot);
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return 0;
    throw error;
  }

  const opened = input.openedAt.replace(/[:.]/g, '-');
  // One provider call is one charge, however many ledgers record it. A resumed
  // run writes the attempts it inherited into its own ledger, so summing files
  // charged the same money twice: on 30 August that read 8.4777 USD spent when
  // 4.6854 had been, and refused a 1.6778 USD top-up the envelope could afford.
  //
  // The key is the whole entry, and only for entries that name the call they
  // charge for. Two records agreeing on candidate, case, repetition, attempt,
  // cost, latency, route and error are one call recorded twice — across every
  // ledger this repository holds, no directory contains two identical entries,
  // so nothing distinct is merged away. The 24 cells whose attempts are both
  // numbered 1 stay separate on their differing cost and latency.
  const charged = new Set<string>();
  let total = 0;
  for (const entry of entries) {
    if (entry < opened) continue;
    let raw: string;
    try {
      raw = await read(path.join(resultsRoot, entry, 'ledger.jsonl'));
    } catch {
      continue;
    }
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as { costUsd?: unknown };
        if (
          typeof parsed.costUsd !== 'number' ||
          !Number.isFinite(parsed.costUsd)
        ) {
          continue;
        }
        const identity = ledgerEntryIdentity(parsed as Record<string, unknown>);
        // An entry that does not name the call it charges for cannot be shown
        // to be a duplicate, so it is counted. Undercounting a budget is the
        // dangerous direction; counting an unidentifiable line twice is not.
        if (identity !== null) {
          if (charged.has(identity)) continue;
          charged.add(identity);
        }
        total += parsed.costUsd;
      } catch {
        // A truncated final line in an interrupted run is not a reason to
        // abandon the whole sum.
      }
    }
  }
  return total;
}

/**
 * Identity of the provider call a ledger entry charges for, or null when the
 * entry does not name one.
 *
 * Built from the identifying fields rather than the whole record, so adding a
 * field to the ledger cannot make one charge look like two. That is not
 * hypothetical: writing the verifier's calls into the ledger added a `role` to
 * every line, and a whole-record key would have stopped matching the entries a
 * resumed run inherits — reinstating the double count it was written to stop.
 *
 * Cost and latency stay in the key. The 24 cells left by the repetition-offset
 * defect carry two attempts both numbered 1, and they are two real charges.
 */
function ledgerEntryIdentity(entry: Record<string, unknown>): string | null {
  const cost = entry.costUsd;
  if (typeof cost !== 'number') return null;
  const latency = typeof entry.latencyMs === 'number' ? entry.latencyMs : null;

  if (entry.role === 'CHECKER' || typeof entry.unitId === 'string') {
    if (typeof entry.unitId !== 'string') return null;
    const call = typeof entry.call === 'number' ? entry.call : null;
    return JSON.stringify(['CHECKER', entry.unitId, call, cost, latency]);
  }

  const named =
    typeof entry.candidateId === 'string' &&
    typeof entry.caseId === 'string' &&
    typeof entry.repetition === 'number' &&
    typeof entry.attempt === 'number';
  if (!named) return null;
  return JSON.stringify([
    'PRIMARY',
    entry.candidateId,
    entry.caseId,
    entry.repetition,
    entry.attempt,
    cost,
    latency,
  ]);
}

/** Reads the recorded envelope, if one has been opened. */
export async function readSpendEnvelope(
  directory: string,
): Promise<SpendEnvelope | undefined> {
  try {
    return spendEnvelopeSchema.parse(
      JSON.parse(
        await readFile(path.join(directory, SPEND_ENVELOPE_FILE), 'utf8'),
      ) as unknown,
    );
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Every envelope on disk, oldest file version first. */
export async function readSpendEnvelopeChain(
  directory: string,
): Promise<SpendEnvelope[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return [];
    throw error;
  }

  const numbered = names
    .map((name) => ({ match: SPEND_ENVELOPE_PATTERN.exec(name), name }))
    .flatMap((entry) =>
      entry.match
        ? [{ name: entry.name, version: Number(entry.match[1]) }]
        : [],
    )
    .sort((left, right) => left.version - right.version);

  const envelopes: SpendEnvelope[] = [];
  for (const entry of numbered) {
    envelopes.push(
      spendEnvelopeSchema.parse(
        JSON.parse(
          await readFile(path.join(directory, entry.name), 'utf8'),
        ) as unknown,
      ),
    );
  }
  return envelopes;
}

/**
 * The envelope in force: the head of the supersession chain.
 *
 * Not "the first file that exists". That was the bug: `spend-envelope.v1.json`
 * from a 30 August decision silently pre-empted a later one, so a fresh owner
 * decision governed nothing while appearing to. A control that quietly loses
 * its input is not a control.
 *
 * The head is the envelope no other envelope supersedes. Anything ambiguous —
 * two heads, a dangling reference, a cycle — refuses rather than picking, for
 * the same reason: choosing between two authorisations is not this function's
 * business.
 */
export function resolveEnvelopeHead(
  envelopes: SpendEnvelope[],
): SpendEnvelope | undefined {
  if (envelopes.length === 0) return undefined;

  const byDecision = new Map<string, SpendEnvelope>();
  for (const envelope of envelopes) {
    if (byDecision.has(envelope.decisionId)) {
      throw new RegressionEnvelopeError(
        `REGRESSION_ENVELOPE_DUPLICATE_DECISION: deux enveloppes portent la décision ${envelope.decisionId}.`,
      );
    }
    byDecision.set(envelope.decisionId, envelope);
  }

  const superseded = new Set<string>();
  for (const envelope of envelopes) {
    if (envelope.supersedes === undefined) continue;
    if (!byDecision.has(envelope.supersedes)) {
      throw new RegressionEnvelopeError(
        `REGRESSION_ENVELOPE_SUPERSEDES_UNKNOWN: ${envelope.decisionId} remplace ${envelope.supersedes}, qui n'est sur le disque nulle part.`,
      );
    }
    if (superseded.has(envelope.supersedes)) {
      throw new RegressionEnvelopeError(
        `REGRESSION_ENVELOPE_SUPERSEDES_FORKED: ${envelope.supersedes} est remplacée par deux enveloppes.`,
      );
    }
    superseded.add(envelope.supersedes);
  }

  const heads = envelopes.filter(
    (envelope) => !superseded.has(envelope.decisionId),
  );
  if (heads.length !== 1 || heads[0] === undefined) {
    throw new RegressionEnvelopeError(
      `REGRESSION_ENVELOPE_CHAIN_AMBIGUOUS: ${heads.length} enveloppes en tête (${heads
        .map((envelope) => envelope.decisionId)
        .sort()
        .join(
          ', ',
        )}) ; une chaîne de supersession doit en avoir exactement une.`,
    );
  }
  return heads[0];
}

/**
 * Reconciles what the command line declares against the envelope in force.
 *
 * Three outcomes and no fourth. The flags agree with the head, and the run
 * proceeds on it. The flags declare a genuinely new decision — new identifier,
 * its own amount, and `supersedes` naming the head — and a new envelope is
 * written. Or they disagree, and the run **refuses**, naming both sides.
 *
 * Refusing the disagreement is the whole point. Preferring either side silently
 * is how an owner's decision came to authorise nothing while looking like it
 * did, and picking the larger would be worse still: a typo would raise the
 * ceiling.
 */
export function reconcileEnvelopeDeclaration(input: {
  declared: {
    decisionId: string | undefined;
    envelopeUsd: number;
    supersedes: string | undefined;
  };
  head: SpendEnvelope | undefined;
}): { action: 'OPEN' | 'REUSE' | 'SUPERSEDE'; envelope?: SpendEnvelope } {
  const { declared, head } = input;

  if (!head) {
    if (declared.supersedes !== undefined) {
      throw new RegressionEnvelopeError(
        `REGRESSION_ENVELOPE_SUPERSEDES_UNKNOWN: la décision déclarée remplace ${declared.supersedes}, mais aucune enveloppe n'est ouverte.`,
      );
    }
    return { action: 'OPEN' };
  }

  const declaredId = declared.decisionId ?? 'undeclared';

  if (declaredId === head.decisionId) {
    if (declared.envelopeUsd !== head.envelopeUsd) {
      throw new RegressionEnvelopeError(
        `REGRESSION_ENVELOPE_AMOUNT_CONFLICT: la décision ${head.decisionId} vaut ${head.envelopeUsd} USD sur le disque et ${declared.envelopeUsd} USD sur la ligne de commande ; une même décision ne peut pas porter deux montants.`,
      );
    }
    return { action: 'REUSE', envelope: head };
  }

  if (declared.supersedes === head.decisionId) {
    return { action: 'SUPERSEDE' };
  }

  throw new RegressionEnvelopeError(
    `REGRESSION_ENVELOPE_DECISION_CONFLICT: l'enveloppe en vigueur est ${head.decisionId} (${head.envelopeUsd} USD) et la ligne de commande déclare ${declaredId} (${declared.envelopeUsd} USD). Pour la remplacer, déclarer --envelope-supersedes=${head.decisionId} ; sinon reprendre la décision en vigueur. Aucune des deux n'est choisie à votre place.`,
  );
}

/** The file name a new envelope takes, after the highest already on disk. */
export function nextSpendEnvelopeFile(existingNames: string[]): string {
  const highest = existingNames
    .map((name) => SPEND_ENVELOPE_PATTERN.exec(name))
    .flatMap((match) => (match ? [Number(match[1])] : []))
    .reduce((maximum, version) => Math.max(maximum, version), 0);
  return `spend-envelope.v${highest + 1}.json`;
}

/**
 * Writes a new envelope as a new file, never over an existing one.
 *
 * `benchmarks/**` is append-only, and an envelope is the record of what an
 * owner authorised: overwriting one would erase the authorisation it replaces.
 */
export async function appendSpendEnvelope(input: {
  directory: string;
  envelope: SpendEnvelope;
}): Promise<string> {
  let names: string[];
  try {
    names = await readdir(input.directory);
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error;
    names = [];
  }
  const fileName = nextSpendEnvelopeFile(names);
  await writeFile(
    path.join(input.directory, fileName),
    `${JSON.stringify(input.envelope, null, 2)}\n`,
    'utf8',
  );
  return fileName;
}

/** Opens an envelope against the provider's usage at this instant. */
export async function writeSpendEnvelope(input: {
  directory: string;
  envelope: SpendEnvelope;
}): Promise<void> {
  await writeFile(
    path.join(input.directory, SPEND_ENVELOPE_FILE),
    `${JSON.stringify(input.envelope, null, 2)}\n`,
    'utf8',
  );
}

/**
 * The cap a run may use: never more than the envelope has left.
 *
 * A requested cap larger than the remainder is reduced rather than refused, so
 * the last run of an envelope still happens at whatever room is left; a
 * remainder of nothing refuses outright.
 */
export function capForRun(input: {
  requestedCapUsd: number;
  state: EnvelopeState;
}): { capUsd: number; reason: string } {
  if (input.state.remainingUsd === null) {
    throw new RegressionEnvelopeError(
      "REGRESSION_ENVELOPE_UNMEASURABLE: ni l'usage fournisseur ni un registre local n'ont pu être lus ; une enveloppe non mesurable n'autorise aucune dépense.",
    );
  }
  if (input.state.remainingUsd <= 0) {
    throw new RegressionEnvelopeError(
      `REGRESSION_ENVELOPE_EXHAUSTED: ${input.state.spentUsd?.toFixed(4)} USD déjà dépensés sur une enveloppe de ${input.state.envelopeUsd} USD.`,
    );
  }
  if (input.requestedCapUsd <= input.state.remainingUsd) {
    return {
      capUsd: input.requestedCapUsd,
      reason: `Plafond demandé ${input.requestedCapUsd} USD, sous le reste d'enveloppe ${input.state.remainingUsd.toFixed(4)} USD.`,
    };
  }
  return {
    capUsd: input.state.remainingUsd,
    reason: `Plafond ramené de ${input.requestedCapUsd} à ${input.state.remainingUsd.toFixed(4)} USD : c'est ce qu'il reste de l'enveloppe.`,
  };
}
