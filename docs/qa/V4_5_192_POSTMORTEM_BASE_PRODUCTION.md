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

La règle est mécanique.

**Jamais de surcharge partielle d'environnement.** Une commande Prisma visant
une base autre que celle du `.env` courant pose les deux variables, ou aucune.

```bash
env -i PATH="$PATH" HOME="$HOME" \
  DATABASE_URL='<url poolée de la cible>' \
  DIRECT_URL='<url directe de la cible>' \
  pnpm prisma migrate deploy
```

`env -i` repart d'un environnement vide, ce qui empêche le `.env` du worktree
de fournir la variable qu'on a oublié de poser. Poser les deux variables
supprime la question de la précédence.

La voie A livre un enveloppeur qui applique cette règle et refuse de démarrer
si les deux variables désignent des hôtes différents. **Tant qu'il n'est pas
disponible, aucune opération n'est menée sur la branche Neon `preview`**, qui
existe aujourd'hui vide et sans migration appliquée.

## Actions préventives

| # | Action | Propriétaire |
| --- | --- | --- |
| 1 | Enveloppeur de commande Prisma refusant une cible ambiguë ou partielle | voie A |
| 2 | Garde dans `prisma.config.ts` : échouer si `DATABASE_URL` et `DIRECT_URL` désignent des hôtes différents, plutôt que de préférer silencieusement l'une des deux | à attribuer — le fichier n'appartient à aucune voie |
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
