# Rapport de release V3

## Synthèse exécutive

- Ticket : `V3-033`.
- Date : 10 août 2026.
- SHA promu : `413071a15518ffcc3f1ffad3b6522596f1a3c999` ; le code
  applicatif est celui du candidat `f1353a3ed565bd40fdeee7162d7a9d734ca8421f`,
  suivi uniquement du présent rapport de release.
- Branches : `dev`, `staging` et `main` alignées par fast-forward sur
  `413071a`.
- Verdict : **GO Production ; V3 techniquement promue**. La vérification
  manuelle VoiceOver sur appareil réel reste une validation humaine résiduelle
  et ne doit pas être présentée comme exécutée par l'automatisation.

Le candidat est validé localement, par le workflow Integration sur un clone
Neon éphémère, par un déploiement Vercel staging relié à une branche Neon
distincte, puis par un déploiement et des smoke tests Production. Aucun P0/P1
applicatif connu ne reste ouvert. Le domaine canonique est
`https://learn-x.app`.

## État Git et périmètre

- `origin/dev`, `origin/staging` et `origin/main` : `413071a` après promotion.
- La promotion vers `staging`, puis vers `main`, a été effectuée uniquement par
  fast-forward ; aucun historique n'a été réécrit.
- Les trois migrations nouvelles depuis `main` sont :
  - `20260809150000_add_account_locale` ;
  - `20260809170000_add_program_language_variants` ;
  - `20260809210000_add_bilingual_editorial_workflow`.
- Les brouillons locaux, `BACKLOG_V3.md` et `LEARNING_FLOW_V3_SPEC.md` modifiés
  sont volontairement exclus du commit de release.

La V3.1 complète, la V4, l'IA et toute modification éditoriale non auditée
restent hors périmètre.

## Preuves de validation

### Matrice locale

| Commande | Résultat |
| --- | --- |
| `pnpm lint` | succès |
| `pnpm typecheck` | succès |
| `pnpm test` | 99 fichiers, 539 tests réussis |
| `pnpm build` | succès, PWA générée avec 14 entrées précachées |
| `pnpm test:e2e` | 40 tests réussis |
| `pnpm prisma:generate` | succès, Prisma 7.9.1 |
| `pnpm i18n:check` | 638 clés FR/EN alignées |
| `pnpm audit --prod --audit-level high` | aucune vulnérabilité connue |
| `git diff --check` | succès |

La matrice E2E couvre Chromium desktop, mobile 390 px, tablette et WebKit
mobile : authentification, catalogue, accordéon Programme, navigation profonde,
sommaire, notes, administration, texte agrandi et réduction des animations.

### GitHub Integration

Le workflow Integration
[#87](https://github.com/Guts6667/learnx/actions/runs/31337349503) est vert sur
le SHA exact `f1353a3`. Il crée une branche Neon éphémère, photographie le clone
Production, applique et rejoue les 28 migrations, exécute les tests Functions et
navigateurs multi-utilisateurs, mesure les lectures, valide les seeds ciblés
idempotents, puis supprime la branche.

Le workflow Integration
[#88](https://github.com/Guts6667/learnx/actions/runs/31362936465) est également
vert sur le SHA promu `413071a`, y compris migrations, replay, tests Functions
et navigateurs, seeds ciblés et suppression de la branche Neon éphémère.

La répétition détaillée de V3-032 reste décrite dans
`docs/V3_MIGRATION_REHEARSAL_REPORT.md` : 44 tables et leurs données antérieures
préservées, isolation notes/tentatives/progressions, suspension et révocation de
sessions, RBAC, Chromium/WebKit/mobile et axe WCAG A/AA.

### Staging Vercel et Neon

- Déploiement :
  `https://learnx-otd4wc5ag-guts6667s-projects.vercel.app`.
- Branche Git déployée : `staging`, commit `f1353a3`.
- Branche Neon : `staging` (`br-damp-forest-asxdi3dl`).
- Hôte direct observé dans le build Vercel :
  `ep-cool-night-as3yii11.c-4.eu-central-1.aws.neon.tech`.
- Production Neon reste `br-broad-brook-asdigraq` et n'a pas été modifiée par
  le déploiement staging.
- Les trois migrations V3 ont été appliquées avec succès sur staging avant le
  build.
- Le shell, le manifeste, le service worker et la session anonyme répondent
  `200`.
- Smoke authentifié avec un compte staging temporaire : login `200`, session
  `200`, liste de programmes `200`, logout `204`. Le compte a ensuite été
  supprimé.

### Domaine canonique

La configuration DNS et Vercel a été corrigée pendant la revue :

- `learn-x.app` pointe vers Vercel et sert LearnX en `200` ;
- `/api/auth/session` répond `200` en JSON ;
- `www.learn-x.app` redirige en `308` vers `https://learn-x.app/` ;
- `learnx-eight.vercel.app` redirige en `308` vers le même domaine canonique ;
- `pnpm deployment:check -- https://learn-x.app` réussit ;
- les enregistrements du sous-domaine e-mail `send.learn-x.app` n'ont pas été
  modifiés.

Les variables Production nécessaires au cycle d'accès sont présentes dans
Vercel : activation des demandes, vérification e-mail, TTL, clé Resend,
expéditeur, `APP_URL`, URLs base et e-mail administrateur. Leurs valeurs n'ont
pas été affichées.

## Sécurité et état Production

Aucun P0 n'est connu. Le P1 F-001 de V3-028 a été corrigé par le comportement
fail-closed de V3-029 et par la configuration des variables d'e-mail
Production. L'incident de disponibilité lié au DNS a été corrigé avant toute
promotion.

Photographie Production en lecture seule avant promotion :

- 2 comptes ;
- 4 programmes ;
- 5 notes ;
- 9 progressions de leçon ;
- 28 migrations Prisma appliquées sans rollback.

Cette photographie sert de minimum de comparaison après déploiement. Elle ne
contient aucune donnée personnelle ni secret.

## Promotion Production réalisée

- Sauvegarde Neon pré-release : `backup-pre-v3-release-20260810`, branche
  `br-gentle-leaf-as9fpxt5`, créée depuis Production et conservée.
- Vérification de la sauvegarde : `2 | 4 | 5 | 9 | 28` pour comptes,
  programmes, notes, progressions de leçon et migrations réussies.
- Déploiement Vercel Production :
  `https://learnx-71lzzjikv-guts6667s-projects.vercel.app`, statut `Ready`,
  branche `main`, commit `413071a`.
- `prisma migrate deploy` : 28 migrations trouvées, aucune migration en
  attente.
- `pnpm deployment:check -- https://learn-x.app` : succès.
- Smoke authentifié avec compte temporaire : login `200`, session `200`,
  programmes `200`, Catalogue `200`, Mes programmes `200`, Aujourd'hui `200`,
  Révisions `200`, logout `204`. Le compte temporaire a ensuite été supprimé.
- Photographie post-smoke : `2 | 4 | 5 | 9 | 28`, identique à la sauvegarde.
- Domaine : apex `200`, `www` et l'ancien domaine Vercel redirigent en `308`
  vers `https://learn-x.app/`.
- Logs observés pendant le smoke : aucune réponse `5xx`; les deux `404`
  observées provenaient exclusivement de sondes initiales sur des chemins
  inexistants, aussitôt corrigées vers les routes canoniques en `200`.
- Surveillance continue du endpoint de session pendant plus de 30 minutes :
  toutes les sondes en `200`, temps client compris entre 0,10 s et 0,26 s ;
  revue finale des logs sans `5xx`.

## Fenêtre, responsabilités et seuils d'arrêt

La promotion doit être réalisée pendant une fenêtre surveillée d'au moins
30 minutes. Rayan autorise la promotion et valide le parcours sur appareil
réel ; Codex exécute les contrôles Git, Neon, Vercel et les smoke tests.

Arrêt immédiat si l'un des événements suivants survient :

- migration ou build Vercel en échec ;
- domaine, shell, manifeste, service worker ou session hors contrat ;
- login, logout, catalogue, programmes, notes ou progression en `5xx` ;
- perte ou variation inexpliquée des décomptes Production ;
- accès croisé à une note, tentative ou progression ;
- capacité administrative accordée à USER ou CREATOR ;
- session encore valide après suspension ;
- erreur critique/sérieuse axe, régression WebKit/mobile ou contenu masqué ;
- événement `api_request` 5xx dans les logs pendant le smoke, ou latences
  critiques répétées au-dessus de 1 000 ms sans cause identifiée.

## Procédure de promotion exécutée

1. Obtenir l'autorisation explicite de promotion Production.
2. Figer `413071a` et vérifier les relations fast-forward.
3. Créer une branche Neon de sauvegarde au point immédiatement antérieur au
   déploiement et vérifier connexion, 28 migrations et décomptes critiques.
4. Fast-forward `main` vers le SHA validé, sans merge divergent ni réécriture.
5. Observer `prisma migrate deploy`, le build et l'activation Vercel Production.
6. Exécuter le smoke public puis authentifié : login, session, Catalogue, Mes
   programmes, programme, leçon, quiz, mini-évaluation, exercice, notes,
   révisions, Profil, admin, suspension et logout.
7. Vérifier les décomptes, les logs Vercel, les e-mails de vérification et
   d'invitation, les caches privés et les deep links.
8. Faire valider sur iPhone réel le responsive, le texte agrandi et VoiceOver.
9. Surveiller les logs pendant 30 minutes, puis seulement marquer V3 clôturée.

## Roll-forward et rollback

Le roll-forward est prioritaire. Les migrations ajoutent des colonnes non nulles
et des identités canoniques que le code `main` antérieur ne renseigne pas lors
de certaines créations ou seeds. Un simple redéploiement de l'ancien binaire
après migration n'est donc pas une stratégie de rollback suffisamment sûre.

En cas d'échec applicatif sans corruption, corriger et redéployer depuis le SHA
candidat. Si un retour complet est indispensable : fermer les écritures,
restaurer ensemble la branche Neon sauvegardée et le SHA `221e34f`, puis
rejouer les smoke tests avant réouverture. Toute écriture postérieure au point
de restauration serait perdue et exige une décision explicite.

## Porte de clôture

État actuel :

- [x] matrice locale complète ;
- [x] Integration Neon sur le SHA candidat ;
- [x] staging isolé migré et déployé ;
- [x] smoke staging public et authentifié ;
- [x] domaine canonique corrigé et vérifié ;
- [x] audit dépendances et absence de P0/P1 applicatif connu ;
- [x] autorisation explicite de promotion Production ;
- [x] sauvegarde Neon immédiatement pré-déploiement ;
- [x] fast-forward `main` et déploiement Production ;
- [x] smoke Production authentifié ;
- [ ] validation iPhone réel et VoiceOver ;
- [x] surveillance Production supérieure à 30 minutes, sans incident.

La V3 est officiellement promue en Production. La validation VoiceOver reste
une vérification manuelle résiduelle à faire sur appareil réel ; elle n'est pas
déclarée réussie dans ce rapport.
