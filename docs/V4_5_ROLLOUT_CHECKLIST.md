# V4.5 — Checklist de mise en production

> État au 31 août 2026, 12 h. Chaque ligne porte **son état réellement
> vérifié**, la preuve, et qui doit agir. Ce qui n'a pas pu être vérifié est
> marqué comme tel plutôt que supposé fait.
>
> Les états des variables Vercel viennent de `vercel env ls --project learnx`,
> qui liste les noms, les environnements et l'âge — jamais les valeurs, qui sont
> `Secret` et illisibles par construction. Ce document ne contient donc aucune
> valeur, et ne doit jamais en contenir.
>
> Les §9 à §11 ont été ajoutés le 31 août : le pré-vol de la promotion, la
> procédure `dev` → `staging` → `main` pas à pas, et les vérifications qui ne
> peuvent être faites que par Rayan, chacune avec son écran. Deux d'entre elles
> sont nouvelles et bloquantes, et n'étaient dans aucune version précédente de
> ce document.

## 1. Variables d'environnement Vercel

| Variable | Production | Preview | État | Qui |
|---|---|---|---|---|
| `SENTRY_DSN` | ✅ posée | ✅ posée | **fait** | — |
| `VITE_SENTRY_DSN` | ✅ posée | ✅ posée | **fait** | — |
| `APP_URL` | ✅ posée | ✅ posée | **fait** | — |
| `LEARNX_PUBLIC_LEADS_ENABLED` | ✅ posée, valeur non vérifiable | **absente → collecte fermée** | **à poser sur Preview** | Rayan |
| `LEARNX_PAYMENTS_ENABLED` | absente | ✅ posée | **état voulu** | ne rien faire |
| `STRIPE_LIVE_*` | absentes | absentes | **état voulu** | après GO packs |
| `DATABASE_URL` / `DIRECT_URL` | ✅ posées, 28 jours | ✅ posées | **décision propriétaire : pas de rotation** | ne rien faire, §2 |

### Les deux drapeaux s'ouvrent par décision, jamais par défaut

Depuis #156 (V4.5-178, fusionnée le 31 août à 01 h), les deux lisent
`=== 'true'`. **Une variable absente signifie fermé**, dans les deux cas.

- `payments-configuration.ts` : absente → paiements éteints. C'est l'état voulu
  en production jusqu'au GO packs, et il s'obtient en ne posant **rien**.
- `public-leads/configuration.ts` : absente → collecte fermée. Auparavant ce
  code refusait la seule chaîne exacte `false`, si bien que l'absence — comme
  `FALSE`, `0`, `no`, ou une valeur avec une espace — valait *activé*. La
  collecte d'adresses e-mail sur la page publique était donc ouverte parce que
  personne ne l'avait fermée. Une fonctionnalité qui touche aux données
  personnelles d'inconnus s'ouvre par une décision, pas par l'absence de
  décision.

**Ce que cela impose avant la promotion.** `LEARNX_PUBLIC_LEADS_ENABLED` est
posée en Production mais **absente de Preview** : la collecte y est donc fermée.
À poser sur Preview si l'on veut pouvoir l'y tester.

**Et une vérification qui ne peut pas se faire d'ici.** La variable est
`Secret` : `vercel env ls` en donne le nom et l'environnement, jamais la valeur.
Sa seule présence en Production ne prouve donc rien — il faut qu'elle vaille
**exactement** `true`. `True`, `TRUE`, `1` ou `true ` avec une espace ferment la
collecte aussi sûrement que son absence. Seul Rayan peut le confirmer, depuis le
dashboard.

Le service exige en outre `RESEND_API_KEY`, `APP_URL` et `LEARNX_EMAIL_FROM` :
les trois sont présentes dans les deux environnements.

> Note de méthode, parce que l'erreur est instructive. Ce document a affirmé
> que les deux drapeaux avaient des défauts **opposés**. C'était faux au moment
> où je l'ai écrit : #156 était déjà fusionnée, et le fichier corrigé était déjà
> dans le répertoire de travail d'où j'écrivais. J'avais lu la sémantique du
> drapeau dans un **autre** worktree, plus ancien, puis rédigé ici sans relire.
> Une constatation ne voyage pas d'un worktree à l'autre : elle se relit là où
> on écrit, au moment où on écrit.

## 2. Rotation des identifiants Neon — **décision propriétaire : abandonnée**

Rayan a décidé le **31 août 2026 à 02 h 50** de ne pas tourner les identifiants
de production. Les identifiants actuels sont conservés. Cette ligne n'est donc
plus une action ouverte, et ne doit pas être réinscrite comme telle à la
prochaine relecture.

Ce que la décision suppose, écrit ici pour qu'elle reste révisable sur des faits
plutôt que sur un souvenir : aucune fuite des chaînes de connexion de production
n'a été constatée. L'incident du 30 août était une erreur de ciblage — un
`DIRECT_URL` de fichier qui l'emportait sur la ligne de commande — et non une
divulgation. La fuite du 30 août au soir concernait le mot de passe du compte de
test `preview-test@learn-x.app`, déjà tourné, et jamais la base de production.

Si l'une de ces deux suppositions cesse d'être vraie, la décision doit être
reprise, et la procédure est celle-ci, dans cet ordre exact :

1. créer un **nouveau rôle** dans Neon, sans toucher à l'ancien ;
2. poser ses chaînes dans Vercel Production (`DATABASE_URL` poolée,
   `DIRECT_URL` directe — *le même endpoint sous ses deux noms*, voir §6) ;
3. redéployer la production et vérifier `/api/health` ;
4. **seulement ensuite**, réinitialiser l'ancien rôle.

L'ordre est ce qui compte : réinitialiser d'abord couperait la production entre
la révocation et le redéploiement.

### Conséquence à traiter : un fichier qui décrit un rôle inexistant

`~/.config/learnx/vercel-values.txt` contient, sous son en-tête PRODUCTION, les
chaînes du **nouveau** rôle préparé pour cette rotation. Ce rôle n'a jamais été
créé dans Neon — une tentative de lecture le 30 août a répondu
`28P01 password authentication failed`.

La rotation étant abandonnée, ces lignes décrivent désormais un rôle qui
n'existera jamais, à côté d'un en-tête qui dit « PRODUCTION ». C'est exactement
la forme d'ambiguïté qui a vidé la base : un fichier qui a l'air de nommer la
production. **À supprimer ou à annoter** (Rayan), pour que personne — humain ou
agent — ne les prenne un jour pour les identifiants en service.

## 3. `staging` — poussée, déploiement **non prouvé**

`staging` est à `79420cb6`, fast-forward propre depuis `dev` (zéro commit
unique, aucune suppression de branche, aucun `--force`).

Aucun déploiement `staging` n'a été observé, et **c'est le comportement
attendu** : depuis le 30 août au soir, la règle de build ne regarde plus le nom
de la branche. Un déploiement n'a lieu que si le message de commit porte le
marqueur, ou si le déploiement est une production. Mon message de promotion n'en
portait pas.

**Ce qu'il faut pour le prouver, depuis le dashboard** (Rayan) :

1. Vercel → projet `learnx` → onglet **Deployments** → filtre **Branch =
   staging** ;
2. si la liste est vide : aucun déploiement n'a jamais été produit pour cette
   branche, ce qui confirme l'explication ci-dessus ;
3. pour en obtenir un, refaire la promotion avec le marqueur dans le message de
   commit, ou déclencher un **Redeploy** depuis le dashboard sur le commit
   `79420cb6` en choisissant la branche `staging` ;
4. une fois `Ready`, ouvrir `/api/health` sur l'URL du déploiement et relever le
   champ commit. L'URL `learnx-git-staging-*` répond `AUTHENTICATION_REQUIRED`
   depuis l'extérieur : il faut passer par le dashboard, ou désactiver la
   protection de déploiement le temps du contrôle.

Tant que ce relevé n'est pas fait, **considérer que `staging` n'est pas servie**.

## 4. Checks requis sur `main` — contournement encore actif

Relevé aujourd'hui sur la protection de `main` :

```
V4.1 final (required), Visual baselines (required), real-functions
```

`real-functions` est le **contournement temporaire** posé quand le renommage du
job d'Integration n'était parti que sur `dev`, laissant `main` exiger un contexte
qu'il ne pouvait pas produire. Il est toujours là.

**À remplacer par `Integration (required)` avant d'ouvrir la PR de
promotion** — et non « à la promotion », comme cette ligne l'a d'abord dit. Une
pull request exécute les workflows de sa branche **source** : la PR
`staging` → `main` produira donc le nouveau nom et jamais l'ancien, et resterait
bloquée indéfiniment sur un contexte que plus rien ne rapporte. Le
raisonnement complet, et pourquoi le faire tôt ne coûte rien, sont au §9.2.

## 5. La promotion `dev` → `main` porte quatre choses ensemble

Elles sont indissociables ; en promouvoir une partie casse la production.

1. le garde `prisma.config.ts` (V4.5-192) ;
2. son correctif d'identité d'endpoint (#131) — **le garde seul casse le build
   de production** ;
3. le renommage du job d'Integration, qui permet de restaurer le check requis ;
4. `neon-cleanup.yml` **et** `scheduled.yml` — voir §6.

## 6. Deux workflows n'ont jamais tourné

`neon-cleanup.yml` (balayage `ci-*`, V4.5-171) et `scheduled.yml` (smoke
post-déploiement, V4.5-173) vivent sur `dev`. **`main` ne les a jamais vus.**

Or un workflow planifié ne s'enregistre **que depuis la branche par défaut**.
Ils n'ont donc jamais été exécutés une seule fois, et ne le seront pas tant
qu'une promotion ne les aura pas portés sur `main`.

C'est le piège qui a déjà coûté deux fois : un workflow présent dans le dépôt
n'est pas un workflow actif.

En attendant, l'attente de capacité ajoutée à `integration.yml` (V4.5-201)
balaie elle-même les branches `ci-*` orphelines, précisément pour ne pas
dépendre d'un workflow que personne n'a enregistré.

## 7. Règle de build — vérifiée dans un journal réel

Aucune branche ne construit d'elle-même. Un build a lieu si le déploiement est
une production, ou si le message de commit porte le marqueur de déploiement.
Relevé le 30 août dans le journal d'un build réel, pas sur parole.

Conséquence pour la promotion : **c'est la personne qui fusionne qui met le
marqueur**, au moment où elle décide que le résultat doit être servi.

## 8. Ce qui reste ouvert, par propriétaire

**Rayan**

- [x] rotation des identifiants Neon — **abandonnée**, décision du 31 août 02 h 50 (§2) ;
- [x] supprimer ou annoter les lignes PRODUCTION de `vercel-values.txt` — le Head of AI rapporte l'avoir fait le 31 août (§11.8) ;
- [x] comptage `public_leads` sur la production — Rayan rapporte **0** (§11.9) ;
- [ ] **poser `LEARNX_ALLOW_PROTECTED_DB=1` en Production** — bloquant, sans quoi le build de production s'arrête au premier pas (§9.1) ;
- [ ] **remplacer `real-functions` par `Integration (required)` sur `main`, avant d'ouvrir la PR de promotion** (§9.2, et non §4 tel qu'il était écrit) ;
- [ ] confirmer depuis le dashboard que `LEARNX_PUBLIC_LEADS_ENABLED` vaut en Production **exactement** `true` (§1) ;
- [ ] poser les trois réglages du smoke planifié, sinon il échouera quatre fois par jour dès qu'il touchera `main` (§9.3) ;
- [ ] relever le commit servi par `staging` — la procédure du §10.2 le fait au passage ;
- [ ] confirmer que `main` est la *Production Branch* du projet Vercel (§9.4) ;
- [ ] `LEARNX_PUBLIC_LEADS_ENABLED` sur **Preview** — absente, donc la collecte y est fermée (§1) ;
- [ ] décider si `Integration (required)` doit aussi devenir requise sur `dev`
      (proposition argumentée dans la PR V4.5-201 : oui, mais après une journée
      d'observation sans annulation).

Les écrans exacts de chacune sont au **§11**.

**Voie D**

- [x] Sentry serveur et navigateur ;
- [x] migrations appliquées sur le preview de `dev` (V4.5-200) ;
- [x] attente de capacité Neon, fin des annulations silencieuses (V4.5-201) ;
- [x] runbook de restauration Neon (V4.5-176), fusionné le 31 août ;
- [x] tests e2e qui ne tournaient nulle part (V4.5-208), fusionné le 31 août.

**Après GO packs uniquement**

- [ ] clés Stripe **live** ;
- [ ] `LEARNX_PAYMENTS_ENABLED=true` en Production.

## 9. Pré-vol — ce qui doit être vrai **avant** d'ouvrir la première PR

Trois conditions bloquent la promotion. Aucune ne se voit sur une branche : la
promotion est la première fois que ce code rencontre la production, et ces
trois-là sont précisément ce que `staging` ne peut pas répéter.

### 9.1 `LEARNX_ALLOW_PROTECTED_DB=1` en **Production** Vercel — bloquant, vérifié

> **Vocabulaire.** Le *garde* est le bout de code, dans `prisma.config.ts`, qui
> regarde quelle base une commande s'apprête à toucher et refuse si c'est la
> production. `quality/protected-db-hosts.json` liste l'unique hôte protégé,
> `ep-rapid-brook-asq9rq6r` — celui de la production, vidé le 30 août.

Le garde n'est pas encore sur `main` : la production n'a donc jamais construit
avec lui. À la promotion, elle le fera, et la porte qui la laisse passer est la
variable `LEARNX_ALLOW_PROTECTED_DB` valant `1`.

**Rien dans le dépôt ne pose cette variable** — `git grep` ne la trouve qu'à
deux endroits, le garde qui la lit et le message d'erreur qui la nomme. Elle ne
peut donc venir que de Vercel, et elle **n'apparaît pas** dans le tableau du §1,
qui a été construit à partir de `vercel env ls`.

Mesuré ici, pas déduit, en simulant le premier pas d'un build de production
(hôte protégé, nom de domaine volontairement irrésolvable en `.invalid`, donc
aucune base réelle jamais contactée) :

```
$ DATABASE_URL=…@ep-rapid-brook-asq9rq6r-pooler.….invalid/neondb \
  DIRECT_URL=…@ep-rapid-brook-asq9rq6r.….invalid/neondb \
  VERCEL_ENV=production pnpm prisma:generate

Failed to load config file … Error: Refus : ep-rapid-brook-asq9rq6r.….invalid
est un hôte protégé (quality/protected-db-hosts.json).
 ELIFECYCLE  Command failed with exit code 1.

$ … LEARNX_ALLOW_PROTECTED_DB=1 pnpm prisma:generate
✔ Generated Prisma Client (7.9.1) to ./generated/prisma in 289ms
```

Ce qui échoue est `pnpm prisma:generate`, c'est-à-dire le **premier** des trois
pas de `build:vercel` (`prisma:generate && vercel:migrate && build`) — avant
même la migration. Sans la variable, le build de production s'arrête à la
première seconde.

**Ce que ça coûte si on l'oublie :** rien de servi de neuf. Vercel garde le
dernier déploiement réussi, donc la production continue de répondre avec
l'ancienne version. La panne est « la promotion n'est pas passée », pas « le
site est tombé ». C'est le seul point rassurant de ce paragraphe.

**Et pourquoi `staging` ne le dira pas.** Un déploiement de `staging` est un
déploiement *preview* : ses variables pointent la base `preview`, qui n'est pas
un hôte protégé. Le garde y passe sans rien dire. La seule chose que la
promotion risque vraiment est donc exactement la seule que la répétition ne
teste pas.

**À faire (Rayan), une seule vérification :** Vercel → projet `learnx` →
Settings → Environment Variables → chercher `LEARNX_ALLOW_PROTECTED_DB`. Si elle
est absente de **Production**, l'ajouter avec la valeur `1`, cochée uniquement
pour Production.

### 9.2 Le check requis de `main` doit changer **avant** la PR, pas après

> **Vocabulaire.** Un *check requis* est un nom de contrôle que GitHub exige de
> voir passer au vert avant d'autoriser une fusion. Le nom compte : GitHub
> attend celui-là, exactement.

Relevé aujourd'hui sur la protection de `main` :

```
$ gh api repos/:owner/:repo/branches/main/protection
  contexts: ["V4.1 final (required)", "Visual baselines (required)", "real-functions"]
  strict:   true
```

Sur `main`, le job d'Integration n'a pas de `name:`, donc son contrôle s'appelle
`real-functions`, l'identifiant du job. Sur `dev`, le même job porte
`name: Integration (required)`, donc son contrôle s'appelle ainsi.

Or, pour une pull request, GitHub exécute les fichiers de workflow **de la
branche source**, pas ceux de la cible. La PR `staging` → `main` produira donc
`Integration (required)` et **jamais** `real-functions`.

**Conséquence, et elle inverse l'ordre écrit au §4 :** si l'on attend la fusion
pour changer le check requis, la PR reste bloquée pour toujours sur un contrôle
que plus personne ne produit. Le renommage doit être fait sur la protection de
`main` **avant** d'ouvrir la PR de promotion.

Le faire tôt ne coûte rien : ni `quality.yml` ni `integration.yml` ne se
déclenchent sur un `push` vers `main` — uniquement sur `dev` et sur les pull
requests. Entre le changement et la promotion, rien n'attend ce nom.

Les deux autres contextes requis, `V4.1 final (required)` et
`Visual baselines (required)`, portent déjà le même nom sur les deux branches :
ils n'ont rien à changer.

### 9.3 Le smoke planifié n'a pas ses réglages — il virera au rouge

`scheduled.yml` arrive sur `main` avec la promotion, et c'est là seulement qu'il
commencera à tourner : GitHub n'enregistre un workflow planifié que depuis la
branche par défaut. Son premier job, `Production smoke`, exige :

| Ce qu'il lit | Type | Présent aujourd'hui |
|---|---|---|
| `vars.LEARNX_DEPLOYMENT_URL` | variable de dépôt | **non** |
| `secrets.LEARNX_DEPLOYMENT_EMAIL` | secret de dépôt | **non** |
| `secrets.LEARNX_DEPLOYMENT_PASSWORD` | secret de dépôt | **non** |

Relevé : `gh variable list` ne rend que `NEON_PROJECT_ID`, `gh secret list` que
`NEON_API_KEY`, et les environnements `Preview` et `Production` n'ont ni
variable ni secret propre.

À la différence des jobs de base de données du même fichier, qui se **ferment
proprement** quand ils ne sont pas configurés, le smoke fait `exit 1` en
l'absence de l'URL — c'est délibéré, il est écrit pour être configuré. Il se
déclenche quatre fois par jour **et** à chaque déploiement de production : sans
ces trois réglages, il échouera à chaque fois.

Ce n'est pas bloquant pour la promotion elle-même — la production sera servie —
mais un contrôle rouge en permanence est un contrôle que plus personne ne
regarde, ce qui est exactement le silence que ce fichier existe pour rompre.

À poser avant, ou à accepter en connaissance de cause et à traiter le jour même.

**Bonne nouvelle du même relevé :** `neon-cleanup.yml`, lui, a tout ce qu'il
faut — `NEON_API_KEY` (secret) et `NEON_PROJECT_ID` (variable) existent. Il
balaiera les branches `ci-*` dès qu'il touchera `main`, sans réglage
supplémentaire.

### 9.4 Une question à trancher d'un coup d'œil

`main` est-elle bien la **Production Branch** du projet Vercel ? Toute la
procédure du §10 en dépend : c'est ce qui fait qu'une fusion dans `main` se
déploie **sans** marqueur, la règle de build faisant toujours construire un
déploiement de production. Vercel → projet `learnx` → Settings → Git →
*Production Branch*. Le smoke du §10.4 le confirmera de toute façon, en lisant
`environment` dans `/api/health`.

## 10. La promotion, pas à pas

État de départ relevé aujourd'hui :

```
$ git rev-list --count origin/main..origin/dev     → 371
$ git rev-list --count origin/staging..origin/dev  →  98
$ git rev-list --count origin/dev..origin/staging  →   0
```

`staging` n'a aucun commit qui lui soit propre : elle avance en fast-forward,
sans risque de conflit. Les quatre choses indissociables du §5 partent
ensemble ; elles sont toutes dans les 371.

### 10.1 Étape A — `dev` → `staging`

```bash
git fetch origin
gh pr create --base staging --head dev \
  --title "chore(v4.5): promotion de dev vers staging" \
  --body "Promotion V4.5-151. Voir docs/V4_5_ROLLOUT_CHECKLIST.md §5 et §10."
```

La protection de `staging` n'exige qu'un contexte, `V4.1 final (required)`, que
la PR produit. Attendre le vert :

```bash
gh pr checks <numéro> --watch
```

Puis fusionner **avec le marqueur dans le sujet** — c'est ce qui déclenche le
build, et c'est le Head of AI qui le pose :

```bash
gh pr merge <numéro> --merge \
  --subject "chore(v4.5): promotion de dev vers staging [deploy]"
```

> Le marqueur est cherché dans **tout** le message de commit, corps compris. Ne
> le faire figurer nulle part ailleurs.

### 10.2 Étape B — vérifier que `staging` est réellement servie

```bash
git fetch origin && git rev-parse --short=8 origin/staging
```

Puis, l'URL `learnx-git-staging-*` répondant `AUTHENTICATION_REQUIRED` depuis
l'extérieur, passer par Vercel → projet `learnx` → **Deployments** → filtre
*Branch = staging* → ouvrir le déploiement `Ready` → son URL → `/api/health`.

Attendu, champ par champ :

| Champ | Valeur attendue | Ce qu'elle prouve |
|---|---|---|
| `status` | `"ok"` | l'API répond |
| `database` | `"ok"` | elle atteint une base |
| `environment` | `"preview"` | c'est bien un déploiement de préproduction |
| `commit` | les 8 caractères relevés ci-dessus | c'est **ce** code qui est servi |

Le champ `commit` est le seul qui distingue « un déploiement existe » de « le
déploiement porte la promotion ». C'est celui qui manquait au §3.

**Ce que cette étape ne prouve pas**, et il vaut mieux l'écrire que le
supposer : un build de `staging` **n'applique aucune migration**
(`planVercelMigration` ne migre qu'en production ou en preview *de `dev`*). Un
`database: "ok"` dit que la base répond, pas que son schéma correspond au code.
Le schéma de la base `preview` est tenu à jour par les builds de `dev`, pas par
celui-ci.

### 10.3 Étape C — `staging` → `main`

**Le §9.2 doit être fait avant cette ligne**, sans quoi la PR ne pourra jamais
passer au vert.

```bash
gh pr create --base main --head staging \
  --title "chore(v4.5): promotion de staging vers main" \
  --body "Promotion V4.5-151. Porte les quatre éléments du §5."
gh pr checks <numéro> --watch
```

Les trois contextes attendus sont `V4.1 final (required)`,
`Visual baselines (required)` et `Integration (required)`. La protection de
`main` est `strict: true` : la branche doit être à jour avec `main` avant la
fusion — `staging` l'est, n'ayant aucun commit propre.

```bash
gh pr merge <numéro> --merge \
  --subject "chore(v4.5): promotion de staging vers main"
```

**Pas de marqueur ici, et ce n'est pas un oubli :** un déploiement de production
construit toujours, marqueur ou pas. En ajouter un ne changerait rien, mais
laisserait croire que la règle dépend de lui.

### 10.4 Étape D — vérifier la production

Trois contrôles, du moins cher au plus cher.

**1. Le build a-t-il migré ?** Vercel → **Deployments** → le déploiement
*Production* en cours → **Building** → chercher dans le journal :

```
prisma migrate deploy : production deployment.
```

C'est la ligne que `scripts/vercel-migrate.ts` imprime avant de migrer. Si l'on
lit à la place `prisma migrate deploy ignoré : …`, la production n'a pas migré
et il faut comprendre pourquoi avant d'aller plus loin. Si le build s'est arrêté
sur `Refus : … est un hôte protégé`, c'est le §9.1 qui n'a pas été fait.

**2. L'application et sa base répondent-elles ?**

```bash
git fetch origin && git rev-parse --short=8 origin/main
curl -sS https://<domaine-de-production>/api/health | jq
```

Attendu : `status: "ok"`, `database: "ok"`, `environment: "production"`, et
`commit` égal aux 8 caractères relevés. Un `status: "degraded"` répond en 503 et
signifie que l'API est debout mais n'atteint pas sa base.

**3. Le parcours public tient-il ?**

```bash
pnpm deployment:check -- https://<domaine-de-production>
```

Le script vérifie la coquille de l'application, le journal de recherche public,
le manifeste PWA, le service worker, et qu'une session anonyme est bien
anonyme. Il ne demande aucun identifiant : la partie authentifiée ne s'exécute
que si `DEPLOYMENT_CHECK_EMAIL` et `DEPLOYMENT_CHECK_PASSWORD` sont fournis
ensemble, ce qui est aussi ce que fera le smoke planifié une fois le §9.3 réglé.

### 10.5 Retour arrière

La production sert le dernier déploiement **réussi** : un build qui échoue ne
casse rien, il ne remplace rien. Le retour arrière ne concerne donc qu'un
déploiement réussi mais mauvais.

```bash
git fetch origin
git revert -m 1 <sha-du-commit-de-fusion-sur-main>
git push origin main
```

La production se reconstruit toute seule, sans marqueur. Puis refaire l'étape D.

**Une migration, elle, ne se révoque pas par un `git revert`.** Si la promotion
a appliqué une migration destructrice, l'annulation du code ne rend pas les
données : c'est `docs/RUNBOOK_RESTORE.md` qu'il faut, et la fenêtre de
restauration Neon Free est d'environ **six heures**. Passé ce délai, il n'y a
plus rien à restaurer. C'est la vraie raison de vérifier le journal de build
(§10.4, contrôle 1) avant tout le reste.

## 11. Les vérifications réservées à Rayan, avec l'écran exact

Rassemblées ici une fois pour toutes. Chacune tient en un écran ; aucune ne peut
être faite par un agent, parce qu'elles vivent dans des dashboards ou dans des
réglages GitHub.

**Bloquantes pour la promotion**

1. **`LEARNX_ALLOW_PROTECTED_DB` = `1` en Production.** Vercel → `learnx` →
   Settings → Environment Variables. Si absente de Production : l'ajouter,
   valeur `1`, environnement Production uniquement. *Sans elle, le build de
   production s'arrête au premier pas (§9.1).*
2. **Le check requis de `main`.** GitHub → Settings → Branches → règle de
   `main` → *Require status checks* : retirer `real-functions`, ajouter
   `Integration (required)`. **Avant** d'ouvrir la PR de promotion (§9.2).
3. **`LEARNX_PUBLIC_LEADS_ENABLED` en Production vaut-elle *exactement*
   `true` ?** Vercel → `learnx` → Settings → Environment Variables → la ligne
   `LEARNX_PUBLIC_LEADS_ENABLED`, environnement Production → l'œil pour révéler
   la valeur. `True`, `TRUE`, `1`, ou `true ` avec une espace ferment la
   collecte aussi sûrement que l'absence. C'est une fonctionnalité qui touche
   aux données personnelles d'inconnus : elle doit être ouverte par décision.

**Non bloquantes, à traiter le jour même**

4. **Les trois réglages du smoke planifié.** GitHub → Settings → Secrets and
   variables → Actions. Onglet *Variables* : `LEARNX_DEPLOYMENT_URL` =
   l'URL de production. Onglet *Secrets* : `LEARNX_DEPLOYMENT_EMAIL` et
   `LEARNX_DEPLOYMENT_PASSWORD` d'un compte de test. *Sans eux, le smoke échoue
   quatre fois par jour (§9.3).*
5. **`LEARNX_PUBLIC_LEADS_ENABLED` sur Preview.** Même écran qu'au point 3, à
   poser si l'on veut pouvoir tester la collecte en préproduction. Absente
   aujourd'hui, donc fermée.
6. **`main` est-elle la Production Branch ?** Vercel → `learnx` → Settings →
   Git → *Production Branch* (§9.4).
7. **`Integration (required)` doit-elle aussi devenir requise sur `dev` ?**
   Décision, pas vérification. La PR V4.5-201 argumente : oui, mais après une
   journée d'observation sans annulation.

**Faites, et pourquoi on le sait**

8. **Les lignes PRODUCTION de `vercel-values.txt`** — le Head of AI rapporte les
   avoir supprimées le 31 août. Fichier hors dépôt, hors de ma portée : c'est un
   rapport, pas un relevé de ma part.
9. **Comptage `public_leads` sur la production** — Rayan rapporte **0**. Aucune
   adresse n'a donc été collectée pendant la période où le drapeau était ouvert
   par défaut. C'est ce qui décide s'il y a une obligation RGPD à traiter, et la
   réponse est non.
10. **Clé API Neon pour l'exercice de restauration (§6 du runbook).** Le secret
    de dépôt `NEON_API_KEY` **existe** — c'est ce qui fait tourner
    `neon-cleanup.yml`. Un secret de dépôt n'est pas lisible, donc il ne
    déverrouille pas un exercice fait à la main ; mais il rend possible de mener
    l'exercice depuis un workflow. À arbitrer par Rayan, avec le runbook.
