# Product Requirements — LearnX MVP

## 1. Vision

LearnX est un environnement personnel d’apprentissage modulaire.

Il permet de créer et suivre plusieurs programmes indépendants, par exemple :

- psychologie ;
- guitare ;
- développement logiciel ;
- langues ;
- préparation à une certification ;
- culture générale.

L’application transforme un objectif complexe en une succession d’étapes, modules, leçons et tâches concrètes.

À chaque ouverture, elle répond à une seule question :

> Quelle est la prochaine action utile à effectuer ?

## 2. Utilisateur MVP

Un seul utilisateur principal au départ.

Le modèle de données reste toutefois compatible avec plusieurs utilisateurs.

## 3. Structure

```text
Programme
└── Étape
    └── Module
        └── Leçon
            ├── Contenu
            ├── Ressources
            ├── Tâches
            ├── Quiz
            ├── Exercices
            └── Révisions
```

### Programme

Un domaine complet d’apprentissage.

Exemples :

- Fondamentaux de la psychologie ;
- Guitare blues ;
- Préparation PSPO I.

Un programme peut définir :

- une durée indicative ;
- une date de démarrage réelle par utilisateur ;
- une date de fin cible calculée ;
- une progression attendue dans le temps ;
- un statut d’avance, dans les temps ou en retard.

### Étape

Un bloc logique de progression.

Une étape peut représenter :

- des fondations ;
- un niveau ;
- une compétence ;
- une phase de projet ;
- une spécialisation.

Elle ne dépend pas d’un mois ou d’un semestre imposé, mais peut avoir une durée indicative, par exemple trois semaines.

Lorsqu’une étape est démarrée, LearnX enregistre la date de début et calcule sa date de fin cible.

### Module

Un ensemble cohérent de leçons.

### Leçon

L’unité principale d’apprentissage.

## 4. Objectifs du MVP

Le MVP permet de :

- créer un compte et se connecter ;
- consulter plusieurs programmes ;
- suivre un programme actif ;
- parcourir ses étapes ;
- ouvrir une leçon ;
- consulter des ressources ;
- cocher des tâches ;
- valider chaque notion avec une activité courte ;
- passer des quiz ;
- réaliser une évaluation finale dans chaque étape ;
- rédiger des notes ;
- soumettre des exercices ;
- suivre la progression ;
- reprendre automatiquement au bon endroit ;
- réviser les notions arrivées à échéance ;
- installer la PWA sur iPhone.

## 5. Non-objectifs

- paiement ;
- réseau social ;
- application native ;
- chat IA ;
- génération automatique de parcours ;
- correction automatique par IA ;
- marketplace ;
- calendrier scolaire imposé ;
- structure par année ou semestre ;
- planification calendaire complexe ;
- gestion automatique des pauses et vacances.

## 6. États

### Programme

- draft
- active
- archived

### Étape

- locked
- available
- in_progress
- completed

### Leçon

- locked
- available
- in_progress
- completed
- needs_review

### Tâche

- todo
- done
- skipped

### Ressource

- not_started
- started
- completed


## 7. Suivi temporel

Chaque programme et chaque étape peut avoir une durée indicative exprimée en jours.

Exemple :

```text
Étape 2
Début réel : 2 août
Durée indicative : 21 jours
Fin cible : 23 août
Progression réelle : 35 %
Progression attendue aujourd’hui : 48 %
Écart : -13 points
Statut : en retard
```

### Progression attendue

Pour une période active :

```text
expectedProgress =
  elapsedTime / plannedDuration
```

La valeur est limitée entre 0 % et 100 %.

### Écart

```text
progressDelta =
  actualProgress - expectedProgress
```

### Statuts temporels

- `ahead` : au moins 10 points d’avance ;
- `on_track` : entre -10 et +10 points ;
- `behind` : plus de 10 points de retard ;
- `overdue` : date cible dépassée et progression inférieure à 100 % ;
- `completed_early` : terminé avant la date cible ;
- `completed_on_time` : terminé à temps ;
- `completed_late` : terminé après la date cible.

Les seuils doivent être centralisés dans une fonction métier configurable.

### Démarrage

- Un programme peut être démarré manuellement.
- Une étape peut être démarrée manuellement.
- La première activité d’une étape peut aussi la démarrer automatiquement.
- L’utilisateur peut ajuster une date de début si nécessaire.
- La date cible est recalculée à partir de la date de début et de la durée indicative.

### Pause

Le MVP ne gère pas encore les pauses complexes. Une étape peut cependant être replanifiée manuellement en modifiant sa date cible.

## 8. Progression

Progression d’une leçon :

- tâches : 40 % ;
- quiz : 30 % ;
- exercices : 20 % ;
- ressources obligatoires : 10 %.

Lorsqu’une catégorie n’existe pas, son poids est redistribué.

Progression d’un module :

- moyenne pondérée de ses leçons.

Progression d’une étape :

- moyenne pondérée de ses modules.

Progression d’un programme :

- moyenne pondérée de ses étapes.


## 9. Modèle d’évaluation pédagogique

Chaque programme doit vérifier l’apprentissage à deux niveaux.

### 9.1 Validation des notions

Chaque notion importante doit être associée à au moins une activité de vérification courte.

Types possibles :

- mini-quiz ;
- vrai/faux ;
- question à choix multiples ;
- réponse courte ;
- exercice d’application ;
- flashcard active ;
- classement ou association ;
- mini-cas pratique.

Une notion ne peut pas être considérée comme maîtrisée uniquement parce que la ressource associée a été ouverte.

Chaque notion possède un état :

- `not_started`
- `learning`
- `validated`
- `needs_review`

### 9.2 Validation des étapes

Chaque étape doit contenir au moins une évaluation finale plus conséquente.

Types possibles :

- projet ;
- étude de cas ;
- analyse écrite ;
- exercice pratique ;
- oral enregistré ;
- simulation ;
- production concrète ;
- examen cumulatif.

Cette évaluation doit mobiliser plusieurs notions de l’étape.

Une étape ne peut être validée que si :

- toutes les notions obligatoires sont validées ;
- toutes les tâches obligatoires sont terminées ;
- l’évaluation finale de l’étape est soumise ;
- le seuil de validation défini est atteint.

### 9.3 Exemple

```text
Étape 2 — Cognition

Notion 1 — Mémoire de travail
- lire le document
- regarder la vidéo
- mini-quiz de 5 questions

Notion 2 — Attention sélective
- lire le document
- exercice d’identification
- mini-quiz de 4 questions

Notion 3 — Biais cognitifs
- lire l’article
- analyser deux exemples
- réponse courte

Évaluation finale de l’étape
- analyser un cas complet
- mobiliser mémoire, attention et biais
- produire une réponse structurée
```

### 9.4 Règles de progression

- consulter une ressource ne valide pas une notion ;
- une ressource est un support au point d'usage, jamais une activité autonome
  ni une catégorie pondérée de progression ;
- une intention pédagogique est comptée une seule fois : tâche légère ou
  exercice avec production, jamais les deux ;
- une notion est validée selon son activité d’évaluation ;
- une étape reste `in_progress` tant que son évaluation finale n’est pas validée ;
- les résultats insuffisants génèrent des éléments de révision ;
- l’utilisateur peut repasser un mini-quiz ;
- l’historique des tentatives est conservé.

## 10. Recommandation quotidienne

Ordre de priorité :

1. révision en retard ;
2. révision due aujourd’hui ;
3. tâche non terminée dans la leçon en cours ;
4. quiz requis ;
5. exercice requis ;
6. prochaine leçon disponible ;
7. prochain module ;
8. prochaine étape.

Une seule action principale est affichée.

## 11. Critères de réussite

Le MVP est validé lorsque l’utilisateur peut :

1. se connecter ;
2. sélectionner un programme ;
3. ouvrir une étape ;
4. commencer une leçon ;
5. cocher une tâche ;
6. fermer l’application ;
7. revenir et retrouver sa progression ;
8. passer un quiz ;
9. rédiger une note ;
10. installer l’application sur iPhone.
