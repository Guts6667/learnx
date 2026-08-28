# Baseline de parité fonctionnelle V4.1

## Autorité et portée

Ce document est la matrice canonique de V4.1-006. Il décrit les comportements
à préserver pendant la refondation React/shadcn et distingue explicitement une
preuve exécutée d'une preuve seulement disponible ou absente.

- baseline produit à préserver :
  `a02ecc3f307af36656fa5cb8a7b62954fdec73e9` (release V4) ;
- première preuve exécutable après migration du runtime :
  `bdc82e354b8f7bb58b2aa48a3e8b8bc8c0e5c81d` ;
- date de capture : 26 août 2026, Europe/Paris ;
- aucun appel modèle, fournisseur ou service externe n'a été réalisé ;
- aucune base réelle n'a été modifiée.

Le SHA `a02ecc3f` porte l'autorité fonctionnelle et contractuelle. Le SHA
`bdc82e35` porte seulement la première exécution reproductible des suites après
migration React ; il ne remplace pas la release comme baseline. Le verrou
historique de `a02ecc3f` ne permet plus un `pnpm install --frozen-lockfile`
exact, car son bloc `pnpm.overrides` et son lockfile divergent. Cette limite est
consignée au lieu de présenter une exécution post-migration comme une exécution
de la release.

La parité est donc bilatérale : les URL et contrats de V4 sont extraits du SHA
release, puis contrôlés sur le candidat ; les suites du candidat vérifient les
comportements. Une preuve avec API simulée ne prouve pas l'intégration au
déploiement réel.

## Légende de preuve

| Code | Signification |
| --- | --- |
| `UNIT` | Test Vitest de composant, service, contrat ou contrôleur, exécuté localement |
| `E2E-MOCK` | Parcours Playwright exécuté dans un navigateur avec API interceptée/simulée |
| `BUILD` | Production build/PWA généré localement |
| `INTEGRATION` | Test sur API et base jetable réelles ; aucune preuve de ce type n'a été exécutée dans cette capture |
| `GAP` | Preuve absente ou insuffisante ; elle doit rester visible jusqu'à sa clôture |

## Reproduction

### Préparation locale

```bash
pnpm install --offline --frozen-lockfile
pnpm prisma:generate
```

`prisma:generate` est obligatoire avant le typecheck. Sans cette étape, le
typecheck échoue parce que le client généré n'existe pas ; ce n'est pas un
défaut fonctionnel de l'application.

Ces commandes reproduisent le candidat migré. Elles ne prétendent pas
reproduire `a02ecc3f` avec une résolution de dépendances différente.

### Contrôle bilatéral des routes

Le manifeste `quality/v4-1-functional-parity.json` contient les 33 routes
applicatives extraites de `a02ecc3f`. Le test
`src/lib/v4-1-functional-parity.test.ts` relit le routeur directement depuis
ce SHA Git et exige une égalité bilatérale exacte entre la release et le
manifeste. Il exige ensuite que le candidat contienne exactement ces mêmes
routes, avec pour seul ajout autorisé la route explicite `*`, équivalente au
fallback `default` du routeur V4. Une suppression ou un ajout simultané dans
le manifeste et le candidat ne peut donc pas masquer une dérive de la release.

```bash
pnpm vitest run src/lib/v4-1-functional-parity.test.ts
```

Le montage serveur (`src/server/api/app.ts`), les contrôleurs métier, le schéma
Prisma et les migrations n'ont aucun diff entre `a02ecc3f` et cette première
capture. Les futures décompositions peuvent déplacer du code, mais ne peuvent
modifier ces contrats pour faciliter la migration UI.

### Gates exécutés

```bash
env -u NODE_OPTIONS zsh -f -c \
  'pnpm lint && pnpm typecheck && pnpm test && pnpm build'
pnpm test:coverage:baseline
pnpm test:e2e
```

Résultats observés :

| Gate | Résultat |
| --- | --- |
| lint | vert |
| typecheck | vert après `pnpm prisma:generate` |
| Vitest | 150 fichiers, 950 tests réussis |
| build | vert ; PWA générée, 128 entrées de précache |
| Playwright | 75 réussis, 33 ignorés, 0 échec sur 108 cellules configurées |
| couverture statements | 75,60 % (7 824 / 10 348) |
| couverture branches | 66,84 % (5 112 / 7 647) |
| couverture functions | 77,35 % (2 012 / 2 601) |
| couverture lines | 76,83 % (7 504 / 9 766) |

Les 33 cellules Playwright ignorées sont notamment liées à des tests exécutés
une seule fois avec des viewports déterministes. Elles ne doivent pas être
comptées comme des parcours validés. Le rapport Playwright reste la source du
détail par projet.

### Intégration réelle non exécutée

La suite suivante existe mais n'a pas été lancée, faute de branche Neon
jetable explicitement fournie :

```bash
pnpm exec playwright test --config playwright.integration.config.ts
```

Elle exige au minimum `DATABASE_URL`, `DIRECT_URL`,
`LEARNX_INTEGRATION_DATABASE`, `LEARNX_INTEGRATION_RUN_ID` et
`NEON_BRANCH_ID`. Elle ne doit jamais viser une base partagée ou la production.

## Matrice des parcours utilisateur

| Domaine | Résultat à préserver | Routes principales | Preuve exécutée | Statut et trou restant |
| --- | --- | --- | --- | --- |
| Public | Landing bilingue, journal Recherche partageable, 404, aucune donnée privée | `/`, `/interest`, `/research/*`, `*` | `UNIT` `src/app/App.test.tsx` ; `E2E-MOCK` `landing.spec.ts`, `research-journal.spec.ts`, `research-public.spec.ts` | Prouvé localement et en navigateur simulé ; déploiement public réel non rejoué |
| Demande d'accès | Soumission, états de validation/erreur et retour de suivi | `/request-access`, `/verify-email` | `UNIT` `src/app/App.test.tsx` ; `E2E-MOCK` `home.spec.ts` | Prouvé avec API simulée ; e-mail et API réels non exercés |
| Activation et auth | Activation, connexion, session restaurée, déconnexion, redirection de route privée et reprise hors ligne | `/activate`, `/login`, routes protégées | `UNIT` `src/app/App.test.tsx`, tests `features/auth` et `server/api/auth` ; `E2E-MOCK` `home.spec.ts` | Auth locale fortement couverte ; cycle réel multi-utilisateur disponible dans `tests/integration/access-lifecycle.spec.ts` mais non exécuté |
| Aujourd'hui | Prochaine action, contexte, progression, plusieurs programmes et état vide | `/today` | `UNIT` `TodayPage.test.tsx` ; `E2E-MOCK` `home.spec.ts` | Prouvé avec fixtures ; données réelles non rejouées |
| Programmes et hiérarchie | Répertoire, découverte, inscription/reprise, Program > Stage > Module > Lesson, routes parentes et verrous | `/program`, `/discover`, `/program/:programSlug`, routes stage/module | `UNIT` `ProgramsDirectoryPages.test.tsx`, `CurriculumPages.test.tsx` et tests de queries/pages ; `E2E-MOCK` `home.spec.ts` | Prouvé avec fixtures ; réconciliation réelle progression/catalogue non rejouée |
| Leçons et contenus | Ressources, progression, activité suivante, contenu verrouillé, hors-ligne et tâches | `/program/:programSlug/lesson/:lessonSlug/*` | `UNIT` `src/pages/LessonPage.test.tsx` ; `E2E-MOCK` chemin critique de `home.spec.ts` | Prouvé avec fixtures ; lecture/écriture réelles non rejouées |
| Activités | Exercices, quiz, évaluations de notion et d'étape, limite de saisie et navigation pédagogique | `/exercise/:exerciseId`, `/quiz`, `/.../assessment` | `UNIT` tests `features/exercises`, quiz, concept/stage assessments et `ExerciseCard` | Couverture composant/serveur disponible ; pas de parcours navigateur complet sur les quatre familles avec backend réel |
| Notes | Liste, recherche, création, édition, autosave, contexte, clavier et suppression confirmée | `/notes`, `/notes/:noteId` | `UNIT` `src/pages/NotesPage.test.tsx` ; `E2E-MOCK` `home.spec.ts` | Prouvé avec API simulée ; persistance réelle non rejouée |
| Révisions | Liste, ressources associées, marquage terminé et état vide | `/reviews` | `UNIT` `src/pages/ReviewsPage.test.tsx` | Pas de parcours Playwright dédié de bout en bout ; API réelle non rejouée (`GAP`) |
| Profil | Langue d'interface, identité/session et accès aux crédits | `/profile` | `UNIT` `src/app/App.test.tsx` et tests i18n/session | Aucun test dédié de la page entière ni parcours Playwright dédié (`GAP`) |
| Crédits utilisateur | Origines offertes/achetées distinctes, total secondaire, réservations et surface de demande | `/credits` | `UNIT` `credits-surfaces.test.ts` et tests serveur du ledger | Pas de test dédié `CreditsPage` ni parcours navigateur avec ledger réel (`GAP`) |
| Administration | Garde admin, comptes, demandes d'accès, contacts, crédits et hiérarchie programme | `/admin/*` | `UNIT` tests pages/API admin ; `E2E-MOCK` `admin.spec.ts`, `admin-contacts.spec.ts` | Navigation/états prouvés avec mocks ; permissions/persistance réelles non rejouées |

## Matrice des autorités serveur

| Domaine | Invariants gelés | Preuve exécutée | Couverture lines observée | Trou explicite |
| --- | --- | --- | --- | --- |
| Correction | devis accepté avant appel, intention persistée avant dispatch, résultat complet/partiel/indisponible, score serveur, idempotence, coût inconnu réconciliable | `UNIT` `correction-orchestration.test.ts`, `persistent-correction.test.ts`, `server/api/corrections/app.test.ts`, `AiCorrectionPanel.test.tsx` | API corrections 70,58 % ; orchestration corrections 79,03 % | Pas d'appel fournisseur ni de correction réelle ; aucun E2E navigateur complet |
| Pricing | somme des appels du workflow, plafond utilisateur, retries absorbés, échec inutilisable libéré, coût/P90 et marge fail-close, quote immuable | `UNIT` `server/pricing/ai-pricing.test.ts` et tests API pricing | pricing global 56,84 % ; `ai-pricing.ts` 83,83 % | Adaptateur Prisma pricing non couvert ; intégration DB non exécutée |
| Ledger/crédits | lots et origines immuables, priorité, expiration, réserve, règlement/libération, plafond, idempotence et conservation | `UNIT` `server/credits/credit-ledger.test.ts` et tests API crédits | ledger pur 98,27 % ; adaptateur Prisma 5,82 % ; API crédits 47,50 % | Atomicité DB réelle seulement décrite par `tests/integration/credit-ledger.spec.ts`, non exécutée |
| Progression/évaluations | calcul côté serveur, validations d'étape, recalcul, tentatives et absence d'effet implicite d'une ressource | `UNIT` `lib/progress.test.ts`, tests API progression, stage validation et recalcul | API progression 97,75 % ; recalcul 88,76 % ; API stage assessment 68,65 % | Parcours cumulatif réel avec DB non exécuté |
| Permissions | session et rôle, capacités admin, périmètre programme, refus d'un utilisateur ordinaire | `UNIT` `capabilities.test.ts`, `program-access-policy.test.ts`, App/auth et API crédits/admin | auth client 91,30 % ; API auth 93,33 % | Matrice multi-utilisateur réelle disponible dans `tests/integration/backend.spec.ts`, non exécutée |

## Contrat visible de correction assistée à préserver

Ces comportements font partie de V4 et ne peuvent pas être réduits à la seule
réussite d'un appel de correction. Ils sont couverts par
`src/features/exercises/AiCorrectionPanel.test.tsx` et par les tests serveur
cités ci-dessus.

| Comportement V4 | Preuve candidate | Gate de parité |
| --- | --- | --- |
| devis préalable avec estimation, plafond réservé et seconde passe incluse | test « consentement explicite » vérifiant explicitement 12 crédits estimés, 18 réservés et la vérification incluse | aucun `POST /api/ai-corrections` avant confirmation |
| avertissement et consentement à la livraison partielle sans compensation | test « consentement explicite » | le consentement reste explicite et antérieur au débit |
| résultat partiel : critères fiables livrés, critères incertains à retravailler, aucun score exact | test « consentement explicite » | aucune incertitude présentée comme certitude |
| règlement : réservé, débité et libéré visibles | test « consentement explicite » | les montants proviennent du contrat serveur |
| retry réseau borné sans nouveau devis ni double facturation | test « relancer la même exécution » | l'idempotence et le devis accepté sont conservés |
| restauration d'une correction réglée et historique immuable | tests « restaure » et « deux corrections » | aucune nouvelle réservation pour une lecture |
| comparaison critérielle de plusieurs corrections | test « deux corrections » | comparaison de niveaux, pas de réécriture du passé |
| contestation argumentée et réexamen distinct | test « argument borné » aux frontières 19/20 et 500/501 | argument trimé de 20 à 500 caractères, nouveau devis, un seul réexamen |

## Matrice appareil, accessibilité et résilience

| Axe | Preuve exécutée | Statut et limite |
| --- | --- | --- |
| Largeurs 320/390/720/1440/1920 | `E2E-MOCK` `ui-primitives.spec.ts` vérifie les primitives et previews Totem, le reflow et l'absence d'overflow | Prouvé pour les surfaces de référence seulement, pas chaque route métier |
| Desktop, tablette, mobile Chromium et mobile WebKit | projets Playwright Desktop Chrome, Pixel 5, tablette 768 et iPhone 13 | 75 cellules réussies ; les 33 ignorées ne sont pas une preuve |
| Texte/zoom 200 % | `ui-primitives.spec.ts` et `home.spec.ts` appliquent `font-size: 200%`, contrôlent overflow et lisibilité | Équivalence de reflow textuel prouvée ; zoom navigateur natif manuel non effectué |
| Clavier et focus | focus visible des primitives, focus restauré après dialogue, `#main-content` après navigation | Prouvé sur parcours ciblés ; audit exhaustif de chaque contrôle absent |
| Reduced motion | `emulateMedia({ reducedMotion: 'reduce' })` et durée d'animation contrôlée | Prouvé sur Today et previews Totem ; pas chaque route |
| Contraste/a11y automatisée | Axe interdit les violations serious/critical WCAG 2 A/AA/2.1 A/AA sur les parcours ciblés | Aucun audit manuel lecteur d'écran ; les violations mineures/modérées ne sont pas bloquées par ce helper |
| PWA | tests composants install/offline/update, parcours hors-ligne, `BUILD` avec manifest/service worker et 128 entrées précache | Installation sur appareil et rollback production non exécutés (`GAP`) |
| Chargement/vide/erreur/retry | tests unitaires et Playwright couvrent plusieurs états publics, Today, admin contacts, auth et offline | Pas de matrice d'erreur réelle pour toutes les routes ni panne réseau réelle contrôlée |

## Fixtures et frontières de l'environnement

- Vitest utilise jsdom et des doubles typés pour réseau, repositories, session,
  temps et fournisseurs selon le domaine.
- Playwright local intercepte les routes API via les helpers de `tests/e2e` ;
  il vérifie le navigateur, pas Neon ni les Functions déployées.
- Les tests d'intégration sont séquentiels et conçus pour une branche Neon
  jetable ; ils ne sont pas implicitement sûrs sans les variables attendues.
- Aucun secret, coût fournisseur ou donnée utilisateur réelle n'est requis par
  cette baseline.

## Écarts ouverts à reprendre dans V4.1-007 et la QA finale

1. Exécuter la suite d'intégration sur une branche Neon jetable et conserver
   son identifiant, le SHA et le rapport.
2. Ajouter des parcours navigateur authentifiés pour correction/pricing/ledger,
   crédits, révisions et profil ; les preuves de composants ne suffisent pas à
   démontrer leur assemblage.
3. Faire une recette PWA installée, offline/update et rollback sur une preview
   représentative.
4. Réaliser une passe manuelle clavier/lecteur d'écran et le zoom navigateur
   natif, en complément des contrôles automatisés.
5. Classifier les 33 cellules Playwright ignorées avant de fixer un gate de
   non-régression ; aucune cellule nécessaire ne doit être silencieusement
   exclue.
6. Corriger les avertissements React des previews Totem concernant des champs
   contrôlés avec `value` sans `onChange`/`readOnly`.
7. La couverture globale reste sous les objectifs V4.1 (80 % sur les quatre
   métriques), et les adaptateurs Prisma pricing/ledger ainsi que les APIs
   crédits/corrections sont les trous critiques les plus visibles.

## Verdict V4.1-006

**Promu comme baseline de parité, pas comme gate de release.** Une revue
indépendante a accepté la matrice et les preuves ciblées : égalité exacte des
routes V4, contrat visible de correction et bornes serveur/interface de la
contestation. L'intégration réelle, plusieurs parcours navigateur critiques et
les preuves manuelles PWA/accessibilité restent explicitement ouverts pour
V4.1-501/502 ; ils ne doivent pas être présentés comme acquis pendant la
migration.
