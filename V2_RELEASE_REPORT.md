# Rapport de clôture V2 LearnX

Date de l’audit : 4 août 2026

Branche auditée : `dev`

HEAD audité : `b378611` (`fix(release): close V2 security and accessibility blockers`)

Référence distante : `origin/dev = b378611`

Production/main observée : `origin/main = 760103d`
Écart observé : `dev` possède 39 commits propres et `main` un commit propre ;
le diff de la base commune vers `dev` couvre 211 fichiers, 70 526 insertions et
4 797 suppressions.

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

Le GO autorise la préparation du merge ; il ne constitue pas encore le merge ni
la clôture de production. `main` possède un commit propre relatif à l'étape 5 :
la résolution doit être inspectée sans réécriture d'historique, puis le merge
reste soumis à l'autorisation explicite du propriétaire.

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
| migration réelle | succès; 16 migrations sur branche Neon éphémère |
| `pnpm test:integration` local | bloqué volontairement sans base éphémère |
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

## Commits candidats au merge

La plage candidate comprend les 39 commits propres à `dev` jusqu'à `b378611`. Elle comprend le
cadrage V2, V2-001 à V2-011, les migrations V2-008A/B, les contenus des étapes
5 à 13, les correctifs UX, la suppression de note et le retrait de `.DS_Store`.
La liste exacte est obtenue par :

```bash
git log --reverse --oneline origin/main..origin/dev
```

`main` possède en parallèle le commit propre `760103d`; le merge doit donc être
préparé depuis les références distantes et le contenu étape 5 vérifié pour
éviter tout doublon. Aucun P0/P1 connu ne bloque cette préparation.

## Porte de sortie GO

Les contrôles locaux, la matrice navigateur, l'audit de dépendances et
`Integration` #22 sont verts. La prochaine action autorisée est la préparation
non destructive du merge, suivie du merge uniquement après confirmation
explicite du propriétaire.

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

La V2 est techniquement prête. Attendre la validation explicite pour merger
`dev` vers `main`, surveiller le déploiement/migrations, effectuer les smoke
tests post-merge, puis marquer officiellement la V2 close.
