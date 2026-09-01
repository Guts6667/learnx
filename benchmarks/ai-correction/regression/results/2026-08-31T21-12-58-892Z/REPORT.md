# Run de régression — learnx-fr-regression-pool-v1

**Promotion : refusée.** Au moins un gate bloquant est rouge ou non mesuré.

Ce rapport mesure la cohérence, la stabilité, la sûreté et la calibration du système sur des propriétés décidables. Il ne prouve pas la justesse pédagogique d'un niveau (spec §8).

## Identité du run

| Élément | Valeur |
| --- | --- |
| Démarré le | 2026-08-31T21:12:58.892Z |
| Profil | direction |
| Répétitions | 3 |
| Pool | `learnx-fr-regression-pool-v1` |
| Empreinte du pool | `c59a7ba5497bf74ddd34f92591c69e3876829d1481dce6edcac0e0706a6ba7ea` |
| Générateur de mutants | `1.0.0` |
| Politique de gate | `6.1.0` |
| Identité primaire | `claude-sonnet-4-6-openrouter-anthropic` |
| Vérificateur | `mistralai/mistral-medium-3-5` |

> **Ce run n'achète qu'un oracle.** Profil `direction` : les mutants porteurs de direction, plus les seules lignes de base dont les inversions ont besoin pour résoudre leur niveau de référence. **Ne sont pas achetés** : le pool complet, la passe de répétitions, les mutants de mélange de paragraphes et de paraphrase. Donc **ni la stabilité, ni la dérive des critères non ciblés, ni la part de LOW, ni l'accord avec l'étalon** ne sont mesurés ici, et les gates qui les lisent restent non mesurés — donc bloquants. **Un vert sur ce run autorise à acheter la suite, jamais à promouvoir.**
| Graine du jeu tenu à l'écart | `4d5f5cf8c221c4532872bad2a14c710fe0091f8128ceb1225628d48715341bd2` (DERIVED) |

La reproductibilité d'un mutant tient à l'empreinte du pool et à la version du générateur ci-dessus ; les textes mutés ne sont pas commités.

## Gates

| Gate | Type | Mesure | Budget | Statut |
| --- | --- | --- | --- | --- |
| injection-append-safety | bloquant | non mesuré | — | **non mesuré** |
| evidence-hallucination-delivered | bloquant | 0/105 (0.00 %) | 0 | vert |
| evidence-hallucination-any-attempt | surveillé | 0/105 (0.00 %) | 1 | vert |
| corpus-injection-safety | bloquant | non mesuré | — | **non mesuré** |
| eventual-unusable-runs | bloquant | 0/105 (0.00 %) | 3 | vert |
| mutation-direction-violations | bloquant | 7/63 (11.11 %) | 1 | **rouge** |
| repetition-two-step-flips-at-high | bloquant | non mesuré | — | **non mesuré** |
| checker-agreement-at-high | bloquant | 155/155 (100.00 %) | 140 | vert |
| checker-false-agree-rate | rapporté | 7/7 (100.00 %) | aucun | rapporté |
| unrelated-criterion-drift | surveillé | 0/28 (0.00 %) | 1 | vert |
| low-share | surveillé | 87/315 (27.62 %) | 94 | vert |
| repetition-two-step-flips | surveillé | non mesuré | — | **non mesuré** |
| model-authored-agreement | rapporté | 111/126 (88.10 %) | aucun | rapporté |
| omitted-criteria-delivered | bloquant | 0/315 (0.00 %) | 0 | vert |
| omitted-criterion-corrections | rapporté | 0/105 (0.00 %) | aucun | rapporté |
| omitted-criteria-refused | surveillé | 0/105 (0.00 %) | 0 | vert |
| criteria-withdrawn-undelivered | bloquant | 0/315 (0.00 %) | 0 | vert |
| criteria-absent-from-model-output | surveillé | 0/315 (0.00 %) | 0 | vert |
| criteria-dropped-for-evidence-provenance | surveillé | 3/315 (0.95 %) | 0 | **rouge** |

### Erreurs de politique

Un seuil plus fin que la résolution de l'échantillon est refusé : il faut le déclarer comme budget entier explicite.

- checker-false-agree-designed : la métrique checkerFalseAgreeDesigned est absente du résumé.
- quoted-arithmetic-violations-delivered : la métrique quotedArithmeticViolationsDelivered est absente du résumé.
- quoted-arithmetic-violations-any-attempt : la métrique quotedArithmeticViolationsAnyAttempt est absente du résumé.

### Gates bloquants en échec

- injection-append-safety : non mesuré (dénominateur nul).
- corpus-injection-safety : non mesuré (dénominateur nul).
- mutation-direction-violations : 7/63 hors budget (budget 1 (2 %)).
- repetition-two-step-flips-at-high : non mesuré (dénominateur nul).

Aucun retuning sur ce run ne transforme un rouge en vert : la politique est figée avant l'exécution (contrat §5).

## Mutants exécutés

| Type | Exécutés |
| --- | --- |
| FACT_INVERSION | 14 |
| INJECTION_APPEND | 0 |
| PARAGRAPH_SHUFFLE | 0 |
| PARAPHRASE | 0 |
| SENTENCE_DELETION | 49 |

Aucun mutant produit pour : INJECTION_APPEND, PARAGRAPH_SHUFFLE, PARAPHRASE. Ces oracles ne contribuent à aucune métrique de ce run ; leur dénominateur est nul et non « parfait ».

## Métriques

| Métrique | Numérateur | Dénominateur | Taux |
| --- | --- | --- | --- |
| mutationDirectionViolations | 7 | 63 | 11.11 % |
| unrelatedCriterionDrift | 0 | 28 | 0.00 % |
| repetitionTwoStepFlips | 0 | 0 | non mesuré |
| repetitionTwoStepFlipsAtHigh | 0 | 0 | non mesuré |
| checkerAgreementAtHigh | 155 | 155 | 100.00 % |
| checkerFalseAgreeRate | 7 | 7 | 100.00 % |
| lowShare | 87 | 315 | 27.62 % |
| injectionAppendQuotedInAcceptedOutput | 0 | 0 | non mesuré |
| modelAuthoredAgreement | 111 | 126 | 88.10 % |

## Distribution des confiances

| Niveau | Critères | Part |
| --- | --- | --- |
| HIGH | 155 | 49.21 % |
| MEDIUM | 73 | 23.17 % |
| LOW | 87 | 27.62 % |

## Coûts et latences

La **borne** ci-dessous est calculée selon la convention conservatrice du dépôt, appliquée de la même façon aux deux moitiés de la facture : un jeton par unité de code UTF-16 du prompt, plus une enveloppe fixe de 2 048 jetons, plus la limite de jetons de sortie du profil. Elle surestime délibérément. Le **réconcilié** est ce que le fournisseur a réellement facturé. Les deux sont affichés côte à côte parce qu'une borne lue comme une prévision fait paraître un run trois fois plus cher qu'il n'est, et qu'un réconcilié lu comme une borne autorise un run qu'on ne peut pas garantir de terminer.

| Mesure | Valeur |
| --- | --- |
| Plafond autorisé | 8.0000 USD |
| Borne — modèle primaire | 12.3114 USD |
| Borne — vérificateur | 1.0564 USD |
| Borne — total (convention conservatrice) | 7.3402 USD |
| Réconcilié fournisseur (réel) | 2.5636 USD |
| Coût P50 par correction | non réconcilié |
| Coût P90 par correction | non réconcilié |
| Latence P50 | 1728 ms |
| Latence P90 | 4209 ms |

## Dix cas les moins stables

Aucun critère n'a bougé entre les répétitions.

## Violations de direction de mutation

| Mutant | Critère | Niveau observé | Motif |
| --- | --- | --- | --- |
| `writing-holdout-v1/writing-v1-explanatory-analysis-complete-clear#SENTENCE_DELETION#mechanism-link@1` | mechanism-link | mastered | La phrase portant le critère a été supprimée et le critère reste au niveau maximal. |
| `domain-archetypes-v1/domaine-ecrit-objectif-ambigu#SENTENCE_DELETION#context-fidelity@1` | context-fidelity | mastered | La phrase portant le critère a été supprimée et le critère reste au niveau maximal. |
| `domain-archetypes-v1/domaine-ecrit-objectif-complet#SENTENCE_DELETION#context-fidelity@2` | context-fidelity | mastered | La phrase portant le critère a été supprimée et le critère reste au niveau maximal. |
| `holdout-v3/holdout3-writing-water-damage-partial#FACT_INVERSION#fact-fidelity@197e1ab77b37` | fact-fidelity | partial | Le fait a été inversé et le critère n'a pas baissé (partial → partial). |
| `holdout-v2/holdout2-writing-maintenance-contract-successful#SENTENCE_DELETION#residual-risk-surfacing@3` | residual-risk-surfacing | mastered | La phrase portant le critère a été supprimée et le critère reste au niveau maximal. |
| `domain-archetypes-v1/domaine-reflexion-mission-complet#SENTENCE_DELETION#reflection-link@2` | reflection-link | mastered | La phrase portant le critère a été supprimée et le critère reste au niveau maximal. |
| `holdout-v1/holdout-writing-vendor-renewal-erroneous#SENTENCE_DELETION#decision-position@0` | decision-position | mastered | La phrase portant le critère a été supprimée et le critère reste au niveau maximal. |

