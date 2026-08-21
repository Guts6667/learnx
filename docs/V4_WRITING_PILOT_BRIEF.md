# V4-002A — Brief de l'activité pilote WRITING

- **Statut** : `RAYAN_A_VALIDATED`
- **Ticket** : `V4-002A`
- **Baseline** : `origin/dev@185693edb424c23e372df1dbe98134330e6bb51c`
- **Responsable** : `AGENT-PEDAGOGIE`
- **Consultation obligatoire** : `AGENT-DEV-LEARNX`
- **Portée** : activité textuelle `WRITING`, `fr-FR`, faible risque
- **Appels modèle autorisés** : 0
- **Effet sur la progression** : aucun

Ce brief propose l'activité réelle et la consigne exacte du premier pilote de
feedback formatif autonome. Il ne publie aucun contrat, ne modifie pas
l'activité pédagogique existante et n'autorise ni appel fournisseur, ni panel,
ni holdout, ni activation de `V4-010`.

## 1. Décision acquise — périmètre Rayan A

### Activité réelle retenue

| Champ | Valeur |
| --- | --- |
| Programme | `fondamentaux-psychologie` |
| Spécification | `content/fondamentaux-psychologie/specs/PEDAGOGY_SPEC_067.json` |
| Étape | `integration-preuves` |
| Module | `projet-integrateur` |
| Leçon | `formuler-question-delimitee` — « Formuler une question délimitée » |
| Activité | `activity-2` — « Choisir sans forcer un cadre » |
| Type authoré | `writing` |
| Version éditoriale observée | `1.1.0` |
| SHA-256 de la spécification | `a44e5aff3e65ae0a82633cf1b3921875e991aa0f104bc6dbbc5653f260f07929` |
| SHA-256 du seed observé | `b4d07f58d7e53d2f12cd206dee17c42484b6b348d54cc2d3a8127c263c571455` |

Description existante :

> Comparer PICO, PECO, SPIDER et un cadre JBI sur deux projets fictifs ;
> retenir le plus utile, laisser les dimensions non pertinentes ouvertes et
> justifier.

La mention historique « cadre JBI » est imprécise : le cadre visé est **PCC**
(`Population`, `Concept`, `Contexte`). JBI est l'organisation qui le présente
dans la ressource de la leçon, pas le nom du cadre. La consigne finale emploie
donc exclusivement `PCC`.

Le pilote conserve l'intention de cette activité et lui fournit les deux
dossiers fictifs nécessaires à une correction reproductible. Le binding final
devra inclure l'identité immuable du programme, de la spécification, de la
leçon, de l'activité, de la consigne et du futur contrat. Avant toute
publication, il devra aussi figer le `ProgramVersion` réellement publié et son
checksum. Les chemins et slugs seuls ne suffisent pas comme identité runtime.

### Pourquoi ce choix

- la réponse est exclusivement textuelle et en français ;
- les projets sont fictifs et ne demandent aucune décision clinique,
  réglementaire ou professionnelle réelle ;
- les propriétés attendues sont observables séparément : choix, appui sur le
  dossier et justification ;
- les formulations alternatives et la concision complète peuvent être
  acceptées sans jugement de style ;
- un refus explicite de choisir peut être distingué d'une simple omission,
  ce qui exerce la décision `EXPLICITLY_REFUTED` du successeur ;
- le feedback peut rester strictement formatif et sans effet sur la maîtrise ou
  la progression.

## 2. Dossiers fictifs définitifs validés

### Projet A — comparer deux pratiques d'apprentissage

Une équipe universitaire prépare une synthèse d'études menées auprès
d'étudiants de première année. Pendant huit semaines, ces études comparent une
courte pratique de rappel hebdomadaire à la relecture libre des mêmes contenus.
Le résultat principal est la performance à un quiz réalisé deux semaines après
la dernière séance. L'équipe cherche à estimer l'effet comparatif des deux
pratiques ; elle ne cherche ni à décrire le vécu des étudiants, ni à
cartographier tous les usages possibles de la pratique de rappel.

### Projet B — comprendre une expérience de formation à distance

Une équipe prépare une synthèse d'études qualitatives fondées sur des entretiens
avec des adultes qui suivent une formation entièrement à distance. Elle étudie
leurs six premières semaines de formation et s'intéresse à la charge perçue
ainsi qu'au sentiment d'appartenance. Aucune intervention n'est imposée et
aucun groupe de comparaison n'est requis. L'équipe cherche à comprendre
l'expérience rapportée et les situations qui la façonnent ; elle ne cherche
pas à mesurer l'efficacité d'un dispositif.

Ces dossiers sont des données pédagogiques synthétiques. Ils ne décrivent ni
une étude réelle, ni une recommandation médicale, ni une décision destinée à
être appliquée hors de LearnX.

## 3. Consigne exacte définitive validée

> Répondez séparément pour le projet A et le projet B. Pour chacun :
>
> 1. choisissez un cadre parmi PICO, PECO, SPIDER et PCC, puis nommez-le ;
> 2. indiquez les dimensions de ce cadre que vous utiliseriez et celles que
>    vous laisseriez ouvertes parce qu'elles ne sont pas pertinentes pour ce
>    projet ;
> 3. reprenez ou reformulez fidèlement au moins deux éléments distincts du
>    dossier ;
> 4. expliquez explicitement le lien entre ces éléments et votre choix de
>    cadre.
>
> Plusieurs choix de cadre peuvent être recevables s'ils sont cohérents avec le
> dossier et correctement justifiés. N'inventez aucune information absente des
> dossiers.

La consigne ne fixe volontairement ni longueur minimale, ni structure de
paragraphes, ni vocabulaire obligatoire. Une réponse concise mais complète est
recevable. Les deux projets sont évalués séparément : une réponse solide au
projet A ne compense pas un élément manquant pour le projet B, et inversement.

## 4. Objectif observable borné

> À partir de cette réponse, LearnX peut établir si l'apprenant formule, pour
> chaque projet, un choix de cadre compréhensible, l'appuie fidèlement sur les
> propriétés explicites du dossier et explique le lien entre ces propriétés et
> son choix, sans exiger de conclusion sur sa maîtrise générale.

Cet objectif porte sur la conformité de la réponse à la consigne. Il ne mesure
ni l'intelligence, ni la créativité, ni le potentiel, ni la qualité générale du
raisonnement de l'apprenant.

## 5. Propriétés observables préparant V4-002B

Cette section borne le futur authoring sans préjuger du contrat qui sera soumis
à l'arbitrage `Rayan B`.

| Famille observable | Ce qui doit pouvoir être constaté | Ce qui reste interdit |
| --- | --- | --- |
| Décision | Un cadre identifiable pour chacun des deux projets | Déduire un choix à partir d'un simple résumé |
| Fidélité au dossier | Des éléments présents dans chaque dossier, sans ajout matériel | Exiger des sources externes ou récompenser une information inventée |
| Lien de justification | Une relation explicite entre les propriétés du projet et l'utilité du cadre | Repénaliser ici une preuve absente ou juger la sophistication du style |
| Dimensions laissées ouvertes | Une dimension non pertinente peut rester ouverte si la réponse l'explique | Exiger de remplir mécaniquement toutes les cases d'un cadre |

Les formulations exactes, éléments atomiques, propriétaires, variantes
acceptables, règles de statut, niveaux, templates et remédiations appartiennent
à `V4-002B`. Aucun gold détaillé n'est fixé par le présent brief.

La consultation Développement confirme qu'une décomposition en dix éléments
reste dans la cible du MVP :

| Critère préparatoire | Décomposition attendue dans V4-002B | Nombre |
| --- | --- | ---: |
| Décision et délimitation | choix du cadre et dimensions pertinentes ou ouvertes, séparément pour A et B | 4 |
| Fidélité au dossier | deux éléments distincts du dossier, séparément pour A et B | 4 |
| Justification du lien | relation explicite dossier → choix, séparément pour A et B | 2 |
| **Total** | Aucun élément partagé silencieusement entre les scénarios | **10** |

## 6. Exclusions du pilote

- aucun score académique, `PASS/FAIL`, validation de maîtrise ou effet sur
  `ConceptProgress`, `StageProgress` ou `VALIDATED` ;
- aucune appréciation de style, d'orthographe, de longueur ou d'éloquence, sauf
  perte de sens objectivement démontrable ;
- aucune correction de sources externes ni grounding documentaire dans ce
  premier pilote ;
- aucune production orale, image, fichier, code ou autre preuve multimodale ;
- aucune recommandation de santé, de droit, de conformité, de sécurité ou de
  pratique professionnelle réelle ;
- aucun feedback libre produit par un modèle ;
- aucun chat de négociation, arbitre humain opérationnel ou troisième modèle ;
- aucun appel réseau, tarification, débit, publication ou activation au titre
  de `V4-002A` ;
- aucun code, schéma, seed ou migration dans ce ticket ;
- aucun démarrage de `V4-002C` avant la clôture et l'arbitrage `Rayan B` de
  `V4-002B`.

## 7. Risques et traitements attendus

| Risque | Traitement requis avant expérience |
| --- | --- |
| Deux projets partiellement traités | Éléments propriétaires séparés par projet ; aucune compensation silencieuse entre A et B |
| Un cadre alternatif est défendable | Variantes acceptables authorées avant le corpus ; une justification cohérente ne devient pas automatiquement une erreur |
| Le refus explicite est confondu avec l'omission | Statut `EXPLICITLY_REFUTED` distinct, même effet de niveau que `NOT_DEMONSTRATED` au MVP, template distinct |
| Le modèle juge la justesse du cadre | Les modèles cherchent ou contestent seulement les preuves ; LearnX applique les règles authorées |
| La concision est sous-évaluée | Aucun minimum de mots ; corpus métamorphique « concis mais complet » obligatoire |
| Une lacune est doublement pénalisée | Chaque élément aura un propriétaire unique dans `V4-002B` |
| Une ambiguïté matérielle est forcée | `CLARIFICATION_REQUIRED` sans score exact lorsqu'une résolution change le niveau |
| Le contexte fiable devient une preuve apprenant | Seuls les spans de la réponse constituent des preuves de production ; le dossier sert de contexte de référence séparé |

## 8. Arbitrage de sélection clos

| Option | Bénéfice | Coût ou limite |
| --- | --- | --- |
| **A — Activité 067 / activity-2** — recommandée | Activité réelle, décision observable, compatible avec les trois familles historiques et `EXPLICITLY_REFUTED` | Deux projets augmentent la combinatoire ; le contrat doit isoler leurs éléments |
| B — « Réduire un thème en question » (`PEDAGOGY_SPEC_007`) | Plus simple et très facilement compilable | N'exerce pas réellement une recommandation ni le refus explicite qui a bloqué le gate précédent |
| C — Nouvelle activité synthétique dédiée | Contrôle maximal du corpus et du gold | Ne répond pas à l'objectif de brancher rapidement une activité LearnX réelle |

**Décision Rayan A acquise** : l'option A, ses trois axes, le texte exact des
deux dossiers et la consigne sont retenus. Les options B et C restent
consignées comme alternatives écartées ; elles ne sont plus en arbitrage.

## 9. Consultation obligatoire — Développement

| Champ | Valeur |
| --- | --- |
| Agent consulté | `AGENT-DEV-LEARNX` |
| Date | 21 août 2026 |
| Statut | `RECEIVED` |
| Périmètre | binding immuable, compatibilité compilateur v2, blockers et exclusions techniques |
| Modification ou appel réalisé par la consultation | aucun |

Décisions résultantes :

- le binding program/spec/leçon/activité est faisable et non ambigu ;
- la projection de l'activité est identique dans la spécification et le seed ;
- la consigne proposée est compatible avec trois critères et dix éléments ;
- chaque scénario doit rester isolé, sans compensation de A par B ;
- une dimension volontairement ouverte est une décision positive démontrée,
  pas une absence de preuve ;
- plusieurs cadres restent acceptables si leur choix est cohérent avec le
  dossier et les variantes ont été authorées avant le corpus ;
- l'actuel mécanisme runtime attend un contrat au statut `draft`, tandis que la
  spécification pédagogique est en `editorial_review` : cette compatibilité
  sera traitée par les tickets ultérieurs, sans publication dans V4-002A.

Réserve structurante : la consigne enrichie des sections 2 et 3 n'est pas
encore la consigne stockée dans `PEDAGOGY_SPEC_067`. Si `Rayan A` la valide,
elle devra être introduite par une modification pédagogique et un seed
explicitement versionnés avant toute activité utilisateur. Le contrat de
correction ne doit jamais remplacer silencieusement la consigne affichée.

## 10. Gate de sortie `Rayan A` — clos

Le 21 août 2026, Rayan a validé explicitement :

1. le texte définitif des deux dossiers fictifs de la section 2 ;
2. la consigne exacte de la section 3 ;
3. l'objectif observable inchangé de la section 4 ;
4. le maintien de toutes les exclusions de la section 6.

Formulation consignée :

> Je valide les deux scénarios, la consigne, l'objectif observable et les
> exclusions de V4-002A.

`V4-002A` est clos. `V4-002B` peut commencer ; cette décision n'autorise ni
code applicatif, ni appel modèle, ni publication de contrat.

Une modification de l'activité ou de la consigne après ce gate rouvre
`V4-002A`. Elle ne peut pas être introduite silencieusement pendant le contrat,
le corpus ou l'expérience.

## 11. Paquet de reprise final

- **Fichier créé** : `docs/V4_WRITING_PILOT_BRIEF.md` ;
- **Validations réalisées** : `git diff --check`, lint, typecheck, 1 069 tests
  et build réussis ; tests exécutés avec le stockage web expérimental Node
  désactivé conformément au contournement d'environnement connu ;
- **Consultation Développement** : `RECEIVED`, avis favorable sous les réserves
  de la section 9 ;
- **Limite** : aucun contrat atomique ni test de compilation dans ce ticket ;
- **Décision acquise** : `Rayan A` clos sur le choix du pilote, les deux
  scénarios, la consigne, l'objectif observable et les exclusions ;
- **Ticket suivant autorisé** : `V4-002B — Contrat atomique successeur`, sous
  responsabilité `AGENT-PEDAGOGIE` et sans code applicatif ;
- **Actions interdites** : appel modèle, modification de corpus/gold, ouverture
  du holdout, publication de contrat, activation V4-010, débit et tarification.
