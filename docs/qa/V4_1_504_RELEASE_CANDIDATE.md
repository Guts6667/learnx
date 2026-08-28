# V4.1-504 — candidat de release et recette propriétaire

## État

**READY_FOR_OWNER_RECIPE**, pas encore `GO` et pas encore publié sur `main`.

- baseline de rollback V4 :
  `a02ecc3f307af36656fa5cb8a7b62954fdec73e9` ;
- SHA fonctionnel du candidat : `d7b1949e` ;
- SHA exact déployé sur la preview : `d7b1949e` ;
- branche : `origin/codex/v4-1-foundation` ;
- preview de branche :
  `https://learnx-git-codex-v4-1-foundation-guts6667s-projects.vercel.app`.

Le SHA fonctionnel contient le code, les tests et les documents de handoff.
GitHub associe le statut Vercel `success` au SHA `d7b1949e`, dont le domaine de
preview répond.

## Preuves automatiques acquises

- `quality:v4.1:final` : vert ;
- 1 374 tests Vitest ;
- couverture globale : 88,96 % statements, 80,43 % branches, 90,21 % functions,
  90,15 % lines ;
- quatre domaines critiques au-dessus de 90 % lines ;
- 0 import Preact, cycle, code mort, vulnérabilité de production haute ou
  critique ;
- budgets JS, CSS, lazy chunk et précache PWA respectés ;
- 72 scénarios Playwright du bundle de production réussis ;
- 11 tests d'intégration sur branche Neon jetable réussis.

Reproduction distante sur le SHA final `d7b1949e` :

- workflow `Quality`, job bloquant `V4.1 final (required)` : succès ;
- workflow `Integration`, job `real-functions` : succès ;
- snapshot avant/après migrations, rejeu complet dans un schéma isolé, tests
  Functions/navigateur et seeds ciblés : succès ;
- déploiements Vercel `Preview` : succès pour `dev` et la branche candidate.

Le répétiteur de migrations distingue désormais un ancien essai explicitement
annulé d'une migration réellement incomplète. Le cas de production observé
(essai annulé puis répétition appliquée) est couvert par un test de régression ;
une tentative non résolue ou deux checksums appliqués incompatibles restent
bloquants.

Smoke HTTP public du 28 août 2026 :

| Route | HTTP | Observation |
| --- | ---: | --- |
| `/` | 200 | shell public servi |
| `/login` | 200 | route SPA servie |
| `/request-access` | 200 | route SPA servie |
| `/research/ai-correction` | 200 | journal public servi |
| `/manifest.webmanifest` | 200 | manifeste PWA servi |
| `/sw.js` | 200 | service worker servi |

Contrôles complémentaires du 28 août 2026 :

- les quatre surfaces publiques `/`, `/login`, `/request-access` et
  `/research/ai-correction/en.html` ne présentent aucun débordement horizontal
  mesuré à 390, 720, 1 440 et 1 920 px dans le navigateur intégré ;
- la V4 de rollback `a02ecc3f…` a été reconstruite dans un worktree détaché
  après `pnpm prisma:generate` ; son build de production et les six smokes HTTP
  ci-dessus sont verts ; le worktree a ensuite été supprimé et la preview du
  candidat est restée active ;
- ce contrôle prouve la reconstructibilité locale du rollback, mais ne remplace
  pas un basculement Vercel réel suivi d'une restauration.

Passe de finition UI du 28 août 2026 :

- le rapport anglais pointe désormais vers la page française réellement
  déployable, avec un test de routage dédié ;
- les sections Produit et Roadmap de la landing ont été clarifiées sans ajouter
  de promesse produit non livrée ;
- comptes, demandes d'accès et contacts utilisent une liste verticale adaptée à
  la croissance plutôt qu'une grille de cartes ;
- les contenus de leçon partagent une surface blanche, espacée et réutilisable,
  et les actions de ressource ont une hiérarchie visuelle distincte ;
- listes de navigation et de programmes occupent toute la largeur disponible ;
- vérifications locales : 1 371 tests, lint, typecheck et build verts ; bundle
  initial à 109,32 kB JS gzip et 19,08 kB CSS gzip, sous les budgets V4.1 ;
- contrôle visuel local à 390 px et desktop sans débordement horizontal. Cette
  preuve ne remplace pas la recette authentifiée du propriétaire sur la preview.

Correctifs issus de la recette propriétaire du 28 août 2026 :

- les listes « Mes parcours » et « Notes » ne conservent plus de plafond de
  largeur interne sur desktop et utilisent toute la largeur de travail ;
- les comptes administrés sont présentés en lignes nettement séparées, avec
  identité et statut d'un côté, actions regroupées de l'autre, puis reflow en
  une colonne sous 896 px ;
- le motif d'une demande ou d'un ajustement de crédits accepte désormais trois
  caractères minimum dans un contrat partagé entre UI, API et ledger ;
- vérifications : lint, typecheck, build, 1 371 tests complets et 58 tests
  ciblés verts.

## Recette propriétaire restante

Chaque case doit recevoir une preuve ou un défaut explicite. Une case non
testée n'est jamais assimilée à un succès.

- [x] Vercel confirme le SHA `d7b1949e` pour l'URL ci-dessus.
- [ ] Demande d'accès, activation, connexion et déconnexion.
- [ ] Refus d'accès utilisateur et permissions administrateur.
- [ ] Aujourd'hui → programme → étape → module → leçon.
- [ ] Notes, révisions et progression.
- [ ] Exercice textuel : devis, confirmation, correction complète et partielle.
- [ ] Historique, contestation et comparaison des corrections.
- [ ] Réservation, règlement, libération et coût inconnu fail-close.
- [ ] Crédits utilisateur et administration.
- [ ] Installation PWA, fonctionnement hors ligne et prise en compte d'une mise
  à jour.
- [ ] 320, 390, 720, 1440 et 1920 px ; zoom 200 % ; clavier ; lecteur d'écran.
- [ ] Rollback de preview vers `a02ecc3f…`, smoke, puis restauration du candidat.
- [x] Protection de `main` stricte et appliquée aux administrateurs, exigeant
  `V4.1 final (required)`, historique linéaire et résolution des conversations.

## Règle de décision

- défaut P0/P1, régression métier/financière ou échec de rollback : **NO-GO** ;
- défaut P2 : owner, impact et version cible obligatoires avant arbitrage ;
- aucun défaut connu et toutes les cases prouvées : demande de **GO explicite
  de Rayan** ;
- aucun merge ou push sur `main` n'est autorisé avant ce GO.
