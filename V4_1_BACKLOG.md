# Backlog V4.1 — refondation technique et visuelle

## Autorité et état

- Version : 1.0.0
- Date de gel : 26 août 2026
- Baseline : `origin/dev` à
  `a02ecc3f307af36656fa5cb8a7b62954fdec73e9`
- État de la baseline : V4 **released et clôturée** à ce SHA.
- Statut V4.1 : **clôturée** — les 27 tickets sont `DONE`, release publiée le
  29 août 2026 au SHA `63c436d9`.
- Autorité : ce fichier est l'unique backlog d'exécution V4.1.
- Identifiants : les IDs Airtable sont stables et ne doivent jamais être
  renumérotés, réutilisés ou interprétés avec un autre livrable.

V4.1 conserve la parité fonctionnelle V4. Elle migre Preact vers React,
introduit shadcn avec le thème Maia, refond les écrans à contrat constant et
réduit les monolithes techniques. Paiement, nouveau pipeline IA et évaluations
textuelles d'étape restent en V4.5 ; conception guidée et analytics restent des
candidats V5.

## Règles d'exécution

- L'owner produit les preuves ; un reviewer distinct rend le verdict.
- Une dépendance est terminée lorsqu'elle est revue et promue, pas seulement
  présente dans un worktree.
- Un statut `bloqué` interdit l'implémentation anticipée.
- Chaque ticket utilise une branche, un worktree et un commit traçables.
- Aucun nettoyage Git, documentaire ou IA n'est implicite : l'audit préserve,
  puis une décision explicitement revue autorise éventuellement une mutation.
- Les contrats métier, migrations, SQL runtime, progression, correction,
  pricing, ledger et historique restent inchangés sauf ticket qui les nomme.
- Chaque handoff fournit SHA, fichiers, validations, limites et rollback.

## Statuts canoniques

La machine d'état opérationnelle, identique dans Git et Airtable, est :

```text
DRAFT → NEEDS_ARBITRATION → READY → IN_PROGRESS
→ REVIEW → QA → READY_FOR_OWNER_GO → DONE
```

- `DRAFT` : définition encore incomplète ou non activable ;
- `NEEDS_ARBITRATION` : décision propriétaire ou conflit de synchronisation ;
- `READY` : dépendances disponibles et ticket activable ;
- `IN_PROGRESS` : un owner travaille dans un worktree identifié ;
- `REVIEW` : preuve immuable remise au reviewer distinct ;
- `QA` : revue acceptée, gates techniques ou produit en cours ;
- `READY_FOR_OWNER_GO` : tous les gates sont verts, action propriétaire requise ;
- `DONE` : preuve promue et clôture autorisée.

Les mentions historiques du backlog se lisent ainsi : `prêt` = `READY`,
`livré pour revue` = `REVIEW`, `terminé` = `DONE`. Un ticket `bloqué` conserve
le dernier statut valide et renseigne son blocage ; il ne constitue pas un
neuvième statut.

## Lot 000 — gouvernance, audit et baseline

### V4.1-001 — Snapshot release/worktree/Git

- Priorité : P0
- Owner : Architecture/Produit
- Reviewer : QA/Release
- Dépendances : aucune
- Source : release V4 à `a02ecc3f` ; `AGENTS.md`
- Statut : **terminé** — manifeste conservé et 70 métadonnées de worktrees
  orphelines retirées sans supprimer de branche, fichier ou worktree actif
- Critères d'acceptation :
  - le SHA released, la branche source et l'état V4 clôturé sont enregistrés ;
  - branches, worktrees et état dirty du worktree principal sont relevés en
    lecture seule ;
  - le worktree V4.1 est isolé de tous les worktrees existants ;
  - aucune suppression, prune, reset, checkout externe ou push n'est exécuté.

### V4.1-002 — Audit dépendances/sécurité/bundle/routes/dette

- Priorité : P0
- Owner : Backend/Data
- Reviewer : Architecture/Produit
- Dépendances : V4.1-001
- Source : `package.json`, lockfile, Vite, TypeScript, routes et code baseline
- Statut : **terminé** — audit corrigé au SHA `fc269f72` puis accepté en
  revue indépendante ; les 113 couplages Preact globaux de la baseline, les
  routes, montages API, hotspots, dépendances et risques sont reproductibles
- Critères d'acceptation :
  - runtime, devDependencies et points de couplage Preact sont inventoriés ;
  - l'audit sécurité daté expose les avis et overrides réellement appliqués ;
  - routes client/API, état des mesures bundle et seuils absents sont explicites ;
  - hotspots et dette sont chiffrés sans mise à jour ou suppression automatique.

### V4.1-003 — Manifeste branches/worktrees/nettoyage sécurisé

- Priorité : P0
- Owner : Architecture/Produit
- Reviewer : QA/Release
- Dépendances : V4.1-001, V4.1-002
- Source : registre Git observé ; politique de préservation V4.1
- Statut : **terminé** — manifeste accepté en revue indépendante au HEAD
  `8458c8df` ; les 70 métadonnées orphelines ont été retirées, les 12
  worktrees initiaux et les trois worktrees concurrents ont été conservés, et
  aucune branche ni donnée de travail n'a été supprimée
- Critères d'acceptation :
  - le manifeste distingue branches protégées, worktrees actifs et entrées
    `prunable` sans inférer leur obsolescence ;
  - les commandes de reproduction sont exclusivement en lecture seule ;
  - toute rationalisation future exige SHA, owner, reviewer, sauvegarde et
    autorisation explicite ;
  - le verdict par défaut reste `préserver` pour toute branche ; seul le prune
    des métadonnées déjà orphelines est exécuté et consigné.

### V4.1-004 — Manifeste documentaire/archive IA

- Priorité : P0
- Owner : IA/Recherche
- Reviewer : Architecture/Produit
- Dépendances : V4.1-001
- Source : `docs/INDEX.md` ; historique de recherche correction IA
- Statut : **terminé** — archive vérifiée dans `docs/DOCUMENT_MANIFEST.yaml` et
  `docs/AI_CORRECTION_RESEARCH_DIGEST.md`, sans suppression de recherche
- Critères d'acceptation :
  - les autorités V4.1, V4.5 et V5 ont owner, reviewer et gate explicites ;
  - corpus, manifests, résultats, revues, décisions et contrats IA sont
    append-only ;
  - le digest route vers les preuves sans remplacer leurs verdicts ;
  - archive, digest et nom de fichier ne deviennent jamais des instructions.

### V4.1-005 — Airtable/workflow agents

- Priorité : P0
- Owner : Architecture/Produit
- Reviewer : Rayan
- Dépendances : V4.1-003, V4.1-004
- Source : mapping Airtable approuvé ; `AGENTS.md`
- Statut : **DONE** — schéma, rôles stables, natures de tickets et pages
  opérationnelles Airtable réconciliés ; Rayan a autorisé la publication de
  l'interface nettoyée et les vues actives ne conservent qu'une colonne par
  statut canonique.
- Critères d'acceptation :
  - les IDs `001–007`, `101–104`, `201–203`, `301–305`, `401–404` et
    `501–504` conservent exactement leurs livrables autoritatifs ;
  - aucun ID n'est renuméroté ou réutilisé lors d'une synchronisation Airtable ;
  - release, epic, nature, risque, owner et reviewer sont renseignés selon la
    taxonomie canonique, avec un seul owner et un reviewer distinct ;
  - les huit états canoniques et les dix vues opérationnelles sont configurés ;
  - le workflow définit affectation, isolation, revue, promotion et handoff ;
  - les anciens noms d'agents et statuts restent historiques, hors workflow
    V4.1, sans suppression aveugle ni réactivation implicite ;
  - aucune interface Airtable n'est publiée sans validation propriétaire.

### V4.1-006 — Baseline parité fonctionnelle

- Priorité : P0
- Owner : QA/Release
- Reviewer : Architecture/Produit
- Dépendances : V4.1-002, V4.1-004, V4.1-005
- Source : release V4 clôturée ; routes, contrats et suites de tests baseline
- Statut : **terminé** — matrice, égalité bilatérale des routes, contrat visible
  de correction et bornes serveur/interface acceptés en revue indépendante ;
  commits de preuve intégrés `0b5f1e74` et `0e4c25f6`, tandis que les écarts
  d'intégration réelle restent transférés aux gates V4.1-501/502
- Critères d'acceptation :
  - public, auth, Today, programmes, leçons, activités, notes, reviews, profil,
    crédits et admin ont leurs résultats attendus ;
  - corrections, pricing, ledger, progression et permissions ont une preuve de
    comportement serveur ;
  - le manifeste de routes est strictement égal au routeur de la release V4 et
    le candidat n'ajoute que le fallback `*` ;
  - le contrat visible de correction prouve l'estimation, le plafond, la
    vérification incluse et l'absence de dispatch avant confirmation ;
  - la contestation conserve ses bornes serveur et interface de 20 à 500
    caractères, testées aux frontières 19/20 et 500/501 ;
  - mobile, desktop, clavier, focus, zoom 200 %, reduced motion, PWA et erreurs
    sont couverts ;
  - commandes, fixtures, environnement, résultats et écarts connus sont gelés.

### V4.1-007 — Seuils couverture/sécurité/bundle

- Priorité : P0
- Owner : QA/Release
- Reviewer : Architecture/Produit
- Dépendances : V4.1-002, V4.1-006
- Source : `docs/V4_1_TECHNICAL_AUDIT.md` ; mesures de V4.1-006
- Statut : **terminé** — après deux revues rejetées, le lot a fermé les
  contournements du manifeste critique et du graphe d'imports ; une revue
  indépendante finale conclut `REVIEW_PASS` au SHA `c22c93ab`. Le gate final
  reste rouge par conception jusqu'à V4.1-501
- Critères d'acceptation :
  - la méthode de couverture et la trajectoire vers V4.1-501 sont gelées ;
  - un avis `high` applicable bloque la release ou possède une exception revue,
    bornée et datée ;
  - budgets JS, CSS, chunks, précache et régression sont dérivés d'une mesure
    reproductible, jamais inventés ;
  - les gates CI, signaux d'arrêt et rollback sont documentés avant migration.

## Lot 100 — migration React

### V4.1-101 — Fondation React/Vite/TS

- Priorité : P0
- Owner : Frontend
- Reviewer : Architecture/Produit
- Dépendances : V4.1-006, V4.1-007
- Source : audit V4.1-002 ; gates V4.1-007
- Statut : **terminé** — React 19 est l'unique runtime UI, sans import ni
  dépendance Preact ; revue indépendante `REVIEW_PASS` au SHA `2277b205`
- Critères d'acceptation :
  - React et React DOM deviennent le runtime UI configuré par Vite ;
  - JSX, types, aliases et montage racine restent TypeScript strict ;
  - la compatibilité Preact éventuelle est inventoriée, bornée et réversible ;
  - lint, typecheck, tests smoke, build et budgets V4.1-007 passent.

### V4.1-102 — Routeur/navigations

- Priorité : P0
- Owner : Frontend
- Reviewer : QA/Release
- Dépendances : V4.1-101
- Source : 33 routes client et baseline V4.1-006
- Statut : **terminé** — routes migrées, parité contrôlée et navigation native
  Recherche protégée par tests unitaires et Playwright ; revue indépendante
  `REVIEW_PASS` au SHA `2277b205`
- Critères d'acceptation :
  - URLs, paramètres, liens profonds, redirections et page 404 sont identiques ;
  - gardes public, authentifié et admin conservent leurs permissions ;
  - back, scroll, focus après navigation et analytics autorisés sont testés ;
  - aucun routeur concurrent ou écran dupliqué ne reste après le lot.

### V4.1-103 — Providers React/React Query/i18n/PWA

- Priorité : P0
- Owner : Frontend
- Reviewer : Backend/Data
- Dépendances : V4.1-101, V4.1-102
- Source : providers et requêtes baseline ; configuration PWA et catalogues
- Statut : **terminé** — providers React, React Query, i18n et PWA passent la
  baseline sans transfert d'autorité métier vers le client ; revue indépendante
  `REVIEW_PASS` au SHA `2277b205`
- Critères d'acceptation :
  - React Query remplace l'usage direct de query-core avec clés et invalidations
    équivalentes ;
  - providers session, erreur, i18n et données gardent leurs contrats typés ;
  - PWA install, offline, update, cache et récupération restent vérifiés ;
  - aucune autorité métier ne migre du serveur vers un provider client.

### V4.1-104 — Testing Library Preact→React

- Priorité : P0
- Owner : QA/Release
- Reviewer : Frontend
- Dépendances : V4.1-101, V4.1-102, V4.1-103
- Source : suites `@testing-library/preact` et baseline V4.1-006
- Statut : **terminé** — Testing Library React en place ; revue indépendante
  `REVIEW_PASS` au SHA `2277b205` avec 968 tests conservés, aucune suppression
  ni désactivation destinée à faire passer la migration
- Critères d'acceptation :
  - helpers, render, événements et tests passent sous Testing Library React ;
  - assertions métier, a11y et navigation sont conservées ;
  - aucun test n'est supprimé, affaibli ou ignoré pour obtenir un résultat vert ;
  - flakes et différences d'ordonnancement React sont mesurés puis résolus.

## Lot 200 — shadcn Maia et layouts

### V4.1-201 — shadcn Maia/tokens

- Priorité : P0
- Owner : Frontend
- Reviewer : Design
- Dépendances : V4.1-007, V4.1-101
- Source : direction Totem/Maia promue ; seuils V4.1-007
- Statut : **terminé** — fondation shadcn Maia et tokens LearnX intégrés sans
  migration de surface ; les défauts d'alias Tailwind et d'interaction du
  bouton `asChild` désactivé ont été corrigés, puis la revue indépendante a
  conclu `REVIEW_PASS` au SHA `cc8bae9e`
- Critères d'acceptation :
  - shadcn est initialisé avec la direction Maia sans esthétique générique ;
  - couleurs, typo, espaces, rayons, ombres, focus et motion sont tokenisés ;
  - seules les primitives réellement consommées sont ajoutées au dépôt ;
  - tokens et composants restent génériques à tous les programmes LearnX.

### V4.1-202 — Primitives/forms/dialogues/tables/states

- Priorité : P0
- Owner : Frontend
- Reviewer : QA/Release
- Dépendances : V4.1-201
- Source : inventaire UI V4.1-006 ; fondation V4.1-201
- Statut : **terminé** — implémentation et revue indépendante `REVIEW_PASS` au
  SHA `6ca24079` ; 968 tests, lint, typecheck et build sont verts. Le chunk
  Radix/Drawer est mesuré séparément comme référence de fondation Maia et reste
  soumis à un plafond de régression de 10 %, sans modifier les budgets initiaux
- Critères d'acceptation :
  - boutons, liens, champs, formulaires, dialogues et tables sont unifiés ;
  - états chargement, vide, succès, erreur, indisponible et interdit existent ;
  - clavier, focus, libellés, erreurs et restauration du focus sont testés ;
  - doublons et CSS ne sont retirés qu'après preuve d'absence de consommateur.

### V4.1-203 — Shells/navigation/responsive

- Priorité : P0
- Owner : Frontend
- Reviewer : Design
- Dépendances : V4.1-102, V4.1-202
- Source : navigation V4.1-102 ; primitives V4.1-202
- Statut : **terminé** — implémentation au SHA `13f31bb4` et revue indépendante
  `REVIEW_PASS` ; shells public, authentification, application et
  administration, navigation responsive, skip link, focus, contraste, PWA et
  budgets initiaux vérifiés avec 975 tests verts
- Critères d'acceptation :
  - shells public, authentifié et admin partagent les primitives approuvées ;
  - navigation mobile/desktop conserve hiérarchie, repères et action primaire ;
  - 320, 390, 720, 1440 et 1920 px, clavier et zoom 200 % sont testés ;
  - landmarks, skip links, focus et reduced motion sont conformes.

## Lot 300 — migration des surfaces

### V4.1-301 — Auth/public

- Priorité : P0
- Owner : Frontend
- Reviewer : QA/Release
- Dépendances : V4.1-103, V4.1-104, V4.1-203
- Source : baseline auth/public V4.1-006
- Statut : **terminé** — revue indépendante `REVIEW_PASS` au commit
  `f53a23a9` : landing, intérêt, authentification et 404 publique migrés vers
  les shells React et primitives partagées ; URLs, payloads et protections
  inchangés ; 980 tests unitaires et matrice E2E 320/390/720/1440/1920 verts
- Critères d'acceptation :
  - landing, intérêt, login, demande d'accès, vérification et activation migrent ;
  - sessions, redirections, messages et protections anti-abus restent identiques ;
  - états clavier, responsive, erreur et reprise sont couverts ;
  - le lot se rollbacke sans mutation de comptes ou de données.

### V4.1-302 — Today/programmes/leçons

- Priorité : P0
- Owner : Frontend
- Reviewer : QA/Release
- Dépendances : V4.1-103, V4.1-104, V4.1-203
- Source : baseline parcours V4.1-006
- Statut : **terminé** — revue indépendante `REVIEW_PASS` au commit
  `b4a43d3b` ; les contrats et URLs restent inchangés
- Preuves : 156 fichiers / 978 tests verts, tests ciblés Today/annuaire/
  programme/leçon et état de reprise verts, lint/typecheck/build/PWA verts ;
  `QueryState`, `TextField` et `SelectField` remplacent les états et contrôles
  ad hoc du périmètre actif
- Critères d'acceptation :
  - Today, annuaire, découverte, programme, étape, module et leçon migrent ;
  - `Program > Stage > Module > Lesson` et URLs restent inchangés ;
  - progression, avance/retard, maîtrise et durée restent des autorités serveur ;
  - états longs, vides, indisponibles et responsive passent la baseline.

### V4.1-303 — Exercises/quiz/assessments/correction

- Priorité : P0
- Owner : Frontend
- Reviewer : IA/Recherche
- Dépendances : V4.1-103, V4.1-104, V4.1-202, V4.1-302
- Source : contrats d'évaluation et correction V4 ; baseline V4.1-006
- Statut : **terminé** — implémentation `ead8f10a`, revue indépendante
  `REVIEW_PASS` puis intégration sur la branche V4.1 au commit `692c09c2` ;
  aucun contrat serveur, score de progression ou payload n'a changé
- Preuves : exercices, quiz, assessments concept/étape et correction assistée
  utilisent les primitives React partagées (`QueryState`, `Textarea`) ; le
  panneau de résultat est séparé du workflow de devis/exécution ; 6 fichiers /
  21 tests ciblés et la suite complète 158 fichiers / 986 tests sont verts,
  ainsi que 22 scénarios E2E desktop/mobile, lint, typecheck, build, budgets
  bundle/PWA et frontières d'import
- Critères d'acceptation :
  - exercices, quiz, assessments concept/étape et panneaux de correction migrent ;
  - tentative, score, maîtrise, devis, soumission, abstention et historique
    gardent leurs contrats ;
  - une ressource ouverte ou un verdict IA seul ne valide jamais une notion ;
  - saisie, indisponibilité, reprise, recours et familles autorisées sont testés.

### V4.1-304 — Reviews/notes/profile/credits

- Priorité : P0
- Owner : Frontend
- Reviewer : Backend/Data
- Dépendances : V4.1-103, V4.1-104, V4.1-203, V4.1-302
- Source : baseline V4.1-006 ; contrats notes, reviews et ledger
- Statut : **terminé** — migration et reprises `0347c87d`, `aa68c992`,
  `345ee7ca` et `3e836fe0` acceptées en revue indépendante ; pagination
  récupérable et cycle complet d'idempotence des demandes de crédits couverts
- Critères d'acceptation :
  - reviews, liste/édition de notes, profil et crédits migrent sans perte d'état ;
  - historique, lots offerts/achetés et écritures restent immuables ;
  - consultation, erreur, reprise et responsive sont couverts ;
  - aucune vente ou valeur de pack V4.5 n'est activée.

### V4.1-305 — Admin/permissions

- Priorité : P0
- Owner : Frontend
- Reviewer : Backend/Data
- Dépendances : V4.1-103, V4.1-104, V4.1-203, V4.1-301
- Source : routes admin et matrice d'accès V4.1-006
- Statut : **terminé** — implémentation `6c0bdde2`, revue indépendante
  `REVIEW_PASS` puis intégration sur la branche V4.1 au commit `4acfc10a` ;
  contrôle de rôle fail-closed, erreurs récupérables, confirmations explicites
  et pagination bornée sont couverts sans modification des autorisations serveur
- Critères d'acceptation :
  - accès, comptes, contacts, crédits et gestion pédagogique admin migrent ;
  - rôle admin, accès interdit et erreurs serveur restent stricts ;
  - aucune action destructive ne devient implicite ou sans confirmation ;
  - tables, formulaires, clavier, zoom et grands volumes sont testés.

## Lot 400 — décomposition technique

### V4.1-401 — API/services decomposition

- Priorité : P1
- Owner : Backend/Data
- Reviewer : Architecture/Produit
- Dépendances : V4.1-301, V4.1-302, V4.1-303, V4.1-304, V4.1-305
- Source : audit V4.1-002 ; contrats prouvés par les lots 300
- Statut : **terminé** — sous-lots Backend/Data livrés et revus sur la branche
  V4.1 :
  Today et Notes (`c6c81317`), reprises module/programme (`98ce5383`), Quiz
  (`cd80b7ef`), évaluations de notion (`d54375f1`) et programmes
  (`b5bc73b1`). Les reprises de revue déplacent l'orchestration Notes dans son
  service (`181fcb2f`), séparent les services de reprise module/programme de la
  persistance (`b2ecf18d`) et découpent les repositories Today et évaluations
  de notion au-delà de 80 lignes (`37a52e94`). Les routeurs Notes et Quiz sont
  isolés (`22e3e4f0`) et leurs repositories Prisma sont à leur tour découpés
  en opérations de moins de 80 lignes (`d5844372`). Les routeurs exposent
  désormais des frontières validation/service/repository sans changer les
  contrats. Les contacts publics sont séparés en configuration, tokens,
  fournisseur e-mail, repository et service (`78a2283b`) ; leur conversion en
  demande d'accès est sérialisée et couverte contre la concurrence
  (`cd20d7bf`), puis les handlers HTTP sont isolés (`6320409e`). L'annuaire de
  programmes est découpé sans changer recherche, curseurs ni isolation par
  utilisateur (`e4e369d0`).
  Correction, pricing et ledger restent exclus et réservés à V4.1-402.
  Preuves du checkpoint : lint, typecheck, tests ciblés des domaines concernés,
  suite complète 1 016/1 016 et build/PWA verts. Une exécution lancée en parallèle du build a
  observé un flake `LessonPage` (bouton encore dans son état de chargement) ; le
  test isolé a ensuite réussi, puis la suite stable complète a confirmé
  1 016/1 016 tests verts. La revue indépendante du checkpoint est `REVIEW_PASS`
  sans P0/P1. Le sous-lot Admin suivant est `REVIEW_PASS` sans P0/P1 : revue des
  demandes d'accès et publication sont séparées en query/repository/service
  (`325ae9b9`), puis le contrôleur `admin/app.ts` passe de 904 à 49 lignes et
  délègue à des routeurs par domaine, une couche de validation commune, des
  dépendances paresseuses et un service d'édition pédagogique
  (`e18167f4`, nettoyage final `047eb4d2`). Les URLs, payloads, capacités,
  erreurs et transactions restent
  couverts par les 47 tests Admin ciblés. Le sous-lot Progress est également
  `REVIEW_PASS` sans P0/P1/P2 : ses frontières validation/service/repository et
  son unité de travail sont explicites (`db09333e`), les recalculs leçon,
  étape et programme sont séparés (`4be9195c`), et leurs contrats sont figés
  par les tests de transaction et de hiérarchie (`4efe022a`). La mutation et
  le recalcul complet restent dans une transaction `Serializable` unique,
  avec trois reprises `P2034` au maximum. Les carryovers du module run courant,
  l'agrégation multi-modules et l'atomicité sont couverts sans changer URLs,
  payloads, auth ou erreurs. Preuves : lint et typecheck verts,
  contrôle d'imports avec 0 cycle et 0 frontière interdite, suite complète
  1 034/1 034 après intégration, build et génération PWA verts. Le sous-lot
  `stage-assessments` est `REVIEW_PASS` sans P0/P1 : le contrôleur de 612
  lignes est remplacé par une composition de 75 lignes et des frontières
  validation, routes, service, sérialisation et repository explicites. Les
  transitions DRAFT/SUBMITTED/NEEDS_REVISION/VALIDATED, le seuil de réussite,
  les prédicats d'accès et d'ownership, l'écriture atomique de revue et son
  audit sont couverts par 18 tests ciblés. Lint, typecheck, suite complète
  168 fichiers / 1 041 tests et build/PWA sont verts. Les doubles Prisma
  prouvent les branches et paramètres transactionnels sans prétendre valider
  une base réelle ; le gate V4.1-502 doit encore exécuter les scénarios de
  concurrence propres aux évaluations d'étape contre la base d'intégration
  éphémère. Le sous-lot `exercises` est également `REVIEW_PASS` : les
  frontières validation/service/repository et l'unité de travail sont
  explicites (`6f53a64f`), puis un test PostgreSQL réel sur branche Neon
  éphémère prouve la convergence de deux créations concurrentes et le rollback
  intégral d'un recalcul forcé en échec (`77040cbe`). Après intégration finale
  de `stage-assessments` (`bb5524b2`), lint, typecheck, 169 fichiers / 1 046
  tests, build/PWA, contrôle des imports (0 Preact, 0 cycle, 0 frontière
  interdite), budgets initiaux et contrat Airtable sont verts. Le dépassement
  du budget JS total reste un diagnostic non bloquant suivi par V4.1-502 ; les
  budgets du chargement initial et du plus gros chunk paresseux sont respectés.
  Correction, pricing et ledger n'ont pas été modifiés et sont réservés à
  V4.1-402.
- Critères d'acceptation :
  - handlers, validation, services et repositories ont des frontières explicites ;
  - réponses, erreurs, auth, transactions et observabilité restent compatibles ;
  - fonctions et fichiers monolithiques sont scindés par responsabilité ;
  - tests de contrat prouvent zéro mutation métier silencieuse.

### V4.1-402 — Correction/pricing/ledger decomposition

- Priorité : P0
- Owner : Backend/Data
- Reviewer : IA/Recherche
- Dépendances : V4.1-303, V4.1-304, V4.1-305, V4.1-401
- Source : contrats V4 correction/pricing/ledger ; audit V4.1-002
- Statut : **terminé** — correction, pricing, persistance des devis et ledger
  sont séparés par responsabilité sans changer les contrats publics. Le P0
  détecté en revue (échec de persistance après réponse fournisseur transformé
  en faux échec facturable) a été corrigé avant intégration : il conduit
  désormais à la réconciliation et à la libération, sans finalisation ni
  règlement. Les deux revues indépendantes concluent `APPROVE`, sans P0/P1.
  Lint, typecheck, 169 fichiers / 1 048 tests et build/PWA sont verts. La preuve
  PostgreSQL réelle de concurrence, idempotence, immutabilité et rollback est
  consignée dans `docs/qa/V4_1_402_POSTGRES_EVIDENCE.md`. Tous les fichiers
  concernés restent sous 400 lignes et les tests du domaine sous 600 lignes.
  L'identité Sonnet gelée, l'absence de retry/fallback, les coûts inconnus à
  `null`, les devis, réservations, règlements, libérations et historiques sont
  inchangés. Le dernier P2 sur le typage des codes de retry a été fermé avant
  intégration (`cc8f2254`).
- Critères d'acceptation :
  - orchestration, contrats, fournisseurs, pricing et ledger sont séparés ;
  - idempotence, devis, réserve, compensation et historique restent identiques ;
  - aucun prix, modèle, fournisseur ou seuil ne change par la décomposition ;
  - tests de concurrence, échec partiel et rollback couvrent les frontières.

### V4.1-403 — Prisma multi-file zero SQL

- Priorité : P0
- Owner : Backend/Data
- Reviewer : QA/Release
- Dépendances : V4.1-401, V4.1-402
- Source : `prisma/schema.prisma`, migrations et audit V4.1-002
- Statut : **DONE** — schéma multi-file livré par `bf69865a`, preuve de parité
  par `87593d29` et clôture intégrée par `848ded02`. `prisma migrate diff` ne détecte aucune différence, le modèle
  runtime canonique reste identique (63 modèles), les hashes des 42 migrations
  sont inchangés et les 1 050 tests passent. La répétition sur clone est
  couverte par le test existant de `migration-rehearsal` ; aucune base distante
  n'a été créée ou modifiée pour cette réorganisation sans changement SQL.
- Critères d'acceptation :
  - le schéma est scindé par domaine avec une configuration Prisma supportée ;
  - le diff de modèle généré est nul et aucune migration SQL n'est produite ;
  - les 42 migrations et usages SQL runtime existants restent inchangés ;
  - generate, validate, seed, clone et répétition de migration sont prouvés.

### V4.1-404 — i18n/CSS/benchmark runner split

- Priorité : P1
- Owner : Architecture/Produit
- Reviewer : Frontend
- Dépendances : V4.1-104, V4.1-203, V4.1-303, V4.1-304, V4.1-305,
  V4.1-401, V4.1-402, V4.1-403
- Source : hotspots de l'audit V4.1-002
- Statut : **DONE** — les 1 007 clés FR/EN et leurs digests restent identiques ;
  le CSS source et compilé est identique octet par octet à la baseline ; le
  runner public, sa bibliothèque scientifique et ses tests sont séparés sans
  changer leurs exports historiques, les quatre validations hors ligne ni le
  préflight writing. La suite intégrée compte 1 065 tests verts, avec lint,
  typecheck, build/PWA, imports et budgets initiaux verts. Aucun appel réseau
  ni artefact expérimental n'a été produit. Les preuves sont consignées dans
  `docs/qa/V4_1_404_CSS_PARITY.md` et
  `docs/V4_1_404_BENCHMARK_RUNNER_SPLIT.md`.
- Dette fermée : `V4.1-404-R1` a été reprise dans `V4.1-503`. Le noyau
  d'agrégation scientifique de 1 021 lignes est séparé par responsabilité et
  des goldens de sous-agrégats conservent strictement les calculs publics.
- Critères d'acceptation :
  - catalogues i18n sont scindés sans clé perdue ni fallback silencieux ;
  - CSS est réparti par tokens/primitives/surfaces sans changer le rendu ;
  - bibliothèque et runner benchmark sont séparés sans réécrire les artefacts ;
  - checks i18n, snapshots, benchmarks validate-only et parité restent verts.

## Lot 500 — gates et release

### V4.1-501 — Coverage 80/90

- Priorité : P0
- Owner : QA/Release
- Reviewer : Architecture/Produit
- Dépendances : V4.1-104, V4.1-301, V4.1-302, V4.1-303, V4.1-304,
  V4.1-305, V4.1-401, V4.1-402, V4.1-403, V4.1-404
- Source : seuils V4.1-007 ; suites migrées et modules décomposés
- Statut : **DONE** — la mesure finale reproductible du 28 août atteint
  88,95 % statements, 80,46 % branches, 90,20 % functions et 90,11 % lines,
  sur 215 fichiers / 1 370 tests verts. Les domaines critiques atteignent
  90,59 % auth/accès, 90,30 % correction-pricing-crédits-réconciliation,
  92,23 % progression/évaluations et 93,22 % autorisations admin.
  Le gate final est désormais le job obligatoire des pull requests et pushes
  vers `dev`. Il refuse les seuils abaissés, les fichiers critiques absents,
  Preact, les cycles/imports interdits et le code mort. Le flake de
  `LessonPage.test.tsx` a été stabilisé en attendant le contrôle réellement
  asynchrone, sans changement produit. Le détail reproductible est consigné
  dans `docs/qa/V4_1_501_COVERAGE.md`.
- Critères d'acceptation :
  - la couverture globale atteint au moins 80 % selon la méthode gelée ;
  - auth, progression, correction, pricing, ledger et permissions atteignent au
    moins 90 % ;
  - les seuils sont bloquants en CI et aucun fichier critique n'est exclu ;
  - tests artificiels sans assertion métier ne comptent pas comme couverture.

### V4.1-502 — Full QA/perf/security/a11y

- Priorité : P0
- Owner : QA/Release
- Reviewer : Architecture/Produit
- Dépendances : V4.1-501
- Source : baseline V4.1-006 ; seuils V4.1-007 ; couverture V4.1-501
- Statut : **DONE** — le gate final est vert sur 215 fichiers / 1 370 tests,
  sans Preact, cycle, import interdit, code mort ni vulnérabilité de production
  haute/critique. La suite navigateur de développement compte 76 réussites,
  36 répétitions de matrices explicitement ignorées et 0 échec ; la suite
  complémentaire sur le bundle de production compte 72 réussites, 24
  répétitions ignorées et 0 échec. L'intégration sur branche Neon jetable
  `br-misty-scene-aseegwr1` compte 11 réussites, 16 cellules serveur
  volontairement non dupliquées et 0 échec ; la branche a été supprimée puis
  vérifiée absente. Les budgets JS initial, CSS, chunk lazy et précache PWA
  sont sous leurs plafonds. La preuve et les limites de recette manuelle
  transférées à V4.1-504 sont consignées dans `docs/qa/V4_1_502_QA.md`.
- Critères d'acceptation :
  - lint, typecheck, tests, e2e, build, PWA et tests d'intégration sont verts ;
  - bundle, rendu, requêtes et erreurs respectent les budgets ;
  - audit dépendances, auth, permissions, secrets et données sensibles passent ;
  - responsive, clavier, focus, contraste, zoom 200 % et reduced motion passent.

### V4.1-503 — Handoff/debt

- Priorité : P0
- Owner : Architecture/Produit
- Reviewer : Rayan
- Dépendances : V4.1-502
- Source : preuves de tous les tickets V4.1 antérieurs
- Statut : **DONE** — les cinq documents canoniques de reprise sont consolidés,
  le manifeste route les autorités actives, et `V4.1-404-R1` est fermé par un
  découpage sûr du noyau d'agrégation et des goldens de sous-agrégats sans
  modifier les verdicts scientifiques historiques.
- Critères d'acceptation :
  - migration, architecture, composants, scripts et documentation sont remis ;
  - dette résiduelle a owner, priorité, impact, dépendances et date de réexamen ;
  - aucun alias Preact, flag, composant dupliqué ou risque sans owner ne subsiste ;
  - handoff contient SHA, validations, limites, exploitation et rollback.
  - `V4.1-404-R1` est fermé après goldens scientifiques et découpage sûr, ou
    explicitement arbitré par Rayan avec une nouvelle version cible.

### V4.1-504 — Final preview/rollback/GO/release

- Priorité : P0
- Owner : QA/Release
- Reviewer : Rayan
- Dépendances : V4.1-503 et tous les tickets P0 V4.1 terminés
- Source : handoff V4.1-503 ; preuves des 26 tickets précédents
- Statut : **DONE** — publié le 29 août 2026 au SHA `63c436d9` sur GO explicite
  de Rayan ; `main` avancé de `a02ecc3f` en avance rapide. Gates distants verts,
  mise à jour PWA prouvée sur appareil réel, rollback analysé comme purement
  applicatif (jeux de migrations identiques entre V4 et V4.1) et smoke public de
  production vert. Dix cases de la recette authentifiée n'ont pas été exécutées
  et sont consignées comme telles, non comme des succès, dans
  `docs/qa/V4_1_504_RELEASE_CANDIDATE.md`. L'incompatibilité de politique entre
  l'historique linéaire exigé par `main` et les fusions de lots présentes sur
  `dev` reste ouverte.
- Critères d'acceptation :
  - preview réelle rejoue la baseline V4 et les parcours critiques ;
  - rollback code/config/PWA est répété et les données restent compatibles ;
  - React est l'unique runtime et les seuils V4.1-007/501/502 sont verts ;
  - le Propriétaire rend un GO explicite, puis la promotion et la release sont
    tracées séparément ; V4.5 reste fermée avant ce GO.

## Candidats post-V4.1 — hors gate de release

Ces tickets sont enregistrés maintenant pour rester visibles, mais ne modifient
ni les contrats ni le périmètre de la release V4.1.

### V4.5-ADM-001 — Ajustements de crédits et équivalent USD auditable

- Priorité : P1
- Owner : Backend/Data
- Reviewer : Finance + QA/Release
- Statut : **DRAFT**
- Dépendances : politique financière V4.5, taux/version de conversion et règles
  d'autorisation admin validés
- Critères d'acceptation :
  - un administrateur autorisé peut ajouter ou retirer des crédits sans solde
    négatif et avec une mutation idempotente, horodatée et auditée ;
  - le motif accepte au minimum 3 caractères et conserve une borne maximale ;
  - chaque opération affiche l'équivalent USD réel issu du contrat serveur
    versionné, jamais une reconstruction UI ni une valeur fictive ;
  - les crédits offerts, achetés, réservés et consommés restent distincts.
- Arbitrage/tradeoff : afficher l'USD apporte de la lisibilité opérationnelle,
  mais lie l'interface admin à une autorité de conversion datée qui doit exister
  avant l'implémentation.

### V5-CATALOG-001 — Thèmes et tags de programmes

- Priorité : P1
- Owner : Architecture/Produit
- Reviewer : Frontend + Gouvernance éditoriale
- Statut : **DRAFT**
- Dépendances : taxonomie canonique et règle d'authoring à valider
- Critères d'acceptation :
  - thèmes et tags sont normalisés, versionnés et utilisables par la recherche
    et les filtres sans coder en dur un domaine ;
  - synonymes, renommages et programmes sans tag ont un comportement explicite ;
  - les surfaces publiques et admin restent utilisables au clavier et sur 320 px.
- Arbitrage/tradeoff : des tags libres sont rapides mais dérivent ; une
  taxonomie gouvernée améliore la recherche au prix d'un authoring initial.

### V4.5-UX-001 — Cartes de parcours responsives

- Priorité : P2
- Owner : Frontend
- Reviewer : Design + QA/Release
- Statut : **DRAFT**
- Dépendances : contenu minimal et densité d'une carte à arbitrer par Rayan
- Critères d'acceptation :
  - Mes parcours affiche trois cartes par ligne sur grand desktop et une carte
    par ligne sur mobile, avec un reflow intermédiaire sans overflow ;
  - prochaine action, progression et statut restent lisibles sans multiplier
    les CTA ;
  - la liste DOM reste sémantique et la navigation clavier conserve un ordre
    logique ;
  - les programmes nombreux sont paginés ou virtualisés selon une mesure réelle.
- Arbitrage/tradeoff : les cartes rendent les parcours plus identifiables, mais
  consomment davantage d'espace qu'une liste et nécessitent une règle de densité.

## Définition de terminé V4.1

V4.1 est terminée uniquement après acceptation et promotion de V4.1-504. Un
commit local, une preview sans recette ou une documentation préparatoire ne
suffit pas à déclarer la release close.
