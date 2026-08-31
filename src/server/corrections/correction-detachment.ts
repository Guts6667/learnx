/**
 * Detaching a correction from its author at 180 days (V4.5-168, decision
 * `owner-rgpd-2026-08-29` §2).
 *
 * The privacy policy already promises this to learners. Nothing implemented
 * it, which is the actual defect: a sentence we could not support, on a page
 * they read before consenting.
 *
 * What leaves the correction is the learner's own words — the production, the
 * prompt that carries it, the quotes cited back at them, and the raw model
 * output. What stays is the shape of the judgement: levels, confidences,
 * costs, timestamps, and every foreign key, including the one that stops a
 * feedback row pointing at someone else's correction. Money rows are not
 * touched at all.
 *
 * With consent, those words move to a research sample under a pseudonym drawn
 * at random and never recorded against anything. Without it they are dropped.
 * The learner is detached either way — consent decides what survives for
 * research, never whether the detachment happens.
 *
 * Pseudonymisation, not anonymisation: free text can name its author. The
 * audit says so (§7 decision 3) and the policy must say so too.
 */

export interface DetachableCorrection {
  activityType: string;
  attempts: Array<{ id: string; rawOutput: unknown }>;
  id: string;
  modelId: string | null;
  promptSnapshot: unknown;
  promptVersion: string;
  /** The account's reuse consent, read at detachment time, never assumed. */
  reuseConsent: boolean;
  structuredResult: unknown;
  submissionSnapshot: unknown;
}

interface ResearchSample {
  activityType: string;
  detachedOn: Date;
  evidenceQuotes: unknown;
  modelId: string | null;
  promptSnapshot: unknown;
  promptVersion: string;
  pseudonym: string;
  rawOutputs: unknown;
  submissionSnapshot: unknown;
}

export interface DetachmentPlan {
  /** Attempts whose `rawOutput` is cleared. */
  attemptIds: string[];
  correctionId: string;
  /** Null when the account gave no consent: the words are dropped instead. */
  sample: ResearchSample | null;
  /** The judgement, with the learner's quotes taken out of it. */
  structuredResult: unknown;
}

/**
 * Empties every `evidenceQuotes` it finds, wherever it finds them.
 *
 * Deliberately shape-agnostic rather than typed against the correction
 * contract: that contract has three variants today and will have more, and a
 * walker that misses a new one leaves the learner's words in a row we have
 * told them was detached. Emptied rather than removed, so the correction still
 * reads as one that cited nothing rather than one missing a field.
 */
export function stripEvidenceQuotes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEvidenceQuotes);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      key === 'evidenceQuotes' ? [] : stripEvidenceQuotes(entry),
    ]),
  );
}

/** Every `evidenceQuotes` found, so they move rather than merely vanish. */
export function collectEvidenceQuotes(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(collectEvidenceQuotes);
  if (value === null || typeof value !== 'object') return [];

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, entry]) =>
      key === 'evidenceQuotes' ? [entry] : collectEvidenceQuotes(entry),
  );
}

export function planDetachment(
  correction: DetachableCorrection,
  makePseudonym: () => string,
  detachedOn: Date,
): DetachmentPlan {
  const attemptIds = correction.attempts
    .filter((attempt) => attempt.rawOutput !== null)
    .map((attempt) => attempt.id);

  const plan = {
    attemptIds,
    correctionId: correction.id,
    structuredResult: stripEvidenceQuotes(correction.structuredResult),
  };

  if (!correction.reuseConsent) return { ...plan, sample: null };

  return {
    ...plan,
    sample: {
      activityType: correction.activityType,
      // The day, not the instant: a precise second lined up against an
      // application log would say who was writing then.
      detachedOn: new Date(
        Date.UTC(
          detachedOn.getUTCFullYear(),
          detachedOn.getUTCMonth(),
          detachedOn.getUTCDate(),
        ),
      ),
      evidenceQuotes: collectEvidenceQuotes(correction.structuredResult),
      modelId: correction.modelId,
      promptSnapshot: correction.promptSnapshot,
      promptVersion: correction.promptVersion,
      // Drawn here and recorded against nothing. The irreversibility is the
      // draw, not a rule in code that a later change could undo.
      pseudonym: makePseudonym(),
      rawOutputs: correction.attempts.map((attempt) => attempt.rawOutput),
      submissionSnapshot: correction.submissionSnapshot,
    },
  };
}
