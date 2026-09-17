import { applyResearchPriceCeilings } from './ai-correction-research-guarded-fetch.js';
/** Checker-only qualification probe, using the shared durable spending envelope. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  acquireAtomRunLock,
  atomCallReservationUsd,
  openAtomBudget,
} from './ai-correction-atom-verifier-budget.js';
import { parseFalseAgreeProbe } from './ai-correction-false-agree-probe.js';
import {
  qualificationSha256,
  validateDesignedProbeEvidence,
  type DesignedProbeBinding,
  type DesignedProbeEvidence,
} from './ai-correction-regression-probe-evidence.js';
import type { RegressionCheckerPort } from './ai-correction-regression-contracts.js';

export async function runDesignedCheckerProbe(input: {
  arguments: string[];
  binding: DesignedProbeBinding;
  instructions: readonly string[];
  executableProfile?: {
    routeProviders: readonly string[];
    requests: { id: string; body: unknown }[];
  } & Record<string, unknown>;
  checker?: RegressionCheckerPort;
  apiKey?: string;
  /** Shared git-common-dir envelope directory; required for execution. */
  budgetDirectory: string;
  probePath: string;
  outputDirectory: string;
  pricing: {
    modelId: string;
    promptUsdPerToken: number;
    completionUsdPerToken: number;
  };
  maxOutputTokens: number;
  readProviderUsage: () => Promise<number | null>;
  now?: () => Date;
}): Promise<{
  evidencePath: string | null;
  reservedBoundUsd: number;
  evidence: DesignedProbeEvidence | null;
}> {
  const probeText = await readFile(input.probePath, 'utf8');
  const probe = parseFalseAgreeProbe(JSON.parse(probeText) as unknown);
  if (
    input.pricing.modelId !== input.binding.checker.modelId ||
    qualificationSha256(JSON.stringify(input.instructions)) !==
      input.binding.checker.promptSha256
  ) {
    throw new Error('DESIGNED_PROBE_CONFIGURATION_MISMATCH');
  }
  if (input.binding.measurementKind === 'LIVE' && !input.executableProfile)
    throw new Error('DESIGNED_PROBE_EXECUTABLE_PROFILE_REQUIRED');
  const requestBodies = new Map<string, string>();
  if (input.executableProfile) {
    if (
      qualificationSha256(JSON.stringify(input.executableProfile)) !==
      input.binding.checker.requestProfileSha256
    )
      throw new Error('DESIGNED_PROBE_EXECUTABLE_PROFILE_MISMATCH');
    for (const request of input.executableProfile.requests) {
      if (requestBodies.has(request.id))
        throw new Error('DESIGNED_PROBE_EXECUTABLE_PROFILE_MISMATCH');
      const body = applyResearchPriceCeilings(request.body, {
        ...input.pricing,
        maxOutputTokens: input.maxOutputTokens,
      });
      if (JSON.stringify(body) !== JSON.stringify(request.body))
        throw new Error('DESIGNED_PROBE_EXECUTABLE_PROFILE_MISMATCH');
      requestBodies.set(request.id, JSON.stringify(body));
    }
    if (
      requestBodies.size !== probe.cases.length ||
      probe.cases.some((entry) => !requestBodies.has(entry.id))
    )
      throw new Error('DESIGNED_PROBE_EXECUTABLE_PROFILE_MISMATCH');
  }
  const reservations = probe.cases.map((entry) =>
    atomCallReservationUsd({
      prompt:
        requestBodies.get(entry.id) ??
        JSON.stringify({ instructions: input.instructions, criteria: [entry] }),
      ...input.pricing,
      maxOutputTokens: input.maxOutputTokens,
    }),
  );
  const reservedBoundUsd = reservations.reduce((sum, value) => sum + value, 0);
  if (
    !input.arguments.includes('--execute') ||
    input.arguments.includes('--dry-run')
  ) {
    return { evidencePath: null, reservedBoundUsd, evidence: null };
  }
  const arg = (name: string) =>
    input.arguments
      .find((value) => value.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const cap = Number(arg('supplier-cost-cap-usd'));
  const envelope = Number(arg('envelope-usd'));
  const legacyDecision = arg('decision-id');
  const decisionId = arg('envelope-decision') ?? legacyDecision;
  if (
    legacyDecision &&
    arg('envelope-decision') &&
    legacyDecision !== decisionId
  )
    throw new Error('DESIGNED_PROBE_DECISION_CONFLICT');
  if (
    !input.apiKey ||
    !input.checker ||
    !decisionId ||
    !Number.isFinite(cap) ||
    cap <= 0 ||
    !Number.isFinite(envelope) ||
    envelope <= 0 ||
    reservedBoundUsd > cap
  ) {
    throw new Error('DESIGNED_PROBE_EXPLICIT_BUDGET_REQUIRED');
  }
  const release = acquireAtomRunLock(input.budgetDirectory);
  try {
    const usage = await input.readProviderUsage();
    if (usage === null)
      throw new Error('DESIGNED_PROBE_PROVIDER_USAGE_UNAVAILABLE');
    const budget = openAtomBudget({
      directory: input.budgetDirectory,
      decisionId,
      envelopeUsd: envelope,
      keyHash: `sha256:${createHash('sha256').update(input.apiKey).digest('hex')}`,
      providerUsageUsd: usage,
      runCapUsd: cap,
      runId: `designed-probe:${input.binding.qualificationRunId}`,
    });
    const evidence: DesignedProbeEvidence = {
      schemaVersion: 1,
      executableProfile: input.executableProfile ?? null,
      ...input.binding,
      createdAt: (input.now?.() ?? new Date()).toISOString(),
      probeId: probe.probeId,
      probeSha256: qualificationSha256(probeText),
      outcomes: [],
    };
    await mkdir(input.outputDirectory, { recursive: true });
    const evidencePath = path.join(
      input.outputDirectory,
      'designed-checker-probe.json',
    );
    // Refuse overwriting prior evidence before the first dispatch.
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
      flag: 'wx',
    });
    for (const [index, entry] of probe.cases.entries()) {
      const reservation = reservations[index];
      if (reservation === undefined)
        throw new Error('DESIGNED_PROBE_RESERVATION_MISSING');
      const callId = budget.reserve(
        reservation,
        await input.readProviderUsage(),
      );
      let outcome: Awaited<ReturnType<RegressionCheckerPort['verify']>>;
      try {
        outcome = await input.checker.verify({
          unitId: entry.id,
          criteria: [
            {
              criterionKey: entry.criterionKey,
              criterionLabel: entry.criterionLabel,
              levelDescription: entry.levelDescription,
              levelKey: entry.levelKey,
              levelLabel: entry.levelLabel,
              quotes: entry.quotes,
            },
          ],
        });
      } catch (error) {
        budget.settle(callId, null);
        throw error;
      }
      budget.settle(callId, outcome.costUsd);
      evidence.outcomes.push({
        id: entry.id,
        costUsd: outcome.costUsd,
        reservedUsd: reservation,
        verdict: outcome.verdicts[entry.criterionKey] ?? 'UNAVAILABLE',
      });
      await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
      if (outcome.costUsd === null)
        throw new Error('DESIGNED_PROBE_UNRECONCILED_COST');
      if (outcome.costUsd > reservation)
        throw new Error('DESIGNED_PROBE_RESERVATION_EXCEEDED');
    }
    validateDesignedProbeEvidence({
      source: evidence,
      probe,
      probeSha256: evidence.probeSha256,
      binding: input.binding,
    });
    return { evidencePath, reservedBoundUsd, evidence };
  } finally {
    release();
  }
}
