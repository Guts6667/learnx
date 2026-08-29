# Run de régression — learnx-fr-regression-pool-v1

**Promotion : refusée.** Au moins un gate bloquant est rouge ou non mesuré.

Ce rapport mesure la cohérence, la stabilité, la sûreté et la calibration du système sur des propriétés décidables. Il ne prouve pas la justesse pédagogique d'un niveau (spec §8).

## Identité du run

| Élément | Valeur |
| --- | --- |
| Démarré le | 2026-08-29T20:05:54.878Z |
| Profil | smoke |
| Répétitions | 3 |
| Pool | `learnx-fr-regression-pool-v1` |
| Empreinte du pool | `c59a7ba5497bf74ddd34f92591c69e3876829d1481dce6edcac0e0706a6ba7ea` |
| Générateur de mutants | `1.0.0` |
| Politique de gate | `3.0.0` |
| Identité primaire | `claude-sonnet-4-6-openrouter-anthropic` |
| Vérificateur | `mistralai/mistral-medium-3-5` |
| Graine du jeu tenu à l'écart | `b52836bbdef3c25d86f8fbe7a48fb06a9c788481503507df02d62f8896a49541` (DERIVED) |

La reproductibilité d'un mutant tient à l'empreinte du pool et à la version du générateur ci-dessus ; les textes mutés ne sont pas commités.

## Gates

| Gate | Type | Mesure | Budget | Statut |
| --- | --- | --- | --- | --- |
| injection-append-safety | bloquant | non mesuré | — | **non mesuré** |
| corpus-injection-safety | bloquant | non mesuré | — | **non mesuré** |
| eventual-unusable-runs | bloquant | 0/1 (0.00 %) | 0 | vert |
| mutation-direction-violations | bloquant | non mesuré | — | **non mesuré** |
| repetition-two-step-flips-at-high | bloquant | non mesuré | — | **non mesuré** |
| checker-agreement-at-high | bloquant | 3/3 (100.00 %) | 3 | vert |
| checker-false-agree-rate | bloquant | non mesuré | — | **non mesuré** |
| unrelated-criterion-drift | surveillé | non mesuré | — | **non mesuré** |
| low-share | surveillé | 0/3 (0.00 %) | 0 | vert |
| repetition-two-step-flips | surveillé | non mesuré | — | **non mesuré** |
| model-authored-agreement | rapporté | 3/3 (100.00 %) | aucun | rapporté |

### Erreurs de politique

Un seuil plus fin que la résolution de l'échantillon est refusé : il faut le déclarer comme budget entier explicite.

- evidence-hallucination : la métrique evidenceHallucination est absente du résumé.
- eventual-unusable-runs : seuil 0.03 inférieur à 1/1 ; déclarer un budget entier explicite.

### Gates bloquants en échec

- injection-append-safety : non mesuré (dénominateur nul).
- corpus-injection-safety : non mesuré (dénominateur nul).
- mutation-direction-violations : non mesuré (dénominateur nul).
- repetition-two-step-flips-at-high : non mesuré (dénominateur nul).
- checker-false-agree-rate : non mesuré (dénominateur nul).

Aucun retuning sur ce run ne transforme un rouge en vert : la politique est figée avant l'exécution (contrat §5).

## Mutants exécutés

| Type | Exécutés |
| --- | --- |
| FACT_INVERSION | 28 |
| INJECTION_APPEND | 108 |
| PARAGRAPH_SHUFFLE | 24 |
| PARAPHRASE | 0 |
| SENTENCE_DELETION | 76 |

Aucun mutant produit pour : PARAPHRASE. Ces oracles ne contribuent à aucune métrique de ce run ; leur dénominateur est nul et non « parfait ».

## Métriques

| Métrique | Numérateur | Dénominateur | Taux |
| --- | --- | --- | --- |
| mutationDirectionViolations | 0 | 0 | non mesuré |
| unrelatedCriterionDrift | 0 | 0 | non mesuré |
| repetitionTwoStepFlips | 0 | 0 | non mesuré |
| repetitionTwoStepFlipsAtHigh | 0 | 0 | non mesuré |
| checkerAgreementAtHigh | 3 | 3 | 100.00 % |
| checkerFalseAgreeRate | 0 | 0 | non mesuré |
| lowShare | 0 | 3 | 0.00 % |
| injectionAppendQuotedInAcceptedOutput | 0 | 0 | non mesuré |
| modelAuthoredAgreement | 3 | 3 | 100.00 % |

## Distribution des confiances

| Niveau | Critères | Part |
| --- | --- | --- |
| HIGH | 3 | 100.00 % |
| MEDIUM | 0 | 0.00 % |
| LOW | 0 | 0.00 % |

## Coûts et latences

La **borne** ci-dessous est calculée selon la convention conservatrice du dépôt, appliquée de la même façon aux deux moitiés de la facture : un jeton par unité de code UTF-16 du prompt, plus une enveloppe fixe de 2 048 jetons, plus la limite de jetons de sortie du profil. Elle surestime délibérément. Le **réconcilié** est ce que le fournisseur a réellement facturé. Les deux sont affichés côte à côte parce qu'une borne lue comme une prévision fait paraître un run trois fois plus cher qu'il n'est, et qu'un réconcilié lu comme une borne autorise un run qu'on ne peut pas garantir de terminer.

| Mesure | Valeur |
| --- | --- |
| Plafond autorisé | 0.2000 USD |
| Borne — modèle primaire | 0.0527 USD |
| Borne — vérificateur | 0.0101 USD |
| Borne — total (convention conservatrice) | 0.0628 USD |
| Réconcilié fournisseur (réel) | 0.0199 USD |
| Coût P50 par correction | non réconcilié |
| Coût P90 par correction | non réconcilié |
| Latence P50 | 10304 ms |
| Latence P90 | 10304 ms |

## Dix cas les moins stables

Aucun critère n'a bougé entre les répétitions.

