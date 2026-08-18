# AI Product Engineer — RAG et systèmes LLM en TypeScript

Ce dossier contient les artefacts pédagogiques d’un parcours destiné à un
Product Engineer ou développeur TypeScript souhaitant construire, évaluer et
exploiter des fonctionnalités IA fiables.

Le parcours est totalement distinct de
`pilotage-projets-ia-iso-42001`. Il n’est orienté ni gouvernance, ni conseil, ni
certification. Il est centré sur l’ingénierie produit : ingestion, embeddings,
retrieval, RAG, citations, abstention, évaluations, observabilité, workflows et
mise en production.

## Périmètre

- public principal : développeur ou Product Engineer expérimenté en TypeScript,
  avec des bases backend ou ayant validé le programme
  `engineering-foundations-product-engineers` ;
- langue principale : français, avec des ressources officielles en anglais
  lorsque leur qualité le justifie ;
- durée cible : environ 40 heures réparties sur sept semaines ;
- projet fil rouge : transformer **Grounded Inspector** en laboratoire RAG
  visuel, puis ajouter un connecteur LearnX en lecture seule ;
- stack cible : TypeScript, React, Hono, PostgreSQL, `pgvector`, Zod, Vitest,
  Playwright et Docker Compose ;
- Python : non requis pour construire ou valider le parcours ;
- objectif : savoir expliquer, mesurer et améliorer un système RAG, pas seulement
  brancher un modèle à une interface de chat.

La structure cible est décrite dans
[`CURRICULUM_BLUEPRINT.md`](./CURRICULUM_BLUEPRINT.md).
Le contrat du projet partagé est défini dans
[`../engineering-foundations-product-engineers/GROUNDED_INSPECTOR_PROJECT.md`](../engineering-foundations-product-engineers/GROUNDED_INSPECTOR_PROJECT.md).

## Organisation prévue des fichiers

- `specs/PEDAGOGY_SPEC_XXX.json` : une leçon complète par fichier ;
- `stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_XXX.json` : l’évaluation finale
  obligatoire de chaque étape ;
- `CURRICULUM_BLUEPRINT.md` : architecture, progression, durées et contraintes
  de conception.

Les identifiants globaux seront réservés après validation du blueprint.

## Statut éditorial

- classification : `CONTENT_ONLY` ;
- statut : blueprint en cours d’authoring ;
- programme LearnX cible : `ai-product-engineer-typescript` ;
- aucun seed, aucune migration et aucune modification du moteur LearnX ne sont
  inclus dans ce premier lot ;
- le programme restera `draft` jusqu’à la revue des sources, activités, banques
  de questions et évaluations finales.

## Principe de parcours

Le programme commence par un pipeline déterministe et inspectable. Les
optimisations, agents et frameworks ne sont introduits qu’après l’existence
d’une baseline et d’un dataset d’évaluation.

```text
appel LLM structuré
→ ingestion et chunking
→ embeddings et recherche exacte
→ réponse sourcée et abstention
→ traces et évaluations
→ recherche hybride et reranking
→ outils, workflows et agents
→ connecteur et contrat LearnX
```

Chaque changement doit être comparé à des cas représentatifs selon qualité,
coût et latence. Une démonstration réussie isolée ne constitue jamais une preuve
de fiabilité.