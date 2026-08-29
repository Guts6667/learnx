import { buildProtocol3TransportJsonSchema } from '../../lib/ai-correction-contracts';
import { AiProviderError } from '../ai/structured-provider';
import { contractRaw } from './correction-orchestration.test-support';
import { createFakeCorrectionTransport } from './fake-correction-transport';
import { selectCorrectionTransport } from './correction-transport-mode';

const jsonSchema = buildProtocol3TransportJsonSchema(contractRaw) as Record<
  string,
  unknown
>;

function execute() {
  return createFakeCorrectionTransport().execute({
    apiKey: 'unused',
    jsonSchema,
    messages: [{ content: 'peu importe', role: 'system' }],
    modelId: 'unused',
  });
}

describe('createFakeCorrectionTransport', () => {
  it('produit une sortie conforme au contrat sans appeler personne', async () => {
    const result = await execute();
    const output = result.output as {
      criteria: Record<string, { levelKey: string }>;
      overallFeedback: string;
    };
    expect(Object.keys(output.criteria)).toEqual([
      'decision-position',
      'evidence-selection',
    ]);
    // Levels come from the schema's own enum, so the fake stays correct for
    // any contract instead of carrying a second copy of one.
    expect(output.criteria['decision-position']?.levelKey).toBe('partial');
    expect(result.usage.actualCostUsd).toBe(0);
    expect(result.providerRoute).toBe('fake');
  });

  it('refuse un schéma qu’il ne sait pas lire plutôt que d’inventer', async () => {
    await expect(
      createFakeCorrectionTransport().execute({
        apiKey: 'unused',
        jsonSchema: { properties: {} },
        messages: [],
        modelId: 'unused',
      }),
    ).rejects.toThrow('FAKE_TRANSPORT_SCHEMA_UNREADABLE');
  });
});

describe('selectCorrectionTransport', () => {
  it('construit le faux transport quand le mode est FAKE', async () => {
    const selection = selectCorrectionTransport({
      LEARNX_AI_CONFIG_ENVIRONMENT: 'development',
      LEARNX_AI_TRANSPORT: 'fake',
      NODE_ENV: 'test',
    });
    expect(selection.mode).toBe('FAKE');

    // The defect this ticket fixes: the mode said FAKE while the transport was
    // the real one. Proving the built transport answers without a provider is
    // the assertion whose absence let that ship.
    const result = await selection.transport.execute({
      apiKey: 'unused',
      jsonSchema,
      messages: [],
      modelId: 'unused',
    });
    expect(result.providerRoute).toBe('fake');
  });

  it('construit le transport réel par défaut', () => {
    expect(selectCorrectionTransport({}).mode).toBe('REAL');
  });

  it('refuse de construire un faux transport en production', () => {
    // Exercised through the selection the composition root calls, not through
    // the resolver alone: the resolver was already right when this broke.
    expect(() =>
      selectCorrectionTransport({
        LEARNX_AI_CONFIG_ENVIRONMENT: 'production',
        LEARNX_AI_TRANSPORT: 'fake',
      }),
    ).toThrow(AiProviderError);
  });
});
