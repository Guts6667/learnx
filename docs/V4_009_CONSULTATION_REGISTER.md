# V4-009 — Registre de consultation et arbitrages

Date : 2026-08-13
Périmètre : orchestration devis → réservation → correction composite → règlement ou libération.

## Architecture et données — ARBITRATED

- Consultation reçue le 2026-08-13.
- Périmètre transmis : machine d’états, transaction distribuée, reprise après crash,
  idempotence, relations devis/correction/réservation et migration additive.
- Décisions retenues : saga persistante, claim par lease, tentative créée avant
  dispatch, identité fournisseur stable, aucun terminal financier avant confirmation
  du ledger, relations de propriété renforcées en base.
- Inconnue conservée inactive : durée de lease et politiques de récupération. Aucune
  valeur métier active n’est fournie par ce ticket.

## Finance & Pricing — ARBITRATED

- Consultation reçue le 2026-08-13.
- Périmètre transmis : plafond composite unique, appels utiles, retries absorbés,
  coûts orphelins, dépassement et réconciliation.
- Décisions retenues : source de vérité du coût = coût fournisseur réellement
  persisté ; seuls les appels terminaux validés utiles sont réglables ; retries,
  sorties invalides et erreurs sont absorbés ; débit borné au plafond ; tout coût
  absent bloque le règlement et ouvre une réconciliation auditée.
- Prix, conversion USD/crédits, marges et plafonds restent DRAFT/INACTIVE jusqu’à
  calibration et validation du propriétaire.

## Produit & pédagogie — ARBITRATED

- Consultation V4-008A reprise comme dépendance autoritaire.
- Une opération apprenant reste visible comme un seul devis et une seule réservation,
  y compris lorsque le vérificateur ciblé est déclenché.
- La correction reste formative et ne modifie jamais progression ou achèvement.
- Un vérificateur requis sans résultat exploitable conduit prudemment à une libération
  intégrale ; PROVISIONAL ne peut être activé que par une règle versionnée validée.

## Propriétaire — ARBITRATED

- Le plan V4-009 a été validé explicitement par Rayan Chambet le 2026-08-13.
- Le ticket autorise l’implémentation et les validations hors production.
- Aucun appel modèle, prix actif, catalogue actif, paiement ou mutation de base
  partagée n’est autorisé.

## Gates de clôture

- [x] Migration additive et dual-read historique.
- [x] Aucun appel fournisseur possible avant devis et réservation valides.
- [x] Idempotence, lease, réconciliation et plafonnement couverts par tests.
- [x] Catalogue et pipeline composite restent inactifs.
- [x] Validation complète lint, typecheck, tests et build.
- [ ] Validation de migration sur clone Neon isolé.
