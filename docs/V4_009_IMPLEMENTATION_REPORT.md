# V4-009 — Rapport d’implémentation

## Contrat livré

V4-009 introduit une orchestration composite persistante et reprenable reliant un
devis immuable, une réservation de crédits, une correction et son résumé financier.
Le fournisseur reste hors transaction ; chaque frontière durable permet une reprise
sans double débit ni nouvel appel aveugle.

Le moteur refuse l’appel fournisseur avant validation du devis et confirmation de la
réservation. Il revalide kill switch, budget et limites avant chaque rôle via un port
serveur. Les coûts utilisés pour le règlement proviennent exclusivement du coût réel
persisté ; les tokens ne servent pas à reconstruire la facture.

## États et reprise

- `SETTLEMENT_PENDING` et `RELEASE_PENDING` séparent résultat pédagogique et effet
  ledger.
- `RECONCILIATION_REQUIRED` empêche tout débit lorsque le coût réel manque.
- Une lease protège la réservation pendant une exécution acceptée et empêche son
  expiration au milieu d’un appel.
- Les identités de dispatch et les coûts des retries restent auditables et absorbés.
- Le calcul financier et le résultat attendu sont snapshotés avant l'effet ledger :
  après un crash, la reprise rejoue uniquement le règlement ou la libération
  idempotente, sans rappeler le fournisseur.
- Les états terminaux financiers garantissent
  `plafond = réglé + libéré`.

## Preuves hors ligne

- `pnpm lint` : réussi.
- `pnpm typecheck` : réussi.
- `NODE_OPTIONS=--no-experimental-webstorage pnpm test` : 126 fichiers et
  728 tests réussis.
- `pnpm build` : réussi, client et service worker générés.
- `pnpm exec prisma validate` et `pnpm prisma:generate` : réussis.
- `git diff --check` : réussi.

La migration n'a pas été appliquée à une base partagée. Sa répétition sur une
branche Neon jetable avec URL directe reste une gate de déploiement, à exécuter
quand le commit parent V4-008A et ce ticket seront publiables dans le workflow CI.

## Compatibilité et activation

Les historiques mono-modèles restent inchangés et leurs nouvelles relations sont
nullables. Aucun backfill destructif n’est effectué. Les catalogues et pipelines
composites restent DRAFT/INACTIVE : ce ticket ne rend aucune correction facturable
ou disponible en production.

## Limites reportées

- La conversion USD/crédits et les valeurs économiques nécessitent la calibration.
- Le worker/deployment asynchrone et les endpoints apprenants relèvent des tickets
  suivants.
- La réconciliation auprès du fournisseur est modélisée, mais son job opérationnel
  dépend de l’infrastructure de production retenue.
- Aucun achat ni paiement n’est inclus.
