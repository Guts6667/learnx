# V4-008 — Registre de consultation

**Statut du ticket :** consultations reçues et arbitrées ; implémentation autorisée
sur des politiques versionnées laissées `DRAFT` ou `INACTIVE`.

**Date du registre :** 2026-08-12

**Périmètre :** administration des allocations, limites et budgets.

**Hors périmètre confirmé :** prix, packs, paiement, moteur composite,
V4-008A, V4-009, V4-010 et appels modèle facturables.

## Consultations obligatoires

| Consultation | Statut | Date | Périmètre transmis | Réponse reçue | Décisions retenues | Inconnues restantes |
| --- | --- | --- | --- | --- | --- | --- |
| Finance & Pricing | `ARBITRATED` | 2026-08-12 | Origines de crédits, lots, réservations, renouvellement, limites, budgets, suspension et ajustements. | Retour consolidé transmis au propriétaire puis amendé par la version 1.2.0 du backlog. | Deux origines séparées ; ledger/lots immuables ; projections dérivées ; achats protégés ; paramètres économiques configurables et inactifs. | Montants, ordre de consommation, cadence, expiration, report, grâce et limites restent volontairement non arbitrés. |
| Produit & pédagogie | `ARBITRATED` | 2026-08-12 | Compréhension des soldes, alertes, demandes d'augmentation et absence de promesse trompeuse. | Cadrage produit transmis puis arbitré par le propriétaire. | « Allocation offerte » et « Crédits achetés » sont les lignes principales ; total secondaire ; demande d'augmentation sans attribution automatique ; aucun prix fictif. | Valeurs et politiques d'activation restent à calibrer hors V4-008. |
| Direction artistique | `RECEIVED` | 2026-08-12 | Surfaces utilisateur et administrateur V4-008. | Références Atlas `learnx-v4-correction-flow.html` et `learnx-v4-atlas-surfaces.html`. | Panneau latéral desktop, surface plein écran mobile, récapitulatif avant validation et composants Atlas existants. | Revue visuelle finale après implémentation responsive. |
| Propriétaire — Rayan Chambet | `ARBITRATED` | 2026-08-12 | Résolution des divergences entre le premier cadrage et le backlog V4 v1.2.0. | Arbitrage explicite transmis dans la conversation principale. | La v1.2.0 prévaut : aucune valeur métier, cadence, ordre ou limite active ne doit être inventé dans V4-008. | L'activation attendra calibration et validation séparées. |

## Arbitrages fermes

- Les lots et les écritures du ledger sont immuables. Disponibilité,
  réservation, consommation et expiration sont calculées depuis le ledger et
  les réservations ; aucune projection modifiable n'est une seconde source de
  vérité.
- Les deux origines apprenant sont « Allocation offerte » et « Crédits
  achetés ». « Disponible au total » reste une information secondaire.
- Un changement de rôle, capacité, cohorte ou suspension n'altère jamais les
  crédits achetés.
- Tout ajustement administratif exige une raison et produit une écriture
  compensatoire auditée. Aucune suppression ou mutation silencieuse.
- La ventilation d'une réservation entre les lots est figée à sa création.
- Une attribution exceptionnelle reste un lot séparé et audité.
- Les politiques trial, famille/amis, early adopters et achats restent isolées
  par identité de politique et de lot.
- Un renouvellement est idempotent par utilisateur, politique et clé de cycle,
  sans supposer la durée ni la nature du cycle.
- Les surfaces administratives utilisent un panneau latéral sur desktop et une
  surface plein écran sur mobile, avec récapitulatif avant confirmation.
- Aucun prix, pack, paiement, parité ou montant fictif n'est activé.

## Paramètres explicitement non arbitrés

Les éléments suivants sont versionnables mais restent sans valeur active ni
valeur par défaut métier dans V4-008 :

- montant d'allocation ;
- ordre de consommation entre lots offerts et achetés ;
- cadence, période, expiration, renouvellement, report et grâce ;
- limites quotidiennes, par cycle, par action, de concurrence ou de budget ;
- bornes et double validation des ajustements ;
- politique de clôture ou d'inactivité ;
- préavis.

## Confrontation au ledger V4-006

| Règle V4-008 | État V4-006 | Verdict technique |
| --- | --- | --- |
| Deux origines offert/acheté | `CreditProvenance` sépare déjà `FREE_ALLOCATION` et `PURCHASED`. | Compatible, à renommer seulement dans les présentations localisées. |
| Ledger append-only | Trigger PostgreSQL interdisant `UPDATE`/`DELETE` sur `credit_ledger_entries`. | Compatible. |
| Lots immuables | `CreditLot.remainingAmount` est modifié lors des réservations, libérations, expirations et ajustements négatifs. | **Contradiction matérielle.** Migration et switch de lecture requis. |
| Projections dérivées | Le compte et les lots stockent des projections mutables, même si le compte est réconcilié avec le ledger. | **Contradiction matérielle.** Les nouvelles lectures doivent agréger ledger et réservations. |
| Ventilation figée | `CreditReservationAllocation` persiste lot, montant et position. | Compatible fonctionnellement ; contrainte DB d'immuabilité à ajouter. |
| Ordre de consommation configurable | V4-006 impose offert par expiration puis acheté FIFO. | **Contradiction matérielle.** L'ordre doit venir d'une politique active ; aucune politique active n'est livrée. |
| Renouvellement idempotent | Aucun modèle de politique, cycle ou unicité utilisateur/politique/cycle. | Migration additive requise, sans figer la cadence. |
| Politiques et limites versionnées | Aucun catalogue de politiques d'allocation/limites. | Migration additive requise en `DRAFT`/`INACTIVE`. |
| Ajustement initial et compensatoire audité | La réduction exige une entrée compensée ; l'attribution initiale auditée n'est pas un flux administratif dédié. | Service admin et audit dédiés requis. |
| Isolation des cohortes | Les références de source existent, mais aucune identité de politique versionnée ne sépare les cohortes. | Liaison lot/politique additive requise. |
| Achats protégés | Les primitives distinguent la provenance mais aucune API d'administration V4-008 ne matérialise encore l'interdiction. | Règles serveur et tests RBAC/IDOR requis. |
| Échec sans résultat : aucun débit | La libération intégrale existe. | Compatible ; l'orchestration automatique reste V4-009. |

## Migration et rollback

La migration V4-008 est additive :

1. ajouter des versions de politiques d'allocation et de limites sans valeur
   active ;
2. relier immuablement les nouveaux lots à leur politique et à une éventuelle
   clé de cycle ;
3. garantir en base l'immuabilité des lots et ventilations ;
4. lire disponibilité, réservation, consommation et expiration par agrégation
   du ledger/réservations ;
5. ajouter l'idempotence des renouvellements et l'audit des ajustements ;
6. exposer les projections et l'historique sans modifier les écritures V4-006.

Le rollback désactive les nouvelles politiques et routes, sans supprimer les
lots, allocations, audits ou écritures append-only. Il ne réécrit jamais
l'historique.

## Gates

- [x] Finance & Pricing reçue.
- [x] Produit & pédagogie reçu.
- [x] Arbitrage du propriétaire reçu.
- [x] Références Atlas reçues.
- [x] Contradictions V4-006 documentées.
- [ ] Migration et service implémentés puis validés.
- [ ] Surfaces Atlas vérifiées responsive et accessibles.
- [ ] Aucune politique active ou valeur fictive introduite.

V4-008A et V4-009 restent explicitement hors périmètre.
