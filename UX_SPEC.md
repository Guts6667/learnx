# UX Specification — LearnX

## Principes

- mobile-first ;
- modulaire ;
- une seule action principale par écran ;
- progression toujours compréhensible ;
- aucune dépendance à un calendrier académique ;
- plusieurs programmes accessibles depuis le même compte.

## Raccord Emotional Design et Totem

`docs/EMOTIONAL_DESIGN_CONTRACT.md` complète cette baseline avec la promesse
de confiance calme et de progression tangible. Les règles métier, droits,
destinations et calculs serveur restent ceux du ticket actif.

`docs/V4_TOTEM_IMPLEMENTATION_MAP.md` et les paquets approuvés qu'il cite fixent
le langage visuel ferme : DM Sans, ardoise, cobalt, brume, corail rare, fond
clair et papier. Totem supersède Atlas pour les choix de palette, typographie,
composition et composants, sans remplacer le contrat émotionnel ni modifier
les règles métier.

Le ticket V4-016C de `BACKLOG_V4.md` porte l’évolution d’Aujourd’hui et du flow
Parcours :

- un compte sans inscription reçoit un état de première arrivée avec une seule
  action dominante, `Choisir mon premier parcours` ;
- un compte déjà inscrit reçoit une recommandation principale et peut reprendre
  chacun de ses autres parcours actifs en une interaction ;
- `Mes parcours` sert à reprendre et `Découvrir` à choisir ; la recherche est
  progressive et n’apparaît pas dans un faux vide.

Les références Totem du 24 août sont des autorités d'implémentation ; les
références plus anciennes restent directionnelles et historiques :

`/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-product-surfaces.html`

La référence Atlas suivante reste historique pour le comportement :

`/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-emotional-flow.html`

## Navigation mobile

- Aujourd’hui
- Programmes
- Révisions
- Notes
- Profil

## Aujourd’hui

Affiche :

1. programme actif ;
2. prochaine action ;
3. étape et module concernés ;
4. durée estimée ;
5. progression du programme ;
6. révisions dues ;
7. dernière activité.

Cette liste décrit la baseline fonctionnelle. V4-016C distingue explicitement
la première arrivée sans parcours de l’accueil de retour multi-programmes ;
`Découvrir` n’est pas une destination universelle par défaut.

## Programmes

Affiche tous les programmes :

- titre ;
- description ;
- progression ;
- étape active ;
- statut ;
- bouton continuer.

## Détail d’un programme

Affiche :

- présentation ;
- progression globale ;
- liste ordonnée des étapes ;
- modules contenus dans chaque étape ;
- prochaine action recommandée.

## Étape

Affiche :

- titre ;
- objectif ;
- durée indicative ;
- date de début ;
- date cible ;
- progression réelle ;
- progression attendue ;
- écart en points ;
- statut temporel ;
- modules ;
- état de disponibilité.

Exemples de libellés :

- « 8 points d’avance »
- « Dans les temps »
- « 13 points de retard »
- « Échéance dépassée de 4 jours »

## Module

Affiche :

- objectifs ;
- leçons ;
- progression ;
- projet final éventuel.

## Leçon

Ordre :

1. titre ;
2. durée indicative ;
3. objectifs ;
4. notions à maîtriser ;
5. contenu ;
6. ressources ;
7. activité de validation de chaque notion ;
8. tâches ;
9. notes ;
10. terminer.

Chaque notion doit afficher :

- son titre ;
- ses ressources ;
- son activité courte ;
- son statut ;
- son meilleur score ;
- un bouton pour recommencer si nécessaire.

## Accessibilité

- zones tactiles ≥ 44 px ;
- focus visible ;
- navigation clavier ;
- labels explicites ;
- safe areas iOS ;
- aucune information portée uniquement par la couleur.


## Composant TimelineStatus

Le composant affiche :

- progression réelle ;
- progression attendue ;
- date cible ;
- écart ;
- statut.

Ne pas dépendre uniquement de la couleur. Toujours afficher un libellé texte et une icône.


## Fin d’étape

La dernière vue d’une étape affiche une carte dédiée :

```text
Évaluation finale
Mobilisez les notions apprises dans cette étape.

Type : étude de cas
Durée indicative : 90 min
Statut : à commencer

[Commencer l’évaluation]
```

L’étape affiche clairement les prérequis manquants :

- 2 notions encore à valider ;
- 1 exercice obligatoire non terminé ;
- évaluation finale non soumise.

## Affichage de maîtrise

Une notion doit toujours indiquer un statut textuel :

- À apprendre
- En cours
- Validée
- À revoir

Ne jamais utiliser uniquement une coche de lecture de ressource comme preuve de maîtrise.
