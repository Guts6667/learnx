# V4.5 — Checklist de mise en production

> État au 31 août 2026, 00 h. Chaque ligne porte **son état réellement
> vérifié**, la preuve, et qui doit agir. Ce qui n'a pas pu être vérifié est
> marqué comme tel plutôt que supposé fait.
>
> Les états des variables Vercel viennent de `vercel env ls --project learnx`,
> qui liste les noms, les environnements et l'âge — jamais les valeurs, qui sont
> `Secret` et illisibles par construction. Ce document ne contient donc aucune
> valeur, et ne doit jamais en contenir.

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

**À la première promotion `dev` → `main`**, qui emporte le renommage, remplacer
`real-functions` par `Integration (required)`. Sans quoi le provisoire devient
définitif et `main` exige un contexte qui aura disparu.

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
- [ ] supprimer ou annoter les lignes PRODUCTION de `vercel-values.txt`, qui décrivent un rôle jamais créé (§2) ;
- [ ] relever le commit servi par `staging` (§3), ou acter qu'elle n'est pas servie ;
- [ ] remplacer `real-functions` par `Integration (required)` sur `main` à la promotion (§4) ;
- [ ] décider si `Integration (required)` doit aussi devenir requise sur `dev`
      (proposition argumentée dans la PR V4.5-201 : oui, mais après une journée
      d'observation sans annulation) ;
- [ ] `LEARNX_PUBLIC_LEADS_ENABLED` sur **Preview** — absente, donc la collecte y est fermée (§1) ;
- [ ] confirmer depuis le dashboard que sa valeur en Production vaut **exactement** `true` (§1).

**Voie D**

- [x] Sentry serveur et navigateur ;
- [x] migrations appliquées sur le preview de `dev` (V4.5-200) ;
- [x] attente de capacité Neon, fin des annulations silencieuses (V4.5-201) ;
- [x] runbook de restauration Neon (V4.5-176), fusionné le 31 août ;
- [x] tests e2e qui ne tournaient nulle part (V4.5-208), fusionné le 31 août.

**Après GO packs uniquement**

- [ ] clés Stripe **live** ;
- [ ] `LEARNX_PAYMENTS_ENABLED=true` en Production.
