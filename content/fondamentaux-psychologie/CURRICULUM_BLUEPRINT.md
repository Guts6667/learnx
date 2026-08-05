# Curriculum blueprint — Fondamentaux de la psychologie

## Statut

- Version : 1.0.0
- Statut : baseline éditoriale MVP
- Dernière revue : 2026-08-03
- Programme : `fondamentaux-psychologie`
- Public : adulte débutant, sans prérequis universitaire
- Volume cible : 130 à 170 heures de travail effectif, hors approfondissements

Ce document décrit la carte cible du programme, pas le contenu détaillé des
leçons. Il ne remplace ni les `PEDAGOGY_SPEC_XXX.json`, ni
`seed/sample-program.json`, qui reste la source de vérité des données
actuellement intégrées.

Le programme constitue une introduction structurée à la psychologie
scientifique. Il ne délivre pas de diplôme, ne remplace pas une licence et ne
forme pas à l’exercice clinique.

## 1. Principes de découpage

La progression suit quatre mouvements :

1. situer la discipline et ses responsabilités ;
2. apprendre à produire et évaluer des connaissances ;
3. étudier les grands mécanismes et domaines ;
4. intégrer les acquis dans une analyse fondée sur les preuves.

Le nombre actuel de treize étapes résulte de ces unités de sens. Il ne constitue
ni un standard LearnX, ni une limite. Une étape peut être scindée, fusionnée ou
ajoutée si l’alignement pédagogique le justifie selon
`PEDAGOGY_CHANGE_POLICY.md`.

Une charge de 6 à 12 heures par étape sert de repère de progression, pas de
contrainte. Les étapes plus denses peuvent dépasser ce repère lorsque leur
cohérence serait dégradée par un découpage supplémentaire. Le nombre de modules,
leçons et notions varie librement selon le sujet.

## 2. Résultats d’apprentissage du programme

À l’issue du parcours, l’apprenant doit pouvoir :

- définir la psychologie comme discipline scientifique et en distinguer les
  principaux domaines, métiers et responsabilités ;
- transformer une question générale en hypothèse et variables observables ;
- distinguer description, corrélation, causalité et interprétation ;
- lire les éléments essentiels d’un article et juger la portée de ses résultats ;
- interpréter des données descriptives, l’incertitude, une taille d’effet et les
  limites d’un test sans surinterprétation ;
- expliquer un comportement à plusieurs niveaux : biologique, cognitif,
  développemental, individuel et social ;
- mobiliser les concepts fondamentaux de cognition, développement, émotion,
  personnalité, psychologie sociale et psychopathologie ;
- distinguer description d’un trouble, diagnostic et intervention fondée sur les
  preuves ;
- analyser les dimensions éthiques, culturelles et sociales d’une affirmation
  ou d’une pratique psychologique ;
- produire une analyse intégrée, sourcée et proportionnée aux preuves.

## 3. Architecture cible

### Étape 1 — Découvrir la discipline

- Slug : `decouvrir-discipline`
- Statut seed : présente
- Finalité : délimiter l’objet de la psychologie, sa diversité et ses devoirs
  éthiques.

Module `definition-psychologie` — Qu’est-ce que la psychologie ?

- Définir la psychologie (`definir-la-psychologie`)
- Les grands domaines (`grands-domaines`)
- Les métiers et l’éthique (`metiers-et-ethique`)

Évaluation finale : analyser des situations, identifier le domaine pertinent,
le professionnel compétent, les limites de l’inférence et les enjeux éthiques.

Réemploi ultérieur : niveaux d’explication dans toutes les étapes ; éthique dans
les méthodes, la psychopathologie et les interventions.

### Étape 2 — Comprendre les grands courants

- Slug : `grands-courants`
- Statut seed : présente
- Finalité : comprendre comment les questions, méthodes et limites des grands
  courants ont façonné la psychologie contemporaine sans les présenter comme
  des blocs équivalents sur le plan empirique.

Module `histoire-et-courants` — Histoire et perspectives

- Naissance de la psychologie expérimentale (`naissance-psychologie-experimentale`)
- Behaviorisme et apprentissage (`behaviorisme-apprentissage`)
- Cognitivisme, humanisme et psychanalyse (`courants-modernes`)

Évaluation finale : comparer les explications proposées pour un même cas,
indiquer leurs apports historiques, leurs prédictions et leurs limites.

Réemploi ultérieur : behaviorisme dans l’apprentissage ; cognitivisme dans la
cognition ; histoire et niveau de preuve dans les controverses.

### Étape 3 — Raisonner scientifiquement

- Slug : `raisonner-scientifiquement`
- Statut seed : présente
- Finalité : construire une question testable et évaluer la validité d’une étude
  ou d’une conclusion.

Module `methode-scientifique` — Méthode scientifique

- Question, hypothèse et opérationnalisation
  (`question-hypothese-operationnalisation`)
- Corrélation et causalité (`correlation-causalite`)
- Plans de recherche (`plans-recherche`)
- Échantillonnage et validité (`echantillonnage-validite`)
- Éthique de la recherche (`ethique-recherche`)

Module `lire-article-scientifique` — Lire un article scientifique

- Anatomie d’un article (`anatomie-article`)
- Lire sans tout comprendre (`lecture-strategique`)
- Hiérarchie des preuves (`hierarchie-preuves`)

Évaluation finale : produire la fiche critique d’une étude simple en séparant
question, méthode, résultats, inférences, limites et enjeux éthiques.

Réemploi ultérieur : lecture critique et validité sont mobilisées dans toutes
les étapes de domaine.

### Étape 4 — Acquérir les outils quantitatifs

- Slug : `outils-quantitatifs`
- Statut seed : présente
- Finalité : raisonner avec des données sans transformer les statistiques en
recette ni confondre significativité et importance.

Module `statistiques-fondamentales` — Statistiques fondamentales

- Décrire des données (`decrire-donnees`)
- Distributions et incertitude (`distributions-incertitude`)
- Tests et interprétation (`tests-interpretation`)

Évaluation finale : analyser un petit jeu de données, choisir des résumés
pertinents et rédiger une conclusion qui explicite incertitude et limites.

Réemploi ultérieur : lecture des graphiques, tailles d’effet et incertitude dans
les études de chaque domaine.

### Étape 5 — Comprendre la cognition

- Slug : `comprendre-cognition`
- Statut seed : présente
- Finalité : expliquer comment l’expérience et le traitement de l’information
façonnent apprentissage, mémoire, perception, attention et autorégulation.

Module `cognition-apprentissage` — Cognition et apprentissage

- Apprentissage (`apprentissage`)
- Mémoire (`memoire`)
- Attention et perception (`attention-perception`)
- Métacognition (`metacognition`)

Évaluation finale : concevoir et justifier un protocole personnel
d’apprentissage en distinguant mécanismes établis, préférences et limites.

Réemploi ultérieur : apprentissage dans le développement et les interventions ;
attention et mémoire dans le fonctionnement quotidien et la psychopathologie.

### Étape 6 — Relier cerveau, corps et comportement

- Slug cible : `bases-biologiques`
- Statut seed : planifiée
- Finalité : comprendre les bases biologiques sans réduire l’explication
  psychologique au cerveau.

Module — Organisation du système nerveux

- Neurones, communication et plasticité
- Système nerveux central, périphérique et endocrinien
- Grandes structures et réseaux fonctionnels

Module — Étudier les relations cerveau-comportement

- Lésions, neuropsychologie et études de cas
- Imagerie, électrophysiologie et limites d’inférence
- Gènes, environnement et développement

Évaluation finale : comparer plusieurs méthodes pour étudier une fonction et
construire une explication multiniveau d’un cas.

Réemploi : méthodes et causalité de l’étape 3 ; mémoire et perception de
l’étape 5 ; stress, développement et troubles dans les étapes suivantes.

### Étape 7 — Comprendre le développement au cours de la vie

- Slug cible : `developpement-vie`
- Statut seed : planifiée
- Finalité : expliquer changements et continuités de l’enfance au vieillissement
  en articulant maturation, apprentissage, relations et contexte culturel.

Module — Cadres et méthodes du développement

- Continuité, stades et trajectoires
- Plans transversaux, longitudinaux et séquentiels
- Développement prénatal et petite enfance

Module — Fonctions et relations au fil de la vie

- Développement cognitif et langage
- Attachement et développement socioémotionnel
- Adolescence, âge adulte et vieillissement

Évaluation finale : interpréter une trajectoire fictive sans déterminisme,
identifier données utiles et explications alternatives.

### Étape 8 — Expliquer motivation, émotion et stress

- Slug cible : `motivation-emotion-stress`
- Statut seed : planifiée
- Finalité : relier besoins, buts, émotions, régulation et réponses au stress à
des contextes concrets.

Module — Motivation et action

- Besoins, incitations et buts
- Motivation intrinsèque et extrinsèque
- Autorégulation, habitudes et persistance

Module — Émotion et adaptation

- Composantes et théories de l’émotion
- Régulation émotionnelle
- Stress, coping, santé et limites des inférences

Évaluation finale : analyser une situation de performance ou d’adaptation avec
plusieurs modèles, puis proposer des hypothèses testables.

### Étape 9 — Étudier la personnalité et les différences individuelles

- Slug cible : `personnalite-differences-individuelles`
- Statut seed : planifiée
- Finalité : décrire des différences relativement stables, leur mesure et leurs
limites sans transformer un score en étiquette totale.

Module — Modèles de personnalité

- Approches par traits et Big Five
- Perspectives biologiques, sociales et narratives
- Stabilité, changement et situations

Module — Mesure et interprétation

- Fidélité, validité et normes
- Autoquestionnaires, observation et biais de réponse
- Usages, limites et enjeux éthiques des tests

Évaluation finale : critiquer l’interprétation d’un profil et proposer une
communication plus valide, nuancée et éthique.

### Étape 10 — Comprendre les conduites sociales

- Slug cible : `psychologie-sociale`
- Statut seed : planifiée
- Finalité : expliquer comment autrui, les groupes, les normes et les contextes
  influencent jugement et comportement.

Module — Percevoir et influencer

- Cognition sociale, attribution et attitudes
- Persuasion, conformité et obéissance
- Décision en groupe

Module — Relations et groupes

- Identités et relations intergroupes
- Stéréotypes, préjugés et discrimination
- Coopération, conflit et comportement prosocial

Évaluation finale : analyser une situation sociale réelle documentée en
distinguant description, mécanismes possibles, preuves et implications éthiques.

### Étape 11 — Comprendre la psychopathologie

- Slug cible : `psychopathologie`
- Statut seed : planifiée
- Finalité : comprendre les notions de trouble, classification, facteurs de
  risque et protection sans apprendre à s’autodiagnostiquer ou diagnostiquer
  autrui.

Module — Définir et classifier

- Normalité, souffrance, handicap et contexte
- Classification, diagnostic, comorbidité et limites
- Modèles biopsychosociaux et trajectoires

Module — Familles de troubles

- Troubles anxieux, obsessionnels et liés au stress
- Troubles dépressifs et bipolaires
- Troubles psychotiques, neurodéveloppementaux et de la personnalité

Évaluation finale : construire une formulation prudente d’un cas fictif,
indiquer les informations manquantes et exclure toute conclusion diagnostique
non justifiée.

### Étape 12 — Évaluer les interventions et les applications

- Slug cible : `interventions-applications`
- Statut seed : planifiée
- Finalité : distinguer familles d’interventions, évaluation d’efficacité et
  applications de la psychologie dans différents contextes.

Module — Interventions psychologiques

- Évaluation, formulation et décision partagée
- Grandes familles de psychothérapies
- Efficacité, effets indésirables, alliance et adaptation

Module — Psychologie appliquée

- Santé et prévention
- Éducation et apprentissage
- Travail, ergonomie et organisations

Évaluation finale : comparer deux interventions ou applications à partir de
leurs objectifs, preuves, limites, accessibilité et enjeux éthiques.

### Étape 13 — Intégrer et argumenter à partir des preuves

- Slug cible : `integration-preuves`
- Statut seed : planifiée
- Finalité : mobiliser plusieurs niveaux d’explication et évaluer une
affirmation psychologique contemporaine de bout en bout.

Module — Science cumulative et controverses

- Réplication, transparence et science ouverte
- Généralisation, diversité des échantillons et contexte culturel
- Communication publique, désinformation et limites de l’expertise

Module — Projet intégrateur

- Formuler une question délimitée
- Chercher et hiérarchiser les sources
- Comparer méthodes et résultats
- Rédiger une conclusion proportionnée aux preuves

Évaluation finale du programme : dossier sourcé et présentation courte analysant
une affirmation psychologique, avec méthode de recherche, synthèse des preuves,
limites, implications éthiques et pistes de vérification.

## 4. Progression spiralaire

| Notion initiale | Réemploi principal |
| --- | --- |
| Objet et domaines de la psychologie | Choix du niveau d’explication dans toutes les études de cas |
| Courants historiques | Apprentissage, cognition, personnalité et interventions |
| Opérationnalisation | Mesure de la cognition, du développement, des émotions et de la personnalité |
| Corrélation et causalité | Biologie, développement, santé et psychologie sociale |
| Validité et échantillonnage | Lecture critique de chaque domaine et projet final |
| Incertitude et taille d’effet | Interprétation des études et efficacité des interventions |
| Apprentissage et mémoire | Développement, habitudes, éducation et interventions |
| Niveaux biologiques, psychologiques et sociaux | Développement, stress, psychopathologie et projet final |
| Éthique | Recherche, tests, diagnostic, intervention et communication publique |

Le réemploi est planifié lorsqu’il apporte une nouvelle application ou un niveau
de difficulté supérieur. Il n’impose pas de répéter artificiellement chaque
notion une fois.

## 5. Compatibilité avec l’état actuel

- Les cinq étapes, six modules et vingt et une leçons déjà présents dans le seed
  conservent leurs titres, slugs et ordre.
- Les étapes 6 à 13 sont planifiées ; ce commit ne les ajoute pas au seed.
- `CURRICULUM_BLUEPRINT.md` est la source de vérité de la carte cible.
- `seed/sample-program.json` est la source de vérité de ce qui est intégré.
- Une `PEDAGOGY_SPEC` détaille une seule leçon et ne redéfinit pas cette carte.
- Toute divergence est classée avec `PEDAGOGY_CHANGE_POLICY.md` avant édition.

## 6. Références de cadrage

Ces références cadrent la couverture et les résultats d’apprentissage ; elles ne
sourcent pas à elles seules les futures leçons.

1. American Psychological Association. (2023). *APA Guidelines for the
   Undergraduate Psychology Major: Version 3.0*. Approuvées en août 2023.
   https://www.apa.org/about/policy/undergraduate-psychology-major.pdf
2. Ministère de l’Enseignement supérieur et de la Recherche. (2014).
   *Référentiels de compétences des mentions de licence — Mention Psychologie*.
   https://www.enseignementsup-recherche.gouv.fr/sites/default/files/content_migration/document/Referentiels_de_competences_licence_formatMESR_2014_12_29_ssblancs_380001.pdf
3. Spielman, R. M., Jenkins, W. J., & Lovett, M. D. (2020). *Psychology 2e*.
   OpenStax, Rice University.
   https://openstax.org/details/books/psychology-2e

Liens et éditions vérifiés le 3 août 2026. Le blueprint ne revendique pas
l’équivalence avec le cursus complet décrit par ces référentiels.
