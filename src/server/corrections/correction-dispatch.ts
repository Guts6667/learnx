import type {
  CorrectionPersistencePort,
  RuntimeCorrectionAttempt,
} from './correction-orchestration-contracts.js';

/** Persist intent, then recheck the emergency stop immediately before dispatch. */
export async function authorizeCorrectionAttempt(input: {
  corrections: CorrectionPersistencePort;
  canDispatch: () => Promise<boolean>;
  attempts: RuntimeCorrectionAttempt[];
  correctionId: string;
  sequence: number;
  identity?: Parameters<
    CorrectionPersistencePort['recordAttemptIntent']
  >[0]['identity'];
}): Promise<boolean> {
  await input.corrections.recordAttemptIntent({
    correctionId: input.correctionId,
    sequence: input.sequence,
    ...(input.identity ? { identity: input.identity } : {}),
  });
  if (await input.canDispatch()) return true;
  // No network call took place. This is a known zero, not an unknown provider
  // bill; CALL_INTENT remains the last dispatch state for this cancellation.
  const attempt: RuntimeCorrectionAttempt = {
    actualCostUsd: 0,
    errorCode: 'DISPATCH_BLOCKED',
    sequence: input.sequence,
    status: 'FAILED',
  };
  input.attempts.push(attempt);
  await input.corrections.recordAttemptOutcome({
    correctionId: input.correctionId,
    attempt,
  });
  return false;
}
