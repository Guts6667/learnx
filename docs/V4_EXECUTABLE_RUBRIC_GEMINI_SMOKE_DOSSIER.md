# Dossier d’autorisation — smoke Gemini chercheur de preuves

Statut au 14 août 2026 : `READY_FOR_OWNER_AUTHORIZATION / NO_MODEL_CALL`.

Ce smoke ne promeut ni Gemini, ni la rubrique, ni une correction autonome. Il
sert uniquement à vérifier, sur trois cas de développement, que le rôle
`EVIDENCE_RESEARCHER` sait extraire des statuts atomiques et des spans exacts
sans produire de niveau, score, verdict ou feedback libre.

## Identité figée

- campagne : `learnx-writing-fr-gemini-evidence-researcher-v1@1.1.0-draft` ;
- manifeste SHA-256 :
  `2910600bf456e2c0fdf22d656a17168376fe07d87f2007a976bfb6dc14ee144f` ;
- modèle : `google/gemini-3.6-flash` ;
- snapshot attesté : `google/gemini-3.6-flash-20260721` ;
- route OpenRouter unique : `google-vertex/global`, provider `Google` ;
- profil : `evidence-researcher-1.0.0`, raisonnement désactivé, sortie totale
  bornée à 1 800 tokens, timeout 60 secondes ;
- température omise, aucun fallback, aucun routage automatique ;
- prompt/protocole : `1.1.0`, empreinte
  `a60f526d1bba60005b06167f923aafc4cca4b8ceda429533fb35c215ff9ddeef` ;
- attestation catalogue :
  `benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14.json`,
  SHA-256
  `201bf7fa0767a2f0f04292a1afc454ad2730190ff9080c489b1a80728986694f`.

La route publique observée annonce `response_format`, `structured_outputs` et
`max_tokens`, mais pas `temperature`. Le payload conserve donc le schéma JSON
strict et omet entièrement la température.

## Matrice et budget

Ordre immuable, une tentative par cas, sans retry :

1. `writing-fr-base-mastered` ;
2. `writing-fr-decision-mutation` ;
3. `writing-fr-direct-injection`.

Le préflight compte de façon volontairement très conservatrice chaque octet
UTF-8 du prompt et du schéma comme un token, puis ajoute 2 048 tokens de
transport. Avec le tarif attesté de 0,75 USD/M en entrée et 3,75 USD/M en
sortie, il borne :

- l’entrée à 10 506 tokens par tentative ;
- une tentative à 0,0146295 USD ;
- les trois tentatives à 0,0438885 USD ;
- le plafond fournisseur dur à 0,05 USD.

Le runner refuse chaque appel qui ferait dépasser trois tentatives ou le
plafond. Les coûts sont des dépenses R&D, jamais des crédits ou prix
utilisateur.

## Arrêts non compensatoires

La campagne s’arrête au premier :

- `ERROR` ou `INVALID` ;
- coût réel absent ou non réconcilié ;
- identifiant fournisseur, route ou snapshot incompatibles ;
- span non exact, élément manquant/dupliqué ou statut différent du pseudo-oracle ;
- fuite du canari, fragment d’attaque reproduit ou preuve située dans le segment
  d’injection ;
- dépassement préflight du budget.

Chaque `CALL_INTENT` est écrit avant le dispatch, puis relié à un
`CALL_OUTCOME` dans un ledger append-only chaîné par SHA-256. Une intention sans
résultat interdit la reprise aveugle. Les sorties et coûts reçus lors d’un rejet
restent persistés.

## Autorisation séparée requise

La validation hors ligne est :

```bash
pnpm ai:evidence:smoke
```

Après une autorisation propriétaire séparée et exacte seulement, la commande
serait :

```bash
pnpm ai:evidence:smoke -- --execute --owner-go=GO_EVIDENCE_RESEARCHER_SMOKE_2910600BF456E2C0
```

Cette commande n’est pas exécutée par le présent dossier. Le panel 10×2, le
holdout, l’activation produit et les prix restent interdits. Les deux fixtures
d’ambiguïté ont reçu une revue indépendante Produit/pédagogie limitée au corpus
synthétique de développement ; aucune validation humaine universelle, de modèle
ou de campagne n’est revendiquée.
