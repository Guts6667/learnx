# Backlog V4.5 — correction IA assistée et ouverture commerciale

## Autorité et état

- Version : 1.1.0
- Statut : **ouvert — GO V4.1-504 rendu le 29 août 2026 (`63c436d9`)**
- Owner de séquence : Produit
- Reviewer d'activation : Propriétaire
- Autorité : ce fichier est le backlog d'exécution V4.5. Les epics 001–012
  restent les périmètres ; les tickets exécutables `V4.5-1xx` (section
  « Tickets d'exécution ») en sont les livrables. Le statut opérationnel de
  chaque ticket vit dans Airtable (`docs/AIRTABLE_SYNC_LOG.md`, entrée du
  29 août 2026) ; la définition vit ici.
- Cadrage : rapport et plan Head of AI du 29 août 2026, validés par le
  Propriétaire ; contrat qualité `docs/V4_5_AI_QUALITY_CONTRACT.md` ; addendum
  `ADR_003` du 29 août 2026.
- Ordonnancement produit (décision du Propriétaire, 29 août 2026) : V4.2
  (design) puis V4.3 (pipeline programmes) sont séquencées avant V4.5. Les
  tickets V4.5 peuvent être préparés et exécutés en parallèle lorsqu'ils ne
  touchent pas les surfaces de V4.2/V4.3 ; leur release reste après.

> **Écart connu, traité par V4.5-110 et V4.5-111.** Les deux manques que
> V4.5-001 et V4.5-002 décrivent sont toujours littéralement présents dans le
> code livré : `detectsHardConstraintMismatch()` dans
> `src/server/corrections/correction-outcome.ts` ajoute seulement un signal de
> monitoring `HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED` au lieu d'imposer le
> niveau plancher du critère, et la garde de score dérive du score déclaré par
> le modèle avec une bande de ±5 points issue de `promoted-identity.ts`. Le
> pilote reste fermé par défaut derrière deux drapeaux indépendants, donc rien
> n'est exposé sans ouverture explicite.

## Objet

V4.5 commence après la clôture de V4.1. Elle combine une nouvelle version de
la correction IA assistée avec les évaluations textuelles d'étape et le cycle
commercial complet : calibration, essai public, packs, paiement,
remboursements et exploitation.

Les anciens tickets V4-011, V4-013 à V4-015, V4-018 et V4-018A restent des
références historiques. Ce document devient l'autorité d'exécution de leur
reprise ; aucune valeur de prix ou de pack n'est activée par sa seule création.

La recherche, les résultats et les décisions V4 restent append-only. Ils
informent le cadrage mais ne qualifient automatiquement ni un modèle, ni un
fournisseur, ni une famille, ni un tarif pour V4.5. Chaque nouvelle campagne
doit être préenregistrée, versionnée et relue sur des preuves fraîches.

## Registre des epics

| Epic | Owner | Reviewer | Tickets d'exécution | Statut |
| --- | --- | --- | --- | --- |
| V4.5-001 | Recherche IA | Produit / Pédagogie | V4.5-100, V4.5-101 | Ouvert |
| V4.5-002 | Architecture IA | Sécurité / Recherche IA | V4.5-110, V4.5-111, V4.5-131 | Ouvert |
| V4.5-003 | Recherche IA | Reviewer indépendant | V4.5-120, V4.5-121 | Ouvert après V4.5-100 |
| V4.5-004 | Recherche IA | Pédagogie / Produit | V4.5-113, V4.5-122 | Ouvert après V4.5-110 |
| V4.5-005 | Domaine / Pédagogie | Produit / Sécurité | V4.5-130 | Ouvert après V4.5-113 |
| V4.5-006 | Produit / Frontend | QA / Accessibilité | V4.5-130 | Ouvert après V4.5-113 |
| V4.5-007 | Finance & Pricing | Produit / Recherche IA | V4.5-164 | Bloqué — données pilote |
| V4.5-008 | Growth / Produit | Sécurité / Finance | V4.5-151, V4.5-163 | Ouvert après V4.5-140 |
| V4.5-009 | Commerce / Backend | Finance / Sécurité | V4.5-160, V4.5-161 | Ouvert (sandbox) ; packs réels sur GO V4.5-012 |
| V4.5-010 | Finance / Support | Juridique / Sécurité | V4.5-162 | Ouvert (sandbox) ; décisions juridiques Rayan |
| V4.5-011 | Exploitation | Recherche IA / Finance | V4.5-112, V4.5-140, V4.5-141 | Ouvert après V4.5-110 |
| V4.5-012 | Release engineering | Propriétaire | V4.5-132, V4.5-150, V4.5-151 | Bloqué — tous les tickets |

Un changement de statut exige une preuve liée et le verdict du reviewer.
L'ouverture d'un epic n'active pas une campagne payante, un essai public ou un
paiement réel : chaque dépense fournisseur, chaque prix et chaque pack exigent
leur autorisation propre, consignée dans Airtable (`Arbitrage Rayan`).

### Décisions de cadrage du 29 août 2026

1. Aucun humain dans la boucle de correction et aucun étalon rédigé par un
   humain : la qualité est mesurée par des oracles machine (mutation,
   stabilité, cross-modèle, sécurité), des signaux apprenants et un
   coupe-circuit automatique. Aucune validation humaine n'est revendiquée.
2. Le pipeline critériel épinglé (`promoted-identity.ts`) est le runtime
   actif ; evidence-assist 3.0 est historique. La seconde passe même-modèle
   est remplacée par un vérificateur indépendant et un niveau de confiance par
   critère (`HIGH | MEDIUM | LOW`).
3. Les corpus scellés deviennent un pool de régression réutilisable
   (`oracleKind: MODEL_AUTHORED`) ; aucun corpus n'est plus « consommé ».
4. Un résultat inutilisable libère la réservation (ADR_003 §6.2 réaffirmé).
5. L'achat de crédits fait partie de V4.5 : le lot commerce est construit en
   parallèle sur sandbox ; packs et prix réels seulement après V4.5-164 et le
   GO V4.5-012.

## P0 — nouvelle correction IA assistée

### V4.5-001 — Contrat qualité de nouvelle génération

- Versionner les critères, preuves, contraintes dures, abstentions et règles de
  livraison partielle.
- Séparer résultats scientifiques, arbitrages produit et promesses publiques.
- Ne jamais faire dépendre progression ou maîtrise d'un verdict IA seul.

### V4.5-002 — Pipeline assisté et garde indépendante

- Comparer primaire seul, vérification ciblée et autres architectures
  préenregistrées.
- Utiliser des signaux indépendants du score déclaré par le modèle.
- Aucun changement automatique de modèle, seuil ou fournisseur.

### V4.5-003 — Benchmark frais et workflow challenger

- Corpus et examen frais, identités scellées, coûts réconciliés et gates adaptés
  à la taille réelle des échantillons.
- Évaluer sécurité, faux résultats favorables, stabilité, couverture,
  abstention, qualité pédagogique et coût P50/P75/P90.
- Publier chaque décision comme un nouvel article sans réécrire l'historique.

### V4.5-004 — Qualification des quatre familles

- Tester séparément `writing`, `reflection`, `practice` et `project`.
- Ne pas extrapoler la preuve Writing aux autres familles.
- Maintenir un scope runtime strict par contrat, langue et classe de taille.

## P0 — évaluations textuelles d'étape

### V4.5-005 — Autorité de validation et progression

- Définir la relation entre remise, feedback formatif et preuve de maîtrise.
- Conserver un gate déterministe lorsque la maîtrise doit modifier la
  progression.
- Ne pas simuler de validation humaine absente.

### V4.5-006 — Expérience d'évaluation et historique

- Intégrer devis, soumission, correction, incertitude, nouvelle tentative et
  historique sans écraser les résultats précédents.
- Couvrir recours, indisponibilité et absence d'effet sur la progression lorsque
  l'autorité déterministe manque.

## P0 — calibration et commerce

### V4.5-007 — Calibration économique

- Mesurer coûts réels et incidents par famille et classe de taille.
- Fixer parité, P90, réserve, prix minimal et marge de contribution disponible.
- Ne dépendre ni d'une promotion fournisseur ni de l'inactivité utilisateur.

### V4.5-008 — Essai public et cohortes

- Séparer essai public, famille/amis, early adopters et crédits achetés.
- Définir limites, anti-abus, métriques d'acquisition et coupe-circuit.
- Une sortie inutilisable ne consomme pas l'essai.

### V4.5-009 — Packs, checkout et webhooks

- Publier uniquement les packs explicitement validés.
- Attribuer les crédits exclusivement après webhook vérifié et idempotent.
- Conserver la séparation des lots achetés et offerts.

### V4.5-010 — Remboursements, litiges et clôture

- Définir procédures, écritures compensatoires, réconciliation et audit.
- Ne jamais réécrire silencieusement le ledger.
- Valider les traitements juridiques, fiscaux et comptables applicables.

## P1 — exploitation et lancement

### V4.5-011 — Monitoring qualité, coût et marché

- Suivre dérive, incidents, abstentions, coûts, funnel essai→paiement et marge.
- Distinguer coût IA, CAC IA et CAC complet.
- Documenter seuils d'alerte, suspension et rollback.

### V4.5-012 — Gate de release V4.5

- Réconcilier achat → crédits → correction → règlement → remboursement/clôture.
- Valider sécurité, confidentialité, accessibilité, support et conditions
  commerciales sur les environnements ouverts.
- Exiger un GO explicite du Propriétaire avant prix, packs ou paiement réels.

## Tickets d'exécution (`V4.5-1xx`)

Conventions : un ticket = une branche `codex/v4-5-1xx` et idéalement un
commit ; owner et reviewer distincts parmi les huit rôles de
`docs/AGENT_WORKFLOW.md` ; aucun push, merge, appel fournisseur payant ou
donnée réelle sans autorisation explicite. Les critères ci-dessous sont
l'autorité de définition ; Airtable porte le statut.

### V4.5-100 — Re-baseline doctrine et contrat qualité V4.5

- Epic : V4.5-001 · Owner : Architecture/Produit (Head of AI) · Reviewer : Rayan
- Livrable : addendum ADR_003 du 29 août ; `docs/V4_5_AI_QUALITY_CONTRACT.md` ;
  ce backlog amendé ; `docs/V4_DOCUMENT_STATUS.md` et
  `docs/DOCUMENT_MANIFEST.yaml` mis à jour.
- Acceptation : `format:check` vert ; liens et identifiants valides ;
  `git diff --check` propre ; aucun artefact historique modifié ; GO Rayan.

### V4.5-101 — Doctrine argent : libération des crédits si résultat inutilisable

- Epic : V4.5-001/008 · Owner : Backend/Data · Reviewer : QA/Release · Deps : V4.5-100
- Livrable : `correction-orchestration.ts` appelle `credits.release` quand
  `correction.status === 'FAILED'` ; replay cohérent ; `COMPLETED_PARTIAL`
  reste débité au prix du devis ; copies FR/EN mises à jour.
- Acceptation : test « unavailable » attend `['reserve','release']` et
  `settledCredits '0'` ; replay d'un FAILED ne débite jamais ; reconstruction
  du ledger verte ; `test`, `lint`, `typecheck` verts.

### V4.5-110 — Label de confiance par critère (déterministe)

- Epic : V4.5-002 · Owner : Backend/Data · Reviewer : IA/Recherche · Deps : V4.5-100
- Livrable : `src/server/corrections/correction-confidence.ts` (fonction pure
  `deriveCriterionConfidence`) implémentant la table §2 du contrat qualité ;
  `confidence` par critère et `overallConfidence` exposés ; `indicativeScore`
  null si un critère est `LOW`.
- Acceptation : tests table-driven par règle ; snapshot API ; aucun coût ou
  token exposé ; couverture ≥ 90 % sur le fichier.

### V4.5-111 — Vérificateur indépendant remplaçant la seconde passe même-modèle

- Epic : V4.5-002 · Owner : Backend/Data · Reviewer : IA/Recherche · Deps : V4.5-110 ;
  arbitrage Rayan (seconde famille de modèle).
- Livrable : `checkerIdentity` épinglée dans `promoted-identity.ts`
  (famille **non Anthropic** pour réduire les biais corrélés — décision Rayan
  du 29 août 2026 : `mistralai/mistral-medium-3-5` via OpenRouter, route et
  tarif à réattester dans le ticket ; sans raisonnement, ≤ 400 tokens) ; prompt et schéma fermés oui/non par critère ; suppression de
  `executeGuardedPass` et de la garde ±5 ; config `LEARNX_AI_CORRECTION_CHECKER_*` ;
  préflight attestant les deux identités (`PROMOTED_CHECKER_IDENTITY`,
  `promotion.scientific = false`) ; transport factice `LEARNX_AI_TRANSPORT=fake`
  refusé au démarrage en production ; échec vérificateur (transport, timeout,
  schéma, clé inconnue) → `UNAVAILABLE`, jamais `AGREED`, `overallConfidence`
  plafonnée `MEDIUM`, signaux `CHECKER_UNAVAILABLE` / `CHECKER_DISAGREED`. Le
  vérificateur reçoit uniquement la ligne de rubrique, le niveau et les
  extraits cités — jamais la production complète ; route épinglée par
  étiquette d'endpoint `mistral/eu` (décision Rayan
  `owner-checker-residency-eu-2026-08-29`, ADR_003). Le vérificateur est facturé
  dans le plafond existant de seconde passe ; la sémantique tarifaire est
  V4.5-114.
- Acceptation : tests fake-provider accord/désaccord/indisponible ; préflight
  `READY` exige les deux identités et rapporte `transport` ; test « jamais la
  production complète » ; aucun appel payant dans les tests ; rollback = déploiement.

### V4.5-112 — Retour apprenant par critère

- Epic : V4.5-011 · Owner : Backend/Data · Reviewer : Frontend · Deps : V4.5-110
- Livrable : migration additive `ai_correction_criterion_feedback`
  (`WRONG | HELPFUL`, unique par utilisateur/correction/critère) ; route
  `POST /api/ai-corrections/:id/feedback` (capacité `ai.assessment.correct`,
  contrôle IDOR) ; deux boutons dans `AiCorrectionResult.tsx` ; i18n FR/EN.
- Acceptation : idempotent ; 404 hors propriétaire ; axe vert ; rehearsal de
  migration vert.

### V4.5-113 — Étiquetage des familles et honnêteté des copies

- Epic : V4.5-004 · Owner : Frontend · Reviewer : Architecture/Produit · Deps : V4.5-110
- Livrable : familles non validées → « Correction en phase de collecte —
  fiabilité non démontrée » ; critères `LOW` → « À vérifier » sans niveau ;
  champ `aiCorrectionValidationScope` côté API exercices.
- Acceptation : tests RTL par état ; baseline visuelle ; `i18n:check` vert.

### V4.5-114 — Sémantique tarifaire du vérificateur indépendant

- Epic : V4.5-007/009 · Owner : Backend/Data · Reviewer : Finance ·
  Deps : V4.5-111, V4.5-121 (mesure réelle du vérificateur)
- Livrable : nouvelle version du catalogue pricing ; plafond = P90 primaire +
  P90 vérificateur mesurés ; renommage `includesAutomaticSecondPass` →
  `includesIndependentCheck` (colonnes catalogue et devis) par migration
  additive ; note de rollback écrite avant l'atterrissage.
- Acceptation : devis existants relisibles ; reconstruction du ledger verte ;
  test prouvant qu'un devis ancien et un devis nouveau se règlent chacun selon
  leur propre formule ; `quality:v4.1:final` vert.

### V4.5-115 — Attestation du profil de requête runtime (route, `only`, `data_collection`)

- Epic : V4.5-002/003 · Owner : Head of AI · Reviewer : Backend/Data ·
  Deps : aucune ; préalable à V4.5-121. Autorisation Rayan : sonde
  authentifiée ≤ 0,10 USD.
- Constat (Head of Development, 29 août) : l'adaptateur runtime n'envoie ni
  `only` ni `data_collection: deny` ; `order: ['Anthropic']` est un nom
  d'affichage, pas le slug documenté.
- Livrable : (1) sonde authentifiée `order: ['Anthropic']` vs `['anthropic']`
  comparant les métadonnées fournisseur retournées, artefact append-only ;
  (2) décision d'ajouter `only` + `data_collection: 'deny'` au profil
  runtime primaire ; si oui, profil `2.1.0` dans `promoted-identity.ts`,
  attestation par le préflight (endpoint observé = épinglé), et V4.5-121
  s'exécute sous ce profil (re-promotion par la suite) ; (3) ADR_003 mis à
  jour avec le résultat.
- Acceptation : artefact de sonde committé avec coût réconcilié ; test
  d'adaptateur figeant le corps de requête ; aucune modification du prompt.

### V4.5-116 — Transport factice réellement câblé (défaut de 111)

- Epic : V4.5-002/012 · Owner : Backend/Data · Reviewer : Architecture/Produit ·
  Statut : livré le 29 août (`995ed402`).
- Défaut : `LEARNX_AI_TRANSPORT=fake` faisait rapporter `transport: FAKE` au
  préflight alors que l'orchestration construisait toujours le transport
  OpenRouter réel. Aucun environnement ne définissait la variable.
- Livré : `selectCorrectionTransport()` renvoie mode et transport ensemble ;
  l'orchestration et le préflight consomment le même objet ; tests : FAKE
  n'atteint jamais `fetch`, le préflight rapporte le transport construit, refus
  en production exercé via la racine de composition.

### V4.5-117 — Clé stable des évaluations d'étape (rattachement des contrats)

- Epic : V4.5-005/006 · Owner : Backend/Data · Reviewer : Architecture/Produit ·
  Deps : V4.5-130, V4.5-112 (API), V4.5-140. Préalable à l'activation de
  `STAGE_ASSESSMENT` dans le pin (décision Rayan, ticket ultérieur).
- Constat (130) : `StageAssessment` n'a ni `key` ni contrat v3 ; rien ne
  rattache un contrat à une évaluation précise ; aucun archétype n'est
  synthétisé pour cette surface (décision du 29 août).
- Livrable : colonne `key` symétrique à `Exercise` (migration additive + note
  de rollback), backfill déterministe slug d'étape + position,
  `@@unique([stageId, key])` ; règle de rattachement
  `CONTRACT_BINDING_UNAVAILABLE` → comparaison de clé ; convention d'authoring
  documentée.
- Acceptation : migration rejouable en preview ; contrat rattaché à une autre
  évaluation refusé, à la bonne clé accepté ; test zéro-écriture de 130
  toujours vert ; aucune activation du pin.

### V4.5-120 — Suite de régression décidable par la machine

- Epic : V4.5-003 · Owner : IA/Recherche · Reviewer : Architecture/Produit ·
  Deps : V4.5-100, V4.5-111
- Spécification : `docs/V4_5_REGRESSION_SUITE.md`.
- Livrable : `benchmarks/ai-correction/regression/regression-pool.v1.json`
  (tous corpus historiques, `oracleKind: MODEL_AUTHORED`) ; générateur de
  mutants déterministe ; métriques `mutationDirectionViolations`,
  `unrelatedCriterionDrift`, `repetitionTwoStepFlips`, `checkerAgreementAtHigh`,
  `lowShare` ; politique de gate v3 (§5 du contrat) ; rapport markdown ;
  `docs/V4_5_REGRESSION_SUITE.md`.
- Acceptation : tests hors ligne pour chaque mutant et métrique ;
  `ai:benchmark:validate` vert ; **aucun appel payant**.

### V4.5-121 — Première exécution payante de la suite

- Epic : V4.5-003 · Owner : IA/Recherche · Reviewer : Rayan · Deps : V4.5-120 ;
  budget autorisé le 29 août 2026 : **≤ 3 USD** (pool réduit : 1 répétition
  sur le pool complet + 3 répétitions sur un sous-ensemble de 24 cas + mutants).
- Livrable : un run complet, coût réconcilié, résultats append-only sous
  `benchmarks/ai-correction/regression/results/`, entrée FR/EN du journal
  public.
- Budget (29 août 2026) : plafond final **13 USD** (`owner-121-budget-2026-08-29`),
  borne prudente 12,51 USD (convention : un token par unité UTF-16 +
  enveloppe, appliquée aux deux moitiés), dépense réelle réconciliée au
  rapport ; ordre de coupe : paraphrases, puis répétitions 3→2, jamais la
  passe complète, les mutants ni la sécurité. Article public FR/EN dans la
  même PR que les résultats (`owner-research-article-2026-08-29`).
- Résultat (29 août 2026, run partielle arrêtée par le Propriétaire à 49
  cellules) : inutilisables 3/49 = 6,1 % (> gate 3 %, > coupe-circuit 5 %) —
  « échec de transport, pas de qualité », politique `maxRetries: 0` ; accord
  étalon 126/138 = 91,3 % ; coût par correction P50 0,019 / P90 0,023 USD ;
  oracles mutation/stabilité/vérificateur `NOT_MEASURED` ; dépense de la nuit
  ≈ 2,61 USD dont ≈ 1 non enregistré et 0,64 en doublon. Journal §8.18.
  Promotion : V4.5-125.
- Acceptation : gates sécurité verts ; gates calibration rapportés sans
  retuning ; page publique via les tests journal existants.

### V4.5-122 — Cas de domaine issus des archétypes réels

- Epic : V4.5-004 · Owner : IA/Recherche · Reviewer : Architecture/Produit · Deps : V4.5-120
- Livrable : 20–30 cas compilés depuis `exercise-correction-contracts.ts` et
  `content/*`, réponses écrites par modèle, `mutationHints` par cas.
- Acceptation : `ai:benchmark:validate` vert ; aucune donnée personnelle ;
  aucun appel payant.

### V4.5-130 — Évaluations d'étape textuelles : feedback IA consultatif

- Epic : V4.5-005/006 · Owner : Backend/Data · Reviewer : Architecture/Produit ·
  Deps : V4.5-110, V4.5-113
- Livrable : `targetKindScope` + `STAGE_ASSESSMENT` ; chargement des remises
  d'étape ; même panneau, copie consultative ; historique non destructif.
- Acceptation : test prouvant zéro écriture dans les tables de progression ;
  tests IDOR ; e2e étendu.

### V4.5-131 — Suppression de la seconde passe par confiance et de la pile IA legacy

- Epic : V4.5-002 · Owner : Backend/Data · Reviewer : QA/Release · Deps : V4.5-111
- Livrable : suppression de `src/server/ai/openrouter-provider.ts`,
  `persistent-correction.ts`, `prisma-correction-repository.ts`,
  `fake-structured-provider.ts` et tests ; retrait des champs `secondPass` et
  de `deriveCorrectionSecondPassDecision`.
- Acceptation : knip vert ; couverture des domaines critiques ≥ 90 %.

### V4.5-132 — Sortir l'outillage benchmark de `src/lib`

- Epic : V4.5-012 · Owner : QA/Release · Reviewer : Architecture/Produit · Deps : V4.5-120
- Livrable : `src/lib/ai-correction-benchmark-*` → `benchmarks/tooling/` ;
  gates couverture/bundle ajustés avec justification ; scripts fonctionnels.
- Acceptation : `quality:v4.1:final` vert ; `ai:benchmark:validate` vert.

### V4.5-140 — Monitoring v2, rapport hebdomadaire et coupe-circuit

- Epic : V4.5-011 · Owner : Backend/Data · Reviewer : IA/Recherche ·
  Deps : V4.5-110, V4.5-111, V4.5-112
- Livrable : métriques §6 du contrat ; `scripts/ai-weekly-report.ts` ;
  coupe-circuit sur fenêtre glissante de 50 → état kill switch en base
  (`ai_runtime_state`, lu par `isPromotedCorrectionConfiguration`) + e-mail
  owner ; réouverture manuelle auditée.
- Acceptation : tests unitaires du coupe-circuit ; page admin avec état et
  motif.
- Décisions Head of AI du 29 août 2026 (`head-of-ai-breaker-2026-08-29`,
  contrat §6) : le coupe-circuit **latche** (réouverture manuelle auditée,
  aucune récupération automatique) ; il **refuse au devis** et laisse courir
  les corrections déjà devisées ; s'il ne peut pas évaluer, il **reste fermé**
  et expose `breaker.evaluationError` (garde-fou visiblement aveugle, jamais
  vert) ; trois raisons : `CHECKER_DISAGREEMENT` (> 40 %), `UNUSABLE_RATE`
  (> 5 %), `LEARNER_CONTRADICTION_AT_HIGH` (> 10 %, quorum de 20 critères
  `HIGH` votés) ; seuils et taux **par raison**, taux `null` sous quorum
  (« pas assez de données », jamais 0 %). Forme de lecture :
  `GET /api/admin/ai-corrections/monitoring`, capacité `credit.admin.manage`.

### V4.5-141 — Échantillonnage de cohérence sur soumissions réelles

- Epic : V4.5-011 · Owner : IA/Recherche · Reviewer : Backend/Data ·
  Deps : V4.5-120, V4.5-140 ; décision Rayan du 29 août 2026 : ré-analyse
  anonymisée autorisée, **plafond 2 USD/semaine** (arrêt automatique au
  plafond), ligne de consentement ajoutée.
- Livrable : job ≤ 10 %/semaine, anonymisé, `cost_source: ABSORBED_QA`,
  régressions ajoutées au pool en `LIVE_DERIVED`.
- Acceptation : test « aucune PII » ; plafond de coût par run via env.

### V4.5-150 — Parcours Playwright de la correction

- Epic : V4.5-012 · Owner : QA/Release · Reviewer : Frontend · Deps : V4.5-101, V4.5-113
- Livrable : `tests/e2e/ai-correction.spec.ts` avec le fake provider (devis →
  consentement → résultat → partiel → `LOW` → vote → réexamen → historique),
  intégré au workflow Integration.
- Acceptation : vert sur desktop et mobile Chromium.

### V4.5-151 — Exécution de la checklist de rollout production

- Epic : V4.5-008/012 · Owner : QA/Release · Reviewer : Rayan · Deps : V4.5-101,
  110, 111, 113, 140, 150, 121 verts ; deux GO Rayan distincts.
- Livrable : les neuf cases restantes de `docs/V4_ROLLOUT_CHECKLIST.md` sur
  preview puis production ; smoke borné avec clé réelle sur compte allow-listé.
- Latence du garde-fou : tant que 173 n'a pas planifié `evaluate()`, un
  déclenchement n'a lieu qu'au prochain devis — un trip peut sembler arriver
  des heures après le franchissement ; à vérifier et à documenter.
- Environnement Preview (30 août) : le `DATABASE_URL` Preview (3 août) visait une
  branche Neon disparue/en retard ⇒ 500 sur toute requête base des previews ;
  correctif : branche Neon `preview` **vide** (jamais un clone de production :
  registre RGPD §3), `migrate deploy`, seed compte de test + pack placeholder
  (`pnpm seed:preview`), `DIRECT_URL` posée ; `preview` ≠ `staging` (177).
- Rollback : V4.4→V4.5 reste **code seul** — trois migrations additives
  (112, 140, 142), aucune n'altère un objet existant ; la checklist le
  vérifie à chaque migration ajoutée.
- Acceptation : preuves (coût, request IDs) dans `docs/qa/V4_5_151_ROLLOUT.md`.

### V4.5-160 — ADR Revolut Merchant et intégration sandbox

- Epic : V4.5-009 (ex V4-013) · Owner : Backend/Data · Reviewer : Architecture/Produit · Deps : V4.5-100
- Livrable : `ADR_004_PAYMENT_HOSTED_CHECKOUT.md` (livré sous le nom
  `ADR_004_PAYMENT_REVOLUT.md`, renommé au passage à Stripe, V4.5-184) ; adaptateur
  `src/server/payments/revolut-*.ts` derrière une interface ;
  `LEARNX_PAYMENTS_ENABLED=false` par défaut + kill switch ; tables
  `payment_order`, `payment_event` (migration additive, états ADR_003 §6.3).
- Livré le 29 août 2026 (inerte) avec la route webhook et deux corrections :
  `PAID` est le dernier mot du fournisseur — l'attribution du lot `PURCHASED`
  et le passage à `FULFILLED` sont un seul acte transactionnel chez LearnX
  (`ORDER_FULFILLED` toléré comme no-op) ; kill switch paiement indépendant du
  coupe-circuit correction (les crédits achetés gardent leur valeur ; le
  checkout affiche la suspension, ne refuse pas). Passe sandbox réelle en
  attente du fournisseur choisi par le Propriétaire (Stripe ou Revolut ;
  adaptateur derrière interface, ADR_004 amendé plutôt que remplacé).
- Acceptation : tests de signature (valide, altéré, rejoué, désordonné) ;
  aucun secret dans bundle/logs ; sandbox consigné dans
  `docs/qa/V4_5_160_SANDBOX.md` ; aucune clé live.

### V4.5-161 — Catalogue de packs et attribution des crédits achetés

- Epic : V4.5-009 (ex V4-014) · Owner : Backend/Data · Reviewer : Finance · Deps : V4.5-160
- Livrable : catalogue `credit_pack` versionné, packs placeholder
  `active=false` ; `POST /api/credits/checkout` ; webhook `PAID` → écriture
  ledger provenance `PURCHASED` idempotente ; page de retour informative.
- Acceptation : double webhook = une attribution ; événements
  remboursement/litige persistés ; reconstruction du ledger ; aucun pack actif
  sans GO Rayan.

### V4.5-162 — Remboursements, litiges et clôture de compte

- Epic : V4.5-010 (ex V4-015) · Owner : Backend/Data · Reviewer : Finance · Deps : V4.5-161
- Livrable : écriture compensatoire admin auditée ; remboursement Revolut
  sandbox ; états WON/LOST ; règle de clôture sans suppression du ledger ;
  `docs/V4_5_REFUNDS_PROCEDURE.md` listant les décisions juridiques/fiscales
  du Propriétaire.
- Décisions du 29 août 2026 : remboursement volontaire **au prorata** des
  crédits non consommés (`owner-refund-policy-2026-08-29`, arrondi au centime
  écrit dans l'ADR) ; contestation bancaire : montant de la banque, écart
  `writtenOffCredits` sur la commande, jamais dans le ledger ; type
  d'écriture `REFUND` ; ouverture de litige sans effet, seul le résultat
  agit ; écriture compensatoire même contre un compte pseudonymisé.
- Acceptation : tests de chaque transition ; UI admin.

### V4.5-163 — Essai public, cohortes et anti-abus

- Epic : V4.5-008 (ex V4-018A) · Owner : Backend/Data · Reviewer : QA/Release ·
  Deps : V4.5-101, V4.5-140
- Livrable : cohortes `TRIAL | FRIENDS_FAMILY | EARLY_ADOPTER | PURCHASED` ;
  allocation d'essai bornée avec limites compte/IP/vélocité ; intégration
  coupe-circuit ; funnel essai→achat dans le rapport hebdomadaire.
- Acceptation : tests d'abus ; limites par env ; aucun effet sur la progression.

### V4.5-164 — Calibration économique et proposition tarifaire

- Epic : V4.5-007 (ex V4-018) · Owner : Finance (préparé par le Head of AI) ·
  Reviewer : Rayan · Deps : V4.5-121 + deux semaines de données pilote
- Livrable : `docs/V4_5_PRICING_CALIBRATION.md` (coûts P50/P75/P90 par famille
  et classe de taille, parité, réserve, prix plancher, marge, packs
  proposés) ; aucune valeur activée.
- Acceptation : chiffres reproductibles depuis les exports ; GO Rayan avant
  tout prix réel.

### Répartition par voie (29 août 2026, décision Propriétaire : V4.3 reportée)

Une voie = un répertoire, une session, un ticket `IN_PROGRESS` à la fois, un
worktree dédié basé sur `origin/dev`. Un fichier appartient à une seule voie à
la fois ; les migrations Prisma atterrissent en série (A puis B).

| Voie | Session | Fichiers possédés | Tickets dans l'ordre |
| --- | --- | --- | --- |
| A — backend IA | Head of Development | `src/server/corrections/**`, `src/server/ai/**`, `src/server/api/corrections/**`, `src/server/api/exercises/eligibility.ts`, `src/lib/*-correction-contracts.ts`, migrations associées | 101 → 110 → 111 → 116 → 131 → 130 → 112 (API + migration) → 140 (backend + coupe-circuit) → 117 → 114 (après 121) |
| B — backend commerce | Head of Development après la voie A (ou session dédiée) | `src/server/payments/**`, `src/server/credits/**`, `src/server/pricing/**`, `src/server/api/credits/**`, migrations associées | 160 → 161 → 163 → 162 ; démarre après le merge de 101 |
| C — frontend | Head of UX/UI | `src/features/exercises/**`, `src/pages/**` (dont `ProgramsDirectoryPages.tsx`, `AdminCreditsPage.tsx`, `Credits*`), `src/styles/**`, `src/components/**`, `src/i18n/catalogs/**` (baseline régénérée par le script, jamais fusionnée à la main), `tests/e2e/**`, `tests/visual/**` | 113 → 112 (UI) → 150 → UX-001 → UX-002 → UX-003 → 140 (UI admin) → 162 (UI admin) |
| D — exploitation | DevOps (learnx-e0) | `.github/**`, `scripts/**` hors runner benchmark, `vercel.json`, scripts `package.json`, `quality/*.json`, `docs/TESTING_AND_RELEASE.md`, `docs/HANDOFF.md`, réglages Vercel/Neon/GitHub ; côté `src/` uniquement `src/server/api/app.ts` et `src/server/api/health/**` (172) et `src/server/api/public-leads/**` (178), avec leurs tests | 174 → 170 → 171 → 177 → 179 → 176 → 178 → 172 → 173 → 175 → 151 → 132 (après 120–122) |
| E — recherche IA | session « AI Research » (à ouvrir) | `src/lib/ai-correction-benchmark-*`, `benchmarks/**`, `scripts/run-ai-correction-benchmark.ts`, `docs/V4_5_REGRESSION_SUITE.md`, `public/research/**` | 120 → 122 → 121 → 141 |
| F — direction IA | Head of AI | docs, ADR, backlog, Airtable, revues, `promoted-identity.ts` pour 115 seulement (coordonné avec A) | spec 120, 115, 165, 164, revue des voies A et E |

Règle produit (29 août, 112/113) : une surface conditionnée par un champ serveur est masquée tant que le champ est absent, jamais affichée désactivée sans raison.

Points de contact inter-voies : `prisma/migrations` (A-112 puis B-160, B-161) ;
`src/server/credits` (A-101 puis B) ; `AdminCreditsPage.tsx` (C seulement) ;
`src/lib/ai-correction-benchmark-*` (E jusqu'au merge de 122, puis D-132) ;
`promoted-identity.ts` (A seulement) ; `src/server/api/app.ts` (D pour 172, prévenir A avant push) ; `docs/INDEX.md`, ce backlog et le
journal Airtable (append-only, point de merge F).

### V4.5-165 — Audit RGPD, registre des traitements et rétention IA/paiement

- Epic : V4.5-010/012 · Owner : Architecture/Produit (Head of AI) · Reviewer : Rayan ·
  Deps : V4.5-111 (destinataire Mistral), V4.5-160 (Revolut). Bloque la partie
  rétention/consentement de V4.5-151 et la partie paiement de V4.5-161.
- Livrable : `docs/V4_5_RGPD_AUDIT.md` — registre des traitements et
  sous-traitants (OpenRouter, Anthropic, Mistral via endpoint `mistral/eu`,
  Revolut, Resend, Vercel, Neon) ; rétention effective attestée et affichée (ADR_003 §7.2) ; textes
  d'information et ligne de consentement (141) ; droits d'accès/suppression
  cohérents avec le ledger append-only ; décisions nécessitant un conseil
  externe listées pour le Propriétaire.
- Acceptation : registre daté et complet ; rétention attestée par fournisseur
  avec source ; textes FR/EN livrés aux tickets 113/141 ; GO Rayan consigné.
- Origine : carte Airtable « Faire un audit RGPD » (Archive V4) convertie le
  29 août 2026.

### Tickets ajoutés en cours de V4.5 (définitions courtes)

Créés dans Airtable entre le 29 août 2026 et aujourd'hui ; consignés ici pour
que Git reste l'autorité de définition. Détail dans `docs/AIRTABLE_SYNC_LOG.md`.

| Ticket | Voie | Owner → Reviewer | Objet | Deps |
| --- | --- | --- | --- | --- |
| V4.5-118 | A | Backend/Data → IA/Recherche | Table de confiance déplacée en `src/lib/ai-correction-confidence.ts` (module pur, importable par le runner) | préalable à 121 |
| V4.5-170 | D | DevOps → Backend/Data | Migrations Prisma hors des builds preview ; preview sur sa propre branche Neon | — |
| V4.5-171 | D | DevOps → QA/Release | Nettoyage des branches Neon `ci-*` ; Integration fiable (422 quota) | — |
| V4.5-172 | D | DevOps → Backend/Data | `/api/health`, stack dans `onError`, suivi d'incidents | — |
| V4.5-173 | D | DevOps → QA/Release | Smoke post-déploiement et purge de rétention planifiés ; **appel planifié de `evaluate()` du coupe-circuit et de `pnpm ai:cost-audit` (quotidien)** — tant qu'il n'existe pas, la latence du garde-fou est « le prochain apprenant » | 172, 142 |
| V4.5-174 | D | DevOps → Propriétaire | Modèle de branches et protection de `dev` (check requis `V4.1 final (required)`) | — |
| V4.5-175 | D | DevOps → QA/Release | Dependabot, `.nvmrc`, suppression des branches mergées | — |
| V4.5-176 | D | DevOps → Backend/Data | Restauration Neon documentée, SHA de rollback tenu à jour | 171 |
| V4.5-177 | D | DevOps → Backend/Data | Palier `staging` : branche protégée, environnement Vercel, base Neon dédiée (décision Rayan dev → staging → main) | 174 |
| V4.5-178 | D | DevOps → Sécurité | `LEARNX_PUBLIC_LEADS_ENABLED` fermé par défaut, défini par environnement | — |
| V4.5-179 | D | DevOps → QA/Release | Playwright : port dérivé du worktree ou `reuseExistingServer: false` (un serveur dev d'un autre checkout capte les tests) | — |
| V4.5-119 | A | Backend/Data → IA/Recherche | Coût, latence et route du vérificateur réellement enregistrés (tentative `CORRECTION_CHECKER`, identité explicite, mapper sans défaut vers le correcteur) — défaut de 111 signalé par le Head of Development | préalable à 114 |
| V4.5-143 | A | Backend/Data → Frontend | `GET /api/admin/ai-corrections/breaker/events` (journal, auteur, `alertedAt`/`alertError`) et `breaker.trippedRates` figés au déclenchement quand l'état est OPEN | 142 |
| V4.5-166 | A | Backend/Data → Sécurité | Suppression de compte par anonymisation : e-mail/nom/sessions effacés, réponses conservées sous pseudonyme, ledger intact (décision `owner-rgpd-2026-08-29`) | 163 ; bloque 151 |
| V4.5-167 | C | Frontend → Head of AI | Page `/confidentialite` + `/privacy` depuis `docs/V4_5_PRIVACY_POLICY.md`, lien pied de page et notice IA, clé `aiCorrection.dataNotice` | 165, 166 ; bloque 151 |
| V4.5-168 | A+C | Backend/Data → Head of AI | Détachement des corrections à 180 jours (pseudonyme, aucune suppression) et ligne d'information « réutilisation pour améliorer le système » | 166, 173 |
| V4.5-142 | A | Backend/Data → IA/Recherche | Alerte owner du coupe-circuit (e-mail Resend, livraison journalisée `alertedAt`/`alertError`, jamais de texte apprenant), audit des coûts inconnus sur 24 h (`pnpm ai:cost-audit`, PROCESSING < 60 min exclus, au-delà `STUCK_PROCESSING`), rapport hebdomadaire (`pnpm ai:weekly-report`, lecture seule). Réconciliation = rapport seul (aucune écriture ; `CONSERVATIVE_WRITE_OFF` reste dormant). Planification par 173. | 140 ; bloque 151 |
| V4.5-144 | A | Backend/Data → DevOps | Gardes `pg_type`/`pg_constraint` des migrations 112 et 140 qualifiées par schéma (Integration rouge : replay dans un schéma isolé) — livré, Integration verte sur `97a614b3` | — |
| V4.5-145 | D | DevOps → Backend/Data | Integration : prouver l'égalité schéma rejoué / schéma migré (un replay qui sort 0 ne prouve rien) | 144 |
| V4.5-146 | D | DevOps → Backend/Data | Domaines critiques : couvrir `account-erasure-service` et `account-administration-service` | 166 |
| V4.5-147 | A | Backend/Data → Sécurité | Empreintes IP en HMAC sous `LEARNX_BUCKET_HMAC_SECRET` (SHA-256 non salé = réversible) ; refus en production, previews compris — livré `87f6d020` | précède la publication de 167 |
| V4.5-169 | C | Frontend → Head of AI | Page confidentialité finale : texte 1.3.0 (identité éditeur confirmée `owner-editor-identity-2026-08-29`), `<strong>` d'insistance, captures | 167 |
| V4.5-180 | D | DevOps → Frontend | Gate visuel : plancher absolu `maxDiffPixels` en plus du ratio (un lien entier passe sous 0,05 % d'une page longue) | — |
| V4.5-163C | A | Backend/Data → IA/Recherche | Déclencheurs de l'attribution d'essai : première période à l'activation (après commit, jamais bloquante), passe quotidienne idempotente `pnpm trial:grant-cycle` (hébergée par 173) — omission nommée, pas décision | 163 |
| V4.5-181 | C | Frontend → Head of AI | Page confidentialité générée au build (supprimer le couplage document ↔ module surveillé par test) | après le pilote |
| V4.5-182 | C | Frontend → Backend/Data | Validation à la frontière client (`zod/mini`, +4,8 Ko, budget intact) ; forme inconnue ⇒ état d'erreur, jamais un rendu partiel — livré `83cb5e77` | — |
| V4.5-183 | C | Frontend → DevOps | Instruire l'écart de bundle (252 Ko / seuil diagnostic 150 Ko) : rapport chiffré, proposition, aucun changement de seuil | 182 |
| V4.5-184 | B | Backend/Data → Architecture/Produit | Stripe : ADR_004 amendé sur place, adaptateur Stripe derrière l'interface (`LEARNX_PAYMENTS_PROVIDER`, défaut `stripe`), passe test-mode réelle ; décision `owner-payment-provider-stripe-2026-08-29` | 162 |
| V4.5-123 | E | IA/Recherche → Head of AI | Verrou de run, enveloppe `--envelope-usd` mesurée sur le delta d'usage fournisseur (non mesurable ⇒ rien n'est autorisé), verdicts vérificateur persistés par correction, journal unique — livré `5cf38e28` | 121 |
| V4.5-124 | A | Backend/Data → IA/Recherche | Identité promue : profil 2.2.0, `maxRetries: 1` sur réponse inutilisable seulement (jamais sur erreur fournisseur ambiguë) ; livraison partielle non rejouée ; décision `owner-retry-policy-2026-08-29` — livré `67ff25b8`, aucune campagne ne l'a encore mesuré | 121 |
| V4.5-125 | E | IA/Recherche → Rayan | Run de régression sur l'identité 2.2.0 = preuve de promotion ; borne reduced ≈ 23 USD (primaire ×2 au pire cas + vérificateur 2,01), réel attendu 6–8 ; article public avec cette run | 123, 124, budget Rayan |
| — | — | — | Résultat 125 (30 août, 200 cellules, 4,69 USD réel / borne 13,98) : inutilisables 4/176 = 2,27 % ✅ (6,12 % avant 124) ; injection 0/51 ✅ ; accord vérificateur HIGH 261/261 ✅ ; LOW 14,9 % ; étalon 83,9 % ; preuves inventées présentées 0/152 ✅ ; mutation 1/10 ❌ (n insayable, indice défectueux) ; stabilité NOT_MEASURED (127) → complément 24 cellules dans l'enveloppe | — |
| V4.5-185 | D | DevOps → Head of AI | Quota Vercel Hobby (100 builds/jour atteint le 29 août) : ne builder que dev/staging/main (`[preview]` opt-in), proposition Pro chiffrée | — |
| V4.5-186 | A | Backend/Data → DevOps | **INCIDENT PROD** : `/api/public-leads` (formulaire landing) répondait 401 — treize apps gardent `*`, publicLeads monté sous catalog depuis le 10 août : **le formulaire n'a jamais fonctionné en production**. Hotfix dev `eb8f42c9` (montage réordonné + test composé) ; hotfix main #108 écrit à la main (pas de cherry-pick : app.ts a divergé) | GO Rayan |
| V4.5-187 | A | Backend/Data → DevOps | Aucun garde wildcard : 13 apps restreintes à leurs préfixes ; test d'énumération sur 103 routes dans les deux sens + sonde en isolation (un voisin ne peut plus répondre à la place d'une app) ; décision : route inconnue ⇒ 404 | 186 |
| V4.5-188 | C | Frontend → QA/Release | Test instable App.test.tsx:687 (`lang` fr/en selon l'ordre) | — |
| V4.5-127 | E | IA/Recherche → Head of AI | Décalage de répétition (la passe rejouait la répétition 1), `--analyse`, gate preuves inventées branché (0/152 présentées, 12/152 brutes interceptées), coût vérificateur absent = ligne rapportée | 125 |
| V4.5-191 | C | Frontend → Backend/Data | Écran admin remboursements/litiges (UI de 162) : calcul serveur affiché avant confirmation en deux temps, montants en chaînes, jamais de montant saisi | 162B |
| V4.5-162B | A | Backend/Data → Frontend | Défaut : second remboursement écrase `refundedCredits`/`writtenOffCredits` à 0 (ledger juste, commande fausse) → 409 + update idempotent + test du second appel ; lectures `refund-preview` et commandes par membre | 162 |
| V4.5-192 | D+A | DevOps → Head of AI | **INCIDENT PROD** (30 août ~11:50 UTC, responsable : Head of AI) : commande de préparation du preview (`prisma db execute` DROP SCHEMA + `migrate deploy`) exécutée contre la production parce que `prisma.config.ts` lit `DIRECT_URL ?? DATABASE_URL` et que le `.env` du worktree pose `DIRECT_URL` = production ; restauration Neon PITR par Rayan (5 utilisateurs), site vérifié. Correctifs : wrapper `db:target --url` refusant `.env` et les hôtes protégés (A), post-mortem + procédure de restauration (D, 176) | — |
| UX-001 | C | Frontend → Design + QA/Release | Cartes de parcours responsives (densité arbitrée `Rayan A`) | — |
| UX-002 | C | Frontend → QA/Release | Fixture visuelle « contenu le plus long » (trois parcours, titres longs, progression non nulle) | UX-001 |
| UX-003 | C | Frontend → QA/Release | Pourcentage chiffré retiré de la carte (`ProgressBar` `labelHidden`, valeur en `aria-label` seulement) — défaut attrapé par UX-002 | UX-002 |

### Landing « Conversion Edition » (maquette Paper) — tickets V4.5-219 → 229

Objectif fixé par Rayan le 5 septembre 2026 : la nouvelle landing publique
(`/`) est livrée pour la release V4.5 et reproduit **précisément** la maquette
Paper. Source de vérité visuelle : fichier Paper « LearnX », page
**New Landing** (`https://app.paper.design/file/01M1C69P0MXA9639D60AEZSP8Y/2-2`),
artboards **« LearnX — Conversion Edition · Refined »** (1440) et
**« LearnX — Conversion Edition · Mobile · Aligned »** → calque
**« LearnX — Mobile Landing · Desktop-aligned »** (390 ; les deux autres calques
de cet artboard sont masqués et ne font pas foi).

Règles communes à tous les tickets de ce lot :

- **Valeurs lues dans Paper, jamais dans une capture** : `get_jsx`,
  `get_computed_styles`, `get_fill_image` sur le calque nommé dans le ticket.
  Le desktop est écrit en hex littéral, le mobile en tokens ; le code utilise
  les tokens (`--color-canvas #F4F4EE`, `--color-paper #FFFEFB`,
  `--color-ink #111A31`, `--color-muted #5E6576`, `--color-line #DCDDD5`,
  `--color-indigo #5557D9`, `--color-indigo-soft #E8E8FF`,
  `--color-coral #D97858`, `--color-mint #C9E7D7`, rayons 10/18/28 px).
- **Chiffres, noms de packs et palier recommandé viennent du catalogue**
  (`GET /api/public-catalogue`, V4.5-206/212/213 et PR #214). La maquette
  affiche 360 / 1 056 / 2 400 : ce sont des placeholders ; la grille arbitrée
  le 2 septembre est 300 / 1 056 / 2 000. Aucun prix ni crédit codé en dur.
- **Aucune sélection de pack avant la candidature** (arbitrage Rayan du
  2 septembre, idée reportée en V5) : aucun bouton, texte ou paramètre ne peut
  laisser croire qu'un choix est transmis avec la demande d'accès.
- **Bilingue** : le site est FR par défaut, EN au bascule. La maquette est en
  anglais seulement ; chaque section livre ses deux langues (ticket 220).
- **Une PR par ticket**, capture Paper et capture Playwright côte à côte
  (1440 et 390) dans la PR, écarts listés explicitement. Pas de `[deploy]`
  avant 229.
- **Voie** : Head of UX/UI (Frontend) pour 219–227 et 229, dans l'ordre ;
  Head of Development (Backend/Data) pour 228 seulement. Deux voies au plus.

Préalables : merger la PR #214 (grille, noms, `recommended`) avant 223 ;
fermer les PR #202, #204 et #205 (explorations du 31 août sur l'ancienne
promesse « Your path to knowledge », remplacées par la maquette Paper) —
décision D0 ci-dessous.

| Ticket | Voie | Owner → Reviewer | Objet | Deps |
| --- | --- | --- | --- | --- |
| V4.5-219 | C | Frontend → Design | Socle visuel : tokens Paper, Plus Jakarta Sans 800 et DM Sans 800 ajoutés à `public/fonts`, fonds décoratifs (disques coral/mint/indigo, débordement `overflow: clip`), rythme des sections (1440 : padding 80 px, sections 74–92 px ; 390 : padding 20 px), navigation (calque « Navigation ») et pied de page (calque « Footer ») desktop + mobile, suppression de la bande `landing-principles`, tablette 768 dérivée | — |
| V4.5-220 | C | Frontend → Rayan | Jeu de copie FR + EN de toute la page (tous les textes de la maquette traduits, y compris libellés de formulaire, états d'erreur et de succès), validé par Rayan avant intégration ; catalogue `src/i18n/catalogs/landing.ts` réécrit, clés mortes retirées | D2, D3, D4 |
| V4.5-221 | C | Frontend → QA/Release | Hero « Know what to learn next. » (calque « Hero · Momentum ») : eyebrow, H1 82 px / −4.8 px / 800 (48 px sur mobile), lead 21 px, CTA primaire → formulaire, CTA secondaire → `#product`, ligne de preuve, aperçu produit statique « Hello, Maya » (barre latérale, progression 7 sur 17 / 68 %, prochaine étape, notes 12 / tentatives 8, toast « Always saved ») ; mobile : calque « Hero » | 219, 220 |
| V4.5-222 | C | Frontend → QA/Release | Preuve produit « Open LearnX. Keep moving. » (calque « Product proof · Resume Learn Improve », fond ink) : trois étapes numérotées et trois cartes (programme « Lead a team project », leçon « Write a sprint goal » avec source Scrum Guide 2020, retour « Writing practice » relu) construites sur `LandingPreviews` avec le contenu réel déjà testé par `landing.spec.ts` ; mobile : calque « Product proof » (liste des étapes + carte combinée « Connected app moments ») | 219, 220 |
| V4.5-223 | C | Frontend → QA/Release | Tarifs « Choose your momentum. » (calque « Pricing · Early adopter ») : trois cartes depuis le catalogue, carte `recommended` en indigo avec badge « OUR PICK », chip « +20 % early-adopter bonus included » seulement si `bonusCredits > 0`, bandeau de bas de section, CTA de carte → formulaire **sans sélection** ; mobile : calque « Pricing » (cartes empilées, Journey en ink) ; réécrit `LandingPricing.tsx` et retire le commentaire « trois boutons égaux » de 213 | 219, 220, #214 amendée selon D2 |
| V4.5-224 | C | Frontend → QA/Release | Feuille de route (calque « Product roadmap ») : titre trois lignes, chronologie à trois jalons (Available ✓ / 02 Bounded pilot / 03 Next) dans une carte canvas, sans le lien « View the full roadmap → » (D3) ; mobile : calque « Roadmap » | 219, 220 |
| V4.5-225 | C | Frontend → QA/Release | Recherche & transparence « Trust deserves receipts. » (calque « Research & transparency », fond indigo-soft) : bouton ink « Explore our research » → `/research/ai-correction/…` (existant, bilingue), carte « Research library » avec une note réelle (D4), trois mini-cartes Sourced / Limits included / Dated ; mobile : calque « Research » | 219, 220 |
| V4.5-226 | C | Frontend → QA/Release | « Your next step » (calque « Momentum CTA ») : construite à l'identique (carte Journey, CTA « Apply with Journey selected → », note « Your selection is a preference, not a purchase »), mais **masquée en V4.5** derrière un interrupteur de code (D5) ; tests des deux états ; affichage prévu en V5 avec la sélection de pack ; mobile : calque « Momentum CTA » | 220, 223 |
| V4.5-227 | C | Frontend → Backend/Data | Formulaire d'accès anticipé (calque « Limited early access ») : panneau ink (bénéfices, « How it works » 01/02/03) + carte formulaire (prénom, e-mail, « What do you want to learn? », « What usually slows you down? » optionnel, case d'abonnement aux nouvelles **décochée**, bouton, encart « No account created. No payment taken. », mention légale) + bloc « Not ready to apply? » ; une soumission = candidature EARLY_ADOPTER (+ LAUNCH_UPDATES si la case est cochée) ; états chargement/erreur/succès de la maquette ; mobile : calque « Early access » (champ objectif en zone de texte) | 219, 220, 228 selon D6 |
| V4.5-228 | A | Backend/Data → Head of AI | Prospects : champs `firstName` et `friction` (migration additive `public_leads`), validation Zod, e-mails de confirmation qui utilisent le prénom, export/écran admin contacts, registre RGPD (V4.5-165) et politique de confidentialité mis à jour, purge alignée sur la rétention existante | D6 |
| V4.5-229 | C+D | QA/Release → DevOps | Recette de la landing : `landing.spec.ts` et `LandingPage.test.tsx` réécrits sur la nouvelle copie (H1 EN « Know what to learn next. »), a11y sans violation sérieuse (contraste des textes muted sur canvas, eyebrows 13 px), reduced-motion, PWA standalone inchangée, budget JS du trajet (189) tenu malgré les deux graisses ajoutées, baselines visuelles régénérées **sur Linux via `visual.yml` (update: true)** pour 1440/768/390, puis merge `[deploy]` sur preview et validation Rayan sur téléphone réel | 219 → 227 |

Arbitrages de Rayan du 5 septembre 2026 :

- **D0 — PR #202/#204/#205** : fermées sans merge le 5 septembre.
- **D1 — Bascule de langue et menu mobile** : bascule FR/EN à droite de la
  navigation desktop et dans le pied de page mobile ; pas de menu hamburger,
  les ancres vivent dans le pied de page ; le lien Confidentialité y reste.
- **D2 — Bonus « +20 % »** : Rayan répond « Journey + Deep Dive ». Lu comme :
  le bonus early adopter porte sur les paliers à 8 € **et** à 16 €, donc la
  grille devient **300 / 1 056 / 2 400** (celle de la maquette) et le
  rendement 100 / 132 / 150 crédits par euro. **Conséquences à confirmer avant
  223** : (1) cela remplace le point 1 de l'arbitrage du 2 septembre et la
  règle « le palier recommandé est aussi le meilleur taux » — Deep Dive rend
  désormais le plus par euro tandis que « OUR PICK » reste sur Journey ;
  (2) la PR #214 doit être amendée (graine 2 400, tests du rendement
  `[100, 132, 125]` et « palier recommandé au meilleur rendement », texte de
  PR) ; (3) la marge du palier à 16 € avec 2 400 crédits n'a pas été
  recalculée par Finance. Copie : hero « +20 % de crédits sur Journey et Deep
  Dive après acceptation », eyebrow tarifs « EARLY ADOPTER · +20 % CREDITS »
  conservée, chip « +20 % included » sur les deux cartes.
- **D3 — « View the full roadmap → »** : lien retiré en V4.5.
- **D4 — Note de recherche** : le dernier article réel de
  `public/research/ai-correction/articles`, vrai titre, vraie date, vrai
  nombre de sources.
- **D5 — Section « Your next step »** : tranché le 5 septembre après
  envoi des captures — la section est **conçue fidèlement à la maquette puis
  masquée** en V4.5 (interrupteur de code, aucun rendu dans le DOM public,
  exclue des baselines visuelles et de l'a11y de la page publiée) ; elle sera
  affichée en V5 avec la sélection de pack avant candidature. Aucune sélection
  n'est transmise en V4.5.
- **D6 — Champs du formulaire** : (b), prénom et frein stockés ; 228 activé.
- **D7 — Tablette 768** : composition mobile élargie jusqu'à 1023 px,
  desktop à partir de 1024 px.

Séquence : #214 → 219 ∥ 220 → 221 → 222 → 223 → 224 → 225 → 226 → 227 (228 en
parallèle si D6 = b) → 229. Une seule voie frontend, un ticket `IN_PROGRESS`
à la fois.

### Cartes closes le 29 août 2026 (nettoyage du tableau)

Remplacées par des tickets V4.5 : V4-011 (→ 130), V4-013 (→ 160), V4-014
(→ 161), V4-015 (→ 162), V4-018 (→ 164), V4-018A (→ 163), V4-016G (→ 160/161),
V4-017 (→ 163/165). Livrées et closes : V4-019-RELEASE, V4.1-504, V4.1-005.

### Séquence

100 → 101 ∥ 110 → 111 → (112 ∥ 113 ∥ 131) → 120 → 122 → 121 → 130 ∥ 140 →
141 → 132 ∥ 150 → 151 → pilote (quatre semaines, crédits offerts). Lot
commerce en parallèle dès la semaine 2 : 160 → 161 → 162 ∥ 163 ; 164 après
données pilote ; packs et prix réels seulement sur GO V4.5-012.

## Définition de terminé V4.5

- pipeline et limites publiées correspondent aux preuves ;
- évaluations textuelles n'accordent aucune maîtrise non démontrée ;
- coûts et réserves sont calibrés sur des mesures réelles ;
- essai, packs, paiement et remboursements sont réconciliables ;
- support, monitoring, rollback et conformité sont opérationnels ;
- rapport public et rapport technique sont datés et reproductibles.
