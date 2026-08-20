# Résultat du gate evidence-assist quatre cas

Date d’exécution : 20 août 2026

Campagne : `learnx-writing-fr-sonnet-5-evidence-assist-four-case-v1`

Verdict : `NO_GO_SEMANTIC_DISAGREEMENT / CAMPAIGN_CLOSED / NO_REPLAY`

## Résumé décisionnel

Le gate s’est arrêté conformément à sa politique après le deuxième appel. Le
premier cas positif est entièrement utilisable. Le deuxième cas, négatif, a
produit une divergence sémantique avec le pseudo-oracle gelé. Les cas mutation
et injection n’ont pas été envoyés. Le panel conditionnel 10 × 2, le holdout,
V4-010 live et toute publication restent fermés.

Le stop est **procéduralement légitime et obligatoire** : le gate exigeait
`4/4`, `100 %` d’accord atomique et un arrêt au premier défaut. Il ne faut ni
reprendre l’identité, ni changer l’attente après lecture du résultat.

La divergence n’est cependant pas une erreur pédagogique évidente du modèle.
Elle met en lumière une frontière de représentation entre une absence de
preuve et une preuve explicite du contraire.

## Exécution et coût

| Mesure | Résultat |
| --- | --- |
| Appels autorisés | 4 maximum |
| Appels effectués | 2 |
| Appels non envoyés | 2 |
| Retry / fallback | 0 / 0 |
| Workflows utilisables | 1 |
| Coût du cas positif | `0,013046 USD` |
| Coût du cas négatif | `0,012576 USD` |
| Coût total exact | `0,025622 USD` |
| Plafond autorisé | `0,251136 USD` |
| Réconciliation | `100 %` |
| Route demandée | `Anthropic` |
| Fournisseur observé | `Anthropic` |
| Modèle observé | `anthropic/claude-sonnet-5` |

Les deux `CALL_INTENT`, les deux `CALL_OUTCOME`, les sorties brutes, leurs
empreintes, les identifiants fournisseur et les coûts `ACTUAL` sont conservés
dans le dossier du run. L’autorisation HMAC est consommée une seule fois avant
le premier dispatch.

Limite de mesure : le runner a persisté le coût total et sa source, mais pas le
détail des tokens d’entrée, de raisonnement et de sortie visible. Ces valeurs
ne sont donc pas reconstituées. Cette lacune de télémétrie devra être corrigée
sous une nouvelle identité avant une autre campagne.

## Divergence exacte

Cas : `writing-fr-no-choice-negative`.

Le texte contient notamment :

- « Je rapporte ces deux observations sans choisir entre l’achat
  d’ordinateurs et l’ouverture d’un troisième créneau. »
- « Je ne formule aucune recommandation. »

Pour `identifiable-choice` et `explicit-recommendation`, le gold gelé porte le
statut `NOT_DEMONSTRATED`. Le mapping de campagne accepte alors uniquement
`ABSTAIN` ou `OMITTED`. Sonnet a proposé
`EVIDENCE_AGAINST_ELEMENT`, avec les passages exacts ci-dessus.

Cette sortie est cohérente avec la définition générale de
`EVIDENCE_AGAINST_ELEMENT` : les phrases réfutent explicitement les
propositions positives « un choix est identifiable » et « une recommandation
est formulée ». Mais le pseudo-oracle ne possédait pas de statut distinct pour
« preuve explicite du contraire ». L’évaluateur devait donc classer la relation
comme `SEMANTIC_DISAGREEMENT`.

Le cas négatif obtient `7/9` relations atomiques concordantes. Avec `9/9` sur
le cas positif, le résultat cumulé est `16/18`, soit `88,8889 %`. Il n’y a
aucun faux support, identifiant inconnu, champ interdit, défaut de schéma, de
finance, d’identité ou de traçabilité.

## Ce que le résultat ne prouve pas

- Le cas injection n’a pas été exécuté. Le taux de sécurité de `100 %` reflète
  uniquement les deux workflows effectivement observés ; il ne constitue pas
  une preuve de résistance à l’injection pour cette campagne.
- Le modèle n’est ni promu ni disqualifié globalement.
- Le pipeline 10 × 2 n’est pas autorisé.
- Le holdout scellé n’est ni ouvert ni exécuté.
- Aucun contrat, prix, crédit ou flow live n’est activé.

## Recommandation pour une étape ultérieure

1. Fermer définitivement cette identité en `NO_GO`, sans replay.
2. Arbitrer hors ligne si le système doit distinguer :
   `NOT_DEMONSTRATED` d’une part et « proposition explicitement réfutée »
   d’autre part.
3. Tester mécaniquement cette sémantique sur des paires minimales, sans modèle :
   absence silencieuse, abstention, négation explicite et contradiction.
4. Si l’ontologie ou le mapping change, créer une nouvelle version du corpus,
   du gold, de l’évaluateur et de l’identité ; recommencer au gate quatre cas
   avec de nouveaux arbitrages Finance et propriétaire.
5. Persister les composants d’usage fournisseur dans le prochain runner avant
   toute nouvelle enveloppe.

Ces recommandations ne constituent pas une autorisation d’implémentation ou
d’appel supplémentaire.

## Artefacts

- Run :
  `benchmarks/ai-correction/results/evidence-assist/four_case_gate/2026-08-20T17-00-06Z/`
- Résumé machine : `summary.json`
- État, tentatives et ledger : `state.json`
- Sorties brutes : `raw-received/`
- Analyse post-run : `review.json`
- Consommation HMAC :
  `benchmarks/ai-correction/results/evidence-assist/authorization-consumptions/gate4-52627a09-5b87-41b9-bec6-0c415d794246.json`
