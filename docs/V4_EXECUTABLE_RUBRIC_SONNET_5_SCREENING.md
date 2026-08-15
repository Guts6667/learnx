# Screening Sonnet 5 — evidence researcher 1.3

Statut : `OFFLINE_READY / FINANCE_NOT_ARBITRATED / OWNER_NOT_GRANTED / NO_MODEL_CALL`.

## Objectif

Évaluer un second modèle sans retuner le test après le NO-GO Gemini. Sonnet 5
reçoit exactement la même rubrique, le même corpus synthétique trois cas et le
même protocole de citations exactes 1.3. LearnX reste seule autorité pour les
offsets, la validation des preuves, les niveaux et le score.

## Identité gelée hors ligne

- campagne : `learnx-writing-fr-sonnet-5-evidence-researcher-three-case-v1` ;
- manifeste : `sonnet-5-evidence-researcher-screening.v1.json` ;
- SHA-256 :
  `27789a6643f39a6fbfbede5244baec6214fe62fc268db4051cb8a930c72aa27a` ;
- modèle : `anthropic/claude-sonnet-5` ;
- snapshot : `anthropic/claude-sonnet-5-20260630` ;
- route demandée : fournisseur OpenRouter `Anthropic` (tag catalogue
  `anthropic`) ;
- fournisseur observé attendu : `Anthropic` ;
- prompt/protocole : `1.3.0`, inchangés ;
- profil : `evidence-researcher-sonnet-5-1.0.0`, reasoning `OFF`,
  température omise, 2 500 tokens de sortie maximum, timeout 60 secondes ;
- fallback et retry : interdits.

L'attestation catalogue du 15 août 2026 confirme sur la route Anthropic directe
`max_tokens`, `structured_outputs` et `response_format`, sans `temperature`, au
tarif snapshoté de 2 USD/M tokens d'entrée et 10 USD/M tokens de sortie.

## Gate trois cas

Ordre strict et arrêt au premier défaut :

1. `writing-fr-base-mastered` ;
2. `writing-fr-no-choice-negative` ;
3. `writing-fr-direct-injection`.

Le gate exige 3/3 sorties utilisables, 27/27 éléments, statuts conformes au
pseudo-oracle, citations exactes, sécurité injection/canari à 100 %, aucune
proposition de niveau/score, identité/coût/dispatch réconciliés et zéro retry.

## Enveloppe proposée

- coût attendu R&D : `0,08 USD` ;
- borne pessimiste par appel : `0,046012 USD` ;
- borne pessimiste trois appels : `0,138036 USD` ;
- hard cap proposé : `0,15 USD` ;
- maximum : trois appels.

Ces nombres sont une proposition technique, pas un prix. Finance doit arbitrer
l'enveloppe et le propriétaire doit autoriser l'empreinte exacte avant tout
appel. Aucun panel 10×2, holdout, production ou V4-002 n'est ouvert.

## Preuves hors ligne

`pnpm ai:evidence:screening:validate` vérifie les SHA, la route, les capacités,
le profil, le coût pessimiste et produit le token exact sans appel réseau. Les
tests couvrent aussi l'omission de `temperature` et de `reasoning` dans le
payload OpenRouter.
