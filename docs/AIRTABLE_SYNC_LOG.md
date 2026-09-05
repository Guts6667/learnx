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

## 29 août 2026 — voies A et C : premiers merges

- V4.5-101 : `READY` → `REVIEW` (changements demandés : persistance/replay)
  → `QA` → `DONE`, PR #27 mergée dans `dev` (`0d991545`), owner Head of
  Development, revue Head of AI (2 tours).
- V4.5-110 : `READY` → `REVIEW` (changements demandés : câblage) → `QA` →
  `DONE`, PR #29 (`3ea51fc1`). Décision consignée : les corrections stockées
  avant 110 se résolvent à `LOW` sans score indicatif ; aucune correction
  réelle n'existe en production, aucun historique n'est donc réécrit.
- V4.5-113 : `READY` → `REVIEW` (partie 1 acceptée, 17b619ae ; merge après
  rebase sur 110, partie 2 dans le même SHA).
- V4.5-150 : `DRAFT` → `READY` → `QA` (accepté, 37784a55 ; merge après 113).
- V4.5-111 : description complétée (transport factice `LEARNX_AI_TRANSPORT`,
  identité vérificateur jumelle, fail-closed, signaux `CHECKER_*`).
- V4.5-131 : sous-item ajouté (colonne `status` PROVISIONAL vs payload FAILED).
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.

## 29 août 2026 — merges du soir (111, 113, 150, 115) et tickets 114/115

- V4.5-111 : `IN_PROGRESS` → `QA` → `DONE`, PR mergée dans `dev`
  (`1d22796e`), owner Head of Development, revue Head of AI. Arbitrages
  consignés : famille non Anthropic (`Rayan A`), résidence `mistral/eu`
  (`Rayan B`).
- V4.5-113 : `REVIEW` → `DONE` (`9cd2ad99`), parties 1 et 2, owner Head of
  UX/UI ; push autorisé directement par Rayan.
- V4.5-150 : `QA` → `DONE` (`db229010`), owner Head of UX/UI.
- V4.5-114 créé (`DRAFT`, après 121) : sémantique tarifaire du vérificateur,
  séparée de 111 sur objection Head of Development.
- V4.5-115 créé (`READY` → `IN_PROGRESS` → `DONE`, `e29ab801`), owner Head
  of AI ; sonde autorisée par Rayan (`Rayan A`, plafond 0,10 USD, coût réel
  0,000306 USD) ; profil de requête primaire 2.1.0.
- V4.5-112 : voie C démarre l'UI inerte ; voie A livre route et migration
  après 131 et 130.
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.
## 29 août 2026 — tickets d'exploitation DevOps V4.5-170…176

- Autorisation : demande explicite de Rayan (« add your recommendations in
  tickets in the V4.5 backlog ») après l'audit Head of DevOps du 29 août 2026,
  session `learnx-e0`. Coordination préalable avec les sessions
  `Head of AI (Fable 5)`, `Head of Development` et `Head of UX/UI` : aucune
  n'écrivait dans Airtable ni dans ce journal ; base de travail imposée
  `origin/dev@67a801ae`, branche dédiée `chore/v4-5-devops-airtable-sync`.
- Base `app8IaHD1sJtI83WT`, table `tblpSbdB7K4MioyJq`, API REST, token
  personnel. Création uniquement : aucun enregistrement existant modifié,
  aucune suppression, aucune page d'interface créée ou publiée.
- 7 enregistrements créés, `Release = V4.5`, `Statut = DRAFT`,
  `Epic = V4.5-013 Exploitation DevOps (proposition)`,
  `État de synchronisation = Proposition Airtable` (la définition Git dans
  `V4_5_BACKLOG.md` reste à écrire, comme pour le lot V4.5-1xx) :
  - `recL3BtE3hDGOdhPW` V4.5-170 — migrations Prisma hors des builds preview
    (P0, `Arbitrage Rayan = À faire`) ;
  - `recJFACuVNTMXxuYP` V4.5-171 — branches Neon `ci-*` et Integration requis (P1) ;
  - `recLb4hF4nvLUH3DO` V4.5-172 — `/api/health`, stack dans `onError`, suivi
    d'erreurs (P1) ;
  - `reczMF60hUFIPkHht` V4.5-173 — smoke post-déploiement et purge planifiés (P2) ;
  - `recLKyPSMTz5aQ1zN` V4.5-174 — modèle de branches et protection de `dev`
    (P1, `Arbitrage Rayan = À faire`) ;
  - `recwXlmCPqUK7kXYB` V4.5-175 — Dependabot, `.nvmrc`, hygiène des branches (P2) ;
  - `recI0o4zDR5FFD7MQ` V4.5-176 — restauration Neon et SHA de rollback (P2).
- Natures et statuts pris exclusivement dans les choix existants ; aucune
  valeur de `Nature`, `Statut`, `Release` ou `Risque` ajoutée, donc
  `docs/V4_1_AIRTABLE_CONTRACT.json` et `scripts/check-v4-1-airtable.ts`
  restent inchangés.
- Relecture : 7/7 enregistrements relus champ par champ après création
  (16 champs chacun), aucun écart avec le dry-run.
- Deux tickets attendent un arbitrage propriétaire avant exécution : V4.5-170
  (valeurs `DATABASE_URL` des environnements Vercel Preview et Production,
  non lisibles depuis le dépôt) et V4.5-174 (choix du modèle de branches).
- Source de définition : rapport d'audit DevOps du 29 août 2026
  (artefact `2014c4b7-c223-44d8-b1e8-c9f143886646`) → à transcrire dans
  `V4_5_BACKLOG.md`.

## 29 août 2026 — décision dev → staging → main, ticket V4.5-177

- Autorisation : décision explicite de Rayan le 29 août 2026 (« Things must go
  on dev, then staging then main ») et autorisation d'investigation.
- 1 enregistrement créé, aucun enregistrement existant modifié, aucune
  suppression, aucune page d'interface touchée :
  - `recYphSi9FXqtNpmj` V4.5-177 — Créer le palier staging : branche,
    environnement Vercel et base Neon dédiée (P0, `DRAFT`,
    `Arbitrage Rayan = À faire`, `Proposition Airtable`).
- Relecture : 16/16 champs conformes au dry-run.
- Constats d'investigation (dépôt uniquement) : la branche `origin/staging`
  existe déjà mais est morte — `2600b6ef` du 10 août 2026, 475 commits
  derrière `dev`, 448 derrière `main`, entièrement contenue dans `main` ;
  aucun workflow, `vercel.json` ni document ne la référence.
  `AiDeploymentEnvironment` est une union fermée
  `development | preview | production`
  (`src/server/ai/openrouter-configuration.ts`) et la configuration échoue en
  `CONFIGURATION_INVALID` si `LEARNX_AI_CONFIG_ENVIRONMENT` ne correspond pas
  exactement à l'environnement déduit de `VERCEL_ENV`
  (`src/server/api/corrections/app.ts:90`) : un palier staging vu comme
  `preview` ne demande aucun changement de code, un environnement Vercel
  personnalisé en demanderait un.
- Écritures NON effectuées, à faire par le propriétaire : mise à jour de
  `V4.5-174` (`Arbitrage Rayan = Rayan A`, modèle dev → staging → main,
  `Risque = P0`) et de `V4.5-170` (`Blocage courant`). La modification
  d'enregistrements existants a été refusée par le classifieur de permissions
  de la session ; seule la création était autorisée.
- Lecture des variables d'environnement Vercel (API REST et CLI) également
  refusée par le classifieur : la question « Preview et Production
  partagent-ils la même base Neon ? » reste ouverte et V4.5-170 reste bloqué
  dessus.

## 29 août 2026 — revue des variables Vercel, ticket V4.5-178

- Autorisation : Rayan a exécuté `vercel env ls` lui-même le 29 août 2026 et
  transmis la sortie (noms et cibles uniquement, aucune valeur divulguée).
- 1 enregistrement créé, aucune modification, aucune suppression :
  - `recLgWg5Jmshn3ymh` V4.5-178 — `LEARNX_PUBLIC_LEADS_ENABLED` échoue en
    ouverture et n'est défini dans aucun environnement Vercel (P1, `DRAFT`,
    `Arbitrage Rayan = À faire`).
- Relecture : 16/16 champs conformes.
- Constats de la revue :
  - `DATABASE_URL` et `DIRECT_URL` ont des entrées distinctes pour Production
    et pour Preview, plus des entrées propres à la branche `staging`
    (`Preview (staging)`, 20 jours). La cible de base de données de V4.5-177
    est donc déjà en place pour staging ; il reste à confirmer que les valeurs
    Preview et Production diffèrent réellement (valeurs masquées).
  - `LEARNX_PUBLIC_LEADS_ENABLED` absent des deux environnements alors que
    `RESEND_API_KEY`, `APP_URL` et `LEARNX_EMAIL_FROM` y sont présents → voir
    V4.5-178.
  - `LEARNX_AI_CONFIG_ENVIRONMENT` est de type « Config » en Production
    (valeur lisible) et « Secret » en Preview. À vérifier : la valeur doit
    valoir exactement `production`, faute de quoi
    `readOpenRouterConfiguration` lèverait `CONFIGURATION_INVALID` dès
    l'activation de l'IA. Sans effet tant que le coupe-circuit est armé.
  - Aucun `SESSION_SECRET` n'est requis par le code applicatif : la variable
    n'existe que pour le serveur de tests d'intégration.
  - `ANTHROPIC_API_KEY` et `OPENAI_API_KEY` ne sont lus que par
    `src/lib/ai-correction-benchmark-runner-preflight.ts` (outillage
    benchmark, déjà visé par V4.5-132). Vérification faite : ces noms
    n'apparaissent pas dans le bundle client construit.

## 29 août 2026 — V4.5-170 : les URL de base sont illisibles par conception

- Aucune écriture Airtable. Entrée de traçabilité uniquement.
- `DATABASE_URL` et `DIRECT_URL` sont marquées « Sensitive » dans Vercel :
  elles sont en écriture seule. `vercel env pull` écrit littéralement
  `"[SENSITIVE]"` (13 caractères) à la place de la valeur, et ni l'API REST,
  ni le tableau de bord, ni la CLI ne peuvent les relire. Bonne posture de
  sécurité, mais la question « Preview et Production partagent-elles la même
  base ? » ne peut être tranchée par lecture.
- Fausse piste écartée : une première comparaison a répondu « SAME HOST » avec
  quatre empreintes identiques `0d2c63a2`. Vérification faite, `0d2c63a2` est
  l'empreinte de la chaîne littérale `(unparsed)` : les quatre lectures
  avaient échoué et se comparaient entre elles. Aucune conclusion n'en a été
  tirée et aucun ticket n'a été modifié sur cette base.
- Conséquence pour V4.5-170 : ne plus chercher à vérifier, mais à établir.
  (1) Conditionner `prisma:deploy` à `VERCEL_ENV=production`, ce qui rend la
  question sans objet quel que soit l'état actuel ; (2) réécrire ensuite les
  variables Preview avec une branche Neon dédiée, connue par construction.
- Vérification restante, côté Neon et non Vercel : compter dans le projet
  `dawn-cake-93662551` les branches autres que `ci-*`. S'il n'en existe
  qu'une, Preview partageait nécessairement la base de production. Le même
  écran renseigne aussi V4.5-171 (branches `ci-*` orphelines).

## 29 août 2026 — correction du diagnostic V4.5-171 et état des checks requis

- Aucune écriture Airtable (la modification d'enregistrements existants reste
  refusée par le classifieur de permissions). Entrée de correction.
- V4.5-171 attribuait l'échec du workflow Integration à des branches Neon
  `ci-*` orphelines. Diagnostic incomplet. La cause première était l'absence
  de groupe de concurrence : `integration.yml` était le seul workflow sans
  `concurrency`, si bien que deux poussées rapprochées lançaient deux runs
  simultanés créant chacun une branche Neon, au-delà du quota du projet.
  Vérifié sur `origin/dev` : `concurrency.group` est désormais présent avec
  `cancel-in-progress: false`, choix délibéré — annuler un run qui crée une
  ressource externe risquerait d'orphaniser la branche. Le run de 14 h 07 est
  vert après le correctif.
- Reste valable dans V4.5-171 : le balayage périodique des branches `ci-*`
  garde son intérêt en défense de second rang, un runner interrompu par
  timeout pouvant encore orphaniser une branche. Devient en revanche
  secondaire, et non plus la correction principale.
- Checks requis sur `main` au 29 août 2026, 14 h 30 : uniquement
  `V4.1 final (required)`. Ni `Integration / real-functions` ni le nouveau
  workflow `Visual` ne sont exigés, alors que les deux échouent utilement.
  Le réglage relève de la protection de branche et demande le propriétaire.
- `required_linear_history` reste activé sur `main` tandis que `dev` accumule
  des commits de fusion : la règle doit être levée puis rétablie à chaque
  release. À trancher avec V4.5-174, d'autant que le modèle retenu par Rayan
  insère `staging` entre les deux.

## 29 août 2026 — mise à jour des tickets DevOps par leur auteur

- Autorisation : Rayan, le 29 août 2026 — « I give you the right to modify the
  tickets you made yourself ». Portée strictement limitée aux neuf
  enregistrements créés par cette session (V4.5-170 à V4.5-178). Le script de
  mutation refuse tout identifiant hors de cette liste ; les tickets
  V4.5-100 à V4.5-164 de la session Head of AI et les cartes héritées n'ont
  pas été touchés. Vérifié après coup : 29 autres enregistrements V4.5
  inchangés, V4.5-100 toujours `DONE`.
- `recLKyPSMTz5aQ1zN` V4.5-174 : `DRAFT` → `READY`, `Arbitrage Rayan = Rayan A`
  (modèle dev → staging → main), `Risque = P2` → `P0`. Description refondue
  avec l'état vérifié des protections (main : un seul check requis et
  `required_linear_history` actif ; dev et staging : aucune protection, 404) et
  les chaînes exactes des contextes de check — `V4.1 final (required)`,
  `real-functions`, `Visual baselines (required)`. Le libellé `real-functions`
  est celui de l'identifiant du job Integration, faute de `name:` : inscrire
  « Integration » comme contexte requis ne correspondrait à rien et ne
  bloquerait rien sans aucun signal.
- `recL3BtE3hDGOdhPW` V4.5-170 : `DRAFT` → `REVIEW`, `Risque = P0` → `P1`,
  `Branche`, `Commit source = f9921813`, `État de synchro = Commit local —
  push en attente`, `Preuves QA` renseignées. `Arbitrage Rayan` ramené de
  `À faire` à `Aucun` : la question posée au propriétaire — comparer les URL
  Preview et Production — est sans objet, ces valeurs étant illisibles par
  conception. Le reliquat (établir la base Preview) est porté par V4.5-177.
- `recJFACuVNTMXxuYP` V4.5-171 : `Risque = P1` → `P2`, diagnostic corrigé
  (groupe de concurrence absent, pas branches orphelines), périmètre réduit au
  balayage préventif, le passage en check requis étant déplacé vers V4.5-174.
- `recYphSi9FXqtNpmj` V4.5-177 : `DRAFT` → `READY`, description complétée avec
  l'état exact de `origin/staging` (479 commits derrière `main`, aucun commit
  unique, non protégée), l'existence des variables `Preview (staging)` côté
  Vercel, et la règle de migration délibérée héritée de V4.5-170.
- Relecture : chaque enregistrement relu champ par champ après mutation,
  aucun écart. Aucune suppression, aucune page d'interface touchée.

## 29 août 2026 — relevé Neon et plan Vercel : 170, 171 et 177 mis à jour

- Autorisation : mise à jour limitée aux tickets créés par cette session.
  Relevé fourni par le propriétaire (captures console Neon) et plan Vercel
  confirmé Hobby.
- Projet Neon LearnX (StudioPickles, plan **Free**), branches observées :
  `production`, `staging`, `backup-pre-v4-release-20260826`,
  `backup-pre-v3-release-20260810`,
  `backup-pre-platform-apm-release-2026…`,
  `backup-pre-v3-018-seed-20260806-074…`,
  `backup-pre-officine-seed-20260806`, `backup-pre-v2-merge-20260804`.
  Aucune branche `ci-*` résiduelle.
- `recYphSi9FXqtNpmj` V4.5-177 : deux inconnues levées. Plan Hobby ⇒ voie (a),
  staging reste un déploiement Preview, `VERCEL_ENV` y vaut `preview`, donc
  l'union fermée `AiDeploymentEnvironment` reste inchangée et AUCUN changement
  de code n'est requis. La branche Neon `staging` existe déjà. Reste une seule
  décision propriétaire : réavancer `origin/staging` ou la recréer.
- `recJFACuVNTMXxuYP` V4.5-171 : `P2` → `P1`. Cause structurelle identifiée en
  plus de la cause première déjà corrigée : le plan Free plafonne le nombre de
  branches et huit sont déjà permanentes, dont six sauvegardes `backup-pre-*`
  du 4 au 26 août. La marge pour les branches de CI est donc très mince. Le
  nettoyage exige un accord nominatif du propriétaire, branche par branche :
  ce sont des sauvegardes de pré-release et aucune ne sera supprimée sans
  autorisation explicite.
- `recL3BtE3hDGOdhPW` V4.5-170 : le relevé confirme qu'AUCUNE branche Neon
  n'est dédiée aux previews. Les variables Preview génériques pointent donc
  nécessairement sur `production` ou sur `staging` : dans les deux cas, chaque
  build preview appliquait des migrations sur une base partagée avec un autre
  palier, depuis une branche non relue. La porte de migration était bien
  nécessaire.
- Relecture : les trois enregistrements relus champ par champ, aucun écart.
- Hors périmètre Airtable, à signaler : l'installation des skills Neon
  (`npx neon@latest skills`) a modifié le fichier suivi `skills-lock.json`
  (empreintes amont mises à jour) et créé `.claude/skills/**`, qui n'est pas
  couvert par `.gitignore` — seul `.claude/settings.local.json` l'est. Ces
  changements sont dans le worktree principal, sur une autre branche, et n'ont
  pas été committés par cette session.

## 29 août 2026 — soirée : tickets 116–118, 130, 131, 112, UX-001/002

- V4.5-116 créé et clos (`995ed402`) : transport factice réellement câblé
  (défaut de 111 signalé par le Head of Development).
- V4.5-117 créé (`DRAFT`) : clé stable des évaluations d'étape.
- V4.5-118 créé, `READY` → `IN_PROGRESS` → `QA` → `DONE` (`9f4f9a5d`) :
  table de confiance déplacée en `src/lib`.
- V4.5-131 : `QA` → `DONE` (`764c027a`). V4.5-130 : `REVIEW` → `QA` → `DONE`
  (`06456cdc`), note de sortie « plomberie seulement ».
- V4.5-112 : `QA` → `IN_PROGRESS` (correction : UI seule livrée, `8c2f8a89`) ;
  moitié API en revue (widening : critères « à vérifier » votables).
- V4.5-150 : correctif e2e mergé (`f3a55e32`) après rouge sur `dev` ;
  UX-001 : `DRAFT` → `DONE` (`aff1d445`), arbitrage densité `Rayan A` ;
  UX-002 créé (`READY`).
- V4.5-114 : rôle `CORRECTION_SECOND_PASS` ajouté au périmètre ; V4.5-122 :
  cas ≥ 2 paragraphes ; V4.5-132 : note sur l'élargissement du motif
  critical-domains.
- Infra : `dev` protégé (check requis `V4.1 final (required)`) ; incident
  Integration (Neon 422, quota de branches) escaladé à la voie D (171) ;
  projet Neon passé au plan Launch par le Propriétaire.
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.

## 2026-08-29 (soir, suite) — Head of AI, base `app8IaHD1sJtI83WT`

- V4.5-112 : `IN_PROGRESS` → `DONE` (`f338f61a`, moitié API mergée).
- V4.5-UX-002 : `READY` → `DONE` (`4160e8ea`, cinq fichiers, baselines
  générées par `visual.yml`).
- UX-003 créé (`READY`, `rec43hW3p7Y3sVUTP`) : pourcentage chiffré encore
  visible sur la carte programme via le libellé de `ProgressBar` — défaut
  attrapé par la fixture non nulle d'UX-002.
- V4.5-179 créé (`READY`, `recFVUKTfqYsjE4km`, voie D) : `reuseExistingServer`
  sur port fixe capte un serveur dev d'un autre checkout (faux verts).
- V4.5-120 : étapes 1–3 acceptées à `0fc85f6b` (non poussé au moment de
  l'écriture) ; décisions Head of AI : `evidenceHallucination` non câblé →
  `NOT_MEASURED` bloquant jusqu'à 121 ; gate bloquante de bascule = `AtHigh`
  (contrat §5), version non restreinte surveillée ; profil `reduced` : budget
  entier 0 pour tout dénominateur < 50.
- V4.5-140 : décisions coupe-circuit consignées (`head-of-ai-breaker-2026-08-29`) :
  latch manuel audité ; refus au devis ; échec d'évaluation → reste fermé avec
  `evaluationError` exposé ; trois raisons dont `UNUSABLE_RATE` ; `wrongAtHigh`
  câblé avec quorum de 20 critères HIGH votés.
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.

## 2026-08-29 (nuit) — Head of AI, base `app8IaHD1sJtI83WT`

- UX-003 : `READY` → `DONE` (`29babe7d`).
- V4.5-140 : `DRAFT` → `REVIEW` (acceptée à `20dcd1dd`, PR #57) ; dérive de
  statut corrigée (la carte n'était pas passée `IN_PROGRESS`).
- V4.5-142 créé (`READY`, `recgEX8YHHsjDVixm`, voie A) : alerte owner,
  audit des coûts inconnus, rapport hebdomadaire — écart du contrat §6
  constaté à la revue de 140.
- V4.5-121 : critère d'acceptation ajouté — article public FR/EN de
  résultats (décision Rayan `owner-research-article-2026-08-29`).
- V4.5-165 : `DRAFT` → `REVIEW` (PR #55 mergée `69271bb1`) ; sept décisions
  Propriétaire en attente (§7 de l'audit).
- Backlog : définitions 118, 170–179, UX-001/002/003 consignées (PR #54,
  `3320e332`) ; 142 et ligne de rollback 151 dans cette entrée.
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.
- V4.5-166, 167, 168 créés (`READY`, `recAv8JFD09VrSS1Z`, `recn4AgQSeVl2BB5T`,
  `recUdTdyD55CJ7Z78`) : suppression par anonymisation, page de
  confidentialité, détachement à 180 jours + information RAG — décisions
  Rayan `owner-rgpd-2026-08-29` ; V4.5-165 : blocage mis à jour.
- V4.5-140 : `REVIEW` → `DONE` (`fa1b2a5e`, PR #57).
- V4.5-165 : attestation fournisseurs (PR #60, `30403064`) et décision
  `owner-openrouter-retention-2026-08-29` consignées ; texte de la politique
  de confidentialité livré (PR #61, `cc27a43e`).
- V4.5-143 créé (`READY`, `rectmO3jKoeB9VRer`, voie A) : journal du
  coupe-circuit exposé et taux figés au déclenchement (manques signalés par la
  voie C sur 140 UI).
- V4.5-119 créé (`REVIEW`, `recvok4Y0lX27n088`, voie A) : coût du vérificateur
  enregistré (défaut de 111, signalé par la voie A ; PR #63).
- V4.5-142 : `READY` → `DONE` (`e0d6b383`, PR #59).
- Règle de handoff « Sorties et leur destination » ajoutée à
  `docs/AGENT_WORKFLOW.md` §7.

## 2026-08-29 (fin de soirée) — Head of AI, base `app8IaHD1sJtI83WT`

- V4.5-120 `IN_PROGRESS` → `DONE` (`5fb24615`) ; V4.5-122 `DRAFT` → `DONE`
  (`af2ff0bf`) ; V4.5-121 `DRAFT` → `IN_PROGRESS` (plafond 3 → 10 → 13 USD,
  décisions Rayan ; « go 13 » du Head of AI).
- V4.5-143 `READY` → `DONE` (`c369a68f`) ; V4.5-144 créé et clos
  (`6ef4de03`, Integration verte sur `97a614b3`) ; V4.5-145, 146, 147, 180,
  169 créés ; V4.5-147 clos (`87f6d020`) ; V4.5-166 clos (`b4b136ca`) ;
  V4.5-179 clos (`93ae5790`, voie D) ; V4.5-163 `IN_PROGRESS` (décisions
  cohorte (a), défaut `EARLY_ADOPTER`, coupe-circuit ⇒ pas d'attribution).
- V4.5-140 UI mergée (`89b2165d`) ; V4.5-167 mergée (`REVIEW`, publiable
  après 169).
- Décisions Rayan consignées : `owner-erasure-2026-08-29` (b, textes
  conservés sous pseudonyme), `owner-openrouter-retention-2026-08-29`,
  `owner-editor-identity-2026-08-29`, adresse de contact `support@learn-x.app`.
- Incident évité : PR #69 (e-mail personnel) fermée sans merge et branches
  supprimées avant toute entrée dans `dev` (dépôt public) — signalé par la
  voie C.
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.
- V4.5-163 : `IN_PROGRESS` → `DONE` (PR #81, 163A+B+C) ; V4.5-167 et 169 :
  `DONE` (PR #83) ; V4.5-181 créé (`DRAFT`, `recN6vydl1IY1mKuU`).
- Incident `dev` rouge (test de fidélité de la politique) causé par le Head
  of AI (textes 1.2.0/1.3.0 mergés sans régénération) ; réparé par #83 ;
  couplage documenté dans l'en-tête du document.
- Règle de handoff « Symboles exportés et leurs appelants » remplace
  « Sorties et leur destination » (AGENT_WORKFLOW §7).
- V4.5-117 `DONE` (`cd7c804b`) ; V4.5-182 `DONE` (`83cb5e77`) ; V4.5-160
  `IN_PROGRESS` → `REVIEW` au merge (inerte, passe sandbox en attente) ;
  V4.5-161 `REVIEW` au merge ; V4.5-182/183 créés ; V4.5-121 : smoke exécuté
  (0,0199 USD réconcilié), run complète lancée sous 12,80 USD.
- Question Propriétaire ouverte : fournisseur de paiement (Stripe sans compte
  Business vs Revolut Business) — ADR_004 à amender selon la réponse.
- Décision Rayan `owner-payment-provider-stripe-2026-08-29` : Stripe (compte
  Revolut Business impossible à ouvrir). V4.5-184 créé (`READY`,
  `recOJrKrdkkWQhi0a`, voie B, après 162) ; blocages 160/161 mis à jour.
  Décision `owner-refund-policy-2026-08-29` : remboursement volontaire au
  prorata ; 162 `IN_PROGRESS`. V4.5-160 `REVIEW` (`1b6576a3`), V4.5-161
  `REVIEW` (`c285306e`).

## 2026-08-30 (nuit) — Head of AI, base `app8IaHD1sJtI83WT`

- V4.5-121 `IN_PROGRESS` → `REVIEW` → `DONE` (run partielle, PR #93
  `3f8e389e`) ; V4.5-124 créé et clos (`67ff25b8`) ; V4.5-125 créé (`DRAFT`,
  `rec8JHU6yyPbQAY8A`, budget Rayan à venir) ; V4.5-123 créé et clos
  (`5cf38e28`) ; V4.5-184 créé, clos côté code (`f73a88d2`, `REVIEW` jusqu'à
  la passe Stripe) ; V4.5-162 `DONE` (`59c2053e`) ; V4.5-182 `DONE`.
- Incidents run 121 : deux lancements tués par l'environnement agent
  (≈ 1 USD non enregistré), doublon de commande tué par le Head of AI
  (0,64 USD), trois relances fantômes sans appel ; arrêt sur décision
  Propriétaire ; décisions `owner-retry-policy-2026-08-29`.
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.

## 2026-08-30 (journée) — Head of AI, base `app8IaHD1sJtI83WT`

- V4.5-125 : run exécutée (`results/2026-08-30T00-44-57-975Z`, 4,69 USD) ;
  carte `IN_PROGRESS` avec le tableau des gates ; complément stabilité à
  venir (127 puis 24 cellules dans l'enveloppe de 14 USD).
- V4.5-126 `DONE` (`71b92e8e` + `6f56f8b0` unification des préflights) ;
  V4.5-127 créé (`IN_PROGRESS`) ; V4.5-145 `DONE` (`95f2a257`) ; V4.5-146
  `DONE` (`7a326124`) ; V4.5-180 `DONE` (`103630f1`) ; correctifs Integration
  #102/#103/#104 mergés.
- **Incident 186** (production) : créé `IN_PROGRESS` ; hotfix dev
  `eb8f42c9` ; PR main #108 en attente du swap de contexte requis
  (`Integration (required)` → `real-functions`) et du GO Rayan ; V4.5-187
  créé ; V4.5-185 (quota Vercel) et V4.5-188 (test instable) créés.
- Décisions Rayan : enveloppe 125 = 14 USD sous convention mesurée
  (`owner-125-budget-2026-08-30`) ; protection Vercel Preview désactivée ;
  `LEARNX_PAYMENTS_ENABLED=true` en Preview.
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.
- V4.5-186 : hotfix main #108 mergé sur GO Rayan (`194e57e9`, 11 h 24 UTC) ;
  production vérifiée (`POST /api/public-leads` → 400) ; carte `REVIEW`
  jusqu'à l'inscription réelle de Rayan et la restauration du check.
  V4.5-187 `DONE` (`4d884485`, route inconnue ⇒ 404 consigné) ; V4.5-188
  `DONE` (`c6d5ff2e`, deux causes) ; V4.5-183 `DONE` (`a4932bb3`) ;
  V4.5-165 partie paiement (`1e5c0a4b`, E4 à trancher) ; V4.5-189, 190, 191
  créés ; 162 rouvert (162B).
- Incident Preview (base injoignable) attribué à la voie D + Rayan ; consigne
  corrigée en cours de route : branche `preview` vide, jamais clonée depuis
  production (arrêt demandé par la voie A).
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.
- **Incident V4.5-192** (créé `IN_PROGRESS`, `recASkufqQIiR8A6o`) : production
  vidée par une commande fournie par le Head of AI, restaurée par Rayan (Neon
  PITR, 5 utilisateurs) ; règle ajoutée à AGENT_WORKFLOW §7 ; wrapper demandé
  à la voie A, post-mortem à la voie D.
- V4.5-162 `DONE` (162B, `1492e002`) ; V4.5-191 (UI) PR #119 en brouillon ;
  seed preview mergé (`4f081295`) ; branche Neon `preview` créée vide, non
  migrée (procédure suspendue jusqu'au wrapper).
- Chaque enregistrement relu après mutation ; aucun autre ticket modifié.
## 30 août 2026 — voie D : mutations Airtable non encore journalisées

Rattrapage. Les mutations ci-dessous ont été appliquées le 29 août au soir et
le 30 août, toutes sur des enregistrements créés par cette session, et
n'avaient pas encore d'entrée. Chaque enregistrement a été relu champ par
champ après mutation ; aucun écart, aucune suppression, aucune page
d'interface touchée.

- `recJFACuVNTMXxuYP` V4.5-171 : `P2` → `P1` → `P0` puis `DRAFT` → `READY`,
  après le relevé Neon du propriétaire ; puis `REVIEW`, PR #46, commit
  `0ec4c397`, `État de synchro = Canonique Git`, `Preuves QA` renseignées, et
  retour à `P1` une fois la cause première corrigée.
- `recI0o4zDR5FFD7MQ` V4.5-176 : `P2` → `P1`, `DRAFT` → `READY`, description
  refondue autour de la fenêtre de restauration de 6 h relevée par le
  propriétaire, et de sa tension avec les suppressions de branches de V4.5-171.
- `recLKyPSMTz5aQ1zN` V4.5-174 : description complétée avec les noms exacts des
  contextes de check, puis `DONE` après application des protections par le
  propriétaire, `Preuves QA` renseignées.
- `recL3BtE3hDGOdhPW` V4.5-170 : `REVIEW` → `DONE`, PR #28, commit `cc956e55`,
  `Arbitrage Rayan` ramené à `Aucun` — la question posée était sans objet, les
  URL de base étant illisibles par conception.
- `recYphSi9FXqtNpmj` V4.5-177 : `Blocage courant` réduit à la seule décision
  restante, plan Hobby et base Neon `staging` étant confirmés.

## 30 août 2026 — voie D : erreur de contexte de check requis sur `main`

Consignée parce qu'elle a bloqué une promotion d'urgence et que la leçon vaut
au-delà de l'incident.

Les checks requis de `main` nomment `Integration (required)`. Or le workflow
d'Integration **sur `main`** ne porte pas de `name:` : le renommage n'est parti
que sur `dev`. Le job publie donc son contexte sous `real-functions`, et
`Integration (required)` ne peut pas apparaître. Une PR vers `main` reste
indéfiniment en « Expected — waiting for status to be reported », et
`enforce_admins` étant actif, personne ne passe outre.

Origine : les noms de contextes ont été relevés sur une PR issue de `dev`
après le renommage, puis transmis pour réglage sur `main`, sans vérifier que
`main` produisait les mêmes. **Un contexte requis se vérifie sur la branche qui
porte la protection, pas sur celle que l'on regarde.**

Contournement demandé au propriétaire : remplacer temporairement le contexte
par `real-functions`, et rétablir `Integration (required)` à la première
promotion normale `dev` → `main`, celle qui emportera le renommage. L'étape de
rétablissement est inscrite dans V4.5-174 pour que le provisoire ne dure pas.

## 30 août 2026 — voie D : exclusion de build, garde Prisma, Sentry

Mutations Airtable de la journée, table `tblpSbdB7K4MioyJq`.

- `recOysSUJWU1sijWA` V4.5-196 créée, puis `Statut` DRAFT → REVIEW quand la
  PR #129 est devenue verte. Passée DONE à la fusion.
- `recLb4hF4nvLUH3DO` V4.5-172 : `Blocage courant` réduit à la seule saisie
  propriétaire restante, les deux variables Sentry dans Vercel.

Une tentative d'écriture sur `Arbitrage Rayan` a été refusée en 422 : le champ
est une liste de choix, pas du texte libre. Le contenu a été porté dans
`Blocage courant`. À retenir avant d'écrire dans un champ non encore utilisé.

### Ce que la journée a appris, hors Airtable

**Une règle portée par un fichier du dépôt ne gouverne pas une branche
antérieure à ce fichier.** L'« Ignored Build Step » vivait dans `vercel.json` et
pointait sur un script. Sur une branche créée avant la fusion qui l'a introduit,
la commande s'exécute quand même, bash ne trouve pas le script, sort en
non-zéro — et dans cette convention inversée, non-zéro veut dire *construire*.
Le mécanisme échouait en s'ouvrant, précisément sur les vieilles branches qu'il
devait arrêter. Constaté sur `codex/v4-5-162-ui` et `codex/seed-preview`. La
règle vit désormais dans le réglage du projet Vercel, que nulle branche ne
transporte.

**Le marqueur `[preview]` est testé sur le message de commit entier.** Mon
propre commit d'alignement citait la règle, contenait donc les caractères
`[preview]`, et s'est auto-inscrit à la construction. Premier commit après la
mise en service. Le déploiement qui en est né a d'ailleurs révélé le point
suivant, ce qui ne rachète pas l'erreur mais la rend utile. À restreindre à la
première ligne.

**Un garde qui compare des noms ne détecte pas ce qu'il croit détecter.** Le
garde de V4.5-192 refusait `DATABASE_URL` et `DIRECT_URL` comme « deux hôtes
différents » alors qu'il s'agissait du même endpoint Neon sous ses deux
écritures, poolée et directe — la configuration recommandée. Tous les builds de
`dev` mouraient à `prisma generate` ; `main` ne portant pas encore le garde, la
production tenait, et la prochaine promotion l'aurait cassée. Il compare
maintenant l'identité d'endpoint.

**Une mesure de bundle mesure le montage autant que la bibliothèque.** J'ai
annoncé le SDK Sentry navigateur à 154 402 octets gzip et recommandé de
l'écarter sur ce chiffre. Il valait 26 832 : j'importais l'espace de noms entier
derrière un import dynamique, ce qui annule le tree-shaking, et je laissais les
intégrations par défaut. Le propriétaire a demandé une seconde mesure plutôt que
d'accepter la première, et il avait raison. Avant de recommander d'abandonner
quelque chose sur un chiffre, vérifier que le chiffre mesure la chose.

## 5 septembre 2026 — V4.5-230, déblocage de l'audit de dépendances

- Base `app8IaHD1sJtI83WT`, table `tblpSbdB7K4MioyJq`, API REST, token
  personnel. **Création uniquement** : un enregistrement, aucun existant
  modifié, aucune suppression, aucune page d'interface créée ou publiée.
  Dry-run imprimé avant l'appel, conformément à `docs/AGENT_WORKFLOW.md` §0.1.
- `recNAkqsJOAdDz9V8` V4.5-230 — audit des dépendances de production rouge sur
  toutes les PR : Prisma 7.10.0 et deux overrides ciblés (P0,
  `Owner = DevOps`, `Reviewer = Sécurité`,
  `Epic = V4.5-013 Exploitation DevOps (proposition)`,
  `Statut = REVIEW`, `État de synchronisation = Proposition Airtable`,
  `Branche = chore/v4-5-230-audit-unblock`).
- Valeurs prises exclusivement dans les choix existants — aucune valeur de
  `Nature`, `Statut`, `Release`, `Risque`, `Owner`, `Reviewer` ou `Epic`
  ajoutée, donc `pnpm quality:airtable` n'est pas affecté.
- Numéro attribué après relevé : 194 enregistrements lus, plus haut `V4.5-`
  existant = 229.

**Ce que le relevé a corrigé du signalement.** La voie learnx-e1 rapportait deux
avis « high ». L'audit en donne **cinq** : un `mysql2` et **quatre** `fast-uri`,
plus un « moderate » qui ne fait pas échouer le gate. Le compte importe parce
qu'il change le correctif — une exception justifiée sur le seul `mysql2`, telle
qu'envisagée, aurait laissé le gate rouge sur les quatre autres.

**Et ce que la correction a révélé.** Corriger les cinq en fait apparaître un
sixième : `deepmerge-ts <8.0.0` via `@prisma/config`, invisible tant que les
autres masquaient la sortie. Un audit ne montre pas toujours tout ce qu'il
reste à faire — il montre ce qu'il voit à cet instant, et le corriger déplace
l'horizon. À se rappeler avant d'annoncer « il reste N avis ».

## 5 septembre 2026 — lot landing « Conversion Edition » (V4.5-219 → 229)

- Autorisation : décisions D0–D7 de Rayan (5 septembre 2026) ; dry-run relu
  avant création.
- Créés (11) : V4.5-219 `recDbJJVtpbAwXcL0`, V4.5-220 `recmEuXIj8mtubrKR`,
  V4.5-221 `recpfqtAKpCqFdDB0`, V4.5-222 `recR71wlki9hBcPoG`,
  V4.5-223 `recdOmQvcPZPkBfIz`, V4.5-224 `recIvKKjHtTrRk9tD`,
  V4.5-225 `rechJxeKa6966NBfx`, V4.5-226 `rech0F6mB1kyJfPsI`,
  V4.5-227 `recRdluhWj0sI4KWb`, V4.5-228 `rec7pygR2lNETBHw9`,
  V4.5-229 `recfgBV4S6C18cl65`.
- Statuts : 219, 220, 228 `READY` ; 223, 226 `NEEDS_ARBITRATION` (D2, D5 à
  confirmer) ; les autres `DRAFT`. Risque `P1`, `État de synchronisation =
  Commit local — push en attente`, branche `docs/v4-5-landing-conversion-edition`.
- Définition : `V4_5_BACKLOG.md` § « Landing « Conversion Edition » (maquette
  Paper) ».
- PR #202, #204, #205 fermées sans merge (D0).
- Relecture : 11/11 enregistrements relus après création ; aucun autre
  enregistrement modifié ; aucune suppression, aucune page d'interface ajoutée.
- 5 septembre, suite : V4.5-226 `NEEDS_ARBITRATION` → `DRAFT`, `Arbitrage
  Rayan = Rayan A` (section conçue et masquée en V4.5, affichée en V5) ;
  titre, résumé et dépendances mis à jour ; enregistrement relu.
- 5 septembre, suite : V4.5-223 `NEEDS_ARBITRATION` → `DRAFT`, `Arbitrage
  Rayan = Rayan A` (grille du 2 septembre conservée, bonus sur Journey seul,
  #214 inchangée) ; V4.5-220 `Arbitrage Rayan = Rayan A` (formulation du
  +20 % figée). Les deux enregistrements relus.

## 5 septembre 2026 — lot landing « Conversion Edition », tickets 219 et 220

- Autorisation : affectation du lot par la session de coordination, sur
  décision de Rayan du 5 septembre 2026 (`V4_5_BACKLOG.md` § lot landing).
- Base : `app8IaHD1sJtI83WT` — Table : `tblpSbdB7K4MioyJq`
- Mutations unitaires par id, aucun bulk update, aucune suppression.

**V4.5-219** (`recDbJJVtpbAwXcL0`) — `READY` → `REVIEW`

- Branche : `docs/v4-5-landing-conversion-edition` → `feat/v4-5-219-landing-foundations`
- PR : #215 (branche de définition) → #219
- Blocage courant renseigné : quota MCP Paper épuisé pour six jours ;
  navigation, pied de page et disques décoratifs restent hors de la PR.
- Relecture : livraison partielle assumée et décrite dans la PR ; les trois
  gates ne sont pas tous verts au moment de la synchronisation.

**V4.5-220** (`recmEuXIj8mtubrKR`) — `READY` → `REVIEW`

- Branche : `docs/v4-5-landing-conversion-edition` → `feat/v4-5-220-landing-copy`
- PR : #215 → #220
- Blocage courant renseigné : attend la validation de Rayan sur
  `docs/V4_5_LANDING_COPY.md` — trois points ouverts (nombre de sources de la
  carte recherche, cohabitation « achat unique » et limite par compte sur
  Starter, six passages marqués à confirmer dans Paper).
- Relecture : le ticket demande une validation avant intégration ; le
  catalogue `landing.ts` n'est donc pas encore réécrit.

Aucun statut manuel écrasé. Aucun `NEEDS_ARBITRATION` déclenché.
