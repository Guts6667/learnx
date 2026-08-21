# Statut des documents V4

- **Statut** : `CANONICAL_ROUTING_REGISTER`
- **Version** : `1.0.0`
- **Date** : 21 août 2026
- **Objet** : empêcher qu'une préparation, une demande de GO ou un protocole
  clos soit repris comme direction active

## 1. Règle

Un document V4 appartient à une seule classe :

| Classe | Usage autorisé |
| --- | --- |
| `ACTIVE_AUTHORITY` | Dirige le prochain travail dans son périmètre. |
| `CURRENT_STATUS` | Décrit l'état réel, sans créer de politique. |
| `HISTORICAL_EVIDENCE` | Prouve une campagne ou une décision passée ; ne peut pas être exécuté. |
| `SUPERSEDED_DRAFT` | Explique une origine, mais ne peut authoriser aucun travail. |
| `CLOSED_REQUEST` | Ancienne demande d'autorisation consommée, refusée ou abandonnée. |

Une preuve historique n'est pas supprimée : son chemin peut être lié à un
artefact ou à une empreinte. Elle reçoit un bandeau de clôture et disparaît du
chemin de lecture actif.

## 2. Autorités actives

| Document | Classe | Portée |
| --- | --- | --- |
| `LEARNX_DOMAIN_KNOWLEDGE.md` | `ACTIVE_AUTHORITY` | Vocabulaire, objets et frontières du domaine. |
| `V4_ROADMAP.md` | `CURRENT_STATUS` | Registre humain unique de progression. |
| `../BACKLOG_V4.md` | `ACTIVE_AUTHORITY` | Périmètres, critères et tickets. |
| `V4_AI_CORRECTION_PHASE_MANIFEST_V3.json` | `CURRENT_STATUS` | Miroir machine du chemin IA. |
| `V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md` | `ACTIVE_AUTHORITY` | Architecture déterministe du moteur. |
| `V4_EVIDENCE_SEMANTIC_ARBITRATION.md` | `ACTIVE_AUTHORITY` | Sémantique successeur, dont `EXPLICITLY_REFUTED`. |
| `V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md` | `ACTIVE_AUTHORITY` | Création du premier contrat. |
| `V4_WRITING_PILOT_BRIEF.md` | `APPROVED_INPUT_V4_002B` | `Rayan A` clos : pilote, scénarios, consigne, objectif et exclusions validés ; aucune autorité d'expérience ou de publication. |
| `V4_WRITING_FRAMEWORK_SELECTION_CONTRACT_DRAFT.md` | `COMPILED_INPUT_V4_003A` | `Rayan B` clos : contrat approuvé et compilable hors ligne par V4-002C ; toujours non publié et sans autorité d'expérience. |
| `V4_002C_COMPILER_REPORT.md` | `CURRENT_STATUS` | Preuve de clôture hors ligne : schéma/compilateur, certificat v2, compatibilité historique, consultations, tests et limites. |
| `../benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.v1.draft.json` | `COMPILED_INPUT_V4_003A` | Projection machine v2 compilée hors ligne ; elle reste `DRAFT`, non liée à une version publiée et sans autorité d'expérience. |
| `V4_003A_MECHANICAL_ORACLE_REPORT.md` | `CURRENT_STATUS` | Preuve de clôture hors ligne : 19 cas mécaniques, 7 mutations et empreinte canonique ; ouvre seulement l'audit V4-003B. |
| `../benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.mechanical-oracle.v2.json` | `AUDIT_INPUT_V4_003B` | Oracle mécanique par construction ; aucune validation humaine, modèle ou live. |
| `V4_003B_INDEPENDENT_AUDIT_REPORT.md` | `CURRENT_STATUS` | Verdict `BLOCKED_WITH_FINDINGS` ; autorité des corrections V4-003A-R1, sans autoriser modèle, gel ou activation. |
| `V4_010_OFFLINE_FAKE_FLOW.md` | `CURRENT_STATUS` | Prototype désactivé, sans autorité live. |

## 3. Preuves historiques

| Famille | Documents | Règle |
| --- | --- | --- |
| Journal | `V4_AI_CORRECTION_EXPERIMENT_LOG.md` | Append-only ; une nouvelle entrée ne réécrit jamais une ancienne. |
| Synthèse technique | `V4_AI_MODEL_BENCHMARK_REPORT.md` | Historique comparatif, pas gate de promotion actuel. |
| Composite Mistral/Sonnet | `V4_008A_ALIGNMENT_REGISTER.md`, `V4_009B_*` | `HISTORICAL_EVIDENCE`, pipeline abandonné. |
| Gemini/Sonnet chercheur v1 | `V4_009C_*`, `V4_EXECUTABLE_RUBRIC_GEMINI_*`, `V4_EXECUTABLE_RUBRIC_SONNET_5_*` | Campagnes closes ; aucun replay. |
| Evidence-assist 3.0 | `V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`, `V4_EVIDENCE_ASSIST_GATE4_*` | Autorité de la campagne close uniquement. |
| Manifeste antérieur | `V4_AI_CORRECTION_PHASE_MANIFEST.json` | Immuable pour préserver les verdicts historiques. |

## 4. Brouillons remplacés

- `V4_WRITING_RECOMMENDATION_FR_CONTRACT_DRAFT.md` : origine pédagogique
  conservée, remplacée par le moteur exécutable et le nouveau funnel.
- Les anciens documents proposant modèle juge, pipeline composite, moyenne,
  `CONFIRMED/UNCERTAIN` comme états cibles ou revue humaine ne dirigent plus le
  MVP.

## 5. Contrôle de propreté

Avant de reprendre un ticket, l'agent doit :

1. commencer par `docs/INDEX.md` ;
2. vérifier la classe du document ici ;
3. refuser toute commande issue d'un `HISTORICAL_EVIDENCE`,
   `SUPERSEDED_DRAFT` ou `CLOSED_REQUEST` ;
4. lire le ticket assigné dans `BACKLOG_V4.md` et son statut dans la roadmap ;
5. signaler toute contradiction avant d'écrire du code ou d'ouvrir un budget.
