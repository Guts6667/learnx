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
  (`anthropic/claude-haiku-4.5`, route Anthropic, sans raisonnement, ≤ 400
  tokens) ; prompt et schéma fermés oui/non par critère ; suppression de
  `executeGuardedPass` et de la garde ±5 ; config `LEARNX_AI_CORRECTION_CHECKER_*` ;
  préflight et catalogue pricing mis à jour ; échec vérificateur →
  `overallConfidence` plafonnée `MEDIUM`, signal `CHECKER_UNAVAILABLE`.
- Acceptation : tests fake-provider accord/désaccord/indisponible ; préflight
  `READY` exige l'identité vérificateur ; devis couvre primaire + vérificateur
  P90 ; aucun appel payant dans les tests.

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

### V4.5-120 — Suite de régression décidable par la machine

- Epic : V4.5-003 · Owner : IA/Recherche · Reviewer : Architecture/Produit ·
  Deps : V4.5-100, V4.5-111
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
  autorisation budget (≤ 10 USD).
- Livrable : un run complet, coût réconcilié, résultats append-only sous
  `benchmarks/ai-correction/regression/results/`, entrée FR/EN du journal
  public.
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

### V4.5-141 — Échantillonnage de cohérence sur soumissions réelles

- Epic : V4.5-011 · Owner : IA/Recherche · Reviewer : Backend/Data ·
  Deps : V4.5-120, V4.5-140 ; décision Rayan (ré-analyse anonymisée + ligne
  de consentement).
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
- Acceptation : preuves (coût, request IDs) dans `docs/qa/V4_5_151_ROLLOUT.md`.

### V4.5-160 — ADR Revolut Merchant et intégration sandbox

- Epic : V4.5-009 (ex V4-013) · Owner : Backend/Data · Reviewer : Architecture/Produit · Deps : V4.5-100
- Livrable : `ADR_004_PAYMENT_REVOLUT.md` ; adaptateur
  `src/server/payments/revolut-*.ts` derrière une interface ;
  `LEARNX_PAYMENTS_ENABLED=false` par défaut + kill switch ; tables
  `payment_order`, `payment_event` (migration additive, états ADR_003 §6.3).
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
