import {
  buildCheckerRequestBody,
  createRuntimeCorrectionChecker,
  type CheckerQuestion,
} from './correction-checker';
import { PROMOTED_CHECKER_IDENTITY } from './promoted-identity';

function question(overrides: Partial<CheckerQuestion> = {}): CheckerQuestion {
  return {
    criterionKey: 'decision-position',
    criterionLabel: 'Position décisionnelle',
    levelDescription: 'Position explicite et actionnable.',
    levelLabel: 'Maîtrisé',
    quotes: ['Je retiens l’option locale.'],
    ...overrides,
  };
}

const questions = [
  question(),
  question({ criterionKey: 'evidence-selection', criterionLabel: 'Preuves' }),
];

function respond(body: unknown, init: { ok?: boolean } = {}) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: init.ok === false ? 500 : 200,
      }),
  );
}

function verdictResponse(
  verdicts: Array<{ criterionKey: string; supported: boolean }>,
  extra: Record<string, unknown> = {},
) {
  return respond({
    choices: [{ message: { content: JSON.stringify({ verdicts }) } }],
    provider: 'Mistral',
    usage: { cost: 0.0042 },
    ...extra,
  });
}

function checker(fetchImplementation: typeof fetch) {
  return createRuntimeCorrectionChecker({
    apiKey: 'test-key',
    appUrl: 'https://preview.learn-x.app',
    fetchImplementation,
    now: () => 1_000,
  });
}

describe('buildCheckerRequestBody', () => {
  it('porte le jeu restrictif complet dès le premier jour', () => {
    // The checker path is new, so no earlier promotion binds it. V4.5-115
    // decides whether the primary joins it; this must not wait for that.
    const body = buildCheckerRequestBody(questions);
    expect(body.provider).toEqual({
      allow_fallbacks: false,
      data_collection: 'deny',
      only: ['mistral/eu'],
      order: ['mistral/eu'],
      require_parameters: true,
    });
    expect(body.model).toBe(PROMOTED_CHECKER_IDENTITY.modelId);
    expect(body.max_tokens).toBe(400);
  });

  it('n’envoie jamais la production de l’apprenant', () => {
    const production = 'Texte intégral que le vérificateur ne doit pas voir.';
    const serialised = JSON.stringify(buildCheckerRequestBody(questions));
    expect(serialised).not.toContain(production);
    expect(serialised).toContain('Je retiens l’option locale.');
    // System role only: the checker is given no user turn to be steered by.
    const messages = buildCheckerRequestBody(questions).messages as Array<{
      role: string;
    }>;
    expect(messages.every((message) => message.role === 'system')).toBe(true);
  });
});

describe('createRuntimeCorrectionChecker — verdicts', () => {
  it('traduit soutenu et non soutenu', async () => {
    const outcome = await checker(
      verdictResponse([
        { criterionKey: 'decision-position', supported: true },
        { criterionKey: 'evidence-selection', supported: false },
      ]) as unknown as typeof fetch,
    ).verify({ questions });

    expect(outcome.verdicts).toEqual({
      'decision-position': 'AGREED',
      'evidence-selection': 'DISAGREED',
    });
    expect(outcome.costUsd).toBe(0.0042);
    expect(outcome.unavailableReason).toBeNull();
  });

  it('laisse indisponible un critère que le vérificateur a sauté', async () => {
    // Skipped is unchecked, not agreed.
    const outcome = await checker(
      verdictResponse([
        { criterionKey: 'decision-position', supported: true },
      ]) as unknown as typeof fetch,
    ).verify({ questions });

    expect(outcome.verdicts['evidence-selection']).toBe('UNAVAILABLE');
  });
});

describe('createRuntimeCorrectionChecker — échoue fermé', () => {
  it.each([
    [
      'panne réseau',
      vi.fn(async () => {
        throw new Error('socket hang up');
      }),
      'NETWORK_ERROR',
    ],
    [
      'délai dépassé',
      vi.fn(async () => {
        const error = new Error('timed out');
        error.name = 'TimeoutError';
        throw error;
      }),
      'TIMEOUT',
    ],
    ['erreur HTTP', respond({}, { ok: false }), 'HTTP_ERROR'],
    ['enveloppe illisible', respond({ choices: [] }), 'UNPARSEABLE'],
    [
      'contenu non JSON',
      respond({
        choices: [{ message: { content: 'pas du JSON' } }],
        provider: 'Mistral',
      }),
      'UNPARSEABLE',
    ],
    [
      'schéma invalide',
      respond({
        choices: [
          { message: { content: JSON.stringify({ verdicts: 'oui' }) } },
        ],
        provider: 'Mistral',
      }),
      'UNPARSEABLE',
    ],
  ])(
    'résout %s en UNAVAILABLE, jamais en AGREED',
    async (_label, impl, reason) => {
      const outcome = await checker(impl as unknown as typeof fetch).verify({
        questions,
      });
      expect(Object.values(outcome.verdicts)).toEqual([
        'UNAVAILABLE',
        'UNAVAILABLE',
      ]);
      expect(outcome.unavailableReason).toBe(reason);
    },
  );

  it('rejette une réponse entière qui parle d’un critère non demandé', async () => {
    // If the checker and the correction are not discussing the same criteria,
    // nothing in the response can be trusted — including the parts that look
    // right.
    const outcome = await checker(
      verdictResponse([
        { criterionKey: 'decision-position', supported: true },
        { criterionKey: 'critere-inconnu', supported: true },
      ]) as unknown as typeof fetch,
    ).verify({ questions });

    expect(outcome.verdicts['decision-position']).toBe('UNAVAILABLE');
    expect(outcome.unavailableReason).toBe('UNKNOWN_CRITERION');
  });

  it('rejette une réponse servie par un autre fournisseur', async () => {
    const outcome = await checker(
      verdictResponse(
        [{ criterionKey: 'decision-position', supported: true }],
        {
          provider: 'Autre',
        },
      ) as unknown as typeof fetch,
    ).verify({ questions });

    expect(outcome.unavailableReason).toBe('ROUTE_MISMATCH');
    expect(outcome.providerRoute).toBe('Autre');
  });

  it('reste indisponible sans clé API, sans appeler le fournisseur', async () => {
    const fetchImplementation = vi.fn();
    const outcome = await createRuntimeCorrectionChecker({
      apiKey: null,
      appUrl: 'https://preview.learn-x.app',
      fetchImplementation: fetchImplementation as unknown as typeof fetch,
    }).verify({ questions });

    expect(outcome.unavailableReason).toBe('UNCONFIGURED');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('n’essaie jamais deux fois', async () => {
    const fetchImplementation = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    await checker(fetchImplementation as unknown as typeof fetch).verify({
      questions,
    });
    // A second call is a second chance to be wrong, not evidence.
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});
