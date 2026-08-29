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

/**
 * Vérificateur indépendant promu le 29 août 2026 (V4.5-111).
 *
 * Ce modèle ne corrige jamais : il répond par oui ou non à une question fermée
 * par critère déjà livré, à partir de la ligne de rubrique, du niveau retenu et
 * de la citation. La production complète de l'apprenant ne lui est jamais
 * transmise.
 *
 * Route ré-attestée le 29 août 2026 contre la liste OpenRouter : le slug
 * `mistralai/mistral-medium-3-5` existe et ses trois points de terminaison
 * portent tous `provider_name: 'Mistral'` (tags `mistral`, `mistral/eu`,
 * `mistral/zdr`). `only: ['Mistral']` ne distingue donc pas la variante
 * européenne de la variante par défaut, là où `only: ['Anthropic']` ne
 * désigne qu'un seul point de terminaison pour le correcteur. L'adaptateur
 * envoie déjà `data_collection: 'deny'` ; la résidence des données reste une
 * décision ouverte, à trancher dans l'ADR §7.2, pas ici.
 *
 * `promotion.scientific` est faux et doit le rester tant que V4.5-121 n'a pas
 * mesuré l'accord du vérificateur. Le pin est donc *attesté*, pas *mesuré* :
 * il garantit qu'un seul modèle nommé peut tenir ce rôle, pas que ce modèle
 * soit bon. C'est la distinction que la V4 avait perdue en croyant la
 * confiance auto-déclarée du correcteur.
 */
export const PROMOTED_CHECKER_IDENTITY = {
  role: 'VERIFICATION_ONLY',
  modelId: 'mistralai/mistral-medium-3-5',
  provider: 'Mistral',
  promotion: {
    scientific: false,
    decisionId: 'owner-checker-family-2026-08-29',
    evidence: 'pending V4.5-121',
  },
  maxRetries: 0,
  requestProfile: {
    adapter: 'OPENROUTER_CHAT',
    reasoning: { budgetTokens: null, budgetMode: 'OFF', effort: 'OFF' },
    routeProviders: ['Mistral'],
    temperature: null,
    timeoutMs: 20_000,
    totalOutputTokenLimit: 400,
    version: '1.0.0',
    visibleOutputTokenTarget: 400,
  },
} as const;
