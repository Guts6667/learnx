# V4-003E-Q1 — résultat du gate réseau Gemini 3.6

Verdict : `NO-GO_TECHNICAL_PROVIDER_HTTP_400 /
RECONCILIATION_REQUIRED`.

Ce verdict concerne le transport de l'identité exacte
`ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed`.
Il ne constitue pas un verdict pédagogique sur Gemini.

## Exécution

- autorisation : `a1450be22b255ad7c20d43a76aafc8ea05fa4f5b4af8183b25a1887245b7c906` ;
- modèle demandé : `google/gemini-3.6-flash` ;
- route demandée : `google-vertex/global` ;
- premier cas : `baseline-pico-spider-mastered` ;
- appels exécutés : `1/4` ;
- retries et fallbacks : `0` ;
- appels non envoyés après l'arrêt : `3` ;
- workflows utilisables : `0/4`.

Le fournisseur a répondu `HTTP 400`. Le raw OpenRouter persiste l'erreur Google
`INVALID_ARGUMENT` avec le message générique « Request contains an invalid
argument. ». Il ne permet pas d'identifier honnêtement quel argument a été
refusé. Aucun diagnostic plus précis n'est donc affirmé.

Le raw a été écrit avant validation. Le ledger contient exactement, dans cet
ordre, `CALL_INTENT`, `RAW_RECEIVED`, `CALL_OUTCOME`.
La vérification hors ligne du paquet et de la chaîne porte l'empreinte
`1192bb02f40d4c5ac159be91738b7696e3c615049f7e428b6618a07d6e2b00b4`.

## Traçabilité et coût

La réponse d'erreur ne contient ni `providerRequestId`, ni usage, ni coût
`ACTUAL`. Elle est donc classée `TRACEABILITY`, `FINANCE` et `IDENTITY` dans
l'artefact, puis `RECONCILIATION_REQUIRED`. Le raw identifie Google dans ses
métadonnées, mais cette valeur n'a pas été normalisée dans le champ
`observedProvider` de la tentative ; aucune concordance d'identité n'est
inventée après coup.

Le coût réel est **inconnu**, jamais zéro. La réserve prudente de la tentative,
`0,1208415 USD`, reste immobilisée jusqu'à réconciliation. Le champ
`totalActualCostUsd: 0` du résumé initial est conservé comme sortie historique
du lanceur, mais un addendum append-only interdit de l'interpréter comme un coût
réconcilié. Le lanceur est corrigé pour produire `null` lors d'une prochaine
sortie non réconciliée.

## Conséquences

L'autorisation single-use est consommée par cet appel et ne peut pas être
rejouée pour contourner l'arrêt. Aucun panel `10 × 2`, holdout ou lancement
V4-010 n'est ouvert. Une nouvelle expérimentation exigerait un diagnostic
hors ligne, une nouvelle identité si le payload ou le profil change, une
nouvelle enveloppe si nécessaire et un nouveau GO propriétaire.
