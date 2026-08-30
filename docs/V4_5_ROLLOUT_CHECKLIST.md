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
| `LEARNX_PUBLIC_LEADS_ENABLED` | ✅ posée | absente | **sans effet**, voir ci-dessous | Rayan, confort |
| `LEARNX_PAYMENTS_ENABLED` | absente | ✅ posée | **état voulu** | ne rien faire |
| `STRIPE_LIVE_*` | absentes | absentes | **état voulu** | après GO packs |
| `DATABASE_URL` / `DIRECT_URL` | ✅ posées, **28 jours** | ✅ posées | rotation **à faire** | Rayan, §2 |

### Le piège : les deux drapeaux n'ont pas le même défaut

C'est la seule chose de cette section qu'il faut retenir, parce qu'elle se lit à
l'envers de l'intuition.

- `payments-configuration.ts` teste `=== 'true'`. **Absente signifie
  désactivé.** Les paiements sont donc éteints en production parce que la
  variable n'y est pas — c'est bien l'état voulu jusqu'au GO packs, et il ne
  faut *rien* poser pour l'obtenir.
- `public-leads/configuration.ts` teste `=== 'false'`. **Absente signifie
  activé.** Le formulaire public est donc déjà actif sur Preview sans variable.
  La poser à `true` sur Preview ne change rien au comportement ; cela rend
  seulement l'intention lisible, ce qui reste souhaitable.

Un drapeau qui s'active par défaut et un drapeau qui se désactive par défaut
dans le même produit est une source d'erreur permanente. À unifier un jour, sur
un ticket dédié — pas dans une fenêtre de mise en production.

## 2. Rotation des identifiants Neon — **à faire**

`DATABASE_URL` et `DIRECT_URL` de Production datent de 28 jours et n'ont pas été
tournés depuis l'incident du 30 août. C'est la dernière action de sécurité
ouverte.

Procédure **« nouveau rôle d'abord »**, dans cet ordre exact :

1. créer un **nouveau rôle** dans Neon, sans toucher à l'ancien ;
2. poser ses chaînes dans Vercel Production (`DATABASE_URL` poolée,
   `DIRECT_URL` directe — *le même endpoint sous ses deux noms*, voir §6) ;
3. redéployer la production et vérifier `/api/health` ;
4. **seulement ensuite**, réinitialiser l'ancien rôle.

L'ordre est ce qui compte : réinitialiser d'abord couperait la production entre
la révocation et le redéploiement.

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

- [ ] rotation des identifiants Neon (§2) — dernière action de sécurité ouverte ;
- [ ] relever le commit servi par `staging` (§3), ou acter qu'elle n'est pas servie ;
- [ ] remplacer `real-functions` par `Integration (required)` sur `main` à la promotion (§4) ;
- [ ] décider si `Integration (required)` doit aussi devenir requise sur `dev`
      (proposition argumentée dans la PR V4.5-201 : oui, mais après une journée
      d'observation sans annulation) ;
- [ ] `LEARNX_PUBLIC_LEADS_ENABLED` sur Preview, pour l'explicite (§1) — sans effet fonctionnel.

**Voie D**

- [x] Sentry serveur et navigateur ;
- [x] migrations appliquées sur le preview de `dev` (V4.5-200) ;
- [x] attente de capacité Neon, fin des annulations silencieuses (V4.5-201) ;
- [ ] runbook de restauration Neon (V4.5-176) ;
- [ ] tests e2e qui ne tournent nulle part (V4.5-208).

**Après GO packs uniquement**

- [ ] clés Stripe **live** ;
- [ ] `LEARNX_PAYMENTS_ENABLED=true` en Production.
