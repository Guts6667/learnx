# V4-009C — Rapport de préparation hors ligne

Date : 2026-08-13
Verdict : `READY_FOR_EXPLICIT_OWNER_GO`

## Campagne gelée

- expérience : `learnx-fr-text-gemini-deterministic-safety-v1@1.0.0` ;
- modèle : `google/gemini-3.6-flash`, snapshot fournisseur
  `google/gemini-3.6-flash-20260721` ;
- route unique : `Google AI Studio`, aucun fallback ni route automatique ;
- profil `2.0.0`, prompt `2.0.0`, protocole `3.0.1` ;
- enveloppe déterministe `1.0.0` ;
- corpus `learnx-french-text-corpus-v1-3`, aucun holdout ;
- 10 cas × 2 répétitions = 20 workflows Gemini seuls ;
- au plus 40 tentatives, retries compris ; plafond dur `0,50 USD`.

Manifeste :
`benchmarks/ai-correction/gemini/v4-009c-run-manifest.json` ; SHA-256 fichier
`4c6d1e320210828f2c3ed6038ff4e7cd9c0e9e07a0cb7f53439c10d41b25010d` ;
fingerprint canonique
`92fb511f25428b5e886f6194d4953701f8933170261d8404d04b95b0b0ea9912`.

Le catalogue OpenRouter a été lu le 13 août sans génération. La route Google AI
Studio annonce `response_format`, `structured_outputs`, `max_tokens`,
`temperature` et le raisonnement. Le tarif standard figé est de 1,50 USD/M
tokens d'entrée et 7,50 USD/M tokens de sortie/raisonnement.

## Enveloppe déterministe

Les contexte, consigne et réponse sont normalisés par transformations Unicode
strictement bornées et restent dans trois segments distincts. Le détecteur
lexical ne fait qu'ajouter un signal audité ; la réponse originale normalisée
est conservée. Les faux positifs pédagogiques sur des textes expliquant la
prompt injection sont testés.

Après génération, LearnX impose le schéma protocole 3, les clés exactes de la
rubrique, la cohérence des preuves, leur résolution unique dans `responseText`,
l'absence du canari et des fragments d'attaque. Une sortie non sûre n'est ni
publiée ni considérée utilisable.

## Exécution et reprise

Chaque tentative écrit un `CALL_INTENT` avant l'appel puis un `CALL_OUTCOME`
chaîné par SHA-256. L'idempotency key lie le fingerprint du manifeste, la
cellule et le numéro de tentative. Une reprise refuse un ledger altéré et ne
rejoue aucune cellule terminée. Le préflight garantit simultanément le plafond
de 40 tentatives et le plafond de 0,50 USD.

La phase aveugle contient uniquement rubrique, contexte, consigne, réponse et
sortie. Le mapping caseId/répétition est séparé ; modèle, route, catégorie,
gold, coût et signaux internes sont absents de la phase 1.

## Historique et portée

Le `NO-GO` V4-009B reste immuable. Son extension Mistral–Sonnet n'est pas
exécutée. V4-009C ne promeut aucun modèle, n'ouvre pas le holdout et n'active ni
V4-010, ni production, ni prix.

## Preuves hors ligne

- tests ciblés V4-009C : 13/13 ;
- suite complète : 132 fichiers, 804 tests ;
- lint : réussi ;
- typecheck : réussi ;
- build PWA : réussi ;
- validation benchmark : 24 cas et 12 modèles épinglés ;
- validation runner : `OWNER_GO_REQUIRED`, aucun appel modèle.
