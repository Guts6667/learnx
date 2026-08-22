# V4-003E-Q1 — préflight du raccord réseau Gemini 3.6

Statut : `IDENTITY_APPROVED / FINANCE_APPROVED / SIMULATED_TRANSPORT_GREEN /
NETWORK_GO_NOT_GRANTED`.

Baseline : `origin/dev@df368cd2e1338cb3d817fa9b8b221654fab8f31d`.
Cette passe est strictement hors ligne : aucun appel OpenRouter, Google Vertex ou
modèle n'a été effectué.

## Ce qui est approuvé

Rayan a approuvé trois éléments qui ne valent pas autorisation réseau :

- l'identité exacte
  `ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed` ;
- le plafond fournisseur single-use de `0,50 USD` pour quatre tentatives au
  maximum ;
- la réserve de trésorerie prudente de `0,652 USD`.

Les deux calculs chargés doivent rester distincts :

- `0,483366 × 1,30398 = 0,63029959668 USD` applique le facteur à la borne
  calculée ;
- `0,50 × 1,30398 = 0,65199 USD`, affiché `0,652 USD`, applique le facteur au
  plafond arrondi approuvé.

Ces montants sont une enveloppe R&D, pas un prix produit.

## Transport simulé

Le provider dérive sa requête du dossier gelé et refuse toute divergence :

- modèle `google/gemini-3.6-flash` ;
- snapshot `google/gemini-3.6-flash-20260721` ;
- route unique `google-vertex/global`, provider attendu `Google` ;
- raisonnement obligatoire `MINIMAL`, `temperature` absente ;
- limite totale sortie + raisonnement `2 500`, cible visible `1 800`, timeout
  `60 s` ;
- aucun retry, fallback ou héritage Sonnet/Anthropic.

Les tests utilisent uniquement un `fetch` simulé et un faux provider local. Ils
prouvent : payload exact, `CALL_INTENT` avant dispatch simulé, raw avant
validation, coût ACTUAL obligatoire, identifiant fournisseur obligatoire,
timeout marqué `ORPHANED`, plafond fail-closed, arrêt au premier défaut et
reprise sans second appel.

Résultat transport/runner : `31/31` tests verts. Le candidat est obligatoire et
le namespace propriétaire est `GO_V4_003E_Q1_GEMINI36_*` ; un candidat absent
ou l'ancien jeton Sonnet échoue avant lecture de clé et avant réseau. L'artefact
de préflight porte l'empreinte
`317966c06fed11a96a004932e60a8540a3bafb01cc7eceb629c878dada71a079`.

## Barrière réseau

Le script accepte `--candidate=gemini-3.6` en validation seule. Son chemin
`--execute` reste bloqué par l'enveloppe persistée :
`ownerNetworkAuthorization=NOT_GRANTED` et `modelCallsAllowed=false`.
Un token calculé ne suffit donc pas à envoyer une requête.

Avant un futur appel réel, il faudra un GO propriétaire distinct, matérialisé
par une autorité additive qui ouvre exactement cette identité et cette enveloppe.
Le panel `10 × 2`, le holdout, V4-010 live et tout prix produit restent fermés.
