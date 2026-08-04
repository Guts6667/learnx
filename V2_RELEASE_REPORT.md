# Rapport de clôture V2 LearnX

Date de l’audit : 4 août 2026

Branches auditées : `dev` et branche locale d'intégration
`codex/v2-main-integration`, créée depuis `origin/main`.

HEAD de code audité : `b378611`
(`fix(release): close V2 security and accessibility blockers`)

Référence distante intégrée : `origin/dev = ec306e6`
(`docs(release): mark V2 candidate ready to merge`)

Commit de fusion préparé : `3d360f2b89a6ff20f831b90f531263d9a6e8b05f`
(`merge(release): prepare V2 integration into main`), local et non poussé.

Production/main observée : `origin/main = 760103d`
Écart observé : `dev` possède 40 commits propres et `main` un commit propre ;
le diff de la base commune vers `dev` couvre 213 fichiers, 70 524 insertions et
4 800 suppressions.

## Synthèse exécutive

**Verdict : GO technique pour préparer le merge `dev` vers `main`.**

La release candidate compile, passe les 289 tests unitaires/API et les 24 tests
Playwright de la matrice existante. Le schéma Prisma est valide et la CI a
appliqué les 16 migrations sur une branche Neon éphémère. Les protections de propriété,
l’atomicité de progression, la publication en cascade, le parcours centré sur
la leçon, la navigation responsive et la politique hors ligne ont des preuves
locales solides.

Les quatre bloqueurs initiaux sont levés : le workflow `Integration` #22 est
vert, axe est exécuté sur les vues critiques, le texte à 200 % et la réduction
de mouvement sont couverts, le rate limit de connexion est partagé en base et
l'inscription publique est désactivée en production. Hono a également été mis
à jour et `pnpm audit --prod` ne signale plus aucune vulnérabilité connue.

Le GO a permis de préparer le merge sans toucher à `main`. Les six conflits
réels sont résolus sur la branche d'intégration locale, puis validés par les
tests seed, la suite complète, Playwright et une exécution des Functions contre
une branche Neon isolée créée depuis Production puis supprimée. Ce résultat ne
constitue pas encore le merge ni la clôture de production, qui restent soumis à
l'autorisation explicite du propriétaire et aux contrôles d'environnement
ci-dessous.

## Périmètre et état Git

- `dev`, `origin/dev` et le HEAD audité sont alignés après les commits de la
  passe.
- `main` et `origin/main` restent inchangés à `760103d`.
- Aucun merge, seed de production ou écriture de production n’a été effectué.
- `.DS_Store`, suivi historiquement malgré `.gitignore`, a été retiré de Git
  dans `4a01ccb` avec `git rm --cached`; le fichier local est conservé.
- `BACKLOG_V3.md` reste un artefact utilisateur provisoire non suivi. Il doit
  être réaudité après la clôture et le merge V2, puis committé séparément s’il
  est retenu.
- Aucun secret, rapport Playwright, résultat temporaire ou fichier `.env` n’est
  suivi. Seul `.env.example` contient des valeurs factices.

## Synthèse opérationnelle avant merge

| Catégorie | Sévérité | État et preuve | Action restante |
| --- | --- | --- | --- |
| Code à corriger | aucune P0/P1 | suites locales, axe, build et Integration #22/#23 verts | aucune |
| Conflits Git | résolu localement | 4 add/add sur `PEDAGOGY_SPEC_018–021`, 2 modify/modify sur le seed et ses tests ; commit `3d360f2`, validation de cohérence et Integration Neon complètes | valider le SHA d'intégration |
| Configuration propriétaire | P1 opérationnelle | `build:vercel` lance `prisma migrate deploy`; l'isolation des valeurs Vercel Preview n'a pas pu être prouvée car elles sont masquées | Rayan confirme Preview sur une branche Neon dédiée et prépare le point de restauration Production |
| Contrôle manuel | P2 | axe/WebKit/texte 200 % verts ; VoiceOver matériel non rejoué sur la RC déployée | smoke iPhone post-merge |
| Publication de contenu | P1 opérationnelle | `build:vercel` ne lance jamais `prisma:seed` | audit lecture seule puis seed séparé uniquement après sauvegarde et autorisation |
| Dette V3 | P2 | en-têtes, pagination, fréquence de `lastUsedAt`, redaction des logs | ne bloque pas le merge V2 |

Le verdict est donc **GO code pour merger après autorisation**, mais **NO-GO
déploiement Production** tant que la sauvegarde/restauration et l'environnement
de base cible ne sont pas confirmés par Rayan.

## Résolution du merge préparé

- `PEDAGOGY_SPEC_018.json` à `021.json` : les deux branches ont des données JSON
  strictement identiques après normalisation SHA-256 ; la version `dev` retient
  seulement le formatage canonique.
- `seed/sample-program.json` : reconstruction conservée depuis le seed V2
  canonique, qui contient l'étape 5 enrichie des clés d'activités, puis les
  étapes 6–13. Comptes vérifiés : 13 étapes, 22 modules, 70 leçons, 403 blocs,
  400 ressources, 210 notions, 210 banques, 1 050 questions et 13 évaluations.
- `prisma/seed.test.ts` : la version V2 conserve les assertions de l'étape 5 et
  ajoute le routage canonique, l'idempotence et les invariants des étapes 6–13.
- `.DS_Store` : la suppression venant de `dev` est conservée.
- Contrôle croisé dédié : aucun doublon de slug, position, clé de ressource ou
  clé d'activité ; les quatre specs de l'étape 5 correspondent exactement au
  seed après normalisation des clés V2.

## Statut des tickets V2

### V2-001 — Cache privé du service worker : terminé sur dev

Preuves : `2b7b2f9`, `vite.config.ts`, `public/sw-cache-cleanup.js`, middleware
`Cache-Control: private, no-store`, tests `api/_lib/sw-cache-cleanup.test.ts` et
`src/server/api/app.test.ts`. Le service worker construit ne précache aucune
route `/api/` et importe le nettoyage de `learnx-pedagogy-v1`.

Limite : la production reste sur `main`; son endpoint session observé renvoie
encore `cache-control: public, max-age=0, must-revalidate`. La correction V2 ne
sera effective en production qu’après merge/déploiement contrôlé.

### V2-002 — Revue bornée au propriétaire : terminé

Preuves : `bf9536a`, prédicats `ownerId` dans les lectures et écritures de
`stage-assessments`, tests croisés propriétaire/autre admin/non-admin/anonyme
dans `api/stage-assessments/app.test.ts`. Les identifiants hors périmètre ne
révèlent pas la ressource.

### V2-003 — Progression exacte et atomique : terminé

Preuves : `ae139b7`, transaction sérialisable et recalcul hiérarchique dans
`src/server/api/_lib/progress-recalculation.ts`, tests de concurrence et
idempotence. La couverture ciblée de `src/server/api/progress/app.ts` est de
98,02 % des instructions et 96,15 % des branches, au-dessus du seuil demandé.

La transaction a été validée contre une branche Neon réelle par `Integration`
#21 puis #22.

### V2-004 — Intégration backend réelle : terminé

Preuves livrées : `0a1d3bb`, serveur d’intégration, fixtures multi-utilisateurs,
Playwright Chromium/WebKit, garde-fou de base éphémère et workflow créant puis
supprimant une branche Neon.

Preuve finale : [GitHub Integration #22](https://github.com/Guts6667/learnx/actions/runs/30937923233),
HEAD `b378611`, succès le 4 août 2026. La CI a créé une branche Neon isolée,
généré Prisma, appliqué les migrations, exécuté les Functions et navigateurs
réels, chargé le rapport Playwright puis supprimé la branche. Le garde-fou local
continue de refuser toute base non marquée éphémère.

### V2-005 — Publication en cascade : terminé

Preuves : `2cecc1e`, aperçu signé, rejet des plans obsolètes, transaction,
rollback, idempotence, autorisation admin + propriétaire et tests dans
`api/admin/publication-*.test.ts`. La validation scientifique n’est jamais un
gate de publication.

Le scénario backend réel est couvert par le pipeline Neon vert.

### V2-006 — Navigation admin progressive : terminé

Preuves : `df22f92`, routes profondes, chargement à la demande, tiroirs avec
piège/restauration du focus, test composant et Playwright admin sur desktop,
mobile Chromium et WebKit.

### V2-007 — Parcours centré sur la leçon : terminé localement

Preuves : `ccab8d6`, `219f41c`, `b409b3e`, séquence déterministe, reprise de
l’activité, sommaire, routes profondes et une seule action principale. Tests de
séquence, pages et parcours Playwright sur quatre projets.

Dette documentaire : le texte historique de V2-008A mentionne encore
`Retour à la leçon` et `Suivant`, alors que les décisions ultérieures ont retenu
`Sommaire`, `Précédent` et `Continuer`. Le code suit la décision finale.

### V2-008 — Design system et responsive : terminé

Preuves : `01ce8d6`, `UI_SYSTEM_SPEC.md`, composants partagés, SafeMarkdown,
tests XSS/liens, évaluations longues structurées, safe areas et tests
320/390/768/desktop.

Le commit `b378611` ajoute axe aux vues critiques et un scénario navigateur avec
texte à 200 %, mouvement réduit et contrôle de débordement. Une vérification
VoiceOver sur appareil réel reste recommandée après déploiement sans constituer
une revendication de certification réglementaire.

### V2-008A — Navigation pédagogique et reprise de module : terminé

Preuves : `dc4e31b`, `cc7b6b1`, `219f41c`, migration `ModuleRun`, bornes de
tentatives, confirmation détaillée, conservation des notes, transaction,
idempotence et tests d’autorisation/concurrence. Sommaire mono-colonne testé en
390 et 320 px ainsi que WebKit.

Le pipeline Neon réel valide les migrations et les parcours concernés.

### V2-008B — Activités canoniques : terminé localement

Preuves : `bdf3ad2`, `b0f8848`, `3d21853`, clé éditoriale stable,
`isCanonical`, `TaskResource`, migration/backfill, routage passif/productif,
pruning idempotent et tests seed/progression. Les ressources restent visibles
mais ne sont plus des activités linéaires.

### V2-009 — Liens et actions : terminé

Preuves : `49fc165`, composants `Button`/`NavigationAction`, tests sémantiques
et correctifs profil/leçon. Les mutations restent des boutons et les appels à
l’action de navigation des liens explicites.

### V2-010 — Navigation principale : terminé

Preuves : `214721b`, cinq destinations, icônes décoratives masquées aux aides,
`aria-current`, cibles tactiles, état actif non fondé sur le soulignement,
tests clavier et responsive 320/390/desktop/WebKit.

La navigation est incluse dans le scénario texte à 200 %, les scans axe et les
quatre projets Playwright. La revue VoiceOver matérielle reste un contrôle
post-déploiement recommandé.

### V2-011 — Politique hors ligne : terminé

Preuves : `941c51c`, source réseau centralisée, requêtes privées en mode
`networkMode: always`, erreur immédiate hors ligne, route conservée, session
revérifiée, retry explicite, purge QueryClient/localStorage/sessionStorage au
login/logout et tests changement de compte. Le scénario offline/reconnect passe
sur Chromium et WebKit.

### V2-012 — Accessibilité et matrice mobile : terminé

- Chromium desktop/mobile, tablette et WebKit/iPhone : **prouvé**, 24/24 tests.
- 320/390 px et absence de débordement : **prouvé** dans les tests du parcours,
  du sommaire, de l’admin et de la navigation.
- Clavier/focus : **largement prouvé** pour navigation, tiroirs, onglets et
  résultats d’évaluation.
- Réduction des animations : **prouvée** via un scénario navigateur dédié.
- Annonces d’erreurs/états : **prouvées** par les rôles ARIA,
  `aria-live`, tests composants et focus vers les résultats.
- Axe sérieux/critique : **prouvé**, aucun défaut bloquant sur Aujourd'hui,
  leçon, sommaire et tiroir admin dans les quatre projets.
- Zoom 200 % et texte agrandi : **prouvés** avec racine typographique à 200 %,
  viewport 390 px et absence de débordement ; les scénarios 320 px couvrent la
  réduction effective de largeur liée au zoom.
- Lecteur d'écran : structure sémantique, noms accessibles et ordre de focus
  contrôlés automatiquement sur Chromium et WebKit. Une session VoiceOver sur
  appareil réel figure dans les vérifications post-déploiement.

Conclusion : les critères automatisables du ticket sont couverts. La V2 ne
revendique pas de certification externe ; le test matériel reste un contrôle de
release sur l'environnement final.

## Matrice de commandes

| Commande | Résultat |
| --- | --- |
| `pnpm lint` | succès |
| `pnpm typecheck` | succès |
| `pnpm test` | succès, 56 fichiers et 289 tests |
| `pnpm build` | succès, bundle JS 165,38 kB / 48,12 kB gzip |
| `pnpm test:e2e` | succès, 24 tests sur 4 projets, axe inclus |
| test offline ciblé Chromium/WebKit | succès, 2/2 |
| couverture progression ciblée | succès; `progress/app.ts` 96,15 % branches |
| `pnpm prisma:generate` | succès, Prisma Client 7.9.1 |
| `pnpm exec prisma validate` | succès |
| migration réelle | succès; 16 migrations vérifiées sur branche Neon éphémère |
| `pnpm test:integration` sur le commit de fusion | succès; 4 tests passés, 2 scénarios backend volontairement ignorés hors projet desktop |
| GitHub `Integration` | succès; run #22, Functions + navigateurs réels |
| `pnpm deployment:check -- https://learnx-eight.vercel.app` | succès anonyme |
| `pnpm audit --prod` | succès; aucune vulnérabilité connue |
| `git diff --check` | succès |

Le seed n’a pas été rejoué sur la base partagée. La procédure du dépôt interdit
à juste titre les écritures d’intégration sans branche éphémère identifiée.

## Parcours testés

- Auth : session, connexion, déconnexion, cache inter-comptes et reconnexion.
- Aujourd’hui : rendu, navigation vers la prochaine activité et reprise.
- Programme, étape, module et leçon : navigation profonde et responsive.
- Tâches, quiz, mini-évaluations, exercices et progression recalculée.
- Notes : liste, Markdown sûr, autosauvegarde et suppression propriétaire.
- Révisions : lecture/complétion propriétaire.
- Profil : actions empilées, admin conditionnel et logout.
- Admin : navigation progressive, preview/confirmation de publication.
- PWA : manifest, service worker, purge d’ancien cache et politique privée
  online-only.
- Responsive : 320/390 px, tablette, desktop, Chromium et WebKit.

Non testés réellement : parcours authentifié de production avant merge et
VoiceOver matériel sur l'application déployée. Le texte à 200 %, axe et la
branche Neon d'intégration sont désormais couverts.

## Revue sécurité

### P0

Aucun P0 confirmé dans le code et les tests audités.

### P1

Aucun P1 connu ne reste ouvert. `b378611` désactive l'inscription directe en
production et remplace la limite mémoire par une limite PostgreSQL atomique,
partagée entre instances. Les clés client/e-mail sont hachées avant stockage.
Le pipeline multi-utilisateurs réel est vert sur une branche Neon éphémère.

### P2 — dette à planifier

- La production n’expose que HSTS parmi les en-têtes de durcissement observés;
  CSP, `X-Content-Type-Options`, politique de framing et `Referrer-Policy` ne
  sont pas configurés explicitement.
- Notes, historiques de tentatives et certaines listes de révisions sont non
  paginés. Acceptable à faible volume personnel, à corriger avant la montée en
  charge multi-utilisateur.
- Chaque vérification de session met à jour `lastUsedAt`, ce qui multiplie les
  écritures et peut créer une course bénigne avec logout. Mesurer puis borner la
  fréquence.
- Plusieurs `console.error` enregistrent l’erreur brute côté serveur. Les
  réponses restent normalisées, mais la politique de logs et de redaction doit
  être formalisée.

### Contrôles satisfaisants

- Cookie de session aléatoire, hashé en base, `HttpOnly`, `SameSite=Lax`,
  `Secure` en production; logout supprime la session serveur et le cookie.
- Prédicats `ownerId`/`userId` présents dans les domaines curriculum,
  progression, quiz, concepts, exercices, notes, révisions et admin; tests IDOR
  croisés présents.
- Admin vérifié côté serveur (`Role.ADMIN`) puis borné au propriétaire.
- Entrées sensibles validées par Zod; erreurs client normalisées sans stack.
- SafeMarkdown n’accepte pas le HTML arbitraire et neutralise les protocoles de
  liens dangereux.
- Quiz et mini-évaluations ne sérialisent ni bonnes options, ni réponses
  acceptées, ni explication avant soumission; les corrections arrivent après.
- API dev envoie `Cache-Control: private, no-store`; aucun cache API runtime.
- Notes/progressions/tentatives/soumissions sont rattachées au `userId` et les
  tentatives historiques sont conservées lors des reprises.

## Dette technique et documentation

| Sévérité | Preuve / impact | Recommandation | Cible |
| --- | --- | --- | --- |
| P2 | VoiceOver matériel non rejoué sur la RC déployée | smoke iPhone post-merge | post-merge |
| P2 | en-têtes de durcissement incomplets | CSP/frame/referrer policy testées | V3 |
| P2 | listes non bornées | pagination stable et limites serveur | V3 |
| P2 | écriture session à chaque lecture | throttle mesuré | V3 |
| P2 | V2-008A historique divergent | aligner backlog/spec sur décisions finales | clôture docs |
| P3 | rapports Playwright locaux ignorés | aucune action | accepté |

## Matrice objective GO / NO-GO

| Gate | Preuve | État |
| --- | --- | --- |
| lint, typecheck, 289 tests, build | branche `dev` et worktree d'intégration | GO |
| seed ciblé et cohérence 13 étapes | 20 tests seed + contrôle croisé JSON | GO |
| Playwright desktop/320/390/WebKit/axe | 24/24 sur `dev` et branche d'intégration | GO |
| Integration Neon | runs #22/#23 sur `dev`, puis commit `3d360f2` validé sur `br-damp-hill-ase0imqf`; migrations/Functions/navigateurs verts, branche supprimée | GO |
| V2-012 | axe sans sérieux/critique, clavier/focus, 200 %, mouvement réduit | GO automatisé |
| VoiceOver matériel | non rejoué sur le déploiement final | post-merge requis |
| dépendances | Hono 4.13.0, `pnpm audit --prod` sans vulnérabilité connue | GO |
| signup/rate limit | inscription Production désactivée, compteur PostgreSQL partagé et haché | GO |
| Preview Vercel | variables présentes mais hôtes masqués, isolation non prouvée | NO-GO pour pousser la branche temporaire |
| smoke authentifié Production | impossible avant merge sans déployer la RC | post-merge requis |
| sauvegarde/restauration Production | non encore créée ni vérifiée | action Rayan avant merge/déploiement |

## Commits candidats au merge

La plage candidate comprend les 40 commits propres à `dev` jusqu'à `ec306e6`. Elle comprend le
cadrage V2, V2-001 à V2-011, les migrations V2-008A/B, les contenus des étapes
5 à 13, les correctifs UX, la suppression de note et le retrait de `.DS_Store`.
La liste exacte est obtenue par :

```bash
git log --reverse --oneline origin/main..origin/dev
```

`main` possède en parallèle le commit propre `760103d`. Le merge a été préparé
depuis les références distantes sur `codex/v2-main-integration` : les six
conflits sont résolus et aucun doublon de contenu n'est détecté. Aucun P0/P1 de
code connu ne bloque l'intégration.

## Migrations et compatibilité N-1

Trois migrations existent dans `dev` et pas dans `main` :

1. `20260804100000_add_module_runs` crée les reprises et rend
   `module_run_id` obligatoire dans les tentatives de quiz, mini-évaluations et
   soumissions d'exercice après backfill.
2. `20260804153000_canonical_learning_activities` ajoute les clés canoniques,
   les relations tâche–ressource et les reports de complétion.
3. `20260804190000_add_shared_login_rate_limits` ajoute le compteur de connexion
   partagé entre Functions.

Le code N-1 `760103d` insère encore tentatives et soumissions sans
`module_run_id`. Il est donc **incompatible avec le schéma V2 migré**. Après
migration, redéployer seulement l'ancien code n'est pas un rollback sûr.

Avant Production :

1. ouvrir une fenêtre de maintenance courte et relever les comptes utilisateurs,
   programmes, progressions, notes, tentatives et soumissions ;
2. créer une branche Neon de sécurité depuis l'état Production courant, ou un
   point de restauration daté dans la fenêtre de rétention, puis vérifier sa
   connexion et les comptes en lecture seule ;
3. relever l'identifiant de branche et l'instant exact dans le journal de
   release ;
4. déployer le code et les migrations sans exécuter le seed ;
5. privilégier le roll-forward en cas de défaut applicatif ;
6. si la base doit revenir en arrière, couper les écritures puis restaurer la
   base au point pré-déploiement **et** redéployer `760103d` dans la même
   opération.

Les branches Neon sont isolées et créées en copy-on-write ; un point historique
peut être restauré dans la limite de rétention configurée. La restauration doit
être testée avant la fenêtre, pas supposée disponible.

## Preview Vercel et base de données

`build:vercel` exécute `pnpm prisma:deploy` avant le build. Les variables
`DATABASE_URL` et `DIRECT_URL` existent pour Preview, mais leur valeur est
masquée par l'outil et leur séparation de Production n'a pas pu être prouvée.
En conséquence, la branche d'intégration n'est pas poussée et aucun Preview
Vercel n'est déclenché. Rayan doit d'abord vérifier que les deux URL Preview
visent une branche Neon dédiée ; une Preview partageant Production est un
NO-GO absolu pour les nouvelles migrations.

## Merge et publication du contenu sont distincts

Le déploiement Vercel ne lance pas `prisma:seed`. Merger les specs et le seed ne
rend donc pas automatiquement les étapes 5–13 visibles dans la base Production.
Après le déploiement technique :

1. lire les comptes et statuts Production sans écrire ;
2. si des étapes manquent, exécuter le seed sur une branche clone de Production
   et vérifier son idempotence deux fois ;
3. comparer avant/après les comptes utilisateurs, progressions, notes,
   tentatives et soumissions, qui doivent rester identiques ;
4. présenter le diff de contenu à Rayan ;
5. seulement après autorisation explicite, exécuter séparément le seed
   Production puis vérifier les 13 étapes/70 leçons.

Aucun seed Production n'est autorisé par le présent GO technique.

## Porte de sortie GO

Les contrôles locaux, la matrice navigateur, l'audit de dépendances et
`Integration` #22 sont verts. La prochaine action autorisée est la préparation
non destructive du merge, suivie du merge uniquement après confirmation
explicite du propriétaire.

## Procédure de merge après GO

1. Vérifier `origin/main` et `origin/dev`, sans réécriture d’historique.
2. Faire valider le commit de la branche d'intégration et l'isolation de la base
   Vercel Preview si un Preview est souhaité.
3. Créer et vérifier la branche/point de restauration Neon Production.
4. Merger la branche d'intégration dans `main`, pousser puis surveiller build et
   migrations ; ne pas lancer de seed.
5. Exécuter le smoke authentifié : auth, programme, leçon, quiz, exercice,
   notes, admin et publication.
6. Vérifier les en-têtes `private, no-store`, le nouveau service worker et la
   purge du cache historique sur un appareil déjà installé.
7. Vérifier mobile réel 390 px/iPhone et desktop avec VoiceOver.
8. Auditer le contenu Production en lecture seule, puis demander une seconde
   autorisation si un seed est nécessaire.

## Rollback

- Code : privilégier un correctif roll-forward. Ne jamais redéployer seul
  `760103d` contre le schéma V2, car ses écritures omettent `module_run_id`.
- Base + code : pour un retour N-1, suspendre les écritures, restaurer la base au
  point pré-déploiement puis redéployer `760103d` ensemble ; ne jamais réécrire
  l'historique Git.
- Contenu : ne pas relancer le seed de production tant que la sauvegarde et les
  comptes attendus ne sont pas vérifiés.
- Après rollback : invalider le service worker défectueux si nécessaire,
  revérifier session/logout, progression, notes et admin, puis documenter
  l’incident avant toute nouvelle tentative.

## Décision requise

La V2 est techniquement prête sur la branche d'intégration. Rayan doit encore :

1. confirmer l'isolation de la base Preview avant tout push de cette branche ;
2. valider le SHA et les six résolutions ;
3. préparer et vérifier le point de restauration Production ;
4. autoriser explicitement le merge vers `main` ;
5. participer au smoke authentifié/VoiceOver post-merge ;
6. autoriser séparément un éventuel seed Production après audit lecture seule.
