# Index documentaire LearnX

## Règle de chargement

`AGENTS.md` et ce fichier sont les seuls documents transversaux à lire par
défaut. Charger ensuite uniquement la ligne correspondant à la tâche active.
Les archives ne sont jamais des instructions d'implémentation.

## Sources de vérité actives

| Besoin | Documents à lire | Autorité |
| --- | --- | --- |
| Ticket V3 | `BACKLOG_V3.md` puis l'ADR ou la spec citée | Le ticket V3 actif |
| Architecture générale | `TECHNICAL_ARCHITECTURE.md` | Code et schéma priment en cas d'écart |
| Données et Prisma | `DATABASE_SCHEMA.md`, `PRISMA_NOTES.md`, `prisma/schema.prisma` | `prisma/schema.prisma` et migrations |
| Authentification et accès V3 | `ADR_001_MULTI_USER_ACCESS.md` | ADR acceptée et ticket actif |
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

## SourceLab — Docker, API et socle d’ingestion

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

Ce parcours V2 guidé construit en 13 h 05 une stack locale SourceLab dans le
dépôt séparé `/Users/rayanchambet/Desktop/Workflow/sourcelab`, à partir du tag
`checkpoint-00-starter`. Il mène à une `SourceVersion READY`, puis à une image
GHCR traçable, et reste en brouillon jusqu’aux revues éditoriale, technique, du
starter, du seed et des liens.

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
