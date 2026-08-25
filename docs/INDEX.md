# Index documentaire LearnX

## Règle de chargement

`AGENTS.md` et ce fichier sont les seuls documents transversaux à lire par
défaut. Charger ensuite uniquement la ligne correspondant à la tâche active.
Les archives ne sont jamais des instructions d'implémentation.

## Sources de vérité actives

| Besoin | Documents à lire | Autorité |
| --- | --- | --- |
| Ticket V3 | `BACKLOG_V3.md` puis l'ADR ou la spec citée | Le ticket V3 actif |
| Ticket V3.5 design et landing | `BACKLOG_V3_5.md` puis les fichiers cités par le ticket | Le ticket V3.5 actif après clôture V3 |
| Ticket V4 IA et économie | `BACKLOG_V4.md` puis l'ADR ou la spec citée | L'amendement d'exécution du 24 août prime sur les tickets expérimentaux historiques |
| Orientation V6 support et conformité | `V6_CANDIDATES.md` | Candidats uniquement, aucune autorité d'implémentation |
| Architecture générale | `TECHNICAL_ARCHITECTURE.md` | Code et schéma priment en cas d'écart |
| Carte du domaine et vocabulaire | `LEARNX_DOMAIN_KNOWLEDGE.md` | Point d'entrée canonique pour les objets et frontières ; la roadmap conserve le statut courant |
| Statut actif ou historique des documents V4 | `V4_DOCUMENT_STATUS.md` | Une préparation ou demande de GO close ne peut jamais être reprise comme instruction |
| Données et Prisma | `DATABASE_SCHEMA.md`, `PRISMA_NOTES.md`, `prisma/schema.prisma` | `prisma/schema.prisma` et migrations |
| Authentification et accès V3 | `ADR_001_MULTI_USER_ACCESS.md` | ADR acceptée et ticket actif |
| UX existante | `UX_SPEC.md` et code concerné | Critères du ticket actif |
| V4 design Totem | `docs/V4_TOTEM_IMPLEMENTATION_MAP.md` puis les paquets d’autorité produit, public et marque cités | Manifestes Totem approuvés le 24 août 2026 |
| Pilotage V4 courant | `docs/V4_ROADMAP.md`, puis `BACKLOG_V4.md` pour le détail | Roadmap datée du 24 août ; anciennes vues dans `docs/archive/v4/` |
| Release du pilote V4 | `docs/V4_019_RELEASE_REPORT.md`, puis `docs/V4_ROLLOUT_CHECKLIST.md` et `docs/V4_019_MANUAL_ACCEPTANCE.md` | Les essais preview sont append-only ; la recette propriétaire précède deux GO distincts : promotion Git/configuration fermée, puis ouverture/smoke |
| Calibration du pilote V4 | `docs/V4_007_PILOT_CALIBRATION.md` | Option B et parité pilote provisoire approuvées le 24 août ; crédits offerts uniquement, aucune vente publique |
| Recherche correction V4 | `docs/V4_RESEARCH_FINDINGS.md`, puis `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md` | Artefacts et journal append-only priment sur les synthèses |
| Reports V4.1 | `V4_1_BACKLOG.md` | Aucune dette V4.1 ne modifie implicitement le pilote V4 |
| Release V3.5 | `V3_5_RELEASE_REPORT.md`, `V3_5_QA_MATRIX.md` | GO technique obtenu ; la preuve de clôture reste celle du rapport réellement promu |
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
