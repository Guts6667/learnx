# Arbitrage Finance — gate evidence-assist quatre cas

Date : 20 août 2026

Baseline qualifiée : `251c6f7fd26361ffc57504dc06f3fb0d4ed91882`

Statut : `FINANCE_ARBITRATED / OWNER_AUTHORIZATION_NOT_GRANTED / NO_MODEL_CALL`

## Décision bornée

Finance & Pricing arbitre uniquement l'enveloppe R&D du gate
`learnx-writing-fr-sonnet-5-evidence-assist-four-case-v1` :

- plafond fournisseur maximal : `0,251136 USD` ;
- quatre appels fournisseur maximum, un par cas ;
- zéro retry et zéro fallback ;
- arrêt au premier défaut selon la politique gelée ;
- coût `ACTUAL` obligatoire pour chaque tentative envoyée ;
- tout coût absent ou non réconcilié ferme la campagne ;
- reliquat non transférable à une autre campagne.

Cet arbitrage n'est ni une autorisation propriétaire, ni un prix utilisateur,
ni une activation réseau. Il ne modifie aucun manifeste de campagne gelé et ne
crée aucun artefact HMAC d'exécution.

## Recalcul de la borne

Le snapshot tarifaire épinglé est
`anthropic-claude-sonnet-5-openrouter-anthropic-2026-08-15`, route OpenRouter
exacte `Anthropic`, sans routage automatique ni fallback :

- entrée : `0,000002 USD/token` ;
- sortie : `0,000010 USD/token` ;
- limite de sortie : `4 096` tokens ;
- borne d'entrée : `10 912` tokens, soit `8 387` octets de prompt, `477`
  octets de schéma et une provision transport de `2 048` tokens.

Calcul pessimiste d'une tentative :

`10 912 × 0,000002 + 4 096 × 0,000010 = 0,062784 USD`.

Calcul pessimiste de la campagne :

`4 × 0,062784 = 0,251136 USD`.

Le plafond est donc cohérent avec le profil, le snapshot et les quatre appels
maximum. Il ne dépend ni d'un cache, ni d'une promotion, ni d'un coût moyen.

## Enveloppes explicitement exclues

- Le plafond `0,21 USD` appartient au gate Sonnet 5 borné historique. Cette
  enveloppe est `FINANCE_RECONCILED_CLOSED_NO_REPLAY` après un coût réel de
  `0,026104 USD` ; elle n'est ni reprise ni transférée.
- Le panel conditionnel `10 × 2` conserve sa proposition maximale séparée de
  `1,258760 USD`. Elle n'est pas arbitrée par cette décision et exige, après un
  résultat `4/4`, un nouvel arbitrage Finance puis un nouveau GO propriétaire.

## Préflight et autorisation

Le préflight hors ligne a été rejoué sur la baseline :

- identité, profil, attestation, route et manifestes : valides ;
- mode : `VALIDATE_ONLY` ;
- statut : `HARD_OFF` ;
- appels modèle effectués : `0` ;
- réseau autorisé : `false`.

La sortie validate-only conserve volontairement
`authorization.financeArbitration=NOT_GRANTED` : ce champ décrit l'absence
d'un **artefact d'exécution signé**, pas l'état de la revue Finance consignée
ici. Il ne passera à `GRANTED` que dans l'autorisation éphémère produite après
un GO propriétaire séparé.

Le runner exige encore un artefact d'autorisation éphémère distinct :

- signature HMAC-SHA-256 avec secret d'au moins 32 octets ;
- nonce d'au moins 32 octets ;
- durée maximale de 15 minutes ;
- usage unique et consommation persistée avant dispatch ;
- identité d'exécution, campagne, étage, plafond `0,251136 USD` et quatre
  tentatives liés dans la signature ;
- `financeArbitration=GRANTED` et `ownerAuthorization=GRANTED` dans l'artefact.

Aucun secret, nonce, jeton propriétaire ou artefact signé n'est stocké dans le
dépôt. L'arbitrage présent satisfait la revue Finance préalable ; seul un GO
propriétaire postérieur peut autoriser la création éphémère de l'artefact.

## Verdict

`ARBITRATED_FOR_OWNER_DECISION` pour le gate quatre cas uniquement.

Les manifestes de campagne et leur freeze set restent byte-identiques. Le
panel, le holdout, V4-002 publié, V4-010 live, les crédits réels et tout prix
utilisateur restent fermés.
