# Engineering Foundations — Architecture, backend et infrastructure

Ce dossier contient les artefacts pédagogiques d’un parcours destiné à un
Product Engineer ou développeur front-end expérimenté qui sait déjà construire
des interfaces et des produits, mais souhaite renforcer les fondations
nécessaires pour concevoir, livrer et diagnostiquer un service complet.

Le parcours ne vise ni un rôle DevOps, ni un rôle SRE, ni l’administration d’une
plateforme cloud. Il vise le niveau d’autonomie attendu d’un ingénieur produit
capable de comprendre ce qui se passe entre le navigateur, l’API, la base de
données, l’environnement d’exécution et le pipeline de livraison.

## Périmètre

- public principal : développeur front-end ou Product Engineer expérimenté,
  disposant déjà de bases solides en TypeScript et en conception produit ;
- langue principale : français, avec des ressources officielles en anglais
  lorsque leur qualité ou leur précision le justifie ;
- durée cible : environ 34 heures réparties sur six semaines ;
- projet fil rouge : construire le socle applicatif et opérationnel de
  **Grounded Inspector**, dans un dépôt totalement séparé de LearnX ;
- objectif : savoir expliquer les choix d’architecture, construire un backend
  correct, rendre l’environnement reproductible, diagnostiquer les pannes
  courantes et livrer avec des contrôles proportionnés ;
- hors périmètre : Kubernetes, Terraform avancé, administration de clusters,
  astreinte SRE, réseau avancé et construction d’une plateforme interne.

La structure cible est décrite dans
[`CURRICULUM_BLUEPRINT.md`](./CURRICULUM_BLUEPRINT.md).
Le projet partagé avec le parcours IA est défini dans
[`GROUNDED_INSPECTOR_PROJECT.md`](./GROUNDED_INSPECTOR_PROJECT.md).

## Organisation prévue des fichiers

- `specs/PEDAGOGY_SPEC_XXX.json` : une leçon complète par fichier ;
- `stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_XXX.json` : l’évaluation finale
  obligatoire de chaque étape ;
- `CURRICULUM_BLUEPRINT.md` : architecture, progression, durées et contraintes
  de conception ;
- `GROUNDED_INSPECTOR_PROJECT.md` : vision, limites et incréments du projet fil
  rouge externe.

Les numéros de spécifications et d’évaluations seront réservés seulement après
validation du blueprint afin d’éviter les collisions avec les artefacts déjà
présents dans le dépôt.

## Statut éditorial

- classification : `CONTENT_ONLY` ;
- statut : blueprint en cours d’authoring ;
- programme LearnX cible : `engineering-foundations-product-engineers` ;
- aucun seed, aucune migration et aucune modification du moteur ne sont inclus
  dans ce premier lot ;
- le programme restera `draft` jusqu’à la revue des sources, des activités, des
  banques de questions et des évaluations finales.

## Principe de parcours

Chaque étape produit une partie vérifiable de Grounded Inspector. Les lectures
restent des supports ; elles ne valident jamais une compétence. La maîtrise est
prouvée par des exercices de conception, d’implémentation, de diagnostic et de
justification des compromis.

Le parcours privilégie un monolithe modulaire, PostgreSQL et Docker Compose. Les
microservices, queues distribuées et composants supplémentaires ne sont
introduits que lorsqu’un problème mesuré les justifie.