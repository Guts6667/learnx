
/**
 * Identité de correction promue au gate de développement le 24 août 2026
 * (learnx-french-text-correction-v3-1 : Sonnet 4.6 route Anthropic épinglée,
 * prompt 2.2.0, protocole 3.0.1, livraison PARTIAL_CRITERION, aucun retry).
 *
 * Le runtime n'appelle jamais un modèle non promu : toute évolution de ce
 * pin exige une nouvelle promotion (benchmark complet + revue aveugle) et
 * passe par une modification explicite de ce fichier, jamais par une
 * configuration implicite.
 *
 * Le scope writing-only et la bande de garde sont bloquants : le défaut
 * éliminatoire Practice a été confirmé par la revue canonique du 24 août.
 */
export const PROMOTED_CORRECTION_IDENTITY = {
  activityTypeScope: ['writing'],
  languageScope: ['fr-FR'],
  targetKindScope: ['EXERCISE'],
  benchmarkId: 'learnx-french-text-correction-v3-1',
  candidateId: 'claude-sonnet-4-6-openrouter-anthropic',
  modelId: 'anthropic/claude-sonnet-4.6',
  provider: 'Anthropic',
  promptVersion: '2.2.0',
  requestProtocolVersion: '3.0.1',
  scoreGuardBandPoints: 5,
  deliveryPolicy: 'PARTIAL_CRITERION',
  maxRetries: 0,
  requestProfile: {
    adapter: 'OPENROUTER_CHAT',
    reasoning: { budgetTokens: null, budgetMode: 'OFF', effort: 'OFF' },
    routeProviders: ['Anthropic'],
    temperature: null,
    timeoutMs: 60_000,
    totalOutputTokenLimit: 1_500,
    version: '2.0.0',
    visibleOutputTokenTarget: 1_500,
  },
} as const;
