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
routeur, hooks/imports, Testing Library et provider de requêtes. Le manifeste
reproductible de V4.1-007 compte 113 fichiers TypeScript important Preact ou un
sous-chemin Preact dans son périmètre global. Parmi eux, 112 se trouvent sous
`src`, `tests` ou `scripts`, selon la recherche Git appliquée au commit de
baseline. Ces nombres décrivent le couplage initial ; ils ne constituent pas un
objectif de réécriture automatique.

### État courant après les lots de fondation

Cet encadré décrit le HEAD React au `13f31bb4` et ne réécrit pas le snapshot V4
ci-dessus : React 19, React Router et React Query sont actifs, aucun import
Preact ne subsiste, 34 déclarations `Route` incluant le wildcard 404 couvrent
les 33 routes déclarées de la baseline et les 19 montages API sont conservés. Les
mesures de migration et leurs gates vivent dans `docs/V4_1_QUALITY_GATES.md` ;
elles ne doivent pas être confondues avec les constats historiques de cet
audit.

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

### Résolution V4.1-007 après l'audit

Le lot qualité a ensuite déplacé les résolutions `nanoid` et `deepmerge-ts`
dans `pnpm-workspace.yaml`, qui est la configuration effectivement lue. Les
installations gelées ont été rejouées avec pnpm 10.28.1 et 11.19.0. La
résolution bornée `deepmerge-ts@<8.0.0 -> 8.0.0` supprime l'avis applicable ;
`pnpm audit --prod --audit-level high` ne remonte plus de vulnérabilité haute ou
critique. Cette résolution reste couverte par la CI et ne vaut pas autorisation
de mise à jour globale des dépendances.

## Bundle et budgets

La configuration Vite ne déclare ni budget de taille, ni gate de chunks. Aucun
bundle `dist` versionné n'est disponible dans le worktree, et l'audit n'a pas
installé de dépendances pour en fabriquer un. La mesure de référence et les
seuils bloquants appartiennent à V4.1-007.

Le lot V4.1-007 ajoute ensuite une mesure reproductible et sépare l'entrée
initiale bloquante des chunks différés diagnostiques. Les budgets gelés restent
ceux du plan propriétaire : 125 kB JS gzip et 25 kB CSS gzip pour l'entrée
initiale. Le gate final reste volontairement rouge tant que Preact subsiste ou
que les quatre métriques globales de couverture restent sous 80 %.

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

Le dépôt compte 310 fichiers TypeScript, TSX ou CSS sous `src` dans la baseline
auditée (316 fichiers suivis sous `src` tous formats confondus). Les principaux
hotspots par taille sont :

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
2. Conserver l'override borné et l'audit strict introduits par V4.1-007.
3. Mesurer le bundle initial à chaque lot et rapporter séparément les chunks
   différés.
4. Utiliser les 33 routes client et 19 montages API pour construire V4.1-006.
5. Décomposer les hotspots uniquement dans les tickets 401 à 404 correspondants.
6. Conserver migrations, SQL runtime, contrats correction et ledger tant qu'une
   preuve de parité n'autorise pas leur évolution.
