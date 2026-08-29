import { z } from 'zod';

import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';
import type { CorrectionTransportPort } from './correction-orchestration-contracts.js';

/**
 * A transport that answers without a provider, for development and preview.
 *
 * It derives its answer from the transport JSON schema it is handed, which
 * already carries the contract's criterion keys and the level keys each one
 * allows. That keeps the fake contract-correct for any contract without giving
 * it a second copy of the contract to drift from.
 *
 * It is never selected in production: `resolveCorrectionTransportMode` refuses
 * to resolve FAKE there, and that refusal runs at construction.
 */

const schemaShape = z.object({
  properties: z.object({
    criteria: z.object({
      properties: z.record(
        z.string(),
        z.object({
          properties: z.object({
            levelKey: z.object({ enum: z.array(z.string()).min(1) }),
          }),
        }),
      ),
    }),
  }),
});

/** The middle level where a rubric offers one, so a fake run is unremarkable. */
function representativeLevel(levels: string[]): string {
  return levels[Math.floor((levels.length - 1) / 2)] ?? levels[0] ?? '';
}

export function createFakeCorrectionTransport(): CorrectionTransportPort {
  return {
    async execute(input) {
      const parsed = schemaShape.safeParse(input.jsonSchema);
      if (!parsed.success) {
        // A schema the fake cannot read would otherwise produce an output the
        // protocol rejects, which reads as a model failure rather than as the
        // configuration mistake it is.
        throw new Error('FAKE_TRANSPORT_SCHEMA_UNREADABLE');
      }
      const criteria = Object.fromEntries(
        Object.entries(parsed.data.properties.criteria.properties).map(
          ([key, criterion]) => [
            key,
            {
              confidence: 0.8,
              evidenceQuotes: [`Extrait simulé pour ${key}.`],
              evidenceStatus: 'FOUND' as const,
              feedback: `Retour simulé pour ${key}. Aucun modèle n'a été appelé.`,
              levelKey: representativeLevel(criterion.properties.levelKey.enum),
            },
          ],
        ),
      );
      return {
        latencyMs: 0,
        modelSnapshot: `${PROMOTED_CORRECTION_IDENTITY.modelId}#fake`,
        output: {
          criteria,
          overallFeedback:
            'Correction simulée : transport factice, aucun appel fournisseur.',
        },
        providerRoute: 'fake',
        usage: {
          actualCostUsd: 0,
          inputTokens: 0,
          reasoningTokens: 0,
          visibleOutputTokens: 0,
        },
      };
    },
  };
}
