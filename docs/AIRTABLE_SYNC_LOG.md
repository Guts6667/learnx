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

## 28 août 2026 — gate propriétaire V4.1-005

- Le commit `eda48a1b` a reçu `REVIEW_PASS`, sans P0, P1 ni P2.
- Airtable a été relu puis le ticket V4.1-005 a effectué la transition réelle
  `REVIEW` → `READY_FOR_OWNER_GO`. Cette transition a matérialisé le huitième
  état canonique ; aucun ticket factice n'a été créé.
- La clôture du ticket et la publication des neuf pages brouillon restent deux
  actions distinctes soumises au GO explicite de Rayan. L'interface n'a pas été
  publiée.

## 28 août 2026 — nettoyage structurel du backlog

- Autorisation propriétaire : supprimer les structures Airtable obsolètes afin
  de rendre la progression V4.1 lisible, sans perdre l'historique utile.
- La base ne contient qu'une table, `Tickets` : elle est conservée comme table
  canonique. Les 27 tickets V4.1 restent séparés de six chantiers préparatoires
  V4.5 et de 45 enregistrements classés `Archive V4`.
- Les huit champs historiques qui doublonnaient le contrat V4.1 ont été
  préfixés `Archive V4 ·` et exclus du workflow actif. Les champs canoniques
  restent `Release`, `Epic`, `Nature`, `Risque`, `Owner`, `Reviewer`, `Statut`,
  `Blocage courant`, `Dépendances`, `Critères d’acceptation`, les références Git
  et les preuves QA.
- Quatre pages hors contrat ont été supprimées du brouillon de l'interface :
  `Kanban — Pilotage détaillé`, `Roadmap détaillée`, le doublon
  `V4.1 — Maintenant` et la page temporaire `V4.1 — Pilotage`.
- Les dix pages déclarées dans `V4_1_AIRTABLE_CONTRACT.json` restent la seule
  structure d'interface attendue. Les suppressions des pages publiées ne seront
  visibles pour les utilisateurs qu'après un GO distinct de publication de
  l'interface.
- Rayan a ensuite explicitement autorisé cette publication. L'interface
  `pbdEbIxppEhMMEwsM` a été publiée puis relue : elle expose exactement dix
  pages, conformes aux noms déclarés dans le contrat, et aucune des quatre pages
  supprimées ne reste visible.
- Après signalement de colonnes Kanban dupliquées (`Done` / `DONE`,
  `In progress` / `IN_PROGRESS`), la page `V4.1 — Maintenant` a été remplacée
  par `pagy6L1WyLSf9DAxy`. Sa portée reste `Release = V4.1` et exclut `DONE` ;
  elle masque désormais toutes les piles vides, ce qui retire de l'affichage les
  choix de statuts historiques sans altérer l'archive. L'interface corrigée a
  été republiée et relue avec dix pages exactement.

## 28 août 2026 — clôture V4.1-503 et ouverture V4.1-504

- Source Git : `c3e81c4b` sur `origin/codex/v4-1-foundation`.
- `V4.1-503` (`recuId91JKChNHdmd`) est passé de `READY` à `DONE` après
  consolidation des cinq documents canoniques, fermeture de la dette
  `V4.1-404-R1` et validation de 1 371 tests.
- `V4.1-504` (`recKRf2xYnUZAWrSx`) est passé de `DRAFT` à `READY`. Son blocage
  de dépendance est levé ; la preview finale, la recette propriétaire, la
  preuve de rollback/PWA et le GO explicite de Rayan restent à exécuter.
- Les deux enregistrements ont été relus après mutation : branche, SHA, statut,
  blocage et preuves QA correspondent au backlog Git. Aucun autre ticket,
  champ, page ou statut Airtable n'a été modifié.

## 28 août 2026 — démarrage de la recette V4.1-504

- Source Git : `bbf4a59c` sur `origin/codex/v4-1-foundation` ; checklist
  `docs/qa/V4_1_504_RELEASE_CANDIDATE.md`.
- `V4.1-504` (`recKRf2xYnUZAWrSx`) est passé de `READY` à `IN_PROGRESS` après
  vérification de la preview publique et smoke HTTP 200 des routes publiques,
  du manifeste PWA et du service worker.
- Le blocage courant nomme uniquement les gates manuels réels : recette
  authentifiée correction/pricing/ledger/permissions, PWA sur appareil,
  accessibilité native et rollback. Aucun de ces contrôles n'est déclaré réussi
  avant preuve propriétaire.
- L'enregistrement a été relu après mutation ; aucun autre ticket ou élément
  d'interface Airtable n'a été modifié.

## 29 août 2026 — création des tickets V4.5 (correction IA et commerce)

- Autorisation : plan Head of AI validé par Rayan (session `learnx-f7`),
  après coordination explicite avec la session `learnx-v4-1-migration-audit`
  (aucun recouvrement de fichiers ni d'accès Airtable).
- Base `app8IaHD1sJtI83WT`, table `tblpSbdB7K4MioyJq`, accès par token
  personnel scoppé à la base, API REST ; création uniquement, aucun record
  existant modifié, aucune suppression, aucune interface publiée.
- 21 enregistrements créés, `Release = V4.5`,
  `État de synchronisation = Proposition Airtable` (la définition Git
  `V4_5_BACKLOG.md` sera amendée par V4.5-100) :
  - V4.5-100 (`READY`, arbitrage `À faire`), V4.5-101, 110, 111, 112, 113,
    120, 121, 122, 130, 131, 132, 140, 141, 150, 151 (`DRAFT`) ;
  - lot commerce V4.5-160, 161, 162, 163, 164 (`DRAFT`).
- Décisions propriétaire appliquées : tickets seulement (pas de cartes epic
  001–012) ; natures limitées aux choix existants ; V4.5-100 seul `READY`.
- Relecture : 21/21 enregistrements relus, aucun écart champ par champ avec
  le dry-run (`Ticket`, `Release`, `Epic`, `Nature`, `Risque`, `Owner`,
  `Reviewer`, `Statut`, `Dépendances`, `Résumé simple`, `Description`,
  `Critères d’acceptation`, `Source canonique`, `Blocage courant`,
  `Arbitrage Rayan`, `Dernière synchronisation`).
- Les six cartes héritées `V4-011/013/014/015/018/018A` (Release V4.5,
  nature `Conditionnel`) et `V4.5-ADM-001`, `V4.5-UX-001` conservent
  exactement leur statut ; les tickets 130 et 160–164 les référencent dans
  `Epic` sans les modifier.
- Source de définition : plan `glimmering-wishing-pudding.md` (Head of AI,
  29 août 2026) → à transcrire dans `V4_5_BACKLOG.md` par V4.5-100.

## 29 août 2026 — V4.5-100 en revue

- V4.5-100 : `READY` → `REVIEW`, commit `07663e4f`, branche `codex/v4-5-100`
  (worktree isolé, base `origin/main@63c436d9`), `État de synchro = Commit
  local — push en attente`. Champs modifiés : Statut, Branche, Commit source,
  État de synchronisation, Preuves QA, Blocage courant. Relecture conforme ;
  aucun autre enregistrement modifié.

## 29 août 2026 — arbitrages Rayan consignés

- V4.5-100 : `REVIEW` conservé ; `PR` = #22 vers `dev`, `Commit source`
  `d1cb28f1`, `État de synchro = Canonique Git`.
- V4.5-111 : `Arbitrage Rayan = Rayan A` — vérificateur d'une famille non
  Anthropic, `mistralai/mistral-medium-3-5` retenu ; statut `DRAFT` conservé.
- V4.5-121 : `Arbitrage Rayan = Rayan A` — budget 3 USD ; statut `DRAFT`.
- V4.5-141 : `Arbitrage Rayan = Rayan A` — ré-analyse anonymisée, plafond
  2 USD/semaine ; statut `DRAFT`.
- Chaque enregistrement a été relu après mutation ; aucun autre ticket modifié.

## 29 août 2026 — clôture V4.5-100, ouverture 101/110, page kanban V4.5

- V4.5-100 : `REVIEW` → `DONE`, PR #22 mergée dans `dev` (`e59ff287`) ;
  `Commit source`, `Preuves QA` et `Blocage courant` mis à jour.
- V4.5-101 et V4.5-110 : `DRAFT` → `READY` (dépendance V4.5-100 close),
  `Blocage courant` = aucun.
- V4.5-111, V4.5-121, V4.5-141 : `Arbitrage Rayan = Rayan A` (voir entrée
  précédente) ; statuts inchangés.
- Interface : page **« V4.5 — Maintenant »** (`pagQ98siiH1Ud298H`, kanban,
  `Release = V4.5 AND Statut != DONE`, groupée par `Statut`) créée et publiée
  par le propriétaire, enregistrée dans `docs/V4_1_AIRTABLE_CONTRACT.json`
  1.1.0. Aucune autre page modifiée.
- Relecture : les quatre enregistrements relus après mutation ; aucun autre
  ticket modifié.

## 29 août 2026 — nettoyage du tableau et voies V4.5

- Autorisation : « You can clean the board » (Rayan, 29 août 2026).
- Clos (`DONE`, résumé « Clos le 29 août 2026 (nettoyage V4.5) — … ») :
  V4-011, V4-013, V4-014, V4-015, V4-018, V4-018A (remplacés par 130, 160,
  161, 162, 164, 163) ; V4-016G, V4-017 (remplacés par 160/161 et 163/165) ;
  V4-019-RELEASE, V4.1-504 (publiés) ; V4.1-005 (GO Rayan).
- Carte « Faire un audit RGPD » (Archive V4) convertie en **V4.5-165**
  (Release V4.5, `DRAFT`, `Arbitrage Rayan = À faire`).
- V4.5-113 : `DRAFT` → `READY` (voie C, partie indépendante de 110).
- Répartition par voie consignée dans `V4_5_BACKLOG.md`. Aucun autre champ
  modifié ; chaque enregistrement relu après mutation.
