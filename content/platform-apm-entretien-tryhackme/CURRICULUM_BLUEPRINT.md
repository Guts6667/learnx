# Blueprint pédagogique — Platform APM : entretien TryHackMe

## Finalité

Ce parcours intensif prépare Rayan à l'entretien avec le Head of Product de
TryHackMe pour le poste d'Associate Product Manager (Platform). Il vise la
maîtrise opérationnelle utile dès l'entretien : cadrer, écrire, prioriser,
mesurer, communiquer et dialoguer avec une équipe d'ingénierie.

Il ne cherche pas à transformer le candidat en ingénieur infrastructure ou en
SRE. Le niveau technique attendu est celui qui permet de poser de bonnes
questions, comprendre les arbitrages et traduire leur impact produit.

## Résultat attendu

À l'issue du parcours, l'apprenant doit pouvoir :

1. expliquer le rôle d'une Platform Squad et son impact indirect en 75 secondes ;
2. transformer un problème vague en ticket Jira testable ;
3. expliquer le but des événements Scrum et produire un update remote concis ;
4. écrire un OKR Platform orienté outcome et choisir ses métriques ;
5. prioriser sous incertitude sans appliquer mécaniquement un score ;
6. dialoguer sur les concepts d'infrastructure essentiels sans surjouer son expertise ;
7. résoudre un cas Platform et défendre une prochaine action devant un Head of Product.

## Architecture

La cohérence pédagogique conduit à deux étapes et six leçons, pour environ
quatre heures trente de travail effectif sur deux jours, évaluations comprises.

### Étape 1 — Comprendre le rôle et exécuter

- Décoder le rôle de Platform APM chez TryHackMe ;
- transformer un problème en ticket livrable ;
- faire tourner Scrum et communiquer à distance.

L'évaluation produit un pitch, un ticket Jira et un update de sprint.

### Étape 2 — Décider et dialoguer technique

- écrire des OKRs et choisir les métriques plateforme ;
- prioriser avec RICE et le jugement produit ;
- dialoguer infrastructure et réussir le cas Head of Product.

L'évaluation finale combine un cas Platform de sept minutes et cinq réponses
chronométrées de 75 secondes.

## Principes d'authoring

- Chaque leçon mène à une production réutilisable pendant l'entretien.
- Les scénarios propres à TryHackMe sont explicitement hypothétiques lorsqu'ils
  ne proviennent pas de l'offre publique.
- Les modèles chiffrés servent d'exemples ; aucune baseline interne n'est inventée.
- Les ressources en anglais sont courtes, guidées et accompagnées d'un contenu
  explicatif en français.
- Les exercices précèdent les mini-évaluations afin de favoriser le rappel actif.
- Les réponses orales visent 60 à 75 secondes et se terminent par une conclusion.

## Sources principales

Le contenu s'appuie sur l'offre officielle TryHackMe, le Scrum Guide, la
documentation Atlassian, le modèle RICE publié par Intercom, la documentation
GitHub Actions, AWS et le Site Reliability Workbook de Google. Les contrôles
détaillés restent dans les sidecars des `PEDAGOGY_SPEC_078` à `083`.
