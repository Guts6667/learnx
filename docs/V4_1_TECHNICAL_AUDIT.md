# Audit technique V4.1 — dépendances, sécurité, bundle, routes et dette

## Statut

- Ticket : V4.1-002
- Date : 26 août 2026
- Baseline : `origin/dev` à
  `a02ecc3f307af36656fa5cb8a7b62954fdec73e9`
- Mode : lecture seule, aucune installation ou correction automatique
- Verdict : **livré pour revue, risques ouverts à traiter par V4.1-007**

Cet audit qualifie la baseline V4 released avant migration. Il ne met à jour
aucune dépendance, ne construit pas de bundle, ne supprime aucun fichier et ne
change aucun seuil.

## Dépendances et chaîne frontend

- gestionnaire déclaré : `pnpm@10.28.1` ;
- runtime UI : `preact@^10.29.8` et `preact-router@^4.1.2` ;
- intégration Vite : `@preact/preset-vite@^2.10.6` ;
- tests UI : `@testing-library/preact@^3.2.4` ;
- data fetching : `@tanstack/query-core@^5.101.4`, sans provider React Query ;
- build : Vite 8, TypeScript 6 strict, Tailwind 4 et `vite-plugin-pwa` ;
- `tsconfig.app.json` utilise `jsxImportSource: preact` et les types PWA Preact ;
- `src/main.tsx` monte l'application avec `render` de Preact.

Le passage React doit donc couvrir ensemble preset Vite, JSX/types, montage,
routeur, hooks/imports, Testing Library et provider de requêtes. L'inventaire
trouve 84 fichiers sous `src`, `tests` ou `scripts` important Preact ou un
sous-chemin Preact ; ce nombre est une baseline de recherche, pas un objectif de
réécriture automatique.

## Sécurité des dépendances

Commande exécutée :

```bash
pnpm audit --prod --audit-level high
```

Résultat : une vulnérabilité `high` sur `deepmerge-ts < 8.0.0`, transitivement
amenée par `@prisma/client > prisma > @prisma/config`, avis
`GHSA-ggr8-5vv4-36mx`. Aucune correction automatique n'a été appliquée. V4.1-007
doit décider la résolution compatible, la preuve de non-régression et la gate
qui bloque une release tant qu'un `high` applicable reste ouvert.

La commande signale aussi que le champ `pnpm.overrides` de `package.json` n'est
plus lu par cette version de pnpm. L'override déclaré pour
`nanoid@<3.3.17 -> 3.3.18` doit être déplacé vers la configuration pnpm
supportée ou remplacé par une résolution prouvée ; il ne faut pas supposer qu'il
protège actuellement l'installation.

## Bundle et budgets

La configuration Vite ne déclare ni budget de taille, ni gate de chunks. Aucun
bundle `dist` versionné n'est disponible dans le worktree, et l'audit n'a pas
installé de dépendances pour en fabriquer un. La mesure de référence et les
seuils bloquants appartiennent à V4.1-007.

La PWA utilise `autoUpdate`, un fallback de navigation, un cache runtime public
`NetworkFirst` et un script de nettoyage de cache. La migration doit mesurer au
minimum JS/CSS initial et asynchrone, polices, précache, service worker, update,
offline et récupération après rollback.

## Routes et surfaces

- `src/app/routes.tsx` centralise 33 déclarations de routes client ;
- `src/server/api/app.ts` monte 19 sous-applications API ;
- le client comprend surfaces publiques, auth, Today, programmes, leçons,
  assessments, quiz, exercices, reviews, notes, profil, crédits et admin ;
- les gardes `ProtectedRoute` et `AdminRoute`, le focus après navigation et les
  URLs existantes font partie du contrat de parité ;
- les trois routes de design Totem sont conditionnées à `import.meta.env.DEV`.

Le nombre de routes est une aide de couverture. Il ne remplace pas la matrice
fonctionnelle et les résultats attendus de V4.1-006.

## Dette structurelle mesurée

Le dépôt compte 310 fichiers sous `src`. Les principaux hotspots par taille
sont :

| Fichier | Lignes observées | Risque de migration |
| --- | ---: | --- |
| `src/styles/index.css` | 4 358 | collisions, CSS inaccessible, régression responsive |
| `src/lib/ai-correction-benchmark.test.ts` | 4 098 | harness monolithique, feedback lent |
| `src/lib/ai-correction-benchmark.ts` | 3 229 | responsabilités et contrats entremêlés |
| `src/i18n/catalogs.ts` | 2 407 | catalogue unique difficile à revoir |
| `scripts/run-ai-correction-benchmark.ts` | 2 055 | runner et orchestration couplés |
| `src/pages/CurriculumPages.tsx` | 1 617 | plusieurs surfaces de parcours dans un fichier |
| `src/pages/AdminPage.tsx` | 1 117 | surface et orchestration admin concentrées |
| `src/server/corrections/correction-orchestration.ts` | 922 | domaine sensible à décomposer sans changer le contrat |
| `src/server/credits/prisma-credit-ledger.ts` | 903 | autorité financière sensible |
| `prisma/schema.prisma` | 1 897 | schéma monolithique, 42 dossiers de migration existants |

Le scan `TODO/FIXME/HACK/XXX` n'a pas trouvé de marqueur de dette technique
explicite dans le code ; les occurrences `TODO` observées sont des valeurs de
statut métier. L'absence de marqueur ne vaut donc pas absence de dette.

Le code contient des usages Prisma SQL bruts ou tagged SQL pour contrôles de
base, verrous, rate limits, ledger et répétition de migration. V4.1-403 doit
scinder le schéma Prisma sans produire de migration SQL ni modifier ces usages
silencieusement ; leur remplacement éventuel exige un ticket et des preuves
propres.

## Couverture et gates manquantes

Vitest configure les reporters `text` et `html`, mais aucun seuil de couverture
n'est déclaré. Les objectifs 80 % global et 90 % sur modules critiques relèvent
de V4.1-501 ; V4.1-007 doit geler la méthode de mesure et les autres seuils de
sécurité et de bundle avant migration.

## Décisions de sortie d'audit

1. Ne pas lancer une mise à jour globale des dépendances.
2. Traiter l'avis `high` et la configuration d'override avant le gate V4.1-007.
3. Mesurer un bundle reproductible avant de fixer son budget.
4. Utiliser les 33 routes client et 19 montages API pour construire V4.1-006.
5. Décomposer les hotspots uniquement dans les tickets 401 à 404 correspondants.
6. Conserver migrations, SQL runtime, contrats correction et ledger tant qu'une
   preuve de parité n'autorise pas leur évolution.
