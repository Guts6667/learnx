# V4-009C — préparation du gate Sonnet 5 à raisonnement borné

> **CLOSED_REQUEST — CAMPAGNE EXÉCUTÉE ET NO-GO.** Le résultat autoritaire est
> `docs/V4_EXECUTABLE_RUBRIC_SONNET_5_BOUNDED_GATE_RESULT.md`. Aucun plafond ou
> GO décrit ici n'est réutilisable.

Date : 16 août 2026
Statut historique final : `NO_GO_TECHNICAL_REQUEST_PROFILE / NO_REPLAY`

## Objet

Cette campagne remplace uniquement le profil Sonnet 5 fermé après le panel du
15 août. Elle ne réécrit ni ce panel, ni son coût, ni son verdict technique.
Elle garde Sonnet 5 dans le rôle strict de chercheur de preuves : le modèle
retourne des statuts atomiques et des citations, tandis que LearnX résout les
citations exactes, exécute la rubrique et calcule les niveaux et le score.

## Nouvelle identité

- modèle : `anthropic/claude-sonnet-5` ;
- snapshot : `anthropic/claude-sonnet-5-20260630` ;
- route unique : `Anthropic`, sans fallback ;
- protocole et prompt evidence researcher : `1.3.0`, inchangés ;
- request profile : `evidence-researcher-sonnet-5-3.0.0` ;
- raisonnement : `EXPLICIT_MAX`, `1 024` tokens ;
- capacité totale de complétion : `2 824` tokens ;
- réserve de sortie visible : `1 800` tokens ;
- température omise, timeout `60 s`, structured outputs stricts.

Le transport envoie simultanément `reasoning.max_tokens=1024` et
`max_tokens=2824`. LearnX refuse hors ligne une identité dont la limite totale
n'est pas exactement égale au maximum de raisonnement plus la réserve visible.
Au runtime, une sortie sans token visible, un raisonnement supérieur à 1 024 ou
un total supérieur à 2 824 échoue le gate sans retry.

L'API catalogue OpenRouter observée le 16 août annonce, pour la route Anthropic,
`reasoning`, `max_tokens`, `response_format` et `structured_outputs`, avec une
limite de complétion de 128 000 tokens. La documentation OpenRouter précise que
`reasoning.max_tokens` contrôle directement le budget Anthropic, dont le
minimum est 1 024, et que `max_tokens` doit rester strictement supérieur afin
de laisser de la place à la réponse finale. Cette attestation prouve la
capacité déclarée, pas encore son respect en exécution.

Sources :

- <https://openrouter.ai/api/v1/models/anthropic/claude-sonnet-5/endpoints>
- <https://openrouter.ai/docs/guides/best-practices/reasoning-tokens>

## Gate préenregistré

Quatre cas existants, immuables, une répétition chacun et aucun résultat
historique réutilisé :

1. `writing-fr-base-mastered` — positif évident ;
2. `writing-fr-no-choice-negative` — négatif explicite ;
3. `writing-fr-evidence-mutation` — mutation critique de preuve et de
   raisonnement ;
4. `writing-fr-direct-injection` — injection directe.

Le gate exige notamment `4/4` workflows utilisables, `36/36` éléments,
`100 %` d'accord atomique, de citations exactes, de sécurité injection/canari,
d'identité fournisseur et de réconciliation coût/dispatch. Il interdit tout
niveau, score ou verdict proposé par le modèle, tout faux `SUPPORTED` sur le
contrôle mécanique, tout retry, fallback ou retuning après résultat.

## Budget proposé, non autorisé

Le validate-only calcule une borne d'entrée de `10 506` tokens, une borne
pessimiste de `0,049252 USD` par tentative et `0,197008 USD` pour quatre
tentatives. Le manifeste propose `0,12 USD` attendu et `0,21 USD` de plafond
dur. Ces montants restent `PROPOSED_NOT_APPROVED` tant que Finance n'a pas
arbitré l'empreinte exacte.

## Prochaines barrières

Avant tout appel : validations complètes, commit reproductible, arbitrage
Produit/pédagogie, arbitrage Finance et autorisation propriétaire citant
l'empreinte et le token exacts. Un succès `4/4` autoriserait uniquement la
préparation d'un nouveau panel 10×2 sous la même identité. Le holdout, V4-002,
V4-010 et toute activation restent fermés.
