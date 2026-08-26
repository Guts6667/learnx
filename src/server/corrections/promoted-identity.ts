
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
 * Le benchmark reste scientifiquement borné à WRITING : le défaut
 * éliminatoire Practice confirmé le 24 août n'est ni effacé ni requalifié.
 * Le 26 août, le Propriétaire a néanmoins autorisé un périmètre produit
 * formatif plus large pour collecter des données et itérer. Cette extension
 * est donc une décision de rollout surveillé, pas une promotion scientifique
 * des familles reflection/practice/project.
 */
export const PROMOTED_CORRECTION_IDENTITY = {
  activityTypeScope: ['writing', 'reflection', 'practice', 'project'],
  scientificallyValidatedActivityTypeScope: ['writing'],
  scopeDecisionId: 'owner-formative-free-text-rollout-2026-08-26',
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
