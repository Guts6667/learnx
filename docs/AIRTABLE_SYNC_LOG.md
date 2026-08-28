# Journal de synchronisation Airtable — V4.1

## Contrat

Ce journal complète `docs/AGENT_WORKFLOW.md`. Il est append-only pendant V4.1.
Chaque entrée consigne uniquement une synchronisation réellement relue ; elle
ne constitue ni un GO de release ni une autorisation de publier une interface.

## 26 août 2026 — initialisation contrôlée

- Base : `app8IaHD1sJtI83WT`
- Table : `tblpSbdB7K4MioyJq`
- Source Git : `V4_1_BACKLOG.md`
- SHA de définition initial : `4b342511`
- Portée : 27 IDs V4.1 stables, sans doublon ni ID manquant
- Champs opérationnels relus : statut, blocage, branche, SHA, preuves QA et
  date de synchronisation
- Mutations effectuées ensuite : mises à jour unitaires des tickets actifs ou
  revus ; aucun bulk update, aucune suppression, aucun archivage
- Interface Kanban : non publiée ; publication exclue sans confirmation
- Conflit : aucun statut manuel n'a été écrasé ; toute divergence future suit
  le protocole `NEEDS_ARBITRATION`

Les prochaines entrées doivent indiquer le ticket, l'ancien et le nouveau
statut, le SHA, les champs modifiés, le résultat de la relecture et l'auteur de
l'autorisation.

## 26 août 2026 — réconciliation opérationnelle

- Autorisation : instruction propriétaire « PLEASE IMPLEMENT THIS PLAN », dont
  le backlog Airtable et le workflow agents font partie intégrante.
- V4.1-005 : `REVIEW` → `NEEDS_ARBITRATION`, SHA `4b342511`. Le blocage réel
  (choix de statuts incomplets et synchronisation non relue) a été enregistré ;
  aucun statut tiers n'a été écrasé.
- V4.1-301 : `IN_PROGRESS` → `REVIEW`, SHA `f53a23a9`, branche
  `codex/v4-1-301`. Les preuves owner ont été enregistrées avant la revue
  indépendante.
- V4.1-302 : `IN_PROGRESS` → `QA`, SHA `b4a43d3b`, branche
  `codex/v4-1-302`. La transition suit un `REVIEW_PASS` indépendant.
- V4.1-006 : statut `REVIEW` conservé, SHA `76f5c2bd`. Le correctif de parité
  bilatérale et le test ciblé ont remplacé les preuves inexactes ; la clôture
  attend encore la seconde revue.
- Les 23 autres tickets V4.1 ont conservé exactement leur statut manuel. Seuls
  `État de synchro = Canonique Git` et `Dernière synchronisation` ont été mis à
  jour en une écriture groupée contrôlée.
- Relecture : 27 IDs V4.1 uniques ; 25 sont synchronisés avec Git. V4.1-005
  demeure explicitement à réconcilier et V4.1-006 demeure en revue. Les vues
  supplémentaires et le choix `READY_FOR_OWNER_GO` ne sont pas fabriqués avant
  une transition réelle.
- Interface : aucun brouillon n'a été publié.

## 26 août 2026 — ouverture des lots fonctionnels

- V4.1-301 : `REVIEW` → `DONE`, preuve indépendante `REVIEW_PASS`, commit
  owner `f53a23a9`, commit d'intégration `b8f3a1af`.
- V4.1-302 : `QA` → `DONE`, preuve indépendante `REVIEW_PASS`, commit owner
  `b4a43d3b`, commit d'intégration `6c8c529c`.
- V4.1-303, V4.1-304 et V4.1-305 : `DRAFT` → `READY`. Le choix canonique
  `READY` a été créé par ces trois transitions réelles, après clôture de leurs
  dépendances ; aucun lot n'est passé artificiellement par un état non acquis.
- Relecture : les cinq tickets portent `État de synchro = Canonique Git`, les
  mêmes statuts que `V4_1_BACKLOG.md`, les SHA de preuve et une date de
  synchronisation. Aucun champ manuel hors périmètre n'a été modifié.
- Le choix `READY_FOR_OWNER_GO` reste volontairement absent tant qu'aucun ticket
  ne satisfait réellement ce gate.

## 28 août 2026 — promotion partielle des lots fonctionnels

- Autorisation : poursuite du plan V4.1 validé par Rayan ; aucune publication
  de l'interface Airtable.
- V4.1-303 : `REVIEW` → `DONE`, preuve indépendante `REVIEW_PASS`, commit
  owner `ead8f10a`, commit d'intégration `692c09c2`.
- V4.1-305 : `REVIEW` → `DONE`, preuve indépendante `REVIEW_PASS`, commit
  owner `6c0bdde2`, commit d'intégration `4acfc10a`.
- V4.1-304 : statut `REVIEW` conservé. La revue a identifié un risque P1
  d'idempotence au retry d'une demande de crédits et un écart P2 de pagination ;
  le blocage et le correctif en cours sont consignés sans promouvoir le ticket.
- Relecture : les trois enregistrements portent les statuts, branches, SHA,
  preuves QA et horodatage attendus ; l'état reste `Canonique Git`.
- Interface : aucun brouillon n'a été publié.

## 28 août 2026 — clôture de la baseline et des surfaces personnelles

- Autorisation : reprise du plan V4.1 validé ; aucune publication de
  l'interface Airtable.
- V4.1-006 : `REVIEW` → `DONE`, après deux revues indépendantes et intégration
  des preuves `0b5f1e74` / `0e4c25f6`. Les parcours navigateur, PWA et
  accessibilité non encore exercés restent portés par V4.1-501/502.
- V4.1-304 : `REVIEW` → `DONE`, après correction du cycle d'idempotence, de la
  pagination et du raccord React Query. La revue indépendante de `bb4c0ffb`
  ne relève aucun P0, P1 ou P2 bloquant ; 1 011 tests sont verts.
- V4.1-401 : `DRAFT` → `READY`, les cinq lots fonctionnels 301 à 305 étant
  terminés et revus. Correction, pricing et ledger restent exclus de son
  périmètre et réservés à V4.1-402.
- Relecture : les trois enregistrements portent les statuts, SHA, preuves QA
  et horodatage attendus ; `État de synchro = Canonique Git`.
- Interface : aucun brouillon n'a été publié.

## 28 août 2026 — ouverture du lot backend générique

- V4.1-401 : `READY` → `IN_PROGRESS`, owner Backend/Data, branche dédiée
  `codex/v4-1-401`, base exacte `8193294f`.
- Périmètre consigné : décomposition des routes génériques sans changement de
  contrat ; correction, pricing, crédits, ledger et réconciliation sont exclus.
- Relecture : statut, branche, SHA de base, preuve de démarrage et horodatage
  sont présents ; `État de synchro = Canonique Git`.
- Interface : aucun brouillon n'a été publié.

## 28 août 2026 — normalisation du pilotage V4.1

- Autorisation : plan V4.1 approuvé par Rayan ; publication de l'interface
  toujours exclue sans confirmation distincte.
- Les 27 tickets V4.1 ont reçu une nature canonique et les champs `Owner` /
  `Reviewer` ont été normalisés vers les huit rôles stables. Les valeurs
  historiques restent uniquement sur les cartes antérieures ; aucun
  enregistrement n'a été supprimé.
- Les définitions exécutables se trouvent dans
  `docs/V4_1_AIRTABLE_CONTRACT.json` et sont contrôlées par
  `pnpm quality:airtable`. Le contrôle vérifie 27 IDs, huit rôles, six natures,
  huit états, l'allow-list exacte des champs modifiables et dix pages attendues
  sans écrire dans Airtable. Chaque page est liée à son ID, son type de
  visualisation, son filtre, son regroupement éventuel et son état de
  publication afin de rendre la configuration reproductible.
- Pages brouillon créées : `V4.1 — Maintenant` (`pag9Ou1lZGtplgfCU`, Kanban),
  `Ready` (`pagaqMosHyNv6WAGT`), `En cours par owner`
  (`pagNrmhdBAswxtsRp`), `Review` (`pagPODll59tYbiCVp`), `QA`
  (`pagTlI8DuvjJQMJ5E`), `Gate de release` (`pagnqJhh4IsLhkJkF`),
  `V4.5 — Préparation` (`pagvv6a80fbqtfMAk`), `V5 — Candidats`
  (`pagzYksoHx5HIvcdv`) et `Archive V4` (`pagLlT1p15kbN1IBT`). La page
  `Arbitrages Rayan` existante (`pagk1VyDJhqR2rG0j`) complète les dix vues.
  Cette page historique n'est pas filtrée par le statut : elle expose le champ
  `Arbitrage Rayan`. Le contrat le consigne explicitement au lieu de lui
  attribuer un filtre fictif. `Archive V4` s'appuie sur la valeur existante
  `Release = Archive V4`, et non sur une valeur `V4` inexistante.
- Le choix `READY_FOR_OWNER_GO` ne sera matérialisé que lors d'une transition
  réelle après revue, jamais en attribuant artificiellement ce statut à un
  ticket. Les statuts historiques restent disponibles pour l'archive, mais le
  workflow actif V4.1 est borné au contrat canonique.
- Relecture : les 27 écritures de rôles/natures ont retourné les valeurs
  attendues et `État de synchronisation = Canonique Git`. Aucun brouillon n'a
  été publié.
