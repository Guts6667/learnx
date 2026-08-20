# Matrice QA V3.5 — LearnX Atlas

## Statut

- Baseline : `dev` après les revues d'écart V3.5-001 à V3.5-007.
- Références : A1 à A6 de `BACKLOG_V3_5.md`.
- Contrat de compréhension : `docs/EMOTIONAL_DESIGN_CONTRACT.md`.
- Automatisation : active ; les résultats exacts sont consignés par la matrice
  de commandes de V3.5-008 puis le rapport de clôture V3.5-009.
- Revue humaine de marque : **à valider**.
- Revue humaine d'utilisabilité et VoiceOver : **à valider séparément**.

Ce document ne transforme pas une baseline visuelle en approbation humaine et
ne déclare aucun contrôle manuel réussi sans preuve.

## Matrice des familles

| Famille | Référence | Largeurs automatisées | États et interactions | Preuve actuelle | Décision humaine |
| --- | --- | --- | --- | --- | --- |
| Landing publique | A3/A5 | 320, 390, 768, 1024, 1440, 1920 | FR/EN, CTA, formulaire, aperçus Programme/Leçon réels, source, absence de preuve IA disponible, axe | `tests/e2e/landing.spec.ts`, captures Playwright attachées | À valider |
| Shell et primitives | A2 | 320, 390, 768, 1024, 1440, 1920 | cibles 44 px, zoom 200 %, axe | `tests/e2e/ui-primitives.spec.ts` | À valider |
| Programme et leçon | A1/A3 | 320, 390, 1440, 1920 | accordéon, titres longs, navigation, sommaire, clavier, erreurs | `tests/e2e/home.spec.ts` | À valider |
| Première arrivée et Aujourd’hui | Emotional Design / V4-016C | 320, 390, 720, 1440 | première inscription, recommandation dominante, trois reprises compactes, absence de faux compteurs | 4 compositions de référence sans débordement ; compréhension à consigner | À valider |
| Mes parcours et Découvrir | Emotional Design / V4-016C | 320, 390, 720, 1440 | intentions séparées, contenu avant outils, recherche progressive | 4 compositions de référence sans débordement ; compréhension à consigner | À valider |
| Résultat, clôture et récupération | Emotional Design / V3.5-004/005, V4-016G | 320, 390, 720, 1440 | acquis, priorité, action, score secondaire ; clôture factuelle ; conservation/non-effet/action sûre | 12 compositions de référence sans débordement ; compréhension à consigner | À valider |
| Exercice et Réviser | A1 | 320, 390, desktop | activité profonde, correction existante, focus et états | `tests/e2e/home.spec.ts` et tests composants | À valider |
| Notes et Profil | A1/A3 | 320, 390, desktop | Markdown sûr, actions, session et PWA | tests `NotesPage`, `ProfilePage`, `PwaStatus` | À valider |
| Administration | A1 | 390, 768, 1024, 1440, 1920 | navigation profonde, tiroir, Échap, restitution du focus, axe | `tests/e2e/admin.spec.ts` | À valider |
| Contacts landing | A4 | 390, 1440, zoom 200 % | default, loading, empty, error, retry, double finalité, axe | `tests/e2e/admin-contacts.spec.ts` | À valider |
| Icône Atlas | A6 | 29, 32, 40, 60, 180, 192, 512, 1024 | géométrie, couleurs, tailles, manifestes, favicon, Apple touch | `src/server/quality/atlas-icons.test.ts` et `tests/e2e/landing.spec.ts` | À valider |
| Correction IA | A1 | — | Surface non livrée en V3.5 | Référence réservée à V4 ; aucune fausse UI | Sans objet V3.5 |

## Preuves de compréhension Emotional Design

La référence approuvée couvre sept écrans à quatre largeurs — 320, 390, 720
pour le reflow équivalent au zoom 200 %, et 1440 — soit 28/28 contrôles de
composition réussis : aucune vue active multiple, cible produit inférieure à
44 px, absence de contenu, erreur runtime ou débordement.

Cette preuve est technique. La clôture des tickets associés exige en plus une
preuve de compréhension consignée sur données réalistes :

| Scénario | Questions auxquelles l’utilisateur doit répondre sans aide | Critère de passage | Preuve à consigner |
| --- | --- | --- | --- |
| Première arrivée | Que propose LearnX ? Que dois-je faire maintenant ? | Le CTA `Choisir mon premier parcours` est identifié en cinq secondes ; aucun compteur ou outil vide n’est cité comme prochaine étape | observation et verbatim |
| Aujourd’hui multi-parcours | Quelle activité est recommandée ? Comment reprendre chacun de mes autres parcours ? | Recommandation dominante distinguée ; trois parcours accessibles en une interaction | destinations suivies et erreurs observées |
| Mes parcours / Découvrir | Où reprendre ? Où chercher un nouveau parcours ? | Les deux intentions sont distinguées sans ouvrir la recherche par défaut | parcours choisi et justification |
| Programme | Où suis-je ? Quelle est la prochaine activité ? | Position et prochaine action exactes identifiées en cinq secondes | réponse et destination sélectionnée |
| Résultat | Qu’est-ce qui est acquis ? Que renforcer ? Que faire ensuite ? | Un acquis et une priorité précèdent le score dans la restitution spontanée | ordre des éléments reformulés |
| Clôture de leçon | Qu’ai-je réellement terminé ? Que se passe-t-il ensuite ? | Travail accompli et prochaine frontière pédagogique compris sans récompense artificielle | reformulation factuelle |
| Erreur / récupération | Qu’est-ce qui est conservé ? Qu’est-ce qui n’a pas eu lieu ou n’a pas été débité ? Quelle action est sûre ? | Les trois réponses sont exactes et l’action choisie n’entraîne pas de mutation double | action, compréhension et reprise observées |

Les maquettes interactives et les captures utilisées comme références sont :

- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-emotional-flow.html` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/emotional-design-renders/`.

Elles fixent hiérarchie, densité, ton et ordre de l’information, pas une copie
pixel-perfect ni une modification du moteur.

## Contrôles transversaux automatisés

- Palette A2 exacte, fontes locales, espacements, rayons et contrastes :
  `src/server/quality/atlas-foundations.test.ts`.
- Absence de classes vertes, émeraude, teal et cyan électrique : même contrôle.
- Liens publics et renouvellement PWA :
  `src/server/quality/pwa-public-routes.test.ts`.
- Identité de contact dédupliquée :
  `src/server/quality/public-contacts.test.ts`.
- Géométrie, palettes, exports et raccordement de l’icône Atlas :
  `src/server/quality/atlas-icons.test.ts`.
- WCAG automatisé : `@axe-core/playwright`, impacts serious/critical bloquants.
- Reduced motion et forced colors : règles CSS versionnées et matrice E2E.
- Mesure de lecture : tokens `--app-reading-max` et gabarits limités à 68–72ch.

## Revue humaine requise avant clôture

Pour chaque famille applicable :

1. comparer au screen pack sans rechercher une copie pixel-perfect ;
2. vérifier hiérarchie, rythme, action dominante et absence de cardification ;
3. tester VoiceOver sur iOS à 390 px et VoiceOver ou lecteur équivalent sur
   desktop ;
4. tester texte système/zoom 200 %, clavier seul et reduced motion ;
5. consigner `accepté`, `écart à corriger` ou `écart accepté`, avec justification.
6. inspecter les huit tailles A6 à taille native sur fonds clair/sombre et
   vérifier le renouvellement favicon/PWA après déploiement.

Un défaut P0/P1, un contenu masqué, une action inaccessible ou une information
exprimée uniquement par couleur bloque V3.5-009.

## Checklist courte de clôture sur le `main` courant

Baseline observée le 20 août 2026 : `origin/main` à `b5f5013`. Cette mention
n’atteste aucun contrôle manuel. Chaque ligne reste `À EXÉCUTER` jusqu’à preuve
datée sur la version réellement déployée.

| Contrôle | Parcours minimal | Preuve requise | Statut |
| --- | --- | --- | --- |
| PWA réelle | Installer, fermer, rouvrir puis mettre à jour sur un téléphone réel ; vérifier que l’ouverture mène à l’application ou à la connexion, jamais à la landing | appareil/OS, URL, date, capture et résultat ; inclure logout/changement de compte et absence de données privées restaurées | À EXÉCUTER |
| VoiceOver | Sur iOS réel, parcourir connexion, Aujourd’hui, Parcours, Programme, Leçon et une erreur récupérable | ordre de lecture, libellés, focus, annonces de statut et défauts consignés | À EXÉCUTER |
| Zoom et reflow | À 200 % desktop et avec grande taille de texte mobile, revoir landing, shell privé, Programme/Leçon et Administration Contacts | captures 320/390 et desktop, absence de scroll horizontal global, contenu/action non masqués | À EXÉCUTER |
| Smoke authentifié | Sur le domaine promu, se connecter puis ouvrir Aujourd’hui, un programme, une leçon, Notes et Administration Contacts ; se déconnecter | compte/rôle de test autorisé, destinations, données visibles, erreurs réseau et résultat daté | À EXÉCUTER |

La clôture officielle exige un sign-off humain unique citant ces quatre preuves.
Un GO automatisé antérieur, une capture locale ou une composition de référence
ne peut pas changer ces statuts.

## Passe de non-régression automatisée du 20 août 2026

Cette passe a été exécutée dans le worktree isolé
`codex/v35-main-nonregression` sur la baseline source consolidée exacte
`251c6f7fd26361ffc57504dc06f3fb0d4ed91882`. À la date du contrôle,
`origin/main` pointait toujours sur
`b5f50130c0aef611b340b812c875a5a4bc170bfc`. Les résultats ci-dessous
qualifient donc la source consolidée fournie pour audit ; ils ne prouvent ni que
`251c6f7` est déployé, ni qu'un contrôle sur appareil réel a eu lieu.

### PASSED_AUTOMATED

| Contrôle | Preuve exacte du 20 août 2026 | Limite de la preuve |
| --- | --- | --- |
| Routes publiques et bundle de production | `pnpm build` réussi : 124 modules, 26 entrées PWA précachées ; aperçu local du bundle : HTTP 200 pour `/`, `/login`, `/request-access`, `/today`, `/manifest.webmanifest` et `/sw.js` | Aperçu local uniquement, pas le domaine Production |
| Entrée PWA simulée | Manifeste servi avec `start_url=/today` et `display=standalone` ; tests `App`, `PwaStatus` et `pwa-public-routes` verts | N'installe ni ne rouvre une PWA réelle et ne valide pas un renouvellement de service worker sur appareil |
| Logout et cache privé | `src/features/auth/session.test.ts` vérifie la purge mémoire, `localStorage` et `sessionStorage` au changement de compte et au logout ; parcours reconnexion/logout couvert par Playwright | Fixtures et navigateur automatisé, pas un changement de compte sur installation réelle hors ligne |
| Landing, connexion et demande d'accès | Routes et états FR/EN couverts par tests composants et Playwright ; aucune API privée appelée par la landing ; axe sans impact serious/critical | Le cycle e-mail réel de demande d'accès n'est pas exécuté |
| Zoom/reflow et responsive | Playwright couvre 320, 390, 720/768, 1024, 1440 et 1920 px selon les surfaces ; texte racine à 200 %, absence de débordement global et actions visibles | Le 200 % est automatisé dans le navigateur ; la grande taille de texte système iOS reste distincte |
| Clavier, focus et axe | Navigation par onglets/flèches, accordéons, tiroirs, Échap et restitution du focus couverts ; axe serious/critical bloquant | Ne remplace pas l'ordre de lecture et les annonces VoiceOver |
| V4-016C | Première arrivée à 320/390/720/1440, CTA unique `Choisir mon premier parcours`, absence d'outils vides ; `Mes parcours`/`Découvrir` testés de 320 à 1920 px | La compréhension utilisateur et l'observation humaine restent à consigner |
| Suite applicative | `pnpm lint`, `pnpm typecheck`, `pnpm test` (`166` fichiers, `1044` tests), `pnpm test:e2e` (`66` réussis, `6` ignorés selon la matrice), `pnpm i18n:check` (`800` clés FR/EN) et `prisma validate` réussis | Aucun seed, aucune migration et aucune écriture sur base partagée |

La sous-suite ciblée V3.5 a également réussi avec `8` fichiers et `65` tests.
Le premier lancement avait échoué uniquement parce que le client Prisma n'était
pas encore généré dans le worktree et que le stockage web expérimental de Node
était incompatible avec jsdom. Après `pnpm prisma:generate` et désactivation de
ce stockage expérimental pour le processus de test, la même sous-suite puis la
suite complète ont réussi. Ces incidents d'environnement ne sont pas comptés
comme preuves produit.

### PENDING_REAL_DEVICE

| Contrôle | Pourquoi il reste ouvert | Preuve nécessaire |
| --- | --- | --- |
| Installation/réouverture PWA | Aucun navigateur automatisé ne reproduit l'installation iOS/Android, la fermeture complète, la réouverture depuis l'icône et le renouvellement d'un ancien worker | Appareil, OS, version déployée, date, captures et destination obtenue |
| Logout/changement de compte sur PWA réelle | Les purges sont testées automatiquement, mais pas le cache effectivement conservé par une installation mobile existante | Deux comptes de test autorisés, passage A→logout→B, mode hors ligne/reconnexion et absence de donnée privée de A |
| VoiceOver réel | Axe, rôles et focus automatisés ne prouvent ni l'ordre de lecture ni la qualité des annonces iOS | Parcours iPhone de connexion, Aujourd'hui, Parcours, Programme, Leçon et erreur récupérable, avec défauts consignés |
| Grande taille de texte mobile | Le reflow à 200 % est vert, mais pas la préférence système iOS/Android sur appareil | Captures 390 px avec grande taille système, sans contenu/action masqués |
| Smoke authentifié sur la version promue | Le parcours authentifié Playwright utilise des fixtures sûres et couvre Aujourd'hui, programme, leçon, notes, administration et logout ; il ne touche pas le domaine promu | Compte et rôle de test autorisés sur le commit effectivement déployé, destinations et erreurs réseau consignées |
| Cycle réel de demande d'accès | Le formulaire et les routes sont couverts sans écrire sur une base partagée | Autorisation explicite, e-mail de test, réception, vérification et activation sur l'environnement retenu |

La clôture officielle V3.5 reste donc **PENDING_REAL_DEVICE**. Les contrôles
`PASSED_AUTOMATED` réduisent la dette technique vérifiable mais ne constituent
pas un sign-off humain de marque, d'utilisabilité ou d'accessibilité matérielle.
