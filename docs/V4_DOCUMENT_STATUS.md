# Statut des documents V4

- **Statut** : `CANONICAL_ROUTING_REGISTER`
- **Version** : `1.0.6`
- **Date** : 21 août 2026
- **Objet** : empêcher qu'une préparation, une demande de GO ou un protocole
  clos soit repris comme direction active

## 1. Règle

Un document V4 appartient à une seule classe :

| Classe | Usage autorisé |
| --- | --- |
| `ACTIVE_AUTHORITY` | Dirige le prochain travail dans son périmètre. |
| `ACTIVE_DESIGN_AUTHORITY` | Dirige le langage visuel et ses critères ; n'autorise pas le code sans ticket activé. |
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
| `V4_TOTEM_DESIGN_IMPLEMENTATION_PLAN.md` | `ACTIVE_DESIGN_AUTHORITY` | Direction Totem validée, file V4-016D→H et frontières ; aucune autorisation de code à elle seule. |
| `V4_AI_CORRECTION_PHASE_MANIFEST_V3.json` | `CURRENT_STATUS` | Miroir machine du chemin IA. |
| `V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md` | `ACTIVE_AUTHORITY` | Architecture déterministe du moteur. |
| `V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md` | `ACTIVE_AUTHORITY` | Core candidate-only inchangé du prochain gate ; les campagnes Sonnet restent historiques. |
| `V4_EVIDENCE_SEMANTIC_ARBITRATION.md` | `ACTIVE_AUTHORITY` | Sémantique successeur, dont `EXPLICITLY_REFUTED`. |
| `V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md` | `ACTIVE_AUTHORITY` | Création du premier contrat. |
| `V4_WRITING_PILOT_BRIEF.md` | `APPROVED_INPUT_V4_002B` | `Rayan A` clos : pilote, scénarios, consigne, objectif et exclusions validés ; aucune autorité d'expérience ou de publication. |
| `V4_WRITING_FRAMEWORK_SELECTION_CONTRACT_DRAFT.md` | `COMPILED_INPUT_V4_003A` | `Rayan B` clos : contrat approuvé et compilable hors ligne par V4-002C ; toujours non publié et sans autorité d'expérience. |
| `V4_002C_COMPILER_REPORT.md` | `CURRENT_STATUS` | Preuve de clôture hors ligne : schéma/compilateur, certificat v2, compatibilité historique, consultations, tests et limites. |
| `../benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.v1.draft.json` | `COMPILED_INPUT_V4_003A` | Projection machine v2 compilée hors ligne ; elle reste `DRAFT`, non liée à une version publiée et sans autorité d'expérience. |
| `V4_003A_MECHANICAL_ORACLE_REPORT.md` | `CURRENT_STATUS` | Preuve de clôture hors ligne : 19 cas mécaniques, 7 mutations et empreinte canonique ; ouvre seulement l'audit V4-003B. |
| `../benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.mechanical-oracle.v2.json` | `AUDIT_INPUT_V4_003B` | Oracle mécanique par construction ; aucune validation humaine, modèle ou live. |
| `V4_003B_INDEPENDENT_AUDIT_REPORT.md` | `CURRENT_STATUS` | Verdict `BLOCKED_WITH_FINDINGS` ; autorité des corrections V4-003A-R1, sans autoriser modèle, gel ou activation. |
| `V4_003A_R1_ORACLE_HARDENING_REPORT.md` | `CURRENT_STATUS` | Clôture hors ligne du correctif v2.1 ; ouvre uniquement V4-003B-R1. |
| `../benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.mechanical-oracle.v2.1.json` | `AUDIT_INPUT_V4_003B_R1` | Oracle mécanique successeur de 33 cas ; non gelé, sans autorité live ni modèle. |
| `V4_003B_R1_INDEPENDENT_AUDIT_REPORT.md` | `CURRENT_STATUS` | Verdict `READY_TO_FREEZE` ; ouvre seulement V4-003C hors ligne, sans réseau ni budget. |
| `V4_003C_EXPERIMENT_IDENTITY_FREEZE_REPORT.md` | `HISTORICAL_EVIDENCE` | Dossier Sonnet exact gelé puis consommé par le gate clos ; aucune reprise ou transposition. |
| `../benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json` | `HISTORICAL_EVIDENCE` | Identité Sonnet close, conservée byte-identique ; réseau, replay et transfert interdits. |
| `V4_003D_GATE4_FINANCE_ARBITRATION.md` | `HISTORICAL_EVIDENCE` | Enveloppe Sonnet consommée par le gate clos ; ne finance aucun successeur. |
| `../benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json` | `CLOSED_REQUEST` | Enveloppe Sonnet close et non transférable ; aucun reliquat réutilisable. |
| `V4_009C_S2_OFFLINE_RUNNER_PREFLIGHT.md` | `HISTORICAL_EVIDENCE` | Préflight du runner spécialisé Sonnet, conservé sans valeur d'attestation Gemini. |
| `../benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-runner-preflight.v1.json` | `HISTORICAL_EVIDENCE` | Preuve machine Sonnet 4/4 fake, conservée sans valeur d'attestation Gemini. |
| `V4_009C_S2_NETWORK_GATE_REPORT.md` | `HISTORICAL_EVIDENCE` | Preuve canonique du gate Sonnet clos après `1/4` ; aucun replay, panel, holdout ou live. |
| `V4_003E_SONNET_5_SEMANTIC_NO_GO_REPORT.md` | `CURRENT_STATUS` | Verdict Sonnet borné, limites `n = 1`, conservation append-only et ordre Gemini 3.6 → Gemini 3.7 → Mistral. |
| `V4_003E_Q1_GEMINI_3_6_OFFLINE_DOSSIER.md` | `HISTORICAL_EVIDENCE` | Préparation hors ligne Gemini 3.6 avant consommation du gate réseau. |
| `V4_003E_Q1_GEMINI_3_6_NETWORK_TRANSPORT_PREFLIGHT.md` | `HISTORICAL_EVIDENCE` | Transport Gemini simulé vert avant le gate réseau désormais clos. |
| `V4_003E_Q1_GEMINI_3_6_NETWORK_GATE_AUTHORIZATION.md` | `HISTORICAL_EVIDENCE` | Autorisation single-use consommée par le gate clos ; aucune réutilisation. |
| `V4_003E_Q1_GEMINI_3_6_NETWORK_GATE_RESULT.md` | `CURRENT_STATUS` | Gate clos après `1/4` sur HTTP 400 ; coût/identifiant absents, réconciliation requise, aucun verdict pédagogique. |
| `V4_010_OFFLINE_FAKE_FLOW.md` | `CURRENT_STATUS` | Prototype désactivé, sans autorité live. |

## 3. Preuves historiques

| Famille | Documents | Règle |
| --- | --- | --- |
| Journal | `V4_AI_CORRECTION_EXPERIMENT_LOG.md` | Append-only ; une nouvelle entrée ne réécrit jamais une ancienne. |
| Synthèse technique | `V4_AI_MODEL_BENCHMARK_REPORT.md` | Historique comparatif, pas gate de promotion actuel. |
| Composite Mistral/Sonnet | `V4_008A_ALIGNMENT_REGISTER.md`, `V4_009B_*` | `HISTORICAL_EVIDENCE`, pipeline abandonné. |
| Gemini/Sonnet chercheur v1 | `V4_009C_*`, `V4_EXECUTABLE_RUBRIC_GEMINI_*`, `V4_EXECUTABLE_RUBRIC_SONNET_5_*` | Campagnes closes ; aucun replay. |
| Evidence-assist 3.0 | `V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`, `V4_EVIDENCE_ASSIST_GATE4_*` | La spec reste `ACTIVE_AUTHORITY` du core inchangé ; les rapports et résultats de gates clos sont `HISTORICAL_EVIDENCE`. |
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
