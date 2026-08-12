# V4-008 — Registre de consultation

**Statut du ticket :** consultations reçues et arbitrées ; implémentation
autorisée avec des politiques versionnées laissées `DRAFT` ou `INACTIVE`.

**Date :** 2026-08-12

**Périmètre :** administration des allocations, limites et budgets.

**Hors périmètre :** prix, packs, paiement, moteur composite, V4-008A,
V4-009, V4-010 et appels modèle facturables.

## Consultations obligatoires

| Consultation | Statut | Date | Périmètre transmis | Réponse reçue | Décisions retenues | Inconnues restantes |
| --- | --- | --- | --- | --- | --- | --- |
| Finance & Pricing | `ARBITRATED` | 2026-08-12 | Origines, lots, réservations, renouvellement, limites, budgets, suspension et ajustements. | Retour consolidé transmis au propriétaire puis amendé par le backlog v1.2.0. | Deux origines ; ledger/lots immuables ; projections dérivées ; achats protégés ; paramètres configurables et inactifs. | Montants, ordre de consommation, cadence, expiration, report, grâce et limites restent non arbitrés. |
| Produit & pédagogie | `ARBITRATED` | 2026-08-12 | Compréhension des soldes, alertes et demandes d’augmentation. | Cadrage produit arbitré par le propriétaire. | « Allocation offerte » et « Crédits achetés » sont les lignes principales ; total secondaire ; demande sans attribution automatique ; aucun prix fictif. | Valeurs et activation restent à calibrer hors V4-008. |
| Direction artistique | `RECEIVED` | 2026-08-12 | Surfaces utilisateur et administrateur. | Références Atlas `learnx-v4-correction-flow.html` et `learnx-v4-atlas-surfaces.html`. | Panneau latéral desktop, plein écran mobile, récapitulatif avant validation et primitives Atlas. | Revue visuelle finale après implémentation responsive. |
| Propriétaire — Rayan Chambet | `ARBITRATED` | 2026-08-12 | Divergences entre le premier cadrage et le backlog v1.2.0. | Arbitrage explicite dans la conversation principale. | La v1.2.0 prévaut : aucune cadence, priorité, limite ou valeur métier active n’est inventée. | L’activation attend calibration et validation séparées. |

## Arbitrages fermes

- Lots et écritures du ledger sont immuables. Disponibilité, réservation,
  consommation et expiration sont dérivées du ledger.
- Les origines « Allocation offerte » et « Crédits achetés » restent
  distinctes ; le total est secondaire.
- Aucun changement de rôle, capacité ou suspension n’altère les achats.
- Un ajustement administratif exige une raison et produit une écriture
  compensatoire auditée, sans suppression ni mutation silencieuse.
- La ventilation d’une réservation est figée lors de sa création.
- Une attribution exceptionnelle crée un lot séparé et audité.
- Trial, famille/amis, early adopters et achats sont isolables par identités de
  politiques et de lots.
- Le renouvellement est idempotent par utilisateur, politique et clé de cycle,
  sans supposer la nature ou la durée du cycle.
- Aucun prix, pack, paiement, parité ou montant fictif n’est activé.

## Paramètres explicitement non arbitrés

Ils sont versionnables mais restent sans valeur active ni valeur par défaut :

- montant et ordre de consommation ;
- cadence, période, expiration, renouvellement, report et grâce ;
- limites quotidiennes, par cycle, par action, de concurrence ou de budget ;
- bornes et double validation des ajustements ;
- politique de clôture, inactivité et préavis.

## Confrontation au ledger V4-006

| Règle V4-008 | État V4-006 | Verdict technique |
| --- | --- | --- |
| Deux origines | `CreditProvenance` sépare déjà offert et acheté. | Compatible. |
| Ledger append-only | Trigger PostgreSQL existant. | Compatible. |
| Lots immuables | `remainingAmount` était modifié pendant les opérations. | **Contradiction corrigée :** les nouvelles opérations reconstruisent depuis le ledger et un trigger bloque les mutations. |
| Projections dérivées | Compte et lot contenaient des projections mutables. | **Contradiction corrigée :** les lectures agrègent toutes les écritures ; les colonnes héritées ne sont plus modifiables. |
| Ventilation figée | Lot, montant et position sont persistés. | Compatible ; trigger d’immuabilité ajouté. |
| Ordre configurable | V4-006 imposait offert expirant puis acheté FIFO. | **Contradiction corrigée :** la réservation exige une priorité explicite ; aucune politique active n’est livrée. |
| Renouvellement idempotent | Aucun modèle de cycle. | Modèle et unicité utilisateur/politique/cycle ajoutés, sans cadence. |
| Politiques versionnées | Aucun catalogue. | Catalogues additifs `DRAFT`/`INACTIVE`, sans ligne active. |
| Ajustement audité | Réduction compensatoire seulement. | Flux admin d’attribution et compensation, raison et audit obligatoires. |
| Achats protégés | Provenance distincte seulement. | Interdiction serveur et tests RBAC/IDOR ajoutés. |
| Échec sans résultat | Libération intégrale disponible. | Compatible ; orchestration automatique reste V4-009. |

## Migration et rollback

La migration est additive : politiques sans valeur active, identité de cycle,
liaison lot/politique, demandes d’augmentation et contraintes d’immuabilité.
Le rollback désactive les routes et politiques nouvelles sans réécrire ni
supprimer lots, ventilations, audits ou écritures append-only.

## Gates

- [x] Finance & Pricing reçue et arbitrée.
- [x] Produit & pédagogie reçu et arbitré.
- [x] Arbitrage propriétaire reçu.
- [x] Références Atlas reçues.
- [x] Contradictions V4-006 documentées et corrigées.
- [x] Aucune politique active ou valeur fictive introduite.
- [ ] Migration, service et surfaces validés par la suite complète.

V4-008A et V4-009 restent explicitement hors périmètre.
