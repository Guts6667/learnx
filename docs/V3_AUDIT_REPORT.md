# Rapport d’audit V3 — sécurité, dette et exploitation

## Cadre

- Ticket : `V3-028`.
- Date : 9 août 2026.
- Branche auditée : `dev`.
- Commit audité : `46caf0b80f11f44adacbc24f10742d04b2690e9f`.
- Écart au moment de l’audit : `origin/dev` contient 10 commits de plus que
  `origin/main`; `origin/main` et `origin/staging` pointent sur `221e34f`.
- Verdict : **NO-GO pour clôturer ou promouvoir la V3 tant que F-001 n’est pas
  corrigé et vérifié**. Aucun P0 n’a été identifié. Aucun correctif produit,
  changement Prisma, migration ou écriture sur la base partagée n’est inclus
  dans cet audit.

Les fichiers locaux hors ticket (`BACKLOG_V3.md`,
`LEARNING_FLOW_V3_SPEC.md`, audits, brouillons Officine et autres fichiers non
suivis) ont été laissés intacts et sont exclus du commit de ce rapport.

## Méthode et preuves

### Analyse statique

- Inventaire des routes Hono et de leurs middlewares d’authentification et de
  capacité.
- Revue des filtres `ownerId`, `userId`, enrollments, publication et preview.
- Revue des sessions, mots de passe, tokens de vérification/invitation,
  limitation de débit, e-mails, audit log et concurrence.
- Revue du cache PWA, du Markdown, des URL externes, de CORS/CSRF, des erreurs,
  secrets suivis, listes non bornées et scripts d’exploitation.
- Revue de `prisma/schema.prisma`, des 28 migrations et du workflow Integration.
- Recherche des API dangereuses (`innerHTML`, `eval`, SQL raw non paramétré) :
  aucune occurrence applicative trouvée.
- Recherche de secrets suivis : seulement des valeurs factices dans
  `.env.example`, `prisma.config.ts` et les tests de connexion.

### Analyse dynamique isolée

Le workflow GitHub Integration n°76 a exécuté le commit exact audité sur une
branche Neon éphémère : génération Prisma, 28 migrations, vraies Functions,
deux comptes isolés, Chromium desktop, Chromium mobile et WebKit mobile. Il a
ensuite exécuté deux fois les seeds ciblés Platform APM et pilote anglais, puis
supprimé la branche Neon. Toutes les étapes ont réussi :

- run : <https://github.com/Guts6667/learnx/actions/runs/31326071105> ;
- job `real-functions` : succès, du 9 août 2026 17:18 UTC à 17:34 UTC ;
- isolation vérifiée : propriétaire contre utilisateur tiers, accès admin
  refusé au rôle Créateur, notes/tentatives/progression privées, retrait d’une
  inscription, quiz et mini-évaluations sans réponse révélée avant soumission ;
- publication idempotente et audit log vérifiés ;
- seeds ciblés idempotents et branche de test supprimée.

La matrice E2E locale ajoute 40 scénarios réussis sur Chromium desktop,
Chromium 390 px, Chromium tablette et WebKit mobile : auth, reprise, catalogue,
accordéon programme, navigation profonde sans boucle, sommaire, notes,
administration, texte agrandi et réduction des animations.

### Production et configuration

- `https://learnx-eight.vercel.app` répond en Production Vercel ; l’API session
  répond `200`, supprime le cookie invalide et envoie
  `Cache-Control: private, no-store`.
- `https://learn-x.app` sert actuellement un site GoDaddy, et non LearnX ;
  `/api/auth/session` y répond `404`.
- La Production Vercel ne contient que trois variables applicatives :
  `ADMIN_EMAIL`, `DATABASE_URL`, `DIRECT_URL`. Aucune valeur sensible n’a été
  affichée dans l’audit.
- La base configurée localement a été interrogée en lecture seule : les 28
  migrations sont appliquées. Aucun seed ni déploiement n’a été lancé.

## Matrice des contrôles d’accès

| Surface | Contrôle serveur observé | Preuve dynamique | Résultat |
| --- | --- | --- | --- |
| Auth/session | Argon2id, token aléatoire 256 bits haché, cookie HttpOnly/Secure/SameSite=Lax, compte ACTIVE | reconnexion, logout et reprise E2E | conforme |
| Demande d’accès | réponse anti-énumération, limites IP/e-mail partagées, tokens hachés et one-shot | concurrence de 4 requêtes, une seule demande | conforme hors configuration F-001 |
| Admin/RBAC | `requireUser` puis capacités ; Créateur sans `/admin` | preview admin refusée en 403 | conforme |
| Programmes privés | propriétaire en preview ; apprenant par enrollment actif ; catalogue public uniquement | tiers 404 avant enrollment, accès après enrollment, 404 après retrait | conforme |
| Notes | toutes les opérations filtrées par `userId` | note propriétaire invisible au tiers | conforme |
| Progression/tentatives | `userId`, programme accessible, module run courant, transaction sérialisable | écritures tierces refusées, tentatives séparées | conforme |
| Quiz/mini-évaluations | réponses et explications retirées avant soumission | payload inspecté avant tentative | conforme |
| Publication | capacité, preview, plan signé, transaction et idempotence | double apply produit un seul audit event | conforme |
| Markdown/liens | parser sans HTML arbitraire ; HTTP(S) uniquement ; noopener/noreferrer | tests SafeMarkdown et E2E | conforme |
| PWA/cache privé | aucun `/api` précaché, purge des clés privées au changement de session | revue config/tests logout | conforme |

## Findings

### F-001 — P1 — Onboarding Production bloqué sans e-mail vérifiable

**Remédiation V3-029.** Le serveur est désormais fail-closed : les demandes
d'accès sont désactivées par défaut en Production et une activation avec une
configuration e-mail absente ou incomplète répond `503` avant toute écriture.
La levée opérationnelle du finding exige encore de configurer les variables
Production, redéployer et réussir le cycle e-mail complet.

**Preuve.** Les demandes d’accès sont activées par défaut. Quand
`LEARNX_EMAIL_VERIFICATION_ENABLED` n’est pas `true`, l’API crée une demande
`PENDING_EMAIL` sans e-mail. La liste admin ne retourne que les demandes dont
`emailVerifiedAt` est renseigné. La Production Vercel ne possède ni `APP_URL`,
ni `LEARNX_EMAIL_VERIFICATION_ENABLED`, ni `RESEND_API_KEY`, ni
`LEARNX_EMAIL_FROM`. L’appelant reçoit néanmoins `202`.

**Impact.** Un nouveau demandeur croit sa demande transmise, mais ne peut ni
vérifier son adresse ni apparaître dans la file d’approbation. Le cycle d’accès
V3 est donc inutilisable en Production.

**Reproduction sûre.** Comparer les noms des variables Vercel Production avec
`createDefaultDependencies()` dans `access-request.ts`, puis suivre le chemin
sans `emailVerification` jusqu’à `PENDING_EMAIL` et le filtre admin
`emailVerifiedAt: { not: null }`. Aucune demande réelle n’a été créée pendant
l’audit.

**Propriétaire/destination.** Rayan pour la configuration Resend/Vercel et
V3-029 pour rendre l’application fail-closed ou observable en cas de
configuration incomplète. Après correction : test réel de demande, e-mail,
vérification, approbation, invitation et activation sur un environnement
isolé.

### F-002 — P2 — Domaine `learn-x.app` non relié à LearnX

**Preuve.** La racine répond avec `Server: DPS` et des assets GoDaddy ; la route
API LearnX répond 404. Le domaine Vercel historique fonctionne.

**Impact.** Le domaine acheté ne peut pas encore servir l’application ni ses
deep links. Il ne doit pas être utilisé comme `APP_URL` avant correction DNS et
validation Vercel.

**Propriétaire/destination.** Rayan/Vercel-GoDaddy, V3-029 pour le contrôle
pré-déploiement. Vérifier DNS, certificat, `/api/auth/session`, deep links et
liens d’e-mail avant bascule.

### F-003 — P2 — En-têtes de durcissement incomplets sur Vercel

**Preuve.** Les réponses Vercel observées ont HSTS, mais aucune politique CSP,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ou politique
explicite anti-framing. L’API n’ajoute actuellement que le contrôle de cache.

**Impact.** Aucune exploitation XSS n’a été trouvée : Preact échappe les textes
et `SafeMarkdown` n’accepte pas le HTML. Néanmoins, la défense en profondeur
contre injection, framing et fuite de référent reste inférieure à la baseline
attendue.

**Propriétaire/destination.** V3-029 si la politique est requise avant sortie,
sinon V3-030. Ajouter des en-têtes compatibles PWA/Vercel et des tests HTTP.

### F-004 — P2 — Advisory élevé dans la chaîne de build

**Preuve.** `pnpm audit --prod` : 0 vulnérabilité sur 159 dépendances runtime.
L’audit complet trouve `GHSA-2v37-7h3g-55p8` sur `nanoid@3.3.16`, transitif de
`vite > postcss`, corrigé à partir de 3.3.17. Le projet n’importe ni
`customAlphabet` ni `customRandom` et le paquet est limité au build/test.

**Impact.** Le CVSS amont concerne une boucle infinie avec taille zéro contrôlée
par l’attaquant. Aucun chemin exploitable dans le runtime LearnX n’a été trouvé,
d’où P2 malgré la sévérité `high` du registre.

**Propriétaire/destination.** V3-030 : mise à jour du lockfile/outil puis matrice
complète.

### F-005 — P2 — Lectures non bornées sur données personnelles croissantes

**Preuve.** Les listes de notes, révisions en attente, tentatives de quiz et de
mini-évaluations ne possèdent ni pagination ni limite. `Aujourd’hui` charge
toutes les leçons publiées accessibles et agrège plusieurs relations. Le
catalogue et les écrans admin, eux, sont paginés.

**Impact.** Avec plusieurs programmes, tentatives et notes, latence, mémoire et
taille des réponses augmentent sans borne. Aucun incident actuel n’a été mesuré.

**Propriétaire/destination.** V3-031 : métriques p95/taille, pagination par
curseur, limites explicites et budgets de requêtes avant optimisation.

### F-006 — P2 — Amplification des écritures de session

**Preuve.** Chaque requête authentifiée exécute `touchSession` et met à jour
`lastUsedAt`, y compris les lectures.

**Impact.** Charge d’écriture et contention inutiles sur Postgres en trafic
multi-utilisateur ; aucun seuil n’est défini.

**Propriétaire/destination.** V3-031 : mesurer puis appliquer un touch borné
dans le temps ou une autre stratégie conservant la suspension/révocation.

### F-007 — P2 — Rétention et observabilité d’exploitation incomplètes

**Preuve.** Aucun job de purge n’a été trouvé pour les sessions expirées, les
buckets de rate limit expirés et les anciens tokens d’e-mail/invitation. Les
erreurs serveur sont normalisées côté client, mais les logs sont ponctuels et
sans identifiant de corrélation, métriques ni alertes définies dans le dépôt.
Le script de recalcul charge tous les `LessonProgress` ciblés en mémoire et les
traite séquentiellement.

**Impact.** Croissance silencieuse des tables techniques, diagnostic plus lent
et opérations globales coûteuses.

**Propriétaire/destination.** V3-030 pour la politique de rétention et le
cleanup prouvé ; V3-031 pour pagination du recalcul, métriques, traces et
alertes.

## Points sans finding bloquant

- Aucun secret réel suivi par Git n’a été détecté.
- Aucun SQL `Unsafe`, `eval`, `new Function`, `innerHTML` applicatif ou rendu
  HTML Markdown arbitraire n’a été détecté.
- Les tokens session/vérification/invitation sont aléatoires, hachés et les
  transitions sensibles utilisent transactions, verrous ou compare-and-swap.
- La suspension révoque les sessions et refuse l’auto-suspension admin.
- Les erreurs d’authentification et de demande d’accès évitent l’énumération.
- L’absence de CORS permissif et `SameSite=Lax` réduisent le risque CSRF sur les
  mutations JSON same-origin ; aucun endpoint de mutation GET n’a été trouvé.
- Les API privées envoient `private, no-store` et le service worker exclut
  `/api` du fallback/précache.

## Limites de l’audit

- Aucun pentest externe, fuzzing, scan DAST authentifié de Production ni test
  de charge n’a été effectué.
- Resend n’a pas été appelé : la délivrabilité, SPF/DKIM/DMARC, bounces et
  webhooks ne sont pas couverts.
- Les permissions de branche GitHub, règles de protection, accès aux secrets
  Neon/Vercel et restauration point-in-time n’ont pas été audités.
- La Production a été testée sans session utilisateur ; les parcours
  authentifiés réels sont prouvés sur le clone Neon CI et par les E2E locaux.
- VoiceOver réel sur appareil et lecteurs d’écran desktop n’ont pas été rejoués
  dans ce ticket.
- Les brouillons pédagogiques locaux et les documents parallèles ne font pas
  partie du périmètre.

## Gate vers les tickets suivants

1. **V3-029 — obligatoire avant clôture :** corriger F-001 et décider le
   traitement de F-003 ; configurer/tester le domaine seulement après F-002.
2. **V3-030 :** corriger F-004, définir la rétention de F-007 et supprimer la
   dette prouvée sans refonte fonctionnelle.
3. **V3-031 :** mesurer puis traiter F-005, F-006 et l’observabilité de F-007.
4. **V3-032 :** rejouer la migration et les scénarios multi-utilisateurs sur un
   clone Neon avec la configuration e-mail substituée par un provider de test.
5. **V3-033 :** promouvoir seulement après zéro P0/P1 ouvert, backup vérifié,
   smoke authentifié et plan de rollback testé.

## Commandes et résultats

| Commande/contrôle | Résultat |
| --- | --- |
| `pnpm prisma:generate` | succès |
| `pnpm exec prisma validate` | succès |
| `pnpm exec prisma migrate status` | 28 migrations, base configurée à jour, lecture seule |
| `pnpm audit --prod --json` | 0 vulnérabilité, 159 dépendances |
| `pnpm audit --json` | 1 advisory high de build, F-004 |
| `pnpm i18n:check` | succès, 637 clés alignées en français et anglais |
| `pnpm test:e2e` | 40/40 scénarios réussis |
| `pnpm lint` | succès |
| `pnpm typecheck` | succès |
| `pnpm test` | 93 fichiers, 512 tests réussis |
| `pnpm build` | succès, PWA générée, 14 entrées précachées |
| GitHub Integration n°76 | succès complet sur clone Neon, branche supprimée |
| `git diff --check` | succès avant et après rédaction du rapport |
