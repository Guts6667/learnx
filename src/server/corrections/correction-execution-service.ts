import {
  buildProtocol3TransportJsonSchema,
  type CorrectionContract,
  type Protocol3CorrectionArtifactOutput,
} from '../../lib/ai-correction-contracts.js';
import {
  reconcileProtocol3ScoreGuardPasses,
  salvageProtocol3PartialCorrection,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
} from '../../lib/ai-correction-benchmark.js';
import { sanitizeStructuredOutputJsonSchema } from '../../lib/ai-json-schema.js';
import {
  buildCorrectionOutcome,
  failedCorrection,
  weightedIndicativeScore,
} from './correction-outcome.js';
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
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';
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

export class CorrectionExecutionService {
  public constructor(
    private readonly corrections: CorrectionPersistencePort,
    private readonly transport: CorrectionTransportPort,
    private readonly apiKey: string,
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
              previousCorrection:
                input.quote.reconsideration.previousCorrection,
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
      return {
        attempts,
        correction: failedCorrection(input.contract, usage.value(), false),
      };
    }
    const score =
      primary.unsureCriteria.length === 0
        ? weightedIndicativeScore(input.contract, primary.output)
        : null;
    const guarded =
      score !== null &&
      Math.abs(score - input.contract.passingScore) <=
        PROMOTED_CORRECTION_IDENTITY.scoreGuardBandPoints;
    if (!guarded) {
      return {
        attempts,
        correction: buildCorrectionOutcome({
          contract: input.contract,
          output: primary.output,
          unsureCriteria: primary.unsureCriteria,
          usageCost: usage.value(),
        }),
      };
    }
    return this.executeGuardedPass({ ...input, attempts, primary, usage });
  }

  private async executeGuardedPass(input: {
    contract: CorrectionContract;
    correctionId: string;
    quote: AcceptedQuoteSnapshot;
    jsonSchema: Record<string, unknown>;
    messages: Array<{ content: string; role: 'system' | 'user' }>;
    attempts: RuntimeCorrectionAttempt[];
    primary: ResolvedGeneration;
    usage: UsageTracker;
  }) {
    const second = await this.callModel(input);
    const reconciled = second
      ? reconcileProtocol3ScoreGuardPasses({
          contract: input.contract,
          primary: input.primary,
          second,
        })
      : null;
    if (!reconciled?.output) {
      return {
        attempts: input.attempts,
        correction: failedCorrection(input.contract, input.usage.value(), true),
      };
    }
    return {
      attempts: input.attempts,
      correction: buildCorrectionOutcome({
        contract: input.contract,
        forceScoreGuardSecondPass: true,
        output: reconciled.output,
        unsureCriteria: reconciled.unsureCriteria,
        usageCost: input.usage.value(),
      }),
    };
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
    try {
      const generation = await this.transport.execute({
        apiKey: this.apiKey,
        jsonSchema: input.jsonSchema,
        messages: input.messages,
        modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
      });
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
      await this.corrections.recordAttemptOutcome({
        attempt,
        correctionId: input.correctionId,
      });
      return resolved;
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
  }
}
