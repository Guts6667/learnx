# Pilotage de projets IA et ISO/IEC 42001

Ce dossier contient les artefacts pédagogiques du parcours conçu pour un
consultant Data/IA junior souhaitant cadrer, piloter et gouverner des projets
d’IA en entreprise, avec une préparation progressive aux compétences d’un
Lead Implementer ISO/IEC 42001.

## Périmètre

- public principal : adulte en début de carrière de consultant IA ;
- langue principale : français, avec des ressources officielles en anglais
  lorsque leur qualité le justifie ;
- durée cible : environ 48 heures réparties sur huit semaines ;
- cas fil rouge : cadrage, réalisation, gouvernance et amélioration d’un
  assistant génératif d’entreprise ;
- objectif : savoir produire et défendre les livrables d’une mission, pas
  mémoriser une norme ni garantir la réussite à un examen particulier.

La structure validée est décrite dans
[`CURRICULUM_BLUEPRINT.md`](./CURRICULUM_BLUEPRINT.md).

## Organisation des fichiers

- `specs/PEDAGOGY_SPEC_XXX.json` : une leçon complète par fichier ;
- `stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_XXX.json` : l’évaluation finale
  obligatoire de chaque étape ;
- `CURRICULUM_BLUEPRINT.md` : architecture, progression, durées et contraintes
  de conception.

Les identifiants de spécification et d’évaluation sont globaux au dépôt. Le
payload `lesson` est destiné au seed ; le sidecar `editorial` conserve les
preuves, les contrôles de ressources et les décisions de revue hors base.

| Étape | Spécifications | Évaluation finale |
| --- | --- | --- |
| 1 | `090` à `092` | `019` |
| 2 | `093` à `095` | `020` |
| 3 | `096` à `098` | `021` |
| 4 | `099` à `103` | `022` |
| 5 | `104` à `110` | `023` |
| 6 | `111` à `116` | `024` |
| 7 | `117` à `120` | `025` |
| 8 | `121` à `125` | `026` |

L'ensemble représente 36 leçons, 88 notions obligatoires, 270 questions avec
feedback explicatif et huit études de cas finales, pour 48 heures indicatives
hors approfondissements facultatifs.

## Statut éditorial

Les artefacts de ce dossier sont des brouillons de conception. Leur bundle est
branché au mécanisme de seed, mais il n'a pas été exécuté et le programme reste
non publiable tant que les contrôles suivants ne sont pas terminés :

1. revue pédagogique et métier de chaque leçon ;
2. vérification humaine des affirmations sensibles et des localisateurs ;
3. contrôle des liens, accès, langues et alternatives ;
4. exécution des tests d'import complets dans un environnement disposant des
   dépendances du projet ;
5. décision de publication explicite.

Le livre fourni par l’apprenant est utilisé comme éclairage secondaire. Il ne
remplace ni les textes officiels, ni une lecture autorisée de la norme, ni un
avis juridique. Aucun numéro d’exigence ou de contrôle ISO n’est inventé dans
les contenus.

Les pages publiques de l'ISO et le texte de la norme ne sont pas utilisés comme
preuves d'authoring ni imposés comme ressources apprenant. Toute correspondance
normative détaillée devra être établie lors d'une revue humaine autorisée.

## Principe de parcours

Une leçon alterne les apports, les ressources apprenant lorsqu’elles sont
nécessaires, les exercices et les mini-évaluations au point d’usage. Une
ressource consultée ne prouve jamais la maîtrise. Chaque étape se conclut par
un livrable professionnel corrigible au moyen d’une grille explicite.
