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
- Rollback : V4.4→V4.5 reste **code seul** — trois migrations additives
  (112, 140, 142), aucune n'altère un objet existant ; la checklist le
  vérifie à chaque migration ajoutée.
- Acceptation : preuves (coût, request IDs) dans `docs/qa/V4_5_151_ROLLOUT.md`.

### V4.5-160 — ADR Revolut Merchant et intégration sandbox

- Epic : V4.5-009 (ex V4-013) · Owner : Backend/Data · Reviewer : Architecture/Produit · Deps : V4.5-100
- Livrable : `ADR_004_PAYMENT_REVOLUT.md` ; adaptateur
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
| UX-001 | C | Frontend → Design + QA/Release | Cartes de parcours responsives (densité arbitrée `Rayan A`) | — |
| UX-002 | C | Frontend → QA/Release | Fixture visuelle « contenu le plus long » (trois parcours, titres longs, progression non nulle) | UX-001 |
| UX-003 | C | Frontend → QA/Release | Pourcentage chiffré retiré de la carte (`ProgressBar` `labelHidden`, valeur en `aria-label` seulement) — défaut attrapé par UX-002 | UX-002 |

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
