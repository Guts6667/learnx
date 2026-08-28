# V4.1-504 — candidat de release et recette propriétaire

## État

**READY_FOR_OWNER_RECIPE**, pas encore `GO` et pas encore publié sur `main`.

- baseline de rollback V4 :
  `a02ecc3f307af36656fa5cb8a7b62954fdec73e9` ;
- SHA fonctionnel du candidat : `c3e81c4b` ;
- dernier SHA documentaire de la branche candidate : `3c42e056` ;
- branche : `origin/codex/v4-1-foundation` ;
- preview de branche :
  `https://learnx-git-codex-v4-1-foundation-guts6667s-projects.vercel.app`.

Le SHA fonctionnel contient le code, les tests et les documents de handoff. Le
commit suivant consigne uniquement la synchronisation Airtable. Le domaine de
preview répond après ce dernier push ; l'interface Vercel doit encore confirmer
explicitement le SHA de déploiement avant le GO propriétaire.

## Preuves automatiques acquises

- `quality:v4.1:final` : vert ;
- 1 371 tests Vitest ;
- couverture globale : 88,97 % statements, 80,46 % branches, 90,23 % functions,
  90,16 % lines ;
- quatre domaines critiques au-dessus de 90 % lines ;
- 0 import Preact, cycle, code mort, vulnérabilité de production haute ou
  critique ;
- budgets JS, CSS, lazy chunk et précache PWA respectés ;
- 72 scénarios Playwright du bundle de production réussis ;
- 11 tests d'intégration sur branche Neon jetable réussis.

Smoke HTTP public du 28 août 2026 :

| Route | HTTP | Observation |
| --- | ---: | --- |
| `/` | 200 | shell public servi |
| `/login` | 200 | route SPA servie |
| `/request-access` | 200 | route SPA servie |
| `/research/ai-correction` | 200 | journal public servi |
| `/manifest.webmanifest` | 200 | manifeste PWA servi |
| `/sw.js` | 200 | service worker servi |

## Recette propriétaire restante

Chaque case doit recevoir une preuve ou un défaut explicite. Une case non
testée n'est jamais assimilée à un succès.

- [ ] Vercel confirme le SHA `3c42e056` pour l'URL ci-dessus.
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
- [ ] Protection de branche exigeant `Quality / V4.1 final (required)`.

## Règle de décision

- défaut P0/P1, régression métier/financière ou échec de rollback : **NO-GO** ;
- défaut P2 : owner, impact et version cible obligatoires avant arbitrage ;
- aucun défaut connu et toutes les cases prouvées : demande de **GO explicite
  de Rayan** ;
- aucun merge ou push sur `main` n'est autorisé avant ce GO.

