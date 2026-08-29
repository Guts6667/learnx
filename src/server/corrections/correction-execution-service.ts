import {
  buildProtocol3TransportJsonSchema,
  type CorrectionContract,
  type Protocol3CorrectionArtifactOutput,
} from '../../lib/ai-correction-contracts.js';
import {
  salvageProtocol3PartialCorrection,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
} from '../../lib/ai-correction-benchmark.js';
import { sanitizeStructuredOutputJsonSchema } from '../../lib/ai-json-schema.js';
import {
  buildCorrectionOutcome,
  failedCorrection,
} from './correction-outcome.js';
import type {
  CheckerQuestion,
  CheckerVerdict,
  CorrectionCheckerPort,
} from './correction-checker.js';
import type {
  AcceptedQuoteSnapshot,
  CorrectionPersistencePort,
  CorrectionTransportPort,
  OrchestratedCorrectionResult,
  RuntimeCorrectionAttempt,
} from './correction-orchestration-contracts.js';
import {
  failedAttempt,
  successfulAttempt,
} from './correction-runtime-attempts.js';
import {
  PROMOTED_CHECKER_IDENTITY,
  PROMOTED_CORRECTION_IDENTITY,
} from './promoted-identity.js';
import { buildRuntimeCorrectionMessages } from './runtime-correction-prompt.js';

interface ResolvedGeneration {
  output: Protocol3CorrectionArtifactOutput;
  unsureCriteria: string[];
}

interface UsageTracker {
  add(cost: number | undefined): void;
  value(): number | null;
}

function createUsageTracker(): UsageTracker {
  let total = 0;
  let complete = true;
  return {
    add(cost) {
      if (cost === undefined) complete = false;
      else total += cost;
    },
    value: () => (complete ? total : null),
  };
}

function resolveGeneration(input: {
  contract: CorrectionContract;
  output: unknown;
  responseText: string;
}): ResolvedGeneration | null {
  try {
    const strict = validateBenchmarkProtocol3ModelOutputWithEvidence({
      benchmarkCase: { responseText: input.responseText },
      contract: input.contract,
      output: input.output,
    });
    return { output: strict.output, unsureCriteria: [] };
  } catch {
    // Exact evidence remains the deterministic boundary before partial salvage.
  }
  try {
    const salvaged = salvageProtocol3PartialCorrection({
      benchmarkCase: { responseText: input.responseText },
      contract: input.contract,
      output: input.output,
    });
    return { output: salvaged.output, unsureCriteria: salvaged.unsureCriteria };
  } catch {
    return null;
  }
}

/**
 * The reconsideration prompt embeds the previous correction verbatim through
 * `JSON.stringify`. The confidence labels V4.5-110 derives are the server's
 * judgement *about* that correction, not part of it, and they must not reach
 * the model for two reasons.
 *
 * The prompt is pinned by the promoted identity: changing what it carries is a
 * prompt change requiring re-promotion, not a refactor. And a reexamination
 * told which criteria we already rated LOW is anchored towards revising exactly
 * those, which is the opposite of the independent second look the prompt asks
 * for.
 *
 * Deleting from a spread copy rather than rebuilding a whitelist keeps the
 * remaining keys in their original order, so the serialised prompt stays
 * byte-identical to what was promoted.
 */
function withoutDerivedConfidence(
  correction: OrchestratedCorrectionResult['correction'],
): unknown {
  const stripped: Record<string, unknown> = {
    ...correction,
    criteria: correction.criteria.map((criterion) => {
      const item: Record<string, unknown> = { ...criterion };
      delete item.confidence;
      return item;
    }),
  };
  delete stripped.overallConfidence;
  return stripped;
}

/**
 * One closed question per delivered criterion, carrying the rubric line, the
 * level the correction chose and the quotes it relied on — and nothing else.
 * The learner's production never enters the checker's request.
 */
function buildCheckerQuestions(
  contract: CorrectionContract,
  output: Protocol3CorrectionArtifactOutput,
): CheckerQuestion[] {
  return output.criteria.flatMap((item) => {
    const criterion = contract.criteria.find(
      (candidate) => candidate.key === item.criterionKey,
    );
    const level = criterion?.performanceLevels.find(
      (candidate) => candidate.key === item.levelKey,
    );
    if (!criterion || !level) return [];
    return [
      {
        criterionKey: item.criterionKey,
        criterionLabel: criterion.label,
        levelDescription: level.description,
        levelLabel: level.label,
        quotes: item.evidenceQuotes,
      },
    ];
  });
}

export class CorrectionExecutionService {
  public constructor(
    private readonly corrections: CorrectionPersistencePort,
    private readonly transport: CorrectionTransportPort,
    private readonly apiKey: string,
    /** Absent in an environment with no checker configured. */
    private readonly checker?: CorrectionCheckerPort,
  ) {}

  public async execute(input: {
    contract: CorrectionContract;
    correctionId: string;
    quote: AcceptedQuoteSnapshot;
  }): Promise<{
    attempts: RuntimeCorrectionAttempt[];
    correction: OrchestratedCorrectionResult['correction'];
  }> {
    const messages = buildRuntimeCorrectionMessages({
      contract: input.contract,
      exerciseInstructions: input.quote.exerciseInstructions,
      ...(input.quote.reconsideration
        ? {
            reconsideration: {
              argument: input.quote.reconsideration.argument,
              previousCorrection: withoutDerivedConfidence(
                input.quote.reconsideration.previousCorrection,
              ),
            },
          }
        : {}),
      submissionText: input.quote.submissionText,
      taskContext: input.quote.taskContext ?? undefined,
    });
    const jsonSchema = sanitizeStructuredOutputJsonSchema(
      buildProtocol3TransportJsonSchema(input.contract),
    ) as Record<string, unknown>;
    return this.executePrimary({ ...input, jsonSchema, messages });
  }

  private async executePrimary(input: {
    contract: CorrectionContract;
    correctionId: string;
    quote: AcceptedQuoteSnapshot;
    jsonSchema: Record<string, unknown>;
    messages: Array<{ content: string; role: 'system' | 'user' }>;
  }) {
    const attempts: RuntimeCorrectionAttempt[] = [];
    const usage = createUsageTracker();
    const primary = await this.callModel({ ...input, attempts, usage });
    if (!primary) {
      return { attempts, correction: failedCorrection(usage.value()) };
    }

    // The score guard used to fire here, asking the same model to answer again
    // near the pass mark and treating agreement as reassurance. It is replaced
    // by one independent check of the evidence, which can disagree.
    const verdicts = await this.verify({
      attempts,
      contract: input.contract,
      correctionId: input.correctionId,
      primary,
      usage,
    });
    return {
      attempts,
      correction: buildCorrectionOutcome({
        contract: input.contract,
        output: primary.output,
        unsureCriteria: primary.unsureCriteria,
        usageCost: usage.value(),
        verdicts,
      }),
    };
  }

  /**
   * Never throws. A checker that fails takes the HIGH ceiling away and nothing
   * else — the correction it was checking is already produced and stays valid
   * at MEDIUM. Letting a checker failure fail the correction would make the
   * guard more dangerous than its absence.
   */
  private async verify(input: {
    attempts: RuntimeCorrectionAttempt[];
    contract: CorrectionContract;
    correctionId: string;
    primary: ResolvedGeneration;
    usage: UsageTracker;
  }): Promise<Record<string, CheckerVerdict>> {
    const questions = buildCheckerQuestions(
      input.contract,
      input.primary.output,
    );
    const unavailable = (): Record<string, CheckerVerdict> =>
      Object.fromEntries(
        questions.map((question) => [question.criterionKey, 'UNAVAILABLE']),
      );
    if (!this.checker || questions.length === 0) return unavailable();

    // The checker's call is recorded like any other, under its own role. Its
    // spend was previously measured and dropped, so a correction's recorded
    // cost understated what was actually spent and V4.5-114 had no checker
    // figure to price a ceiling from.
    const sequence = input.attempts.length + 1;
    await this.corrections.recordAttemptIntent({
      correctionId: input.correctionId,
      identity: {
        modelId: PROMOTED_CHECKER_IDENTITY.modelId,
        provider: PROMOTED_CHECKER_IDENTITY.provider,
        role: 'CORRECTION_CHECKER',
      },
      sequence,
    });

    // A checker that throws is the same as one that answers UNAVAILABLE: the
    // attempt is still recorded, so the call is not invisible in the ledger.
    const outcome = await this.checker.verify({ questions }).catch(() => null);

    const attempt: RuntimeCorrectionAttempt = {
      ...(outcome?.costUsd == null ? {} : { actualCostUsd: outcome.costUsd }),
      ...(outcome?.unavailableReason == null
        ? {}
        : { errorCode: outcome.unavailableReason }),
      ...(outcome?.latencyMs == null ? {} : { latencyMs: outcome.latencyMs }),
      modelSnapshot: PROMOTED_CHECKER_IDENTITY.modelId,
      ...(outcome?.providerRoute == null
        ? {}
        : { providerRoute: outcome.providerRoute }),
      sequence,
      status:
        outcome && outcome.unavailableReason === null ? 'SUCCEEDED' : 'FAILED',
    };
    input.attempts.push(attempt);
    input.usage.add(attempt.actualCostUsd);
    await this.corrections.recordAttemptOutcome({
      attempt,
      correctionId: input.correctionId,
    });

    return outcome?.verdicts ?? unavailable();
  }

  private async callModel(input: {
    contract: CorrectionContract;
    correctionId: string;
    quote: AcceptedQuoteSnapshot;
    jsonSchema: Record<string, unknown>;
    messages: Array<{ content: string; role: 'system' | 'user' }>;
    attempts: RuntimeCorrectionAttempt[];
    usage: UsageTracker;
  }): Promise<ResolvedGeneration | null> {
    const sequence = input.attempts.length + 1;
    await this.corrections.recordAttemptIntent({
      correctionId: input.correctionId,
      sequence,
    });
    let generation: Awaited<ReturnType<CorrectionTransportPort['execute']>>;
    try {
      generation = await this.transport.execute({
        apiKey: this.apiKey,
        jsonSchema: input.jsonSchema,
        messages: input.messages,
        modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
      });
    } catch (error) {
      const attempt = failedAttempt(error, sequence);
      input.usage.add(attempt.actualCostUsd);
      input.attempts.push(attempt);
      await this.corrections.recordAttemptOutcome({
        attempt,
        correctionId: input.correctionId,
      });
      return null;
    }
    input.usage.add(generation.usage.actualCostUsd);
    const resolved = resolveGeneration({
      contract: input.contract,
      output: generation.output,
      responseText: input.quote.submissionText,
    });
    const attempt = successfulAttempt({
      generation,
      sequence,
      valid: resolved !== null,
    });
    input.attempts.push(attempt);
    // Persistence failures after a successful dispatch are infrastructure
    // failures. They must escape to reconciliation and must never be rewritten
    // as a model/provider FAILED outcome.
    await this.corrections.recordAttemptOutcome({
      attempt,
      correctionId: input.correctionId,
    });
    return resolved;
  }
}
