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

Recommandation :

- 3 à 7 questions pour un mini-quiz ;
- durée cible de 2 à 10 minutes ;
- feedback immédiat ;
- explication après chaque réponse ;
- seuil par défaut : 70 %.

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
