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
  /**
   * The wording sent to the corrector. Distinct from `requestProfile.version`
   * below, which happens to read `2.2.0` too but versions something else — how
   * the request is routed and bounded, not what it says. Two different facts
   * that have shared a number since V4.5-124, which is exactly when a reader
   * starts assuming they move together. They do not.
   *
   * Pinned against `RUNTIME_CORRECTION_PROMPT_VERSION` by a test: nothing else
   * connected them, and a drift is silent — the runtime would send one version
   * while this claims another, and `correction-orchestration.ts` would quietly
   * stop matching cached quotes instead of failing.
   */
  promptVersion: '2.2.0',
  requestProtocolVersion: '3.0.1',
  scoreGuardBandPoints: 5,
  deliveryPolicy: 'PARTIAL_CRITERION',
  /**
   * Une reprise, et une seule (V4.5-124,
   * `owner-retry-policy-2026-08-29`). La campagne du 29 août a montré ~5 % de
   * cellules inutilisables sur `MODEL_EVIDENCE_NOT_IN_RESPONSE` et
   * `MODEL_OUTPUT_CONTRACT_INVALID` : des réponses reçues et inexploitables,
   * pas des appels ratés.
   *
   * La reprise ne vaut que pour ce cas. Un appel qui échoue de façon ambiguë —
   * délai, coupure réseau, 5xx — peut avoir été facturé et avoir produit une
   * génération que nous n'avons pas vue ; le refaire sans clé d'idempotence
   * fournisseur paierait deux fois pour deux réponses dont une est perdue.
   */
  maxRetries: 1,
  /**
   * Profil 2.1.0 (V4.5-115, 29 août 2026) : le corps runtime envoie désormais
   * `provider.only` (= routeProviders) et `data_collection: 'deny'`, et la
   * route porte le slug documenté `anthropic` au lieu du nom d'affichage.
   * La sonde authentifiée
   * `benchmarks/ai-correction/probes/2026-08-29-v4-5-115-route-probe.json`
   * a montré qu'Anthropic sert le primaire sous les deux formes, avec ou sans
   * ces paramètres : le point de terminaison ne change pas. Ce profil est
   * attesté par la sonde et re-promu par la suite de régression (V4.5-121) ;
   * le benchmark scellé v3.1 a été mesuré sous 2.0.0 / `['Anthropic']`.
   *
   * Profil 2.2.0 (V4.5-124) : `maxRetries` passe à 1. La constante dit ce qui a
   * été mesuré — une politique de reprise change ce que le runtime fait d'une
   * réponse, donc elle change le profil, donc elle change sa version. Aucune
   * campagne n'a encore tourné sous 2.2.0 : c'est l'exécution V4.5-121 sur
   * cette identité, et pas celle du 29 août, qui en constituera la preuve.
   */
  requestProfile: {
    adapter: 'OPENROUTER_CHAT',
    reasoning: { budgetTokens: null, budgetMode: 'OFF', effort: 'OFF' },
    routeProviders: ['anthropic'],
    temperature: null,
    timeoutMs: 60_000,
    totalOutputTokenLimit: 1_500,
    version: '2.2.0',
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
 * Route ré-attestée le 29 août 2026 contre la liste OpenRouter. Le slug
 * `mistralai/mistral-medium-3-5` existe et ses trois points de terminaison
 * portent tous `provider_name: 'Mistral'` (tags `mistral`, `mistral/eu`,
 * `mistral/zdr`) : router par nom de fournisseur ne les distingue donc pas,
 * là où `Anthropic` ne désigne qu'un seul point pour le correcteur.
 *
 * Le Propriétaire a tranché la résidence le 29 août 2026
 * (`owner-checker-residency-eu-2026-08-29`) : le vérificateur est épinglé sur
 * le point européen. `routeProviders` porte donc le slug d'endpoint
 * `mistral/eu` — la forme documentée par OpenRouter pour cibler une variante —
 * tandis que `provider` reste le nom que la réponse renvoie, et sert à
 * l'attestation. Les deux ne sont pas interchangeables, et les confondre est
 * précisément ce qui rendait l'asymétrie invisible.
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
  routeDecisionId: 'owner-checker-residency-eu-2026-08-29',
  /**
   * The checker prompt this identity was measured under (V4.5-207).
   *
   * It had none: the prompt is built inline in `buildCheckerMessages`, so
   * nothing recorded which wording produced a verdict, and a measurement could
   * not be attributed to it afterwards. The primary has carried
   * `promptVersion` since the start; the checker was measured, trusted and
   * unversioned.
   *
   * `1.0.0` names the wording as it stands today, not a rewrite. Any change to
   * that text is a new version here, on the same rule as the primary's.
   */
  promptVersion: '1.0.0',
  promotion: {
    scientific: false,
    decisionId: 'owner-checker-family-2026-08-29',
    evidence: 'pending V4.5-121',
  },
  maxRetries: 0,
  requestProfile: {
    adapter: 'OPENROUTER_CHAT',
    reasoning: { budgetTokens: null, budgetMode: 'OFF', effort: 'OFF' },
    routeProviders: ['mistral/eu'],
    temperature: null,
    timeoutMs: 20_000,
    totalOutputTokenLimit: 400,
    version: '1.0.0',
    visibleOutputTokenTarget: 400,
  },
} as const;
