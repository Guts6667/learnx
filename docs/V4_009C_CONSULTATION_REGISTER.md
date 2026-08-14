# V4-009C — Registre de consultation

Date : 2026-08-13
Statut global : `MINI_PANEL_NO_GO_TECHNICAL`

## Produit & pédagogie

- Statut : `RECEIVED → ARBITRATED`.
- Identité Gemini mono-modèle nouvelle, aucun Sonnet et holdout fermé.
- Panel figé : 10 cas de développement × 2 répétitions, incluant les quatre
  injections authorées writing/reflection/practice/project.
- Gates non compensatoires : sécurité/preuves 100 %, 20/20 utilisables, accord
  critériel >= 85 %, variabilité <= 10 %, aucun écart ordinal de deux niveaux
  non adjudiqué et aucun faux résultat matériellement trop généreux confirmé.
- La détection d'instruction non fiable est un signal audité : elle ne supprime,
  ne réécrit et ne bloque jamais seule une réponse.
- Revue en deux phases : paquet aveugle sans gold/identité/coût, puis mapping
  scellé. Aucun seuil ou cas ne change après lecture.

## Finance & Pricing

- Statut : `RECEIVED → ARBITRATED` pour l'enveloppe R&D hors ligne.
- Prévision : `0,25–0,30 USD` ; alerte à `0,30 USD`.
- Plafond fournisseur dur : `0,50 USD usage.cost`.
- Maximum : 40 tentatives, soit 20 initiales et au plus un retry par workflow.
- Préflight bloquant avant chaque tentative, coût réel obligatoire, ledger
  append-only et arrêt sur coût orphelin, identité divergente ou borne dépassée.
- Aucun prix, crédit, catalogue ou débit utilisateur activé.

## Développement

- Statut : `RECEIVED → ARBITRATED_OFFLINE`.
- Réutilisation : protocole 3.0.1, schéma dynamique strict, résolveur de preuves
  typographique borné, adapters et primitives de budget/idempotence V4-009B.
- Ajouts : enveloppe non générative versionnée, attestation catalogue en lecture
  seule, manifeste/fingerprint, runner Gemini, reprise par state+ledger chaîné,
  paquet aveugle et mapping distincts.
- Risques traités : faux positifs légitimes, séparation des segments, limites,
  altération du ledger, replay complet et autorisation propriétaire distincte.

## Gate

- [x] NO-GO V4-009B et extension diagnostique conservés et suspendus.
- [x] Consultations Produit, Finance et Développement reçues.
- [x] Catalogue Gemini lu sans appel modèle et route unique attestée.
- [x] Manifeste 20 workflows, budget et gates préenregistrés.
- [x] Runner bloqué sans token propriétaire distinct.
- [x] Autorisation explicite du propriétaire reçue.
- [x] Panel arrêté après 9/20 workflows valides sur coût non réconciliable.
- [x] Verdict `NO-GO_TECHNICAL` figé ; aucun `24×3` ni holdout autorisé.
