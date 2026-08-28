# V4.1-402 — preuve PostgreSQL du ledger

Statut : `PASS`  
Date UTC : `2026-08-28`  
Branche Git testée : `codex/v4-1-402`  
Commit contenant les scénarios : `c51b356a`  
Commit final validé ensuite : `801dd64b`

## Environnement éphémère

- projet Neon : `dawn-cake-93662551` ;
- branche Neon : `br-summer-hall-aszhdudw` (`codex-v41-402-proof`) ;
- run id : `v41-402-rollback-20260828` ;
- base issue d'une branche isolée copy-on-write ;
- branche supprimée après la preuve ;
- aucune chaîne de connexion ni aucun secret n'est conservé dans Git.

## Commande reproductible expurgée

```bash
LEARNX_INTEGRATION_DATABASE=ephemeral \
DATABASE_URL='<ephemeral-neon-connection-string>' \
NEON_BRANCH_ID='br-summer-hall-aszhdudw' \
LEARNX_INTEGRATION_RUN_ID='v41-402-rollback-20260828' \
pnpm exec playwright test \
  --config=playwright.integration.config.ts \
  tests/integration/credit-ledger.spec.ts \
  --project=chromium-desktop
```

Le garde `requireEphemeralIntegrationDatabase` a vérifié l'identité de la
branche avant toute écriture.

## Résultat brut utile

```text
Running 2 tests using 1 worker

✓ ledger réel atomique, reconstructible et immuable (5.4s)
✓ un échec de finalisation annule toutes les écritures du règlement (2.1s)

2 passed (9.1s)
```

Les erreurs Prisma visibles pendant l'exécution sont attendues et font partie
des assertions : conflit sérialisable réessayé, rejet d'une mutation du ledger
append-only et exception forcée de finalisation.

## Invariants prouvés sur PostgreSQL réel

1. Deux réservations concurrentes de 120 crédits sur un solde de 200 ne peuvent
   pas toutes deux réussir : une seule réservation gagne, l'autre termine en
   `INSUFFICIENT_CREDITS` après la gestion du conflit sérialisable.
2. Un règlement de 80 crédits est idempotent et ne crée pas de second débit.
3. Le ledger refuse toute modification directe d'une écriture existante.
4. La projection reconstruite depuis le ledger retrouve les soldes attendus.
5. Une erreur forcée après la création des écritures de règlement mais avant la
   mise à jour finale de la réservation annule toute la transaction : zéro
   `RESERVATION_RELEASE`, zéro `SETTLEMENT`, réservation toujours `RESERVED`.
6. Après retrait du défaut forcé, la réservation peut être libérée normalement.

La persistance d'une tentative fournisseur sans coût ni identifiant est testée
séparément au niveau contrat : elle reste `ORPHANED`, avec `costSource` et
`costUsd` absents, jamais convertis en zéro. Le replay financier en état de
réconciliation reste bloqué.

## Nettoyage

- branche Neon `br-summer-hall-aszhdudw` supprimée après le run ;
- base PostgreSQL locale temporaire `learnx_v41_402_test` supprimée ;
- aucun artefact contenant des identifiants de connexion n'a été conservé.
