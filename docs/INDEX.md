# Index documentaire LearnX

## Règle de chargement

`AGENTS.md` et ce fichier sont les seuls documents transversaux à lire par
défaut. Charger ensuite uniquement la ligne correspondant à la tâche active.
Les archives ne sont jamais des instructions d'implémentation.

Vue de pilotage courante : `V4_ROADMAP.md`. Elle est le registre humain unique
de l'état réel, des tickets reprenables, des responsables, du chemin critique et
des gates ; `../BACKLOG_V4.md` reste l'autorité des périmètres, dépendances et
critères, sans second tableau de statut. Le manifeste V3 est son miroir machine
pour la phase IA.

## Sources de vérité actives

| Besoin | Documents à lire | Autorité |
| --- | --- | --- |
| Ticket V3 | `BACKLOG_V3.md` puis l'ADR ou la spec citée | Le ticket V3 actif |
| Ticket V3.5 design et landing | `BACKLOG_V3_5.md` puis les fichiers cités par le ticket | Le ticket V3.5 actif après clôture V3 |
| Ticket V4 IA et économie | `BACKLOG_V4.md` puis l'ADR ou la spec citée | Le ticket V4 actif ; le sign-off humain V3.5 reste un gate de rollout tant qu'il n'est pas consigné |
| Orientation V6 support et conformité | `V6_CANDIDATES.md` | Candidats uniquement, aucune autorité d'implémentation |
| Architecture générale | `TECHNICAL_ARCHITECTURE.md` | Code et schéma priment en cas d'écart |
| Données et Prisma | `DATABASE_SCHEMA.md`, `PRISMA_NOTES.md`, `prisma/schema.prisma` | `prisma/schema.prisma` et migrations |
| Authentification et accès V3 | `ADR_001_MULTI_USER_ACCESS.md` | ADR acceptée et ticket actif |
| Correction IA, crédits et frontières de confiance V4 | `../ADR_003_AI_CORRECTION_FINANCING_TRUST_BOUNDARIES.md`, `V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md`, `V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`, `V4_010_OFFLINE_FAKE_FLOW.md` | L'ADR fixe les frontières de confiance et de financement ; la spec du moteur régit les règles serveur ; la spec evidence-assist régit la nouvelle observation sémantique candidate. Le flow V4-010 documenté reste un prototype local désactivé, sans autorité live. La composite locale est une baseline historique sans autorité active. |
| Recherche et sélection des corrections IA V4 | `V4_AI_CORRECTION_EXPERIMENT_LOG.md`, `V4_AI_MODEL_BENCHMARK_REPORT.md`, `../public/research/ai-correction/index.html`, `../public/research/ai-correction/en.html` | Le journal append-only et le manifeste V3 portent la décision courante. Le rapport benchmark décrit les campagnes historiques et ne peut promouvoir la nouvelle identité ; les HTML publics synthétisent uniquement les preuves stabilisées. |
| État machine courant de la correction IA V4 | `V4_AI_CORRECTION_PHASE_MANIFEST_V3.json` | Autorité courante evidence-assist. Le manifeste sans suffixe reste historique et inchangé pour préserver les empreintes des campagnes closes. |
| Arbitrage Finance du gate evidence-assist quatre cas | `V4_EVIDENCE_ASSIST_GATE4_FINANCE_ARBITRATION.md` | Plafond R&D de `0,251136 USD` arbitré pour quatre appels maximum, sans retry/fallback ; aucun GO propriétaire, réseau, panel conditionnel ou prix utilisateur n'en découle. |
| Moteur de correction formative V4 | `V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md`, `V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`, `V4_AI_CORRECTION_PHASE_MANIFEST_V3.json`, `V4_EXECUTABLE_RUBRIC_NEON_REHEARSAL_REPORT.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_SMOKE_DOSSIER.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_PROFILE_DIAGNOSIS.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_SMOKE_1_2_RESULT.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_QUOTE_PROTOCOL_1_3.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_SMOKE_1_3_RESULT.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_THREE_CASE_GATE_1_3.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_THREE_CASE_GATE_V2.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_PANEL_V2_PREPARATION.md`, `V4_EXECUTABLE_RUBRIC_SONNET_5_SCREENING.md`, `V4_EXECUTABLE_RUBRIC_SONNET_5_PANEL_PREPARATION.md`, `V4_EXECUTABLE_RUBRIC_SONNET_5_BOUNDED_GATE_PREPARATION.md`, `V4_EXECUTABLE_RUBRIC_SONNET_5_BOUNDED_GATE_RESULT.md`, `V4_AI_CORRECTION_PHASE_MANIFEST.json`, `../benchmarks/ai-correction/executable-rubric/sonnet-5-reasoning-capability-attestation-2026-08-16.json`, `../benchmarks/ai-correction/executable-rubric/sonnet-5-evidence-assist-four-case.v1.json`, `../benchmarks/ai-correction/executable-rubric/sonnet-5-evidence-assist-panel-10x2.v1.json`, `../benchmarks/ai-correction/executable-rubric/sonnet-5-evidence-assist-development-freeze-set.v1.json`, `../benchmarks/ai-correction/executable-rubric/evidence-assist-promotion-policy.v1.json`, `../benchmarks/ai-correction/autonomous/README.md`, `../benchmarks/ai-correction/autonomous/manifest.v2.json`, `../benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-mechanical-oracle.v1.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-semantic-ambiguity-development.v1.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-holdout.v3.manifest.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-holdout.v2.manifest.json` | Les NO-GO historiques restent inchangés. Evidence-assist 3.0.0 segmente la réponse côté LearnX et limite le modèle à des relations candidates jamais scorables. Statut : `OFFLINE_CAMPAIGN_FROZEN / NO_MODEL_CALL`; aucun pipeline n'est promu. V4-002/V4-010 avancent uniquement hors ligne, publication et live bloqués. Le gate quatre cas précède le corpus complet 10 × 2 sous la même identité. `GO_TO_SEALED_HOLDOUT` conserve `pipelinePromoted=false` et n'ouvre pas le holdout ; seul `GO_AUTONOMOUS_FORMATIVE` après holdout one-shot peut le passer à true. Le holdout v3 reste fermé, non authoré et inexécutable ; le v2 est `SUPERSEDED_HISTORICAL_DRAFT`. |
| UX existante | `UX_SPEC.md` et code concerné | Critères du ticket actif |
| Emotional Design Atlas | `EMOTIONAL_DESIGN_CONTRACT.md`, `UX_SPEC.md` et le ticket concerné | Le contrat fixe confiance, hiérarchie et preuves de compréhension ; les règles métier, pédagogiques et financières restent celles du ticket actif |
| Release V3.5 | `V3_5_RELEASE_REPORT.md`, `V3_5_QA_MATRIX.md` | GO technique obtenu ; clôture officielle encore suspendue à la validation humaine sur la version réellement promue |
| Parcours pédagogique V3 | `LEARNING_FLOW_V3_SPEC.md` | Spec approuvée par V3-016 |
| Progression et calendrier | `TIMELINE_SPEC.md` | Logique serveur et tests |
| Évaluations | `ASSESSMENT_SPEC.md` | Schéma, logique serveur et tests |
| Revue scientifique | `SCIENTIFIC_REVIEW_SPEC.md` | Vision optionnelle non persistée tant qu'aucun ticket ne l'autorise |
| Contenu pédagogique | `EDITORIAL_GUIDELINES.md`, `PEDAGOGY_AUTHORING_GUIDE.md`, `PEDAGOGY_CHANGE_POLICY.md` et le blueprint du programme | Les quatre documents ensemble |
| Workflow bilingue | `content/i18n/GLOSSARY_FR_EN.json` et `PEDAGOGY_AUTHORING_GUIDE.md` §11 | Manifeste de traduction et workflow serveur |
| Audit sécurité et exploitation V3 | `docs/V3_AUDIT_REPORT.md` | Rapport de preuve V3-028 ; corrections dans V3-029 à V3-031 |
| Performance et observabilité V3 | `docs/V3_PERFORMANCE_REPORT.md` | Mesures, budgets, alertes et rollback de V3-031 |
| Répétition de migration V3 | `docs/V3_MIGRATION_REHEARSAL_REPORT.md` | Checksums clone Production, replay complet et matrice multi-utilisateur de V3-032 |
| Release V3 | `docs/V3_RELEASE_REPORT.md` | Verdict, preuves staging, procédure de promotion et rollback de V3-033 |

`PRODUCT_REQUIREMENTS.md` conserve la baseline MVP. Le consulter pour une
décision fondatrice précise, pas comme état courant exhaustif de la V3.

## Programme de psychologie

- Blueprint : `content/fondamentaux-psychologie/CURRICULUM_BLUEPRINT.md`
- Spécifications de leçons : `content/fondamentaux-psychologie/specs/`
- Évaluations d'étape :
  `content/fondamentaux-psychologie/stage-assessments/`
- Banques d'évaluation :
  `content/fondamentaux-psychologie/assessment-banks/`
- Bundle importé par Prisma : `seed/sample-program.json`

Ne jamais charger toutes les spécifications pour modifier une seule leçon.
Ouvrir uniquement la spec ciblée, les évaluations liées et les documents de
gouvernance exigés par `AGENTS.md`.

## Programme Officine Express

- Blueprint : `content/officine-express/CURRICULUM_BLUEPRINT.md`
- Spécifications de leçons : `content/officine-express/specs/`
- Évaluation d'étape : `content/officine-express/stage-assessments/`
- Bundle importé par Prisma : `seed/officine-express-program.json`

Ce programme personnel est un pilote court de reconnaissance médicamenteuse.
Il ne remplace ni une formation professionnelle ni la validation du
pharmacien.

## Programme Platform APM — Entretien TryHackMe

- Blueprint :
  `content/platform-apm-entretien-tryhackme/CURRICULUM_BLUEPRINT.md`
- Spécifications de leçons :
  `content/platform-apm-entretien-tryhackme/specs/`
- Évaluations d'étape :
  `content/platform-apm-entretien-tryhackme/stage-assessments/`
- Bundle importé par Prisma : `seed/platform-apm-interview-program.json`

Ce parcours intensif prépare un entretien précis. Les informations relatives au
poste doivent être revérifiées avant toute réutilisation ultérieure.

## Programme Pilotage de projets IA et ISO/IEC 42001

- Présentation et statut :
  `content/pilotage-projets-ia-iso-42001/README.md`
- Blueprint :
  `content/pilotage-projets-ia-iso-42001/CURRICULUM_BLUEPRINT.md`
- Spécifications de leçons :
  `content/pilotage-projets-ia-iso-42001/specs/`
- Évaluations d’étape :
  `content/pilotage-projets-ia-iso-42001/stage-assessments/`
- Bundle importé par Prisma :
  `seed/pilotage-projets-ia-iso-42001-program.json`

Ce parcours en huit étapes prépare au pilotage de projets IA en entreprise et
construit une base de type Lead Implementer. Il ne revendique ni formation
accréditée ni équivalence avec une certification dont l’organisme et le
programme d’examen ne sont pas encore confirmés.

## Psychology Foundations — English pilot

- Blueprint : `content/psychology-foundations-pilot/CURRICULUM_BLUEPRINT.md`
- Spécifications : `content/psychology-foundations-pilot/specs/`
- Évaluation d'étape :
  `content/psychology-foundations-pilot/stage-assessments/`
- Manifeste :
  `content/psychology-foundations-pilot/TRANSLATION_MANIFEST_en.json`
- Bundle Prisma : `seed/psychology-foundations-pilot-program.json`

Les deux premiers lots anglais restent des brouillons privés tant que les revues
humaines linguistique, pédagogique et culturelle/juridique ne sont pas
approuvées dans le workflow bilingue. Leur publication et leur progression sont
indépendantes du programme français.

## Ingénieur logiciel en production — Construire SourceLab

- Présentation et statut :
  `content/ingenieur-logiciel-production-sourcelab/README.md`
- Blueprint :
  `content/ingenieur-logiciel-production-sourcelab/CURRICULUM_BLUEPRINT.md`
- Spécifications :
  `content/ingenieur-logiciel-production-sourcelab/specs/`
- Évaluations d’étape :
  `content/ingenieur-logiciel-production-sourcelab/stage-assessments/`
- Bundle Prisma :
  `seed/ingenieur-logiciel-production-sourcelab-program.json`

Ce parcours construit SourceLab V1 dans un dépôt et une base séparés de LearnX.
Il reste en brouillon jusqu’aux revues éditoriale, technique et des liens.

## AI Product Engineer — RAG et évaluation avec SourceLab

- Présentation et statut : `content/ai-product-engineer-sourcelab/README.md`
- Blueprint :
  `content/ai-product-engineer-sourcelab/CURRICULUM_BLUEPRINT.md`
- Spécifications : `content/ai-product-engineer-sourcelab/specs/`
- Évaluations d’étape :
  `content/ai-product-engineer-sourcelab/stage-assessments/`
- Bundle Prisma : `seed/ai-product-engineer-sourcelab-program.json`

Ce parcours ajoute corpus, retrieval, RAG, Program Builder et moteur de rubrique
exécutable au projet SourceLab autonome. Les modèles recherchent ou contestent
des preuves ; LearnX conserve les calculs déterministes. Le programme reste en
brouillon jusqu’aux revues éditoriale, technique et des liens.

## Archives

- `docs/archive/v1/` : backlog et point d'entrée historique V1.
- `docs/archive/v2/` : backlog, spécifications de livraison et rapport de
  clôture V2.

Une archive peut servir à comprendre une décision passée. Elle ne définit ni le
périmètre actuel ni le prochain ticket.
