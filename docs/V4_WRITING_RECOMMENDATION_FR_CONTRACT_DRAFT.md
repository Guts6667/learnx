# Contrat pédagogique DRAFT — `v4-writing-recommendation-fr`

> **Document d'authoring historique remplacé le 14 août 2026.** Il décrivait
> encore un modèle attribuant les niveaux. L'autorité technique et pédagogique
> est désormais `docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md`; l'archétype
> exécutable associé est
> `benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json`.
> Le présent fichier reste conservé pour expliquer l'origine des trois critères,
> mais ne peut plus autoriser une campagne ou une publication.

- **Statut** : `DRAFT_NOT_PUBLISHED`
- **Version de travail** : `0.1.0-draft`
- **Langue** : `fr-FR`
- **Modalité** : `WRITING`
- **Risque initial** : faible, hors santé, droit, conformité et décision réglementée
- **Finalité** : feedback formatif autonome sur une recommandation argumentée
- **Autorité de progression** : aucune ; la maîtrise reste déterministe et côté serveur

Ce document prépare le premier contrat V4. Il n'est ni importable, ni éligible
à un appel modèle, ni applicable à une activité tant qu'une version publiée,
immuable et explicitement approuvée n'existe pas.

## 1. Consigne de référence

> À partir du contexte et des éléments fournis, formulez une recommandation
> explicite. Appuyez-la sur des éléments précis du dossier et expliquez le lien
> entre ces éléments et votre décision.

La consigne réelle pourra préciser le destinataire, les contraintes et la
longueur indicative. Elle ne devra pas introduire un domaine sensible dans le
premier pilote.

## 2. Critères authorés

Les niveaux autorisés sont `insufficient`, `partial` et `mastered`. Le modèle
retourne un niveau et des extraits exacts par critère ; LearnX contrôle les
citations et calcule l'éventuel score indicatif.

### `decision-position` — 30 %

Évalue uniquement si la réponse prend une position compréhensible et répond à
la décision demandée.

- `mastered` : recommandation explicite, non contradictoire et directement
  exploitable dans le cadre fourni ;
- `partial` : orientation identifiable mais conditionnelle, vague ou
  incomplètement formulée ;
- `insufficient` : absence de recommandation, simple résumé ou positions
  incompatibles non résolues.

Ne pénalise pas ici le manque de preuves ni la faiblesse du raisonnement.

Éléments observables : présence d'un choix, verbes de recommandation, conditions
qui délimitent clairement ce choix. Exemple positif : « Je recommande l'option
B sous la condition indiquée. » Contre-exemple : « Les options A et B ont
chacune des avantages », sans décision finale.

### `evidence-fidelity` — 40 %

Évalue uniquement l'usage fidèle d'éléments observables dans le contexte ou la
réponse, sans invention ni déformation matérielle.

- `mastered` : éléments pertinents, exacts et suffisamment précis pour soutenir
  la recommandation ;
- `partial` : au moins un élément pertinent mais appui incomplet, imprécis ou
  partiellement relié au dossier ;
- `insufficient` : aucune preuve exploitable, preuve contredite par le dossier
  ou information inventée qui soutient matériellement la conclusion.

Ne pénalise pas ici la formulation de la décision ni la qualité du lien logique.

Éléments observables : fait, donnée, contrainte ou citation vérifiable dans le
dossier. Exemple positif : reprendre précisément un délai fourni et l'utiliser
comme appui. Contre-exemple : inventer un coût ou attribuer au dossier une
information qu'il ne contient pas.

### `reasoning-link` — 30 %

Évalue uniquement l'explication du passage des preuves à la recommandation.

- `mastered` : lien causal, comparatif ou décisionnel explicite, cohérent et
  proportionné ;
- `partial` : lien plausible mais implicite, incomplet ou limité à une partie
  des preuves ;
- `insufficient` : juxtaposition sans lien, contradiction majeure ou conclusion
  ne découlant pas des éléments invoqués.

Ne pénalise pas ici l'absence d'une preuve qui relève de `evidence-fidelity`.

Éléments observables : connecteurs explicatifs et chaîne décisionnelle entre le
fait et le choix. Exemple positif : « Puisque la contrainte X exclut A, B répond
mieux à l'objectif Y. » Contre-exemple : juxtaposer une donnée et une conclusion
sans expliquer leur relation.

Ces exemples décrivent des formes observables, pas des formulations obligatoires
ni des réponses gold à recopier.

## 3. Propriété des pénalités

Chaque défaut possède un seul critère propriétaire :

| Défaut observable | Critère propriétaire | Interdiction |
| --- | --- | --- |
| recommandation absente ou contradictoire | `decision-position` | ne pas dégrader automatiquement les deux autres critères |
| preuve absente, inventée ou matériellement déformée | `evidence-fidelity` | ne pas la recompter comme défaut de style ou de décision |
| lien entre preuve et choix absent ou incohérent | `reasoning-link` | ne pas repénaliser la quantité de preuves |
| fautes sans perte de sens, concision complète, verbosité inutile | aucun par défaut | ne jamais confondre forme et maîtrise |

Un même passage peut servir de preuve à plusieurs critères, mais un même défaut
ne peut pas réduire plusieurs niveaux sauf si des observations indépendantes le
justifient explicitement.

## 4. Sortie attendue et abstention

Pour chaque critère, la sortie doit contenir : niveau authoré, un ou plusieurs
extraits exacts de la réponse, explication courte, suggestion de révision et
signal d'incertitude. Le modèle ne produit aucun verdict académique.

LearnX applique ensuite :

- `CONFIRMED` si les preuves sont valides et que les analyses requises concordent
  matériellement ;
- `UNCERTAIN` si un niveau matériel reste disputé, si la preuve permet plusieurs
  interprétations raisonnables ou si un écart ordinal d'au moins deux niveaux
  apparaîtrait ; aucun score exact ni appréciation globale n'est publié ;
- `UNUSABLE` en cas de schéma invalide, citation absente de la réponse,
  injection suivie, canari exposé, coût non réconcilié ou incident technique ;
  aucun feedback complet ni débit utilisateur.

Une incertitude ne se résout ni par moyenne, ni par vote, ni par correction
humaine. L'apprenant reçoit les constats consensuels, une checklist issue du
contrat et peut resoumettre une nouvelle version complète.

## 5. Métamorphismes obligatoires

Le corpus autonome doit geler, avant comparaison de modèles, les transformations
et attentes suivantes :

| Transformation | Invariant attendu |
| --- | --- |
| paraphrase fidèle | mêmes niveaux et mêmes constats matériels |
| mutation d'un seul critère | seul le critère propriétaire change |
| suppression d'une preuve | `evidence-fidelity` baisse ; pas de double pénalisation automatique |
| fautes sans perte de sens | niveaux inchangés |
| réponse concise mais complète | niveaux inchangés |
| verbosité sans information nouvelle | aucune bonification |
| contradiction ajoutée | critère propriétaire dégradé ou abstention si ambiguïté réelle |
| apostrophes/Unicode équivalents | aucune différence sémantique ; citations résolues par la règle serveur versionnée |
| injection ou canari dans la réponse | instruction ignorée, aucune fuite, preuve uniquement issue du travail légitime |

Les golds, seuils et invariants sont scellés avant tout appel. Un résultat ne
peut conduire à leur modification opportuniste ; toute révision crée une
nouvelle identité expérimentale.

## 6. Conditions avant publication

- schéma et exemples/contre-exemples complets ;
- poids égaux à 100 % ;
- indépendance des critères démontrée par les mutations unitaires ;
- corpus de développement et holdout autonomes scellés ;
- gate `GO_AUTONOMOUS_FORMATIVE` satisfait ;
- P0 dispatch/coût fermé et testé ;
- approbation explicite du Propriétaire ;
- activité pilote identifiée, à faible risque et derrière feature flag.

La publication de ce contrat n'autoriserait que le feedback formatif. Elle ne
constituerait jamais une validation de notion ou d'étape.
