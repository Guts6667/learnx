# Rapport de clôture V2 LearnX

Date de l’audit : 4 août 2026

Branche auditée : `dev`

HEAD fonctionnel audité : `981b780` (`feat(notes): add secure note deletion`)

HEAD technique avant rapport : `4a01ccb` (`chore(repo): stop tracking macOS metadata`)

Référence distante au début du rapport : `origin/dev = 4a01ccb`

Production/main observée : `origin/main = 760103d`
Écart technique avant le commit du rapport : 31 commits, 203 fichiers,
65 731 insertions et 5 686 suppressions.

## Synthèse exécutive

**Verdict : NO-GO temporaire. Ne pas merger `dev` vers `main`.**

La release candidate compile, passe les 286 tests unitaires/API et les 20 tests
Playwright de la matrice existante. Le schéma Prisma est valide et la base Neon
configurée annonce les 15 migrations à jour. Les protections de propriété,
l’atomicité de progression, la publication en cascade, le parcours centré sur
la leçon, la navigation responsive et la politique hors ligne ont des preuves
locales solides.

La clôture officielle reste bloquée par quatre éléments :

1. le workflow GitHub `Integration` échoue avant migration et tests, à l’étape
   de création d’une branche Neon, avec `Input required and not supplied:
   api_key` ;
2. V2-012 est partiel : aucune suite axe automatisée et aucune preuve complète
   de zoom 200 %, tailles système iOS et revue manuelle VoiceOver ;
3. la limitation des connexions est en mémoire dans une architecture Vercel
   serverless et ne constitue pas une limite globale durable ;
4. `POST /api/auth/register` reste public, crée immédiatement utilisateur et
   session, effectue un hash coûteux et n’a pas de limitation dédiée.

Les points 3 et 4 sont classés P1 sécurité/disponibilité. Ils demandent une
décision produit et un correctif autonome testé. Ils ne sont pas corrigés
silencieusement pendant cette revue.

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

### V2-003 — Progression exacte et atomique : terminé localement

Preuves : `ae139b7`, transaction sérialisable et recalcul hiérarchique dans
`src/server/api/_lib/progress-recalculation.ts`, tests de concurrence et
idempotence. La couverture ciblée de `src/server/api/progress/app.ts` est de
98,02 % des instructions et 96,15 % des branches, au-dessus du seuil demandé.

Limite : la validation contre une vraie branche Neon est bloquée par la CI.

### V2-004 — Intégration backend réelle : partiel, bloquant

Preuves livrées : `0a1d3bb`, serveur d’intégration, fixtures multi-utilisateurs,
Playwright Chromium/WebKit, garde-fou de base éphémère et workflow créant puis
supprimant une branche Neon.

Échec réel : les runs GitHub des HEAD `981b780` et `4a01ccb` s’arrêtent à
`Create isolated Neon branch`. L’annotation exacte est `Input required and not
supplied: api_key`. Migration, Functions et tests d’intégration sont sautés.
Localement, `pnpm test:integration` refuse correctement toute écriture sans
`LEARNX_INTEGRATION_DATABASE=ephemeral`, `NEON_BRANCH_ID` et identifiant de run.

Conclusion : l’infrastructure existe, mais le critère « pipeline réel » n’est
pas prouvé sur la release candidate.

### V2-005 — Publication en cascade : terminé localement

Preuves : `2cecc1e`, aperçu signé, rejet des plans obsolètes, transaction,
rollback, idempotence, autorisation admin + propriétaire et tests dans
`api/admin/publication-*.test.ts`. La validation scientifique n’est jamais un
gate de publication.

Limite : scénario réel Neon non exécuté à cause de V2-004.

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

### V2-008 — Design system et responsive : partiel

Preuves : `01ce8d6`, `UI_SYSTEM_SPEC.md`, composants partagés, SafeMarkdown,
tests XSS/liens, évaluations longues structurées, safe areas et tests
320/390/768/desktop.

Manques : aucune preuve axe, zoom 200 %, taille système iOS ou session manuelle
VoiceOver. Les exigences de rendu et clavier sont prouvées; la conformité
accessibilité complète ne l’est pas.

### V2-008A — Navigation pédagogique et reprise de module : terminé localement

Preuves : `dc4e31b`, `cc7b6b1`, `219f41c`, migration `ModuleRun`, bornes de
tentatives, confirmation détaillée, conservation des notes, transaction,
idempotence et tests d’autorisation/concurrence. Sommaire mono-colonne testé en
390 et 320 px ainsi que WebKit.

Limite : scénario réel sur Neon non exécuté à cause de V2-004.

### V2-008B — Activités canoniques : terminé localement

Preuves : `bdf3ad2`, `b0f8848`, `3d21853`, clé éditoriale stable,
`isCanonical`, `TaskResource`, migration/backfill, routage passif/productif,
pruning idempotent et tests seed/progression. Les ressources restent visibles
mais ne sont plus des activités linéaires.

### V2-009 — Liens et actions : terminé

Preuves : `49fc165`, composants `Button`/`NavigationAction`, tests sémantiques
et correctifs profil/leçon. Les mutations restent des boutons et les appels à
l’action de navigation des liens explicites.

### V2-010 — Navigation principale : partiel

Preuves : `214721b`, cinq destinations, icônes décoratives masquées aux aides,
`aria-current`, cibles tactiles, état actif non fondé sur le soulignement,
tests clavier et responsive 320/390/desktop/WebKit.

Manques : annonce VoiceOver et zoom/tailles système non vérifiés manuellement.

### V2-011 — Politique hors ligne : terminé

Preuves : `941c51c`, source réseau centralisée, requêtes privées en mode
`networkMode: always`, erreur immédiate hors ligne, route conservée, session
revérifiée, retry explicite, purge QueryClient/localStorage/sessionStorage au
login/logout et tests changement de compte. Le scénario offline/reconnect passe
sur Chromium et WebKit.

### V2-012 — Accessibilité et matrice mobile : partiel, bloquant

- Chromium desktop/mobile, tablette et WebKit/iPhone : **prouvé**, 20/20 tests.
- 320/390 px et absence de débordement : **prouvé** dans les tests du parcours,
  du sommaire, de l’admin et de la navigation.
- Clavier/focus : **largement prouvé** pour navigation, tiroirs, onglets et
  résultats d’évaluation.
- Réduction des animations : **implémentée** via
  `prefers-reduced-motion: reduce`, sans scénario navigateur dédié.
- Annonces d’erreurs/états : **partiellement prouvées** par les rôles ARIA,
  `aria-live`, tests composants et focus vers les résultats.
- Axe sérieux/critique : **non prouvé**, aucune dépendance ni exécution axe.
- Zoom 200 % et texte agrandi : **non prouvés**.
- Checklist manuelle VoiceOver : **non produite**.

Conclusion : le ticket est PARTIEL, pas non implémenté. Ses manques explicites
restent nécessaires à la porte de sortie V2.

## Matrice de commandes

| Commande | Résultat |
| --- | --- |
| `pnpm lint` | succès |
| `pnpm typecheck` | succès |
| `pnpm test` | succès, 56 fichiers et 286 tests |
| `pnpm build` | succès, bundle JS 165,38 kB / 48,12 kB gzip |
| `pnpm test:e2e` | succès, 20 tests sur 4 projets |
| test offline ciblé Chromium/WebKit | succès, 2/2 |
| couverture progression ciblée | succès; `progress/app.ts` 96,15 % branches |
| `pnpm prisma:generate` | succès, Prisma Client 7.9.1 |
| `pnpm exec prisma validate` | succès |
| `pnpm exec prisma migrate status` | succès; 15 migrations, base à jour |
| `pnpm test:integration` | bloqué volontairement sans base éphémère |
| GitHub `Integration` | échec; `NEON_API_KEY` absent |
| `pnpm deployment:check -- https://learnx-eight.vercel.app` | succès anonyme |
| `pnpm audit --prod` | 1 vulnérabilité modérée Hono |
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

Non testés réellement : parcours authentifié de production (absence des secrets
du compte de test), VoiceOver matériel, zoom 200 %, tailles de police système
iOS, axe, vraie branche Neon d’intégration.

## Revue sécurité

### P0

Aucun P0 confirmé dans le code et les tests audités.

### P1 — bloqueurs

1. **Rate limit de login non durable.**
   `InMemoryLoginRateLimiter` stocke les échecs dans le processus. Sur Vercel,
   plusieurs instances et cold starts permettent de contourner la limite.
   Recommandation : limite atomique partagée (base/Redis/service de bord), clé
   de client fiable, expiration et tests multi-instance.
2. **Inscription publique non limitée.**
   `POST /api/auth/register` crée immédiatement `User` + `Session` et exécute
   Argon2 sans limite dédiée. Risques : création massive de comptes, CPU et
   stockage. Décider avant merge si l’inscription V2 doit être désactivée en
   production ou protégée durablement; V3 prévoit un workflow d’accès distinct.
3. **Pipeline réel non exécutable.**
   Le secret `NEON_API_KEY` manque; les tests multi-utilisateurs réels et de
   migration ne s’exécutent pas. Ce défaut de contrôle bloque la preuve de
   non-régression sécurité/IDOR.

### P2 — dette à planifier

- `hono` installé est inférieur à 4.12.34 et `pnpm audit --prod` signale
  GHSA-8j4g-w8fx-2239 (ReDoS du middleware CORS). LearnX n’importe pas ce
  middleware, mais une mise à jour patch doit être faite avant ou juste après
  merge avec tests complets.
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
| P1 | V2-012 partiel | ticket accessibilité dédié, axe + revue manuelle | avant merge |
| P1 | CI Neon sans secret | configurer secret/variable et obtenir un run vert | avant merge |
| P1 | auth rate limit/registration | décision puis correctif serveur autonome | avant merge |
| P2 | Hono modéré | mise à jour patch et matrice complète | avant merge si possible |
| P2 | listes non bornées | pagination stable et limites serveur | V3 |
| P2 | écriture session à chaque lecture | throttle mesuré | V3 |
| P2 | V2-008A historique divergent | aligner backlog/spec sur décisions finales | clôture docs |
| P3 | rapports Playwright locaux ignorés | aucune action | accepté |

## Commits candidats au merge

La plage candidate est `760103d..4a01ccb`, soit 31 commits. Elle comprend le
cadrage V2, V2-001 à V2-011, les migrations V2-008A/B, les contenus des étapes
5 à 13, les correctifs UX, la suppression de note et le retrait de `.DS_Store`.
La liste exacte est obtenue par :

```bash
git log --reverse --oneline origin/main..origin/dev
```

Cette plage ne doit pas être mergée tant que les P1 et V2-012 ne sont pas
traités et que le pipeline réel n’est pas vert.

## Procédure de sortie NO-GO

1. Configurer `NEON_API_KEY` et `NEON_PROJECT_ID` pour GitHub Actions, puis
   obtenir un run `Integration` vert sur le HEAD de `dev`.
2. Valider et implémenter un petit ticket V2-012 : axe sur les vues critiques,
   zoom 200 %/texte agrandi et checklist VoiceOver documentée.
3. Arbitrer l’inscription V2 et le rate limit serverless, puis livrer un
   correctif autonome avec tests multi-instance/abus.
4. Mettre Hono à jour vers une version corrigée et rejouer la matrice.
5. Rejouer lint, typecheck, tests, build, E2E, intégration réelle, Prisma et
   smoke de déploiement preview.
6. Mettre à jour ce rapport avec un verdict GO et demander explicitement
   l’autorisation de merger `dev` vers `main`.

## Procédure de merge après GO

1. Vérifier `origin/main` et `origin/dev`, sans réécriture d’historique.
2. Créer une sauvegarde/restauration Neon vérifiable avant migrations/seed.
3. Merger `dev` dans `main`, pousser puis surveiller build et migrations.
4. Exécuter le smoke authentifié : auth, programme, leçon, quiz, exercice,
   notes, admin et publication.
5. Vérifier les en-têtes `private, no-store`, le nouveau service worker et la
   purge du cache historique sur un appareil déjà installé.
6. Vérifier mobile réel 390 px/iPhone et desktop.

## Rollback

- Code : redéployer le dernier commit `main` stable `760103d` ou effectuer un
  revert explicite du merge; ne jamais réécrire `main`.
- Base : les migrations sont additives/backfillées; restaurer la branche ou le
  point de restauration Neon préparé avant déploiement si un invariant échoue.
- Contenu : ne pas relancer le seed de production tant que la sauvegarde et les
  comptes attendus ne sont pas vérifiés.
- Après rollback : invalider le service worker défectueux si nécessaire,
  revérifier session/logout, progression, notes et admin, puis documenter
  l’incident avant toute nouvelle tentative.

## Décision requise

La V2 n’est pas officiellement close. Attendre une validation explicite pour :

- ouvrir les correctifs V2-012 et authentification ;
- configurer les secrets CI ;
- puis, uniquement après un rapport GO mis à jour, merger vers `main`.
