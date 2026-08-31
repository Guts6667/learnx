# Runbook — restauration de la base et retour arrière applicatif

> État au 31 août 2026. Deux procédures distinctes vivent dans ce document,
> parce qu'on les confond sous le mot « rollback » et qu'elles ne réparent pas
> les mêmes pannes.
>
> **Rien de ce document n'a été répété.** L'exercice reste à faire ; §6 dit
> comment, et par qui.

## 1. Laquelle des deux ?

| Symptôme | Procédure |
|---|---|
| Le code déployé est fautif, les données sont saines | **§3 — retour arrière applicatif** |
| Des données ont été perdues, effacées ou corrompues | **§4 — restauration de la base** |
| Les deux | §4 d'abord, §3 ensuite : une base restaurée sous un code fautif se réabîme |

Un retour arrière applicatif ne répare **jamais** une perte de données : Vercel
redéploie du code, il ne touche pas à Postgres. Inversement, restaurer la base
ne corrige pas un bug de code.

## 2. La fenêtre d'historique, et ce qu'elle implique

Neon ne fait pas de sauvegardes au sens classique. Il conserve un historique
continu qui permet de créer une branche à n'importe quel instant du passé
récent — c'est l'« instant restore ». La profondeur de cet historique dépend du
plan.

**Sur le plan gratuit, la fenêtre relevée dans la console est de six heures.**
Elle est à revérifier avant de s'appuyer dessus : elle change avec le plan, et
elle est la seule défense en profondeur du projet.

Ce que six heures veulent dire concrètement :

- une corruption découverte le lendemain matin **n'est pas récupérable** ;
- il n'existe aucune sauvegarde hors de cette fenêtre. Aucune. Une suppression
  remarquée trop tard est définitive ;
- c'est V4.5-176, action 6 du post-mortem du 30 août : décider d'une sauvegarde
  périodique hors fenêtre. **Non fait, décision propriétaire en attente.**

## 3. Retour arrière applicatif

### Cible actuelle

| | |
|---|---|
| Servi en production | `194e57e9` |
| **Cible de retour arrière** | **`9c35e9db`** |

Relevé le 31 août par inspection des déploiements de production : `194e57e9`
est servi, `9c35e9db` est le déploiement de production précédent.

### Ce que ce retour arrière coûte, avant de le lancer

Revenir à `9c35e9db` annule exactement le correctif V4.5-186, qui monte les
routes publiques avant les applications qui gardent tout. **Le formulaire de la
page d'accueil redevient donc cassé** — il répondra 401 à chaque envoi.

C'est acceptable dans une panne grave, et inacceptable pour un incident mineur.
La règle : lire cette liste avant de décider, jamais après.

```
git log --oneline <cible>..<servi>
```

### Procédure

1. Vercel → projet `learnx` → **Deployments** → filtre **Environment =
   Production** ;
2. repérer le déploiement portant la cible, vérifier son SHA dans les journaux
   de build (`Cloning … Commit: …`) plutôt que de se fier à l'ordre ;
3. menu **⋯** → **Instant Rollback** (ou **Promote to Production**) ;
4. attendre `Ready`, puis vérifier §5.

Aucune migration inverse n'est jouée, et c'est voulu : Prisma ne sait pas
annuler une migration. Si la version fautive a migré le schéma, un retour
arrière applicatif seul laisse un schéma en avance sur le code. Vérifier §5
avant de déclarer l'incident clos.

## 4. Restauration de la base

**On ne restaure jamais directement par-dessus la production.** On restaure sur
une branche, on vérifie, puis on bascule. Le §4.3 est la seule étape
irréversible.

### 4.1 Restaurer sur une branche

1. Neon → projet → **Branches** → `production` → **Restore** ;
2. choisir l'instant, **avant** l'événement fautif — pas à l'heure ronde la plus
   proche, à un instant dont on peut dire pourquoi il est sain ;
3. Neon crée une branche de sécurité `production_old_<horodatage>` qui porte
   l'état **d'avant la restauration**. C'est le filet : elle permet de revenir
   en arrière si l'instant choisi était mauvais.

### 4.2 Vérifier avant de basculer

Sur la branche restaurée, avec la chaîne **directe** (sans `-pooler`) :

- les données perdues sont revenues, et celles qu'il fallait garder aussi —
  restaurer trop tôt reperd tout ce qui a été écrit entre-temps ;
- `SELECT count(*)` sur les tables porteuses : comptes, corrections, paiements ;
- la dernière migration appliquée correspond au code servi
  (`SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1`).

### 4.3 Basculer

Une fois seulement la vérification faite. Conserver `production_old_*` jusqu'à
ce que la production restaurée ait vécu une journée ouvrée, puis la supprimer —
elle occupe une place sous le plafond de dix branches du plan gratuit.

### 4.4 Précaution de confidentialité

Une branche restaurée est une copie complète de la production : comptes réels,
textes d'apprenants, traces de paiement. Elle ne doit **jamais** être rattachée
à un environnement Preview ni à une URL accessible, et doit être supprimée dès
qu'elle ne sert plus. Le registre RGPD de `docs/V4_5_RGPD_AUDIT.md` en dépend.

## 5. Vérification, dans les deux cas

- `GET /api/health` répond 200 ;
- le commit servi est bien celui attendu ;
- un parcours réel : connexion, une leçon, un envoi du formulaire public ;
- les journaux Vercel ne montrent pas d'erreur nouvelle ; Sentry non plus.

## 6. L'exercice, qui reste à faire

Un runbook non répété est une hypothèse. Celui-ci n'a pas été exercé, et je ne
peux pas l'exercer : la clé d'API Neon est un secret GitHub, elle n'existe pas
dans cette session, et créer une branche de restauration consomme une place sous
le plafond de dix.

**À faire par Rayan, une fois, dans une fenêtre calme** (30 minutes) :

1. restaurer `production` sur une branche à `maintenant − 1 heure` (§4.1) ;
2. y faire les vérifications du §4.2 avec la chaîne directe ;
3. **ne pas basculer** — c'est un exercice ;
4. supprimer la branche restaurée **et** la `production_old_*` créée au passage ;
5. noter ici la durée réelle de chaque étape.

La durée est le résultat qui compte. Un runbook dont on ignore s'il prend dix
minutes ou deux heures ne permet pas de décider, en pleine panne, entre
attendre et communiquer.

## 7. Tenir la cible à jour

La cible de retour arrière du §3 **périme à chaque promotion en production**.
Elle a déjà pointé pendant plusieurs semaines sur `a02ecc3f` — la release V4 —
alors que deux lignes de release étaient passées depuis ; un retour arrière
l'aurait appliquée, et aurait ramené la production des semaines en arrière.

L'étape est inscrite dans la checklist de release de
`docs/TESTING_AND_RELEASE.md`. Elle se relit ainsi :

```bash
# Le SHA servi, et le précédent, depuis les déploiements réels
npx vercel ls --prod
npx vercel inspect <url> --logs | grep 'Cloning'
```

Vérifier contre les déploiements, jamais contre l'historique de `main` : un
commit présent sur `main` n'a pas forcément été servi.
