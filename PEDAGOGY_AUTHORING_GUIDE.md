# Guide de rédaction des `PEDAGOGY_SPEC` — LearnX

## 1. Objet et source de vérité technique

Ce guide définit le contrat exact des futures `PEDAGOGY_SPEC_XXX.json` du MVP.
Il est aligné sur les schémas Zod de `prisma/seed.ts` au 3 août 2026.

Une spécification contient deux couches :

1. `lesson`, payload strictement compatible avec une leçon de
   `seed/sample-program.json` ;
2. `editorial`, sidecar de traçabilité non importé en base.

Le sidecar conserve les références, contrôles de liens, décisions et revues que
le schéma de données actuel ne représente pas. Il ne justifie aucune migration.
Lors de l’intégration, seul l’objet `lesson` remplace la leçon ciblée dans le
seed. Les autres clés servent à localiser et contrôler cette opération.

En cas d’écart, `prisma/seed.ts` est la source de vérité pour le payload et
`EDITORIAL_GUIDELINES.md` est la source de vérité éditoriale.

## 2. Nom et unité de livraison

Le nom suit exactement :

```text
PEDAGOGY_SPEC_001.json
PEDAGOGY_SPEC_002.json
```

Le numéro est unique, croissant et sur trois chiffres. Une spécification MVP
décrit une seule leçon. Elle ne redéfinit ni le programme entier, ni l’étape, ni
le module, ni le schéma de données.

Les sélecteurs `programSlug`, `stageSlug` et `moduleSlug` doivent correspondre
exactement à des objets existants dans `seed/sample-program.json`. Le
`lesson.slug` cible une leçon existante ou, après validation explicite, une
nouvelle leçon cohérente avec `CURRICULUM_BLUEPRINT.md`.

## 3. Objet racine exact

Toutes les clés ci-dessous sont obligatoires. Aucune clé supplémentaire n’est
ajoutée sans mise à jour préalable de ce guide.

```json
{
  "specId": "PEDAGOGY_SPEC_001",
  "schemaVersion": 1,
  "programSlug": "fondamentaux-psychologie",
  "stageSlug": "decouvrir-discipline",
  "moduleSlug": "definition-psychologie",
  "lesson": {},
  "editorial": {}
}
```

Règles :

- `specId` correspond au nom du fichier sans extension ;
- `schemaVersion` est le nombre entier `1`, pas la chaîne `"1.0.0"` ;
- les slugs utilisent des minuscules ASCII et des tirets ;
- `lesson` suit exactement la section 4 ;
- `editorial` suit exactement la section 5.

## 4. Payload `lesson` compatible avec le seed

### 4.1 Forme complète

```json
{
  "title": "Définir la psychologie",
  "slug": "definir-la-psychologie",
  "summary": "Résumé original et délimité.",
  "objectives": [
    "Définir la psychologie comme une discipline scientifique."
  ],
  "prerequisites": [],
  "estimatedMinutes": 90,
  "position": 1,
  "contentBlocks": [],
  "resources": [],
  "concepts": [],
  "tasks": []
}
```

Pour le seed, `summary`, `objectives`, `prerequisites`, `estimatedMinutes`,
`contentBlocks`, `resources`, `concepts` et `tasks` ont des valeurs par défaut ou
sont techniquement optionnels. Pour une leçon déclarée complète, tous les champs
ci-dessus sont néanmoins obligatoires. Seul `prerequisites` peut être vide sans
justification. Les quatre listes pédagogiques ne peuvent pas être vides pour une
leçon publiable.

Ne jamais placer dans `lesson` des champs éditoriaux non reconnus comme
`references`, `recommendedResources`, `takeaways`, `status`, `version`,
`pedagogicalJustification`, `language` ou `access`. Zod les supprimerait
silencieusement. Ils appartiennent au sidecar `editorial` lorsque nécessaire.

### 4.2 Blocs de contenu

Forme exacte :

```json
{
  "type": "definition",
  "position": 1,
  "content": {
    "text": "Texte original du bloc."
  }
}
```

Types autorisés :

```text
rich_text | objective | definition | example | callout | quote | embed | divider
```

`position` est un entier strictement positif, unique dans la leçon. `text` est
non vide. La source du bloc est déclarée séparément dans
`editorial.contentBlockSources` avec la même position.

### 4.3 Ressources recommandées (`lesson.resources`)

Forme exacte :

```json
{
  "key": "openstax-psychology-2e-1-1",
  "type": "book_chapter",
  "title": "Psychology 2e — 1.1 What Is Psychology?",
  "author": "Rose M. Spielman, William J. Jenkins et Marilyn D. Lovett",
  "url": "https://openstax.org/books/psychology-2e/pages/1-1-what-is-psychology",
  "citation": "Spielman, R. M., Jenkins, W. J., & Lovett, M. D. (2020). Psychology 2e, section 1.1. OpenStax.",
  "description": "Lire la section 1.1 et relever la définition et les critères d’une démarche empirique.",
  "isRequired": true,
  "estimatedMinutes": 25,
  "position": 1
}
```

Types autorisés :

```text
book | book_chapter | article | video | course | podcast | website | document | tool
```

Champs techniquement obligatoires : `key`, `type`, `title`, `url`, `isRequired`,
`position`. Pour une livraison éditoriale complète, `author`, `citation`,
`description` et `estimatedMinutes` sont également obligatoires. La description
contient une consigne concrète, pas une simple appréciation.

`key` est stable et unique dans la leçon. Toute clé citée par une notion doit
exister dans cette liste.

### 4.4 Notions

Forme exacte :

```json
{
  "title": "Démarche empirique",
  "slug": "demarche-empirique",
  "description": "Une connaissance scientifique repose sur des questions testables, des observations systématiques et des conclusions révisables.",
  "position": 1,
  "isRequired": true,
  "masteryThreshold": 70,
  "resourceKeys": [
    "openstax-psychology-2e-1-1"
  ],
  "assessment": {
    "type": "quiz",
    "title": "Mini-évaluation — Démarche empirique",
    "questionCount": 5
  }
}
```

Types d’évaluation autorisés :

```text
quiz | short_answer | practice | flashcard | case_question
```

Règles du seed :

- `position` est un entier supérieur ou égal à zéro et unique dans la leçon ;
- `masteryThreshold` est compris entre 0 et 100 ;
- toute notion `isRequired: true` possède obligatoirement `assessment` ;
- `questionCount` est un entier strictement positif ;
- chaque `resourceKey` correspond à une ressource de la même leçon ;
- une ressource consultée ne valide pas la notion.

Pour une leçon publiable, `description` et au moins une `resourceKey` sont
obligatoires, même s’ils restent techniquement optionnels dans le seed.

### 4.5 Tâches

Forme exacte :

```json
{
  "title": "Rendre une question observable",
  "description": "Formuler une question testable et proposer deux indicateurs mesurables.",
  "type": "practice",
  "isRequired": true,
  "weight": 1,
  "position": 1
}
```

Types autorisés :

```text
reading | watching | listening | reflection | checklist | writing | practice | project
```

`weight` est strictement positif. `position` est un entier strictement positif
et unique dans la leçon. La description indique le livrable ou le critère de
complétion.

## 5. Sidecar `editorial` exact

Le sidecar n’est jamais copié dans `seed/sample-program.json`.

```json
{
  "version": "1.0.0",
  "status": "draft",
  "language": "fr",
  "audience": "Adulte débutant sans prérequis universitaire",
  "owner": "À renseigner",
  "createdAt": "2026-08-03",
  "lastReviewedAt": null,
  "nextReviewAt": null,
  "references": [],
  "contentBlockSources": [],
  "resourceChecks": [],
  "assessmentBanks": [],
  "review": {
    "editorialReviewer": null,
    "subjectReviewer": null,
    "scientificAccuracy": false,
    "pedagogicalAlignment": false,
    "seedCompatibility": false,
    "linksAndMedia": false,
    "readyForPublication": false,
    "notes": []
  },
  "changeLog": []
}
```

Statuts autorisés :

```text
draft | editorial_review | subject_review | approved | published | archived
```

### 5.1 Références

Chaque entrée suit cette forme ; `null` est utilisé lorsque le champ ne
s’applique pas, jamais pour une donnée inconnue qui devrait être vérifiée.

```json
{
  "id": "REF-001",
  "type": "textbook",
  "authors": ["Spielman, R. M.", "Jenkins, W. J.", "Lovett, M. D."],
  "organization": "OpenStax",
  "title": "Psychology 2e",
  "year": 2020,
  "edition": "2e éd.",
  "publication": "OpenStax, Rice University",
  "doi": null,
  "url": "https://openstax.org/details/books/psychology-2e",
  "accessedAt": "2026-08-03",
  "evidenceLevel": "B",
  "peerReviewed": true,
  "language": "en",
  "license": "CC BY-NC-SA 4.0",
  "status": "verified",
  "notes": "Manuel d’introduction ; vérifier la section précise dans le rattachement au bloc."
}
```

`evidenceLevel` vaut `A`, `B`, `C`, `D` ou `E`. `status` vaut `verified`,
`corrected`, `retracted` ou `unavailable`. Une référence `retracted` ou
`unavailable` bloque la publication, sauf présentation critique explicitement
validée.

### 5.2 Rattachement des sources aux blocs

Chaque position de `lesson.contentBlocks` apparaît une fois :

```json
{
  "contentBlockPosition": 1,
  "referenceLinks": [
    {
      "referenceId": "REF-001",
      "locator": "section 1.1, paragraphes 1 à 5",
      "supports": "Définition de la psychologie et caractère empirique."
    }
  ],
  "confidence": "high",
  "confidenceRationale": "Manuel universitaire relu et source institutionnelle convergente.",
  "notApplicableReason": null
}
```

`confidence` vaut `very_high`, `high`, `moderate` ou `low`. Un bloc de
connaissance ne peut pas avoir une liste vide. Pour un bloc sans affirmation,
`referenceLinks` est vide, `confidence` et `confidenceRationale` valent `null`,
et `notApplicableReason` explique pourquoi.

### 5.3 Contrôle des ressources

Chaque `lesson.resources[].key` possède une entrée :

```json
{
  "resourceKey": "openstax-psychology-2e-1-1",
  "referenceIds": ["REF-001"],
  "pedagogicalRationale": "Introduction académique accessible à la définition et à la méthode.",
  "learnerInstructions": "Lire la section 1.1 et relever trois critères.",
  "language": "en",
  "accessType": "open",
  "accessibilityNotes": "Version HTML disponible.",
  "alternativeResourceKey": null,
  "checkedAt": "2026-08-03",
  "urlStatus": "ok",
  "mediaSegment": null,
  "transcriptAvailable": null,
  "notes": null
}
```

`accessType` vaut `open`, `registration`, `institutional` ou `paid`.
`urlStatus` vaut `ok`, `redirect`, `restricted` ou `broken`. Pour une vidéo ou un
audio, `mediaSegment` utilise `HH:MM:SS-HH:MM:SS` et
`transcriptAvailable` est un booléen. Une ressource obligatoire `restricted` ou
`broken` exige `alternativeResourceKey`.

### 5.4 Banques de questions

Le seed MVP ne lit pas encore les questions. Elles sont néanmoins livrées dans
`editorial.assessmentBanks`, avec une forme directement alignée sur
`ConceptAssessmentQuestion` et `ConceptAssessmentOption` :

```json
{
  "conceptSlug": "demarche-empirique",
  "assessmentTitle": "Mini-évaluation — Démarche empirique",
  "questions": [
    {
      "type": "single_choice",
      "prompt": "Quelle proposition est testable ?",
      "explanation": "Une proposition testable relie des variables observables.",
      "acceptedAnswers": [],
      "position": 1,
      "options": [
        {
          "label": "Le sommeil mesuré est associé au nombre d’erreurs.",
          "isCorrect": true,
          "position": 1
        },
        {
          "label": "Le sommeil possède une énergie invisible.",
          "isCorrect": false,
          "position": 2
        }
      ]
    }
  ]
}
```

Types autorisés : `true_false`, `single_choice`, `multiple_choice` et
`short_answer`. Pour `short_answer`, `options` est vide et `acceptedAnswers`
contient toutes les réponses exactes acceptées après normalisation de la casse et
des espaces. Pour les autres types, `acceptedAnswers` est vide et les options
correctes portent `isCorrect: true`.

Chaque banque correspond à une notion de `lesson.concepts`. Son titre et son
nombre de questions correspondent exactement à `concept.assessment`. Les
questions ne sont jamais copiées dans `lesson` tant que `prisma/seed.ts` ne les
accepte pas. Leur import relève d’une intégration technique séparée et ne doit
pas retarder la rédaction.

### 5.5 Historique

Chaque changement est résumé :

```json
{
  "version": "1.0.0",
  "date": "2026-08-03",
  "author": "À renseigner",
  "change": "Création",
  "reviewRequired": "editorial_and_subject"
}
```

## 6. Évaluation finale d’étape

La `PEDAGOGY_SPEC` d’une leçon ne duplique pas l’évaluation finale d’étape. Le
seed la porte sous `program.stages[].assessment` avec la forme exacte :

```json
{
  "title": "Évaluation finale — Découvrir la discipline",
  "type": "case_study",
  "isRequired": true,
  "passingScore": 70
}
```

Types autorisés :

```text
project | case_study | written_assignment | practical_exercise | oral | simulation | cumulative_exam
```

Avant d’approuver une leçon, vérifier que son étape possède déjà cette
évaluation. Une modification de sa forme relève de la politique de changement
et ne doit pas être glissée dans une spec de leçon.

## 7. Règles d’intégration sans interprétation

1. Valider l’objet racine et le sidecar contre ce guide.
2. Localiser programme, étape et module avec les trois slugs.
3. Vérifier que `lesson.slug` est unique dans le module.
4. Remplacer l’objet de leçon cible par `lesson`, sans copier `editorial`.
5. Ne modifier aucun autre niveau du seed.
6. Exécuter les tests du seed et les contrôles du projet.
7. Conserver la `PEDAGOGY_SPEC` comme preuve éditoriale versionnée.

L’intégrateur NE DOIT PAS renommer un slug, convertir un type, inventer un
champ, déplacer une référence dans `description` ou compléter une donnée
manquante de sa propre initiative. La spec retourne en révision.

## 8. Contrôle avant livraison

- [ ] Le nom du fichier, `specId` et `schemaVersion` correspondent.
- [ ] Les trois slugs parents existent dans le seed.
- [ ] `lesson` ne contient que les champs acceptés par `prisma/seed.ts`.
- [ ] Types, positions, poids, seuils et nombres de questions sont valides.
- [ ] Toutes les notions obligatoires ont une évaluation.
- [ ] Chaque évaluation possède une banque dont le titre et le nombre de
      questions correspondent aux métadonnées de la notion.
- [ ] Tous les `resourceKeys` existent dans la même leçon.
- [ ] Tous les blocs de connaissance ont des références avec localisateur.
- [ ] Chaque ressource a été contrôlée et possède une consigne.
- [ ] Les liens, éditions et segments média ont été vérifiés.
- [ ] L’étape possède une évaluation finale.
- [ ] Les revues éditoriale et de domaine sont renseignées avant approbation.
- [ ] `pnpm test -- prisma/seed.test.ts` passe après intégration.
- [ ] Aucun changement Prisma, API ou backlog n’est inclus.

Une case non satisfaite conserve `status: "draft"` ou
`status: "editorial_review"` et `readyForPublication: false`.

## 9. Artefact d’évaluation finale d’étape

Les consignes et la grille qui dépassent les quatre champs du seed sont livrées
dans `PEDAGOGY_STAGE_ASSESSMENT_XXX.json`. L’objet racine contient exactement :

```json
{
  "specId": "PEDAGOGY_STAGE_ASSESSMENT_001",
  "schemaVersion": 1,
  "programSlug": "fondamentaux-psychologie",
  "stageSlug": "decouvrir-discipline",
  "assessment": {
    "seed": {
      "title": "Évaluation finale — Découvrir la discipline",
      "type": "case_study",
      "isRequired": true,
      "passingScore": 70
    },
    "description": "But et contexte de l’évaluation.",
    "instructions": ["Consigne observable."],
    "case": "Cas fictif complet à analyser.",
    "estimatedMinutes": 90,
    "submissionFormat": "Réponse structurée de 900 à 1 200 mots.",
    "conceptSlugs": ["objet-psychologie"],
    "rubric": [
      {
        "criterion": "Exactitude conceptuelle",
        "weight": 40,
        "requirements": ["Les concepts sont employés correctement."]
      }
    ],
    "remediation": "Revoir les notions non maîtrisées puis soumettre une révision."
  },
  "editorial": {
    "version": "1.0.0",
    "status": "draft",
    "createdAt": "2026-08-03",
    "referenceIds": [],
    "review": {
      "editorialReviewer": null,
      "subjectReviewer": null,
      "readyForPublication": false,
      "notes": []
    },
    "changeLog": []
  }
}
```

Les poids de `rubric` totalisent 100. `assessment.seed` reste identique à
`program.stages[].assessment`. Les autres champs correspondent aux colonnes déjà
présentes sur `StageAssessment` ou à une preuve éditoriale ; leur import doit être
validé séparément si le seed ne les prend pas encore en charge.

## 10. Banque autonome pour une leçon déjà intégrée

Lorsqu’une leçon existe déjà dans le seed sans ses questions, ne pas dupliquer
tout son contenu. Livrer `PEDAGOGY_ASSESSMENT_BANK_XXX.json` avec :

```json
{
  "specId": "PEDAGOGY_ASSESSMENT_BANK_001",
  "schemaVersion": 1,
  "programSlug": "fondamentaux-psychologie",
  "stageSlug": "decouvrir-discipline",
  "moduleSlug": "definition-psychologie",
  "lessonSlug": "definir-la-psychologie",
  "assessmentBanks": [],
  "editorial": {
    "version": "1.0.0",
    "status": "draft",
    "createdAt": "2026-08-03",
    "sourceResourceKeys": [],
    "review": {
      "editorialReviewer": null,
      "subjectReviewer": null,
      "readyForPublication": false,
      "notes": []
    },
    "changeLog": []
  }
}
```

`assessmentBanks` suit exactement la section 5.4. Chaque `conceptSlug`, titre
et nombre de questions doit correspondre à la leçon déjà intégrée.
