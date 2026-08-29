# Tests et release LearnX V4.1

## Stratégie

| Niveau | Objet | Outil |
| --- | --- | --- |
| Unitaire | règles, composants et contrats | Vitest + Testing Library React |
| Intégration | transactions, repositories, permissions et concurrence | Playwright/runner sur branche Neon jetable |
| E2E développement | routes, responsive, accessibilité et catalogues internes | Playwright multi-projets |
| E2E production | bundle livré, sans routes de design | Playwright production config |
| Références visuelles | dérive visuelle d'un changement de design system | Playwright `toHaveScreenshot`, pré-vol local |
| Statique | types, lint, imports, cycles et code mort | TypeScript, ESLint, contrôle imports, knip |
| Supply chain | vulnérabilités de production | `pnpm audit --prod` |

## Gates reproductibles

```bash
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage:v4.1
pnpm quality:coverage:critical
pnpm quality:dead-code
pnpm build
pnpm quality:bundle
pnpm quality:security
pnpm test:e2e:production
```

La chaîne consolidée est `pnpm quality:v4.1:final`. Elle exige 80 % sur les
quatre métriques globales et 90 % lines sur auth/accès,
correction/pricing/crédits/réconciliation, progression/évaluations et
autorisations admin.

## Références visuelles

`pnpm test:visual` compare 30 captures — landing, connexion, demande d'accès, 404,
Aujourd'hui, Mes parcours, Découvrir, programme, leçon et notes — à 390, 768 et
1440 px. Les surfaces authentifiées réutilisent le mock déterministe
`tests/e2e/journey-api.ts`, donc les pixels ne dépendent d'aucune base.

C'est un **pré-vol local, pas un gate CI** : les captures dépendent de la
plateforme et les références versionnées sont produites sur macOS. Les rendre
bloquantes en CI exige de générer des références Linux avec
`--update-snapshots` sur un runner Linux, puis de les committer.

Usage pendant un travail de design :

```bash
pnpm test:visual              # avant le changement : doit être vert
# … modifier tokens, typographie ou palette …
pnpm test:visual              # lire chaque écart et l'accepter délibérément
pnpm test:visual:update       # seulement après revue des écarts
```

La tolérance est calibrée : `threshold: 0.01` par pixel et un ratio de
`0.0005`. Elle a été vérifiée dans les deux sens — un simple changement d'accent
de marque (`#3b5bd6` → `#4F52D9`) fait échouer les 10 captures d'un projet, et
une exécution sans changement reste verte. Une tolérance plus permissive
masquait exactement ce changement.

## Environnements

- Vitest : jsdom et doubles typés ; aucun service payant.
- E2E local : API interceptée pour vérifier le navigateur.
- Intégration : branche Neon copy-on-write jetable, protégée par identifiants
  d'environnement ; suppression vérifiée après le run.
- Preview finale : configuration proche production, données de recette et
  secrets externes ; aucune donnée utilisateur réelle dans les fixtures.

## Pipeline CI et release

```mermaid
flowchart LR
  P["Push branche"] --> S["Lint + types + imports"]
  S --> U["Tests + couverture"]
  U --> B["Build + bundle + PWA"]
  B --> V["Sécurité + code mort"]
  V --> E["Preview + E2E production"]
  E --> M["Recette manuelle V4.1-504"]
  M --> G{"GO Rayan ?"}
  G -->|oui| R["Release unique V4.1"]
  G -->|non| K["V4 reste en production"]
  R --> X["Smoke puis surveillance"]
  X -->|incident| Z["Rollback a02ecc3f"]
```

Le contexte externe `Quality / V4.1 final (required)` doit être rendu
obligatoire sur `dev` avant le GO. Le dépôt prouve le job, pas le réglage de
protection de branche.

## Recette obligatoire V4.1-504

1. Déployer le SHA candidat exact en preview et le consigner.
2. Rejouer demande d'accès, activation, connexion/déconnexion et permissions.
3. Parcourir Today → programme → étape → module → leçon, notes et révisions.
4. Rejouer exercice, devis, confirmation, résultat complet/partiel,
   contestation, historique et comparaison.
5. Vérifier réservation, règlement, libération et coût inconnu fail-close.
6. Contrôler crédits utilisateur et administration.
7. Installer la PWA sur appareil, tester offline/update.
8. Contrôler 320/390/720/1440/1920, zoom navigateur 200 %, clavier et lecteur
   d'écran ; aucune couleur comme seul signal.
9. Répéter un rollback vers `a02ecc3f…`, puis restaurer la preview candidate.
10. Enregistrer preuves, divergences et décision propriétaire.

## Budgets

- JavaScript initial ≤ 125 kB gzip ;
- CSS initial ≤ 25 kB gzip ;
- plus gros chunk lazy et précache sous les seuils versionnés du script bundle ;
- 0 vulnérabilité haute/critique ;
- 0 dette P0/P1 ; chaque P2 a owner, impact et cible.

## Rollback

V4.1 ne requiert pas de migration de données pour React/shadcn ou le découpage
Prisma. Le rollback applicatif redéploie la release V4
`a02ecc3f307af36656fa5cb8a7b62954fdec73e9`. Ne jamais utiliser un rollback
Git destructif sur un worktree local ; le déploiement cible un SHA immuable.

Pour la correction, suspendre les nouveaux dispatchs avant toute opération de
rollback si des tentatives restent `SENT`, `ORPHANED` ou sans coût. Réconcilier
chaque tentative avant règlement/libération définitifs.
