# Post-mortem — effacement de la base de production du 30 août 2026

- Ticket : V4.5-192
- Rédacteur : voie D (exploitation)
- Statut : clos côté données, actions préventives ouvertes
- Gravité : maximale. Perte totale des données de production, récupérée.

## Résumé

Le 30 août 2026 vers 11 h 50 UTC, le schéma `public` de la base de production
a été supprimé puis recréé par une commande destinée à la base `preview`. La
production a été restaurée depuis l'historique Neon dans la fenêtre de six
heures du plan Free. Cinq utilisateurs sont revenus ; le site a été vérifié
après restauration.

La donnée est récupérée. Ce qui reste à traiter est la raison pour laquelle une
commande visant `preview` a atteint `production`, et le fait que la fenêtre de
six heures était la totalité de la marge disponible.

## Chronologie

Les heures sont en UTC. Les éléments marqués « rapporté » proviennent de la
voie AI ; ceux marqués « vérifié » ont été constatés directement par la voie D.

| Heure | Événement | Source |
| --- | --- | --- |
| 11 h 24 | Déploiement du correctif V4.5-186 en production (`194e57e9`) | vérifié |
| ~11 h 30 | L'environnement Preview ne sert plus aucune requête base : `POST /api/auth/login` répond 500 | rapporté |
| ~11 h 50 | `DATABASE_URL='<preview>' pnpm prisma db execute --stdin` (`DROP SCHEMA public CASCADE`) puis `migrate deploy`, exécutés depuis le worktree `learnx-preview` | rapporté |
| ~11 h 50 | La commande atteint **production** et non `preview` | rapporté |
| — | Restauration via Neon « Restore from history », point dans le temps antérieur à la suppression | rapporté |
| — | Cinq utilisateurs de retour ; connexion et formulaire de contact vérifiés | rapporté |
| 12 h ~10 | Production vérifiée indépendamment par la voie D : `GET /` en 200, `POST /api/auth/login` et `POST /api/public-leads` en 400 de validation, donc chemin base fonctionnel | vérifié |

## Cause première

`prisma.config.ts` compose l'URL de sa source de données ainsi :

```ts
url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? fallbackDatabaseUrl
```

`DIRECT_URL` a la priorité. Les commandes Prisma destructrices — `db execute`,
`migrate deploy`, `migrate reset` — utilisent cette URL.

La commande n'a surchargé que `DATABASE_URL`. `DIRECT_URL` a donc continué
d'être lue depuis le `.env` du worktree, où elle désignait la production
(`ep-rapid-brook`). La surcharge partielle a été silencieuse : aucune erreur,
aucun avertissement, et la commande a fait exactement ce qu'on lui demandait,
sur la mauvaise base.

Trois propriétés se sont additionnées :

1. **la précédence est inversée par rapport à l'intuition.** On surcharge
   `DATABASE_URL` en croyant désigner la base ; c'est `DIRECT_URL` qui décide ;
2. **une surcharge partielle est indétectable.** Rien ne compare les deux
   variables, rien ne remarque qu'elles désignent deux hôtes différents ;
3. **le `.env` d'un worktree porte des identifiants de production.** Un
   répertoire de travail nommé `learnx-preview` pointait sur la production.

## Ce qui a permis la récupération

La fenêtre d'historique Neon, réglée à **six heures**, maximum du plan Free.
La restauration a eu lieu dans cette fenêtre.

Il faut le dire sans adoucir : six heures étaient la totalité de la marge. Le
même incident constaté après le déjeuner aurait été définitif. V4.5-176 avait
documenté cette fenêtre le 29 août en la qualifiant de posture de sauvegarde
réelle du projet ; l'incident du lendemain l'a mise à l'épreuve.

À noter également, par honnêteté : la voie D avait recommandé le 29 août la
suppression de trois branches `backup-pre-*` anciennes pour libérer le quota de
branches. Elles précédaient de plusieurs releases l'état actuel du schéma et
n'auraient pas servi ici, mais la recommandation réduisait bien le nombre de
points de récupération, à un moment où la fenêtre de six heures était déjà la
seule autre défense.

## Procédure de restauration, telle qu'exécutée

À reproduire exactement en cas de récidive.

1. Console Neon → projet LearnX → **Branches** → branche `production`.
2. **Restore** → point dans le temps antérieur à l'incident.
3. Neon crée automatiquement une branche de sauvegarde `production_old_<horodatage>`
   contenant l'état d'avant restauration. Elle n'est pas supprimée toute seule.
4. Vérifier l'application avant de conclure : page publique en 200, une route
   d'API en réponse de validation et non en 500.

### Rétention de la branche `production_old_*`

Elle occupe le quota de branches, que le plan Free plafonne à dix, et contient
l'état vide d'après incident — sans valeur propre, sauf pour une expertise.

Proposition de la voie D : **conservation sept jours, puis suppression**, le
délai laissant le temps de constater une anomalie qui n'aurait pas été vue le
jour même. **Décision propriétaire requise** ; aucune suppression de branche
Neon n'est faite sans accord nominatif.

## Procédure preview réécrite

La règle est mécanique, et depuis le 30 août elle est outillée.

**Toute commande base passe par `pnpm db:target`** (`scripts/db-target.ts`,
livré par la voie A, commit `8425e3f4`).

```bash
pnpm db:target -- --url '<chaîne de connexion de la cible>' migrate-deploy --yes
pnpm db:target -- --url '<chaîne de connexion de la cible>' seed-preview
```

L'enveloppeur ferme les trois portes de l'incident. Il n'importe délibérément
pas `dotenv/config` : lire un `.env` était exactement la faute. Il pose
`DATABASE_URL` **et** `DIRECT_URL` depuis la même `--url`, ce qui supprime la
question de la précédence. Il refuse de démarrer sans `--url`, une cible omise
signifiant « ce que le shell contient ». Et il refuse tout hôte protégé, ainsi
que tout `.env` local qui en nomme un, la liste vivant dans
`quality/protected-db-hosts.json` — où figure aujourd'hui l'hôte de production.

Le principe sous-jacent reste vrai si l'on doit un jour s'en passer : **poser
les deux variables, ou aucune, jamais une seule**, et repartir d'un
environnement vide.

```bash
env -i PATH="$PATH" HOME="$HOME" \
  DATABASE_URL='<url poolée de la cible>' \
  DIRECT_URL='<url directe de la cible>' \
  pnpm prisma migrate deploy
```

La branche Neon `preview` existe, vide et sans migration appliquée. Elle peut
désormais être migrée et semée, l'enveloppeur étant disponible.

## Actions préventives

| # | Action | Propriétaire |
| --- | --- | --- |
| 1 | Enveloppeur de commande Prisma refusant une cible ambiguë ou partielle | voie A — **fait**, `pnpm db:target`, commit `8425e3f4` |
| 2 | Garde dans `prisma.config.ts` : échouer si `DATABASE_URL` et `DIRECT_URL` désignent des hôtes différents, plutôt que de préférer silencieusement l'une des deux | à attribuer — le fichier n'appartient à aucune voie. L'enveloppeur protège le chemin outillé ; cette garde protège un `pnpm prisma` tapé à la main |
| 3 | Retirer les identifiants de production des `.env` des worktrees de travail | Propriétaire |
| 4 | Décision de rétention sur `production_old_*` | Propriétaire |
| 5 | Réexaminer la fenêtre de six heures, seule défense en profondeur du projet (V4.5-176) | Propriétaire |
| 6 | Sauvegarde périodique hors fenêtre d'historique, à cadence décidée (V4.5-176) | voie D après décision |

L'action 2 mérite un mot : le fichier de configuration a fait ce que sa ligne
demande, et cette ligne est raisonnable prise isolément. C'est la combinaison
« précédence inversée » et « surcharge partielle silencieuse » qui est
dangereuse. Une garde de trois lignes y aurait transformé une perte totale en
message d'erreur.

## Ce que l'incident dit du dispositif

L'audit DevOps du 29 août notait qu'aucune alerte ne surveillait la production
et que l'exploitant apprendrait une panne par un utilisateur. Trois incidents
en deux jours l'ont confirmé : le formulaire public cassé depuis sa mise en
ligne et découvert par lecture de code, l'environnement Preview muet découvert
par une passe de paiement, et cet effacement découvert par celui qui l'a causé.

Aucun n'a été signalé par un dispositif. V4.5-172 — route de santé,
journalisation des erreurs, suivi d'incidents — et V4.5-173 — contrôles
planifiés — restent ouverts et non commencés.

## Suites, 30 août 2026

### La branche de restauration a été supprimée

`production_old_*`, créée par la restauration à un point dans le temps, a été
supprimée par le propriétaire le 30 août 2026. Elle avait été conservée le temps
de vérifier que la production restaurée se comportait normalement. Le projet
Neon retrouve ainsi une place sous le plafond de dix branches du plan gratuit —
plafond qui est, lui, la cause du 422 d'Integration traité en V4.5-171.

### Le garde issu de l'action 2 a cassé tous les builds

C'est la partie de ce post-mortem qui mérite le plus d'être lue, parce qu'elle
s'est produite après lui.

L'action 2 demandait « une garde de trois lignes » refusant une configuration
ambiguë. Elle a été écrite. Elle refusait, entre autres, deux URL désignant
« deux hôtes différents ». Or Neon expose chaque endpoint sous deux noms — l'un
passant par le pooler de connexions, l'autre le contournant — et une
configuration correcte utilise **les deux à la fois** : `DATABASE_URL` poolée,
`DIRECT_URL` directe, parce qu'une migration ne peut pas s'exécuter en poolé.

Le garde comparait les noms. Il a donc lu la configuration recommandée comme
l'incident qu'il devait empêcher, et **tous les builds Vercel de `dev` sont
morts à `prisma generate`** :

```
Refus : DATABASE_URL et DIRECT_URL désignent deux hôtes différents.
  DIRECT_URL   → ep-bold-rain-as6nh8m7.c-4.eu-central-1.aws.neon.tech
  DATABASE_URL → ep-bold-rain-as6nh8m7-pooler.c-4.eu-central-1.aws.neon.tech
```

La production a tenu par accident de calendrier : `main` ne portait pas encore
le garde. La première promotion l'aurait emportée, et le build de production
aurait échoué au moment précis où l'on déploie.

Le garde compare maintenant l'identité d'endpoint — le premier label, suffixe
`-pooler` retiré — et non le nom d'hôte. Le refus reste entier pour deux
endpoints réellement différents, c'est-à-dire pour la forme de l'incident du
30 août.

**Ce que cela ajoute au post-mortem.** Un correctif de sécurité qui refuse trop
large ne se contente pas d'être gênant : il déplace la panne au lieu de la
supprimer, et il la déplace vers un moment — le déploiement — où elle coûte plus
cher. Un garde doit être éprouvé contre la configuration *normale* autant que
contre la configuration fautive. Celui-ci ne l'avait été que contre la seconde,
et ses tests utilisaient des fixtures inventées plutôt que les chaînes réelles
de l'environnement. Les tests portent désormais les hostnames relevés dans les
journaux de build.

### Découvert par un déploiement accidentel

Le garde a été trouvé parce qu'une branche a déployé alors qu'elle n'aurait pas
dû : son message de commit citait la règle d'exclusion de build et contenait
donc les caractères `[preview]`, qui sont testés sur le message entier. Une
erreur en a révélé une autre.

Cela ne rachète pas l'erreur, mais cela confirme la conclusion ci-dessus : rien
dans le dispositif ne surveillait l'échec des builds. Sans ce déploiement
fortuit, le garde aurait été découvert à la promotion suivante, en production.
