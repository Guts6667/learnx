# Timeline & Pace Specification

## Objectif

Afficher si l’utilisateur avance au rythme prévu pour un programme ou une étape.

## Entrées

- `startedAt`
- `targetEndAt`
- `completedAt`
- `actualProgress`
- date courante

## Calcul attendu

```ts
expectedProgress =
  clamp(
    elapsedMilliseconds / totalPlannedMilliseconds * 100,
    0,
    100
  )
```

```ts
progressDelta = actualProgress - expectedProgress
```

## Statuts actifs

```text
delta >= 10       -> ahead
-10 < delta < 10  -> on_track
delta <= -10      -> behind
now > targetEnd   -> overdue
```

`overdue` prend priorité sur `behind`.

## Statuts terminés

```text
completedAt < targetEndAt  -> completed_early
completedAt == targetEndAt -> completed_on_time
completedAt > targetEndAt  -> completed_late
```

Pour éviter une égalité trop stricte, `completed_on_time` peut inclure une tolérance de 24 heures.

## Exemple

Début : 2 août à 00:00  
Durée : 21 jours  
Fin cible : 23 août à 00:00  
Date actuelle : 12 août à 12:00  

Temps écoulé : 10,5 jours  
Progression attendue : 50 %

Si la progression réelle vaut 35 % :

```text
35 - 50 = -15 points
Statut : behind
```

## Affichage

```text
Progression : 35 %
Attendu aujourd’hui : 50 %
Écart : 15 points de retard
Fin cible : 23 août
```

## Tests minimaux

- début non défini ;
- durée nulle ;
- avant la date de début ;
- milieu de période ;
- date cible atteinte ;
- période dépassée ;
- terminé en avance ;
- terminé à temps ;
- terminé en retard ;
- fuseaux horaires ;
- changement manuel de date cible.
