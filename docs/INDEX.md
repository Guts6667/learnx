# Index documentaire LearnX

## Règle de chargement

`AGENTS.md` et ce fichier sont les seuls documents transversaux à lire par
défaut. Charger ensuite uniquement la ligne correspondant à la tâche active.
Les archives ne sont jamais des instructions d'implémentation.

Vue de pilotage courante : `V4_ROADMAP.md`. Elle résume l'état réel des tickets,
le chemin critique et les gates ; `../BACKLOG_V4.md` reste l'autorité détaillée.

## Sources de vérité actives

| Besoin | Documents à lire | Autorité |
| --- | --- | --- |
| Ticket V3 | `BACKLOG_V3.md` puis l'ADR ou la spec citée | Le ticket V3 actif |
| Ticket V3.5 design et landing | `BACKLOG_V3_5.md` puis les fichiers cités par le ticket | Le ticket V3.5 actif après clôture V3 |
| Ticket V4 IA et économie | `BACKLOG_V4.md` puis l'ADR ou la spec citée | Le ticket V4 actif après clôture V3.5 |
| Orientation V6 support et conformité | `V6_CANDIDATES.md` | Candidats uniquement, aucune autorité d'implémentation |
| Architecture générale | `TECHNICAL_ARCHITECTURE.md` | Code et schéma priment en cas d'écart |
| Données et Prisma | `DATABASE_SCHEMA.md`, `PRISMA_NOTES.md`, `prisma/schema.prisma` | `prisma/schema.prisma` et migrations |
| Authentification et accès V3 | `ADR_001_MULTI_USER_ACCESS.md` | ADR acceptée et ticket actif |
| Correction IA, crédits et frontières de confiance V4 | `../ADR_003_AI_CORRECTION_FINANCING_TRUST_BOUNDARIES.md`, `V4_AI_CORRECTION_COMPOSITE_SPEC.md` | L'ADR fixe les frontières ; la spec composite remplace les formulations mono-modèle ou binaires incompatibles avec l'amendement formatif du 12 août 2026 |
| Recherche et sélection des corrections IA V4 | `V4_AI_CORRECTION_EXPERIMENT_LOG.md`, `V4_AI_MODEL_BENCHMARK_REPORT.md`, `../public/research/ai-correction/index.html`, `../public/research/ai-correction/en.html` | Le journal append-only conserve les campagnes et décisions ; le rapport détaille le benchmark courant ; les HTML publics FR/EN synthétisent uniquement les preuves stabilisées |
| Moteur de correction formative V4 | `V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md`, `V4_EXECUTABLE_RUBRIC_NEON_REHEARSAL_REPORT.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_SMOKE_DOSSIER.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_PROFILE_DIAGNOSIS.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_SMOKE_1_2_RESULT.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_QUOTE_PROTOCOL_1_3.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_SMOKE_1_3_RESULT.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_THREE_CASE_GATE_1_3.md`, `V4_EXECUTABLE_RUBRIC_GEMINI_THREE_CASE_GATE_V2.md`, `V4_AI_CORRECTION_PHASE_MANIFEST.json`, `../benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-mechanical-oracle.v1.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-semantic-ambiguity-development.v1.json`, `../benchmarks/ai-correction/executable-rubric/writing-fr-holdout.v2.manifest.json` | La spec fixe l'autorité : les modèles cherchent ou contestent des preuves, LearnX compile la rubrique et calcule les niveaux. L'oracle mécanique est exécutable ; les corpus sémantiques sont des pseudo-oracles synthétiques séparés, sans revendication de validation humaine. L'ambiguïté sémantique est testée hors de l'identité Gemini mono-rôle. Le holdout historique exposé est disqualifié ; son remplacement reste vide, non scellé et non exécutable jusqu'à authoring autonome indépendant des candidats, contrôles mécaniques/métamorphiques et GO one-shot. Le rapport Neon prouve la migration additive sur une branche jetable. Les dossiers smoke figent les NO-GO techniques 1.1.0 et 1.2.0 sans verdict pédagogique ; le protocole 1.3 dérive les offsets côté serveur depuis une citation exacte unique. Le gate trois cas v1 reste inconclusif ; le gate v2 termine 3/3 VALID, avec négatif discriminé et injection sûre. Il autorise seulement la préparation du panel 10×2 après correction d'observabilité route/provider et nouveaux GO Finance/propriétaire. L'archétype WRITING reste DRAFT tant que les autres gates ne sont pas franchis |
| UX existante | `UX_SPEC.md` et code concerné | Critères du ticket actif |
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

## Archives

- `docs/archive/v1/` : backlog et point d'entrée historique V1.
- `docs/archive/v2/` : backlog, spécifications de livraison et rapport de
  clôture V2.

Une archive peut servir à comprendre une décision passée. Elle ne définit ni le
périmètre actuel ni le prochain ticket.
