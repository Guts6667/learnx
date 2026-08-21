# V4-009C-S2 — Résultat du gate réseau Sonnet 5

- **Statut** : `NO-GO_SEMANTIC_DISAGREEMENT`
- **Date** : 21 août 2026
- **Identité** : `cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31`
- **Modèle et route** : `anthropic/claude-sonnet-5`, route demandée et observée `Anthropic`
- **Appels envoyés** : `1/4`
- **Retry ou fallback** : aucun
- **Coût fournisseur ACTUAL** : `0,018828 USD`
- **Panel, holdout ou activation** : aucun

## Résultat

Le runner a arrêté le gate après le premier appel, conformément à la règle
préenregistrée d'arrêt au premier défaut. Les trois autres cas n'ont pas été
envoyés.

La réponse fournisseur était structurée, le coût était réconcilié et le raw a
été persisté avant validation. La sortie a néanmoins produit un désaccord
sémantique sur `project-b-dimension-scope` :

- l'oracle mécanique attend `SUPPORTED` / `EVIDENCE_FOR_ELEMENT` ;
- Sonnet 5 a retourné `EVIDENCE_AGAINST_ELEMENT` ;
- le passage concerné est : « Pour B, je mobilise échantillon, phénomène,
  design, évaluation et type de recherche, sans laisser de dimension ouverte. »

Ce passage correspond au comportement positif authoré : le contrat accepte
explicitement l'absence de dimension ouverte lorsque toutes les dimensions sont
traitées. L'écart est donc classé comme défaut du candidat, et non comme erreur
de transport, coût non réconcilié ou ambiguïté de l'oracle.

## Télémétrie de la tentative

- cas : `baseline-pico-spider-mastered` ;
- statut : `INVALID` ;
- défaut : `SEMANTIC_DISAGREEMENT` ;
- input : `5 829` tokens ;
- sortie visible : `717` tokens ;
- reasoning : `0` token ;
- latence : `4 228 ms` ;
- provider request ID : `gen-1787336575-aDS4BzkqrNJqmwEzAHQP` ;
- raw SHA-256 : `fd44138bdf283df114d74eecca8a91e5ec7a9fb57e1c3d261989dd53ddacb70f`.

## Artefacts

Répertoire :

`benchmarks/ai-correction/results/writing-framework-selection-sonnet5-v2/2026-08-21T20-24-00-Europe-Paris`

- summary SHA-256 : `c843a7429a3674614f8de56b6bd4541513f40c23e051b479d6daa78a7f3eacef` ;
- ledger SHA-256 : `d9d8436a5d9288de95e5444aa355d8e4bf6c159831441850f525e5bac6b22a45` ;
- ledger final record hash : `95e26c61926cf06d7bb5e98d659fb90206843d71162cf778529e2f90fea598e0` ;
- événements : `CALL_INTENT`, `RAW_RECEIVED`, `CALL_OUTCOME`.

## Verdict et frontières

L'identité testée est close en `NO-GO_SEMANTIC_DISAGREEMENT`. Ce verdict ne
doit pas être contourné par une relance, un retuning ou une modification de
l'oracle sous la même identité.

Aucun pipeline n'est promu. Le panel 10 × 2, le holdout, V4-010 live et tout
appel supplémentaire restent fermés jusqu'à un nouvel arbitrage produit et
propriétaire sous une nouvelle identité si nécessaire.

## Validations du lot

- tests ciblés : `23/23` ;
- lint : vert ;
- typecheck : vert ;
- build : vert ;
- suite complète : `1 140/1 140` avec
  `NODE_OPTIONS=--no-experimental-webstorage`.
