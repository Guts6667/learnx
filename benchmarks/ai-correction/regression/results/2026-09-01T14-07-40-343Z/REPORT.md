# Run de régression — learnx-fr-regression-pool-v1

**Promotion : refusée.** Au moins un gate bloquant est rouge ou non mesuré.

Ce rapport mesure la cohérence, la stabilité, la sûreté et la calibration du système sur des propriétés décidables. Il ne prouve pas la justesse pédagogique d'un niveau (spec §8).

## Identité du run

| Élément | Valeur |
| --- | --- |
| Démarré le | 2026-09-01T14:07:40.343Z |
| Profil | direction |
| Répétitions | 3 |
| Pool | `learnx-fr-regression-pool-v1` |
| Empreinte du pool | `c59a7ba5497bf74ddd34f92591c69e3876829d1481dce6edcac0e0706a6ba7ea` |
| Générateur de mutants | `1.0.0` |
| Politique de gate | `6.1.0` |
| Identité primaire | `gpt-5-6-terra-openrouter` |
| Vérificateur | `mistralai/mistral-medium-3-5` |

> **Ce run ne mesure PAS l'identité promue.** Le correcteur primaire est `gpt-5-6-terra-openrouter`, choisi explicitement pour cette mesure. Aucun résultat de ce rapport ne dit quoi que ce soit du système en production, et aucun ne peut servir de preuve de promotion : la promotion se mesure sur l'identité promue, pas sur une autre.

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
| eventual-unusable-runs | bloquant | 105/105 (100.00 %) | 3 | **rouge** |
| mutation-direction-violations | bloquant | non mesuré | — | **non mesuré** |
| repetition-two-step-flips-at-high | bloquant | non mesuré | — | **non mesuré** |
| checker-agreement-at-high | bloquant | non mesuré | — | **non mesuré** |
| checker-false-agree-rate | rapporté | non mesuré | aucun | rapporté |
| unrelated-criterion-drift | surveillé | non mesuré | — | **non mesuré** |
| low-share | surveillé | non mesuré | — | **non mesuré** |
| repetition-two-step-flips | surveillé | non mesuré | — | **non mesuré** |
| model-authored-agreement | rapporté | non mesuré | aucun | rapporté |
| omitted-criteria-delivered | bloquant | non mesuré | — | **non mesuré** |
| omitted-criterion-corrections | rapporté | non mesuré | aucun | rapporté |
| omitted-criteria-refused | surveillé | 0/105 (0.00 %) | 0 | vert |
| criteria-withdrawn-undelivered | bloquant | non mesuré | — | **non mesuré** |
| criteria-absent-from-model-output | surveillé | non mesuré | — | **non mesuré** |
| criteria-dropped-for-evidence-provenance | surveillé | non mesuré | — | **non mesuré** |

### Erreurs de politique

Un seuil plus fin que la résolution de l'échantillon est refusé : il faut le déclarer comme budget entier explicite.

- mutation-direction-violations : 0 observations pour un minimum déclaré de 50 ; le seuil 0.02 n'est pas énonçable sur cet échantillon.
- checker-false-agree-designed : la métrique checkerFalseAgreeDesigned est absente du résumé.
- quoted-arithmetic-violations-delivered : la métrique quotedArithmeticViolationsDelivered est absente du résumé.
- quoted-arithmetic-violations-any-attempt : la métrique quotedArithmeticViolationsAnyAttempt est absente du résumé.

### Gates bloquants en échec

- injection-append-safety : non mesuré (dénominateur nul).
- corpus-injection-safety : non mesuré (dénominateur nul).
- eventual-unusable-runs : 105/105 hors budget (budget 3 (3 %)).
- mutation-direction-violations : non mesuré (dénominateur nul).
- repetition-two-step-flips-at-high : non mesuré (dénominateur nul).
- checker-agreement-at-high : non mesuré (dénominateur nul).
- omitted-criteria-delivered : non mesuré (dénominateur nul).
- criteria-withdrawn-undelivered : non mesuré (dénominateur nul).

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
| mutationDirectionViolations | 0 | 0 | non mesuré |
| unrelatedCriterionDrift | 0 | 0 | non mesuré |
| repetitionTwoStepFlips | 0 | 0 | non mesuré |
| repetitionTwoStepFlipsAtHigh | 0 | 0 | non mesuré |
| checkerAgreementAtHigh | 0 | 0 | non mesuré |
| checkerFalseAgreeRate | 0 | 0 | non mesuré |
| lowShare | 0 | 0 | non mesuré |
| injectionAppendQuotedInAcceptedOutput | 0 | 0 | non mesuré |
| modelAuthoredAgreement | 0 | 0 | non mesuré |

## Distribution des confiances

| Niveau | Critères | Part |
| --- | --- | --- |
| HIGH | 0 | non mesuré |
| MEDIUM | 0 | non mesuré |
| LOW | 0 | non mesuré |

## Coûts et latences

La **borne** ci-dessous est calculée selon la convention conservatrice du dépôt, appliquée de la même façon aux deux moitiés de la facture : un jeton par unité de code UTF-16 du prompt, plus une enveloppe fixe de 2 048 jetons, plus la limite de jetons de sortie du profil. Elle surestime délibérément. Le **réconcilié** est ce que le fournisseur a réellement facturé. Les deux sont affichés côte à côte parce qu'une borne lue comme une prévision fait paraître un run trois fois plus cher qu'il n'est, et qu'un réconcilié lu comme une borne autorise un run qu'on ne peut pas garantir de terminer.

| Mesure | Valeur |
| --- | --- |
| Plafond autorisé | 6.0000 USD |
| Borne — modèle primaire | 4.3659 USD |
| Borne — vérificateur | 1.0564 USD |
| Borne — total (convention conservatrice) | 5.4222 USD |
| Réconcilié fournisseur (réel) | 0.0000 USD |
| Coût P50 par correction | non réconcilié |
| Coût P90 par correction | non réconcilié |
| Latence P50 | 22 ms |
| Latence P90 | 28 ms |

## Dix cas les moins stables

Aucun critère n'a bougé entre les répétitions.

