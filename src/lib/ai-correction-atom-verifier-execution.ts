import { createHash } from 'node:crypto';

import {
  atomCallReservationUsd,
  type openAtomBudget,
} from './ai-correction-atom-verifier-budget.js';
import {
  ATOM_REQUEST_PROFILE,
  type AtomCandidate,
  type AtomTransportResult,
} from './ai-correction-atom-verifier-transport.js';
import {
  parseVerifierAnswer,
  seededShuffle,
  VERIFIER_SYSTEM_PROMPT,
  type CardObservation,
} from './ai-correction-atom-verifier.js';

type Case = { cardId: string; userMessage: string; promptHash: string };
export type AtomAttempt = {
  kind: 'SMOKE' | 'MEASUREMENT';
  callId: string;
  candidateId: string;
  cardId: string;
  repetition: number;
  promptHash: string;
  reservedUsd: number;
  result: AtomTransportResult;
};

/** Transport qualification precedes all measurement jobs. No implicit retry. */
export async function executeAtomMeasurement(input: {
  budget: ReturnType<typeof openAtomBudget>;
  candidates: AtomCandidate[];
  cases: Case[];
  concurrency: number;
  repetitions: number;
  readUsage: () => Promise<number | null>;
  call: (
    candidate: AtomCandidate,
    userMessage: string,
  ) => Promise<AtomTransportResult>;
  persist: (attempt: AtomAttempt) => void;
}) {
  if (
    !Number.isInteger(input.concurrency) ||
    input.concurrency < 1 ||
    input.concurrency > 8
  )
    throw new Error('ATOM_CONCURRENCY_OUT_OF_RANGE');
  const observations = new Map<string, CardObservation[]>();
  const invalidReasons = new Map<string, string[]>();
  let stopped: string | null = null;
  const invalidate = (id: string, reason: string) =>
    invalidReasons.set(id, [...(invalidReasons.get(id) ?? []), reason]);
  const dispatch = async (
    candidate: AtomCandidate,
    c: Case,
    repetition: number,
    kind: AtomAttempt['kind'],
  ) => {
    let callId: string;
    const reservedUsd = atomCallReservationUsd({
      prompt: VERIFIER_SYSTEM_PROMPT + c.userMessage,
      promptUsdPerToken: candidate.price.prompt,
      completionUsdPerToken: candidate.price.completion,
      maxOutputTokens: ATOM_REQUEST_PROFILE.maxOutputTokens,
    });
    try {
      const usage = await input.readUsage();
      if (stopped !== null) return null;
      callId = input.budget.reserve(reservedUsd, usage);
    } catch (error) {
      stopped = error instanceof Error ? error.message : 'ATOM_BUDGET_REFUSED';
      return null;
    }
    let result: AtomTransportResult;
    try {
      result = await input.call(candidate, c.userMessage);
    } catch {
      result = {
        content: null,
        costUsd: null,
        errorCode: 'PROVIDER_TRANSPORT_UNKNOWN_COST',
        generationId: null,
        providerRoute: null,
      };
    }
    input.budget.settle(callId, result.costUsd);
    input.persist({
      callId,
      candidateId: candidate.id,
      cardId: c.cardId,
      repetition,
      kind,
      promptHash: c.promptHash,
      reservedUsd,
      result,
    });
    if (result.costUsd === null) stopped = 'ATOM_RECONCILIATION_REQUIRED';
    if (result.costUsd !== null && result.costUsd > reservedUsd)
      stopped = 'ATOM_RESERVATION_EXCEEDED';
    const parsed =
      !result.errorCode && result.content
        ? parseVerifierAnswer(result.content)
        : null;
    if (!parsed)
      invalidate(
        candidate.id,
        result.errorCode ?? 'MODEL_OUTPUT_SCHEMA_INVALID',
      );
    return parsed;
  };
  // A long real card exercises the actual schema and output limit. Smoke calls
  // are separately labelled and never counted as semantic observations.
  const smoke = [...input.cases].sort(
    (a, b) => b.userMessage.length - a.userMessage.length,
  )[0];
  if (!smoke) throw new Error('ATOM_EMPTY_CASES');
  for (const candidate of input.candidates) {
    if (!candidate.route) {
      invalidate(candidate.id, 'PROFILE_UNVERIFIED');
      continue;
    }
    if (stopped !== null) break;
    await dispatch(candidate, smoke, 0, 'SMOKE');
  }
  const jobs: { candidate: AtomCandidate; c: Case; repetition: number }[] = [];
  for (const candidate of input.candidates) {
    if (invalidReasons.has(candidate.id)) continue;
    for (let repetition = 1; repetition <= input.repetitions; repetition += 1) {
      const seed = createHash('sha256')
        .update(`atom-verifier/v2/${candidate.id}/${repetition}`)
        .digest('hex');
      for (const c of seededShuffle(input.cases, seed))
        jobs.push({ candidate, c, repetition });
    }
  }
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length && stopped === null) {
      const job = jobs[cursor++];
      if (invalidReasons.has(job.candidate.id)) continue;
      let answer: ReturnType<typeof parseVerifierAnswer>;
      try {
        answer = await dispatch(
          job.candidate,
          job.c,
          job.repetition,
          'MEASUREMENT',
        );
      } catch {
        stopped = 'ATOM_PERSISTENCE_FAILURE';
        return;
      }
      const list = observations.get(job.candidate.id) ?? [];
      list.push({
        cardId: job.c.cardId,
        repetition: job.repetition,
        verdict: answer?.verdict ?? null,
      });
      observations.set(job.candidate.id, list);
    }
  };
  const workers = await Promise.allSettled(
    Array.from({ length: input.concurrency }, worker),
  );
  if (workers.some((r) => r.status === 'rejected'))
    stopped = 'ATOM_PERSISTENCE_FAILURE';
  return {
    observations,
    invalidReasons,
    stopped,
    totals: input.budget.totals(),
  };
}
