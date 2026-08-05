# Politique de changement pédagogique — LearnX

## Objet

Cette politique classe toute évolution pédagogique avant modification. Elle
protège le moteur contre les changements implicites sans empêcher les
corrections de contenu nécessaires.

Elle ne remplace pas `EDITORIAL_GUIDELINES.md`, qui définit la qualité, ni
`PEDAGOGY_AUTHORING_GUIDE.md`, qui définit le format.

## 1. Correction de contenu sans impact moteur

Peut être réalisée dans un commit documentaire ou de données autonome :

- correction factuelle, typographique, bibliographique ou de lien ;
- amélioration de clarté sans changement d’objectif ;
- remplacement d’une ressource inaccessible par une ressource équivalente ;
- ajout ou correction du sidecar éditorial ;
- ajustement raisonnable d’une durée, d’une consigne, d’un seuil ou d’une tâche
  déjà représentable par le seed ;
- ajout de contenu, de notion ou de leçon avec les champs et types existants ;
- réorganisation éditoriale compatible avec `Program -> Stage -> Module -> Lesson`.

Conditions : le JSON reste accepté par `prisma/seed.ts`, aucune route ou logique
serveur ne change, les évaluations obligatoires restent présentes et les tests
existants passent.

Une erreur scientifique, éthique, juridique ou de sécurité est corrigée en
priorité. Si son correctif dépasse cette catégorie, le contenu concerné reste en
brouillon ou est retiré jusqu’à validation technique.

## 2. Changement nécessitant validation technique

Ne pas implémenter dans un commit pédagogique. Ouvrir une décision séparée avec
impact, solution minimale et critères d’acceptation lorsque le changement :

- ajoute ou renomme un champ, enum, relation ou état ;
- nécessite une migration Prisma ou une modification du schéma Zod du seed ;
- change une route API, un contrat frontend, un calcul de progression, de
  maîtrise ou de recommandation ;
- modifie les règles serveur de publication ou de validation ;
- exige un nouveau type de ressource, tâche ou évaluation ;
- change la manière d’importer les `PEDAGOGY_SPEC` ;
- invalide un ticket technique déjà livré ou demande une reprise de données.

Tant que la validation n’est pas obtenue, la spec utilise le format existant ou
reste `draft`. Aucun champ prospectif n’est glissé dans `lesson`.

## 3. Idée future

À conserver hors du ticket actif lorsqu’elle est utile mais non nécessaire à la qualité
ou à la sécurité immédiate, par exemple :

- moteur de prérequis ou de dépendances entre notions ;
- graphe automatique de réemploi et répétition espacée avancée ;
- annotations bibliographiques visibles dans l’interface ;
- portail autonome permettant à un réviseur externe de se connecter et de
  signer lui-même une validation ;
- import générique de sidecars et tableaux de bord de liens ;
- génération ou correction automatique par IA ;
- nouveaux médias interactifs ou types d’évaluation.

Une idée future n’est pas ajoutée à `BACKLOG_V3.md` sans demande explicite. Elle
peut être conservée dans une note de décision dédiée lorsqu’un emplacement est
validé.

## 4. Décision et traçabilité

Avant toute modification, répondre :

1. Est-ce une correction indispensable ou un gain éditorial mesurable ?
2. Le seed et les types actuels savent-ils la représenter sans perte ?
3. Le changement touche-t-il Prisma, l’API, le moteur, les tickets ou une donnée
   déjà publiée ?

La réponse produit l’une des trois classifications : `CONTENT_ONLY`,
`TECH_VALIDATION` ou `FUTURE_IDEA`. Le commit indique la classification et ne
mélange pas une correction de contenu avec une évolution technique.

En cas de doute sur l’impact moteur, classer `TECH_VALIDATION` et demander une
revue avant édition.
