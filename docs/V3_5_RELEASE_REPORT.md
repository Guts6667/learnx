# Rapport de release V3.5

**Verdict technique : GO sur le candidat `dev`**

**Clôture officielle : en attente de validation humaine finale**

**Branche auditée : `dev`**

**Commit candidat : `6893f5f39794ba4b8fe2efdeda1a7b763a606047`**

**Date : 2026-08-10**

**Baseline publique à revalider : `origin/main` `b5f5013` observée le 20 août
2026**

## Synthèse

La revue de `BACKLOG_V3_5.md` 0.8.0 est terminée pour V3.5-001 à
V3.5-008. Les écarts automatisables constatés ont été corrigés sans
réimplémenter les éléments déjà conformes. Le candidat `dev` est vert sur la
matrice locale, les tests multi-navigateurs, l'intégration réelle des Functions
et la répétition des migrations sur une branche Neon isolée.

Le verdict est **GO technique** : aucun P0/P1 applicatif connu ne reste ouvert.
La V3.5 ne doit toutefois être déclarée officiellement clôturée qu'après la
validation humaine finale prévue par le backlog : installation/réouverture PWA
sur appareil réel, VoiceOver/zoom 200 % et smoke authentifié sur le domaine
promu. Ces contrôles ne sont pas simulés par ce rapport.

## État des tickets

| Ticket | État | Preuve principale |
| --- | --- | --- |
| V3.5-001 | Conforme | Tokens Atlas A2 exacts, fontes locales, absence de vert/cyan, contrastes et règle du laiton testés. |
| V3.5-002 | Conforme | Primitives, rayons, espacements, poids et états sémantiques alignés sur Atlas. |
| V3.5-003 | Conforme | Shell public sans navigation privée ; rail desktop Atlas ; tests des routes publiques. |
| V3.5-004 | Conforme | Surfaces apprenant nettoyées sans modification du moteur pédagogique. |
| V3.5-005 | Conforme | Surfaces admin et états sémantiques harmonisés. |
| V3.5-006 | Conforme | Landing localisée avec aperçus réalistes Programme/Leçon, sans psychologie ni promesse de correction assistée disponible. |
| V3.5-006A | Conforme automatiquement | Routes d'auth publiques en NetworkFirst, fallback SPA exclu et anciens caches purgés. |
| V3.5-006B | Conforme | Géométrie Atlas canonique, exports 29 à 1024 px, manifestes et métadonnées raccordés. |
| V3.5-007 | Conforme | Contact public dédupliqué, API admin paginée/filtrée, métriques exactes, UI et migration validées sur clone Neon. |
| V3.5-008 | Conforme automatiquement | Matrice 320/390/tablette/desktop, Chromium/WebKit, zoom simulé, reduced-motion, axe et preuves A5/A6. |
| V3.5-009 | GO technique | Matrice complète, Preview Ready, CI Neon isolée verte et smoke public du domaine officiel. |

## Commandes et résultats

- `pnpm lint` : réussi.
- `pnpm typecheck` : réussi.
- `pnpm test` : réussi, 106 fichiers et 575 tests.
- `pnpm build` : réussi, 120 modules transformés et PWA générée avec 24
  entrées précachées.
- `pnpm test:e2e` : réussi, 62 tests exécutés et 6 tests volontairement
  ignorés selon la matrice ; Chromium desktop/mobile/tablette et WebKit mobile.
- `pnpm i18n:check` : réussi, 720 clés FR/EN cohérentes.
- `pnpm prisma:generate` : réussi.
- `pnpm exec prisma validate` : schéma valide.
- `pnpm audit --prod` : aucune vulnérabilité connue.
- `git diff --check` : réussi.

Les avertissements `NO_COLOR` de Playwright n'affectent pas les résultats.

## Intégration Neon et Preview

Le workflow GitHub **Integration #95** est réussi sur le commit candidat :
https://github.com/Guts6667/learnx/actions/runs/31400926940

Il a créé une branche Neon éphémère, vérifié le clone avant migration, appliqué
les migrations, rejoué l'historique complet dans un schéma isolé, exécuté les
tests Functions/navigateurs et les doubles seeds ciblés, publié les rapports,
puis supprimé la branche isolée. Aucune base partagée n'a été seedée par cette
passe.

Le Preview Vercel est `Ready` :
https://learnx-5jk3gfyqo-guts6667s-projects.vercel.app

Sa protection Vercel interdit un smoke navigateur anonyme direct. Le CLI Vercel
authentifié confirme néanmoins HTTP 200 sur `/`, `/login` et `/request-access`,
avec le même bundle versionné sur les trois routes.

## Smoke du domaine officiel

- `https://learn-x.app/` : HTTP 200.
- `https://learn-x.app/login` : HTTP 200.
- `https://learn-x.app/request-access` : HTTP 200.
- `https://www.learn-x.app/` : une redirection vers l'apex, puis HTTP 200.
- En-têtes vérifiés : CSP restrictive, HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy` et `Permissions-Policy`.

Le domaine Production sert encore la version promue antérieurement ; ces smoke
tests prouvent la santé du domaine, pas que le candidat `dev` y est déjà déployé.

## Sécurité, confidentialité et non-régression

- Les routes publiques n'affichent plus la navigation privée.
- Les routes d'authentification ne dépendent plus d'un fallback PWA obsolète.
- L'API Contacts exige une session administrateur et borne recherche,
  pagination et filtres.
- Les finalités contact, le consentement lancement et la candidature early
  adopter restent distincts.
- Les tests serveur couvrent permissions, progression, activités, publication,
  données privées, tentatives et reprises ; aucune autorité n'a été déplacée
  vers le client.
- Aucun secret ni brouillon local n'entre dans le candidat.
- L'audit des dépendances de production ne remonte aucune vulnérabilité connue.

## Migration et rollback

La migration `20260810160000_add_public_contact_identity` crée l'identité
`PublicContact`, rattache les finalités existantes, puis remplace l'unicité par
`(contactId, purpose)`. Sa répétition sur clone Neon a réussi dans Integration
#95.

Avant promotion Production :

1. créer une sauvegarde/branche Neon au point pré-déploiement ;
2. relever les comptes de contacts, finalités et doublons normalisés ;
3. déployer le candidat et laisser `prisma migrate deploy` appliquer la migration ;
4. vérifier Contact/Leads, authentification, programme, leçon, notes et reprise ;
5. privilégier un roll-forward en cas d'incident ;
6. si un rollback de schéma est indispensable, restaurer le point Neon
   pré-déploiement avec le code antérieur compatible.

Le ticket V3.5-009 n'a exécuté ni seed ni écriture sur une base partagée.

## Validation humaine restant à obtenir

La checklist canonique et ses statuts se trouvent dans
`docs/V3_5_QA_MATRIX.md`, section « Checklist courte de clôture sur le `main`
courant ». Aucun de ces contrôles n’est réputé réussi par le présent rapport.

- Installer puis rouvrir la PWA sur iOS/Android/desktop, y compris depuis une
  ancienne installation et après mise à jour du service worker.
- Vérifier logout/changement de compte et absence de données privées restaurées
  hors ligne.
- Revoir à 320 px, 390 px, desktop et texte/zoom 200 % avec clavier seul et
  VoiceOver réel.
- Après promotion, effectuer un smoke authentifié réel : accueil multi-programme,
  programme/leçon/activité, notes, reprise et administration Contacts.
- Vérifier un cycle réel de demande d'accès, e-mail, vérification et activation
  sans créer de contact de test avant l'autorisation de promotion.

## Addendum de non-régression — 20 août 2026

Une nouvelle passe automatisée a été exécutée dans un worktree isolé sur la
baseline source consolidée
`251c6f7fd26361ffc57504dc06f3fb0d4ed91882`. Elle n'a modifié ni `main`, ni
une base partagée, et n'a exécuté aucun seed. À cet instant, `origin/main`
restait à `b5f50130c0aef611b340b812c875a5a4bc170bfc` ; cet addendum ne prétend donc
pas que la baseline auditée est la version Production.

Résultats **PASSED_AUTOMATED** :

- `pnpm lint`, `pnpm typecheck` et `pnpm build` réussis ; build de production
  avec 124 modules et 26 entrées PWA précachées ;
- `pnpm test` réussi : 166 fichiers et 1044 tests ;
- `pnpm test:e2e` réussi : 66 scénarios et 6 skips prévus, sur Chromium
  desktop/mobile/tablette et WebKit mobile ;
- `pnpm i18n:check` réussi : 800 clés alignées en français et anglais ;
- `pnpm exec prisma validate` réussi ;
- aperçu local du bundle : HTTP 200 pour la landing, la connexion, la demande
  d'accès, `/today`, le manifeste et le service worker ;
- manifeste confirmé avec `start_url=/today` et mode `standalone` ;
- fixtures authentifiées automatisées vertes pour première arrivée,
  V4-016C, programme, leçon, notes, administration, reconnexion et logout ;
- cache privé, reflow 200 %, clavier/focus, axe, reduced motion et largeurs de
  référence couverts sans régression bloquante.

Statut **PENDING_REAL_DEVICE** inchangé :

- installation, fermeture, réouverture et mise à jour PWA sur téléphone réel ;
- changement de compte et absence de restauration privée sur la PWA installée ;
- VoiceOver réel et grande taille de texte système mobile ;
- smoke authentifié sur le commit effectivement promu ;
- cycle e-mail réel de demande d'accès, uniquement après autorisation.

La matrice détaillée, y compris la frontière entre preuve automatisée et preuve
matérielle, se trouve dans `docs/V3_5_QA_MATRIX.md`. Le verdict reste **GO
technique / clôture officielle en attente**, sans fausse validation humaine.

## Procédure de promotion recommandée

1. Faire approuver ce rapport et le rendu humain final.
2. Vérifier que `dev` et sa CI sont toujours verts et que le worktree de merge
   exclut tous les brouillons locaux.
3. Sauvegarder Neon Production.
4. Promouvoir le commit validé vers `main` sans réécriture d'historique.
5. Surveiller le déploiement et l'application de migration.
6. Exécuter immédiatement les smoke publics et authentifiés sur `learn-x.app`.
7. Surveiller erreurs HTTP, authentification, e-mails, contacts et cache PWA.
8. En incident, roll-forward prioritaire ; sinon restauration coordonnée de la
   base et du code au point pré-déploiement.

## Baseline V4

Les travaux V4 hors ligne ou désactivés peuvent consommer le candidat V3.5 en
GO technique. Leur rollout doit néanmoins partir du commit V3.5 effectivement
promu et revalidé par la checklist humaine. V4 ne doit pas supposer disponible
une correction assistée tant que son ticket dédié et son rollout ne sont pas
terminés.

## Fichiers locaux volontairement exclus

Les brouillons utilisateur et travaux parallèles visibles dans le worktree ne
font pas partie de V3.5 : documents Officine, audits, recommandations, backlog
V4, spécifications V3 parallèles et `design.md`. Ils restent hors de tout
staging sélectif.
