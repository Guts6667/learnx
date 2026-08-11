# Rapport du benchmark des modèles de correction IA

- **Ticket** : V4-003
- **Statut** : NO-GO — exécution live et revue pédagogique requises
- **Corpus** : `learnx-french-text-corpus-v1`
- **Prompt** : `1.0.0`
- **Données réelles envoyées** : aucune

## Corpus et protocole prêts

Le corpus contient 24 réponses synthétiques françaises : six profils
(`SUCCESSFUL`, `PARTIAL`, `ERRONEOUS`, `AMBIGUOUS`, `OFF_TOPIC`,
`PROMPT_INJECTION`) pour chacun des quatre types textuels du pilote (`writing`,
`reflection`, `practice`, `project`). Chaque cas possède une attente explicite
pour les deux critères de son contrat.

Le protocole exécute trois répétitions par cas et par candidat, avec un retry au
maximum. Il mesure accord par critère, citations inventées, erreur de calibration,
résistance aux injections, sorties invalides, médiane/P75/P90 de latence, coût
complet estimé, retries, demandes de seconde passe, variabilité et désaccord
entre modèles.

## Candidats épinglés

Les identifiants ci-dessous proviennent du catalogue OpenRouter observé le
11 août 2026. Ils sont exacts et ne contiennent aucun alias dynamique :

1. `openai/gpt-5.6-terra-20260709` ;
2. `anthropic/claude-4.6-sonnet-20260217` ;
3. `google/gemini-3.6-flash-20260721`.

Les prix du fichier de configuration sont un snapshot de benchmark, pas une
constante de facturation ni une promesse commerciale.

## Seuils pré-enregistrés

- accord par critère ≥ 85 % ;
- citations inventées ≤ 1 % ;
- coût complet de l’exécution de référence ≤ 10 USD ;
- sûreté sur injections ≥ 90 % ;
- sorties invalides ≤ 1 % ;
- erreur moyenne de calibration ≤ 25 % ;
- latence P90 ≤ 20 secondes ;
- variabilité inter-répétitions ≤ 10 %.

Un changement ultérieur régresse également dès que, face à la baseline promue,
l’accord baisse de plus de 3 points, les citations inventées augmentent de plus
de 0,5 point, la sûreté injection baisse de plus de 3 points, ou la latence P90
ou le coût complet augmentent de plus de 25 %. Le rollback revient au dernier
couple modèle/prompt ayant passé le même corpus dès qu’un seuil absolu ou une de
ces limites relatives est franchi.

## Gates restant à lever

1. revue pédagogique humaine du corpus et consignation du réviseur/de la date ;
2. exécution plafonnée avec une clé OpenRouter de développement ;
3. analyse humaine des désaccords, notamment des ambiguïtés et injections ;
4. choix documenté du modèle primaire et, si justifié, du modèle de seconde passe.

Tant que ces quatre gates ne sont pas levés, **aucun modèle n’est choisi ni
autorisé en production**. Cette absence de sélection est intentionnelle : un
classement inventé ou issu de la réputation des modèles violerait V4-003.
