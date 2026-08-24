# V4-008A — Registre de consultation et d’alignement composite

> **HISTORICAL_EVIDENCE — PIPELINE ABANDONNÉ.** Ce registre conserve
> l'alignement du composite Mistral/Sonnet. Il ne peut plus autoriser un appel,
> une implémentation ou une activation. La direction active est le moteur de
> rubrique exécutable référencé par `docs/V4_ROADMAP.md`.

**Statut :** consultations reçues et arbitrées pour une implémentation hors
ligne ; activation, prix et appels modèle bloqués.

**Date :** 12 août 2026

## Consultations

### Produit & pédagogie — `ARBITRATED`

- Le contrat pédagogique snapshoté reste l’autorité des critères, poids et
  niveaux.
- Les modèles proposent uniquement des observations critérielles, preuves et
  feedbacks. LearnX calcule le score indicatif, déclenche la vérification et
  consolide le résultat.
- Le vérificateur reçoit la même soumission et la même rubrique, mais jamais la
  sortie primaire.
- Aucun résultat de correction ne modifie la progression.
- Les seuils, signaux et règles de consolidation restent versionnés et
  inactifs jusqu’à calibration.

### Finance & Pricing — `ARBITRATED` pour la structure, `BLOCKED` pour les valeurs

- Un devis, un consentement et une réservation couvrent le primaire et la
  vérification ciblée éventuelle.
- Seules les tentatives terminales validées et utiles au résultat sont
  réglables. Les retries, erreurs et sorties invalides sont absorbés par
  LearnX.
- Sans résultat utilisable, le règlement utilisateur est nul et la réservation
  est libérée.
- Le coût interne conserve chaque appel, rôle, tentative, route, usage, latence
  et coût réel.
- Aucun prix, plafond, conversion, marge ou budget n’est activé par V4-008A.

### Direction artistique — `RECEIVED`

La spécification composite couvre les états nécessaires aux surfaces Atlas :
résultat provisoire, résultat incertain sans score exact, correction
indisponible, règlement synthétique et détail dépliable. Aucune nouvelle règle
métier ou surface finale n’est introduite dans ce ticket.

### Propriétaire — `ARBITRATED`

Rayan Chambet a validé le plan V4-008A et l’implémentation hors ligne. Cette
validation n’autorise ni benchmark facturable, ni activation économique, ni
V4-009/V4-010.

## Écarts constatés et résolution

| Fondation | Écart mono-modèle | Résolution V4-008A |
| --- | --- | --- |
| V4-003 | Campagnes historiques sans identité composite | Lecture historique conservée ; identité composite neuve et non comparable |
| V4-004 | Score, confiance globale et seconde passe encore présents dans la sortie historique | Nouveau domaine composite minimal ; autorités et déclenchement côté serveur |
| V4-005 | Statuts binaires, rôle unique et tentatives non séparées | États composites, exécutions par rôle et tentatives techniques auditables |
| V4-007 | Catalogue lié à un modèle et à une seconde passe du même modèle | Snapshot de pipeline, vérification ciblée et dimensions de coût, uniquement `DRAFT/INACTIVE` |

## Gates

- [x] Produit & pédagogie reçu et arbitré.
- [x] Finance & Pricing reçue pour la structure ; valeurs économiques bloquées.
- [x] Direction artistique reçue.
- [x] Propriétaire autorise l’implémentation hors ligne.
- [x] Aucun modèle, prix ou catalogue n’est activé.
- [x] Migration, domaine composite et devis inactif validés ; lint, typecheck,
  709 tests et build réussis (avec désactivation du `localStorage` expérimental
  de Node pour la suite navigateur).

V4-009, V4-010 et tout appel modèle restent explicitement hors périmètre.
