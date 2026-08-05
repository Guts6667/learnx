# Assessment Specification — LearnX

## Objectif

Vérifier l’acquisition des connaissances à deux niveaux :

1. compréhension d’une notion ;
2. maîtrise globale d’une étape.

## Hiérarchie

```text
Stage
├── Module
│   └── Lesson
│       └── Concept
│           ├── Resources
│           └── Concept Assessment
└── Stage Assessment
```

## Activité courte par notion

Chaque notion obligatoire doit avoir au moins une activité de validation.

Formats MVP :

- single choice ;
- multiple choice ;
- true/false ;
- short answer ;
- mini practice.

Règles d'expérience :

- aucun nombre arbitraire de questions n'est imposé : la couverture de la
  notion dicte le volume ;
- durée cible de 2 à 10 minutes pour une validation courte ;
- une question est affichée à la fois ;
- la tentative complète est soumise avant d'afficher le résultat ;
- le score et la correction détaillée apparaissent après la soumission ;
- aucun feedback révélateur ni explication de correction n'apparaît pendant la
  tentative ;
- seuil par défaut : 70 %.

Une mini-évaluation cible une notion précise. Un quiz consolide plusieurs acquis
d'une leçon. Ils ne doivent pas représenter deux fois la même intention
pédagogique. Les tentatives et leurs corrections restent consultables ; le
serveur est l'unique autorité de réussite et de progression.

## Évaluation finale par étape

Chaque étape publiée doit avoir au moins une évaluation finale.

Formats :

- projet ;
- étude de cas ;
- exercice pratique ;
- devoir écrit ;
- oral ;
- simulation ;
- examen cumulatif.

L’évaluation doit mobiliser plusieurs notions et ne pas être une simple répétition des mini-quiz.

## Validation

### Notion

Validée si :

- l’évaluation obligatoire est terminée ;
- le seuil est atteint ;
- ou l’exercice est explicitement validé.

### Étape

Validée si :

- toutes les notions obligatoires sont validées ;
- toutes les tâches obligatoires sont terminées ;
- l’évaluation finale est validée.

## Publication

Une étape ne peut pas passer à `published` si :

- elle ne contient aucune notion ;
- une notion obligatoire n’a pas d’évaluation ;
- elle ne possède aucune évaluation finale.

## Révision

En cas d’échec :

- la notion passe à `needs_review` ;
- une révision est créée ;
- les ressources liées sont suggérées ;
- l’utilisateur peut refaire l’évaluation.

## Exemple cognition

```text
Étape — Cognition

Notion — Mémoire de travail
Ressources :
- chapitre de livre
- vidéo
Validation :
- quiz de 5 questions

Notion — Attention sélective
Ressources :
- article
- expérience interactive
Validation :
- exercice d’identification

Évaluation finale :
- étude de cas mêlant mémoire, attention et biais
```
