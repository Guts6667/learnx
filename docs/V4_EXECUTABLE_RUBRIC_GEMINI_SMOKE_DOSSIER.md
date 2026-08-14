# Dossier d’autorisation — smoke Gemini chercheur de preuves

Statut au 14 août 2026 : `COMPLETED / NO_GO_TECHNICAL_PROFILE`.

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

## Résultat du smoke autorisé

L’autorisation propriétaire a été reçue pour trois appels maximum et un plafond
dur de 0,05 USD. Le runner a exécuté une seule tentative, puis s’est arrêté
conformément au manifeste au premier `INVALID` :

- run : `2026-08-14-evidence-researcher-smoke-v1-1-0` ;
- cas : `writing-fr-base-mastered` ;
- statut : `INVALID`, code `MODEL_OUTPUT_TRUNCATED` ;
- coût fournisseur réel : `0,008241 USD` ;
- budget restant : `0,041759 USD` ;
- latence : `1 790 ms` ;
- usage : 2 068 tokens d’entrée, 1 725 tokens de raisonnement et 59 tokens de
  sortie visible ;
- identifiant fournisseur :
  `gen-1786708936-OJp5N5RuDTc2SevfeJmR` ;
- modèle retourné : `google/gemini-3.6-flash`, provider `Google`.

Le profil interne demandait un raisonnement désactivé en omettant le paramètre,
mais la route a tout de même consommé 1 725 des 1 800 tokens de sortie totale en
raisonnement. Il ne restait que 59 tokens visibles et la réponse a été tronquée.
Il s’agit d’un échec technique du profil/transport sous cette identité, pas d’un
verdict pédagogique sur Gemini. La sortie brute n’a pas été fournie au runner
après le `finish_reason=length` et n’est donc pas analysable pédagogiquement.

Les deuxième et troisième appels n’ont pas été envoyés. Aucun retry, relèvement
de plafond ou changement silencieux de profil n’est permis sous l’identité
1.1.0. Une nouvelle expérimentation exige un profil versionné distinct, un
nouveau préflight et une nouvelle autorisation.

## Preuves scellées

Les artefacts locaux restent exclus du dépôt conformément à la politique des
résultats de benchmark. Le dossier de run contient un `CALL_INTENT` et un
`CALL_OUTCOME`, sans intention orpheline :

- état SHA-256 :
  `b99e3f5a53a473fb08b4608efb08152c3473eb110d3f2d453b25dbfd6b58be84` ;
- ledger SHA-256 :
  `abd9aaae2ceb9e2d1b808234d19e11875a4d65df990283ccfd4c6fa98dd9da0e` ;
- dernier hash de chaîne :
  `19053f8b2d0569c669a2f82227ac1dcf8b7b95d10f069a11b3529f1122f7aa73`.

## Commandes

La validation hors ligne est :

```bash
pnpm ai:evidence:smoke
```

La commande autorisée et exécutée une fois était :

```bash
pnpm ai:evidence:smoke -- --execute --owner-go=GO_EVIDENCE_RESEARCHER_SMOKE_2910600BF456E2C0 --run-id=2026-08-14-evidence-researcher-smoke-v1-1-0
```

Ne pas la rejouer : son `run-id` et son ledger sont désormais des preuves
historiques. Le panel 10×2, le holdout, l’activation produit et les prix restent
interdits. Les deux fixtures d’ambiguïté ont reçu une revue indépendante
Produit/pédagogie limitée au corpus synthétique de développement ; aucune
validation humaine universelle, de modèle ou de campagne n’est revendiquée.
