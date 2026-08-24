# V4-003E-Q1 — Réconciliation du coût Gemini 3.6

## Statut

`RECONCILIATION_REQUIRED`

Le gate clos du 22 août 2026 conserve un coût fournisseur inconnu et une
réserve maximale non libérée de `0,1208415 USD`. L'absence de coût dans la
réponse HTTP 400 ne vaut jamais zéro.

## Tentative de réconciliation du 22 août 2026

- appel concerné : `2026-08-22T07:08:18.938Z` ;
- modèle : `google/gemini-3.6-flash` ;
- route demandée : `google-vertex/global` ;
- endpoint consulté en lecture seule : `GET /api/v1/activity?date=2026-08-22` ;
- résultat : HTTP 400, car l'API d'activité n'accepte que les jours UTC
  terminés ;
- consultation UI : impossible dans la session disponible, non authentifiée ;
- génération, modification du compte et dépense effectuées pendant cette
  tentative : aucune.

Le brut Q1 ne contient ni `X-Generation-Id`, ni `providerRequestId`. L'API
Generation ne peut donc pas être interrogée directement pour cet appel.

## Procédure terminale

1. À partir du 23 août 2026 UTC, interroger l'activité du 22 août avec une clé
   de gestion, filtrée par le hash de la clé du gate.
2. Si une seule ligne Google/Gemini 3.6 correspond à l'appel, enregistrer son
   montant comme `ACTUAL` et joindre la réponse assainie à un nouvel artefact
   append-only.
3. Si plusieurs appels sont agrégés, utiliser l'interface Activity ou le support
   OpenRouter pour obtenir la génération exacte ; ne pas répartir le total par
   hypothèse.
4. Si aucune preuve fournisseur plus précise n'est récupérable, une décision
   Finance distincte peut comptabiliser au maximum `0,1208415 USD` comme
   `CONSERVATIVE_WRITE_OFF`. Cette décision exige un artefact d'autorisation et
   ne doit jamais être produite automatiquement par le runner.

Tant qu'aucune des étapes 2 ou 4 n'est matérialisée, la campagne reste en
`RECONCILIATION_REQUIRED` et son autorisation single-use reste consommée.

## Sources externes

- activité : <https://openrouter.ai/docs/api/api-reference/analytics/get-user-activity>
- génération : <https://openrouter.ai/docs/api/api-reference/generations/get-generation>
