# V4-003E-Q1 — dossier Gemini 3.6 hors ligne

Statut : `HARD_OFF_PREFLIGHT_GREEN / IDENTITY_PREPARED_NOT_APPROVED /
FINANCE_DRAFT_NOT_ARBITRATED / NETWORK_FORBIDDEN`.

Baseline : `origin/dev@c8ae231c94e961e44461ef678d9a1c0924cc5f4c`.
Cette préparation n'a effectué aucun appel modèle et ne réutilise aucun résultat,
budget ou GO Sonnet.

## Identité proposée

- modèle transport : `google/gemini-3.6-flash` ;
- snapshot catalogue : `google/gemini-3.6-flash-20260721` ;
- route unique : `google-vertex/global` ;
- provider attendu : `Google` ;
- fallback : interdit ;
- protocole : `3.0.0`, validateur `2.0.0`, segmentation `2.0.0` ;
- raisonnement obligatoire, effort `MINIMAL`, sans budget exact ;
- `temperature` omise ;
- sortie totale `2 500` tokens, cible visible `1 800`, timeout `60 s` ;
- empreinte identité :
  `ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed`.

Le model ID principal est celui à envoyer sur le transport. Le snapshot daté est
attesté séparément : le catalogue public le nomme, mais son endpoint direct daté
n'est pas une cible transport autonome. Toute divergence lors d'une future
réattestation bloque avant réseau.

## Attestation catalogue et tarifs

La lecture publique OpenRouter du 21 août 2026 confirme sur la route épinglée :

- `response_format`, `structured_outputs` et `max_tokens` ;
- raisonnement obligatoire, efforts `high|medium|low|minimal` ;
- absence de `temperature` dans les paramètres supportés ;
- contexte `1 048 576`, sortie maximale catalogue `65 536` ;
- route unique épinglable, sans fallback ni route automatique.

Le calcul Finance utilise les tarifs standards hors promotion à réattester :
`1,50 USD/M` en entrée et `7,50 USD/M` en sortie + raisonnement. Le prix
promotionnel affiché par le catalogue n'est pas utilisé.

La précédente proposition `0,075 USD` n'est pas transférée. En appliquant la
borne S2 prudente (`65 536` octets, schéma `477`, marge transport `2 048`,
`2 500` tokens sortie + raisonnement), le nouveau calcul DRAFT donne :

- `0,1208415 USD` maximum par tentative ;
- `0,483366 USD` pour quatre tentatives ;
- plafond arrondi proposé à Finance : `0,50 USD`.

Ces valeurs ne sont ni un budget actif ni une autorisation de dépense.

## Préflight HARD_OFF

Le runner S2 accepte désormais une identité candidate fournie par dossier au lieu
de coder Sonnet/Anthropic dans son cœur. Son provider réseau historique reste
spécifique Sonnet et n'est pas utilisable pour Gemini dans Q1.

Le faux fournisseur déterministe a exécuté les quatre cas dans l'ordre gelé :

1. `baseline-pico-spider-mastered` ;
2. `fidelity-a-explicit-refusal` ;
3. `fidelity-a-first-fact-removed` ;
4. `injection-negative-base-remains-partial`.

Résultat : `4/4 VALID`, `12` événements append-only, raw persisté avant
validation, message maximal `12 321` octets, replay `0` exécution provider,
`modelCallsPerformed=0`, `networkCallsAllowed=false`.

L'artefact de preuve porte l'empreinte
`9d7dee2afcba338d3354b2d2478f42378307d0b281edfe400c8eb4723f87475e`.
Les empreintes corpus, mapping, runner, télémétrie et politique d'arrêt sont
strictement identiques au core Sonnet clos.

## Arbitrages encore requis

Avant tout réseau, Rayan doit successivement :

1. approuver l'identité exacte `ef88a8e…` et le profil proposé ;
2. obtenir l'arbitrage Finance sur les tarifs réattestés et le plafond DRAFT ;
3. autoriser séparément une exécution single-use, quatre appels maximum, aucun
   retry ni fallback, séquentielle et arrêt au premier défaut.

Cette préparation n'ouvre ni panel `10 × 2`, ni holdout, ni publication de
contrat, ni V4-010 live.
