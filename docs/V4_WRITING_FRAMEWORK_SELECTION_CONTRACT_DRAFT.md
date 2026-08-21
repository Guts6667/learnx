# V4-002B — Contrat atomique DRAFT du pilote WRITING

- **Statut** : `APPROVED_INPUT_V4_002C`
- **Ticket** : `V4-002B`
- **Contrat** : `v4-writing-framework-selection-fr`
- **Version de travail** : `1.0.0-draft`
- **Schéma cible** : `executable-rubric/v2`, à implémenter dans `V4-002C`
- **Langue / modalité / risque** : `fr-FR` / `WRITING` / faible
- **Éligibilité revendiquée** : aucune avant compilation
- **Progression, maîtrise et validation** : aucun effet
- **Appels modèle autorisés** : 0

Ce document transforme le brief validé de `V4-002A` en contrat pédagogique
atomique. Il fixe les règles que le futur compilateur devra représenter ; il ne
prétend pas être déjà compilable avec le schéma v1, ne publie aucun contrat et
n'autorise aucune expérience.

## 1. Binding du pilote

| Champ | Valeur figée ou état |
| --- | --- |
| Programme | `fondamentaux-psychologie` |
| Spécification source | `content/fondamentaux-psychologie/specs/PEDAGOGY_SPEC_067.json` |
| Leçon | `formuler-question-delimitee` |
| Activité | `activity-2` — « Choisir sans forcer un cadre » |
| Brief approuvé | `docs/V4_WRITING_PILOT_BRIEF.md`, gate `Rayan A` clos le 21 août 2026 |
| Version éditoriale observée | `1.1.0` |
| SHA-256 de la spécification observée | `a44e5aff3e65ae0a82633cf1b3921875e991aa0f104bc6dbbc5653f260f07929` |
| SHA-256 du seed observé | `b4d07f58d7e53d2f12cd206dee17c42484b6b348d54cc2d3a8127c263c571455` |
| `ProgramVersion` publié | à lier avant toute publication ; absent de ce DRAFT |
| Consigne dans la spec et le seed | non encore mise à jour ; modification pédagogique versionnée obligatoire ultérieurement |

Le contrat ne peut jamais remplacer silencieusement la consigne affichée. Le
binding runtime final doit lier la version publiée du programme, la consigne,
les deux scénarios, le contrat et leurs checksums.

## 2. Objectif borné

> À partir de cette réponse, LearnX peut établir si l'apprenant formule, pour
> chaque projet, un choix de cadre compréhensible, l'appuie fidèlement sur les
> propriétés explicites du dossier et explique le lien entre ces propriétés et
> son choix, sans conclure sur sa maîtrise générale.

Trois axes seulement sont autorisés :

1. `framework-decision` — choix et délimitation du cadre ;
2. `dossier-fidelity` — fidélité aux éléments du dossier ;
3. `choice-rationale` — lien explicite entre dossier et choix.

Le style, la longueur, l'orthographe, l'éloquence, la profondeur supposée et la
connaissance externe ne sont pas des critères.

## 3. Contexte fiable authoré

Les faits ci-dessous servent à vérifier la fidélité. Ils ne constituent jamais
des preuves de la production de l'apprenant : seules les portions certifiées de
sa réponse peuvent démontrer un élément.

### Projet A

| Clé | Proposition fiable |
| --- | --- |
| `a-population-first-year` | Les études portent sur des étudiants de première année. |
| `a-duration-eight-weeks` | Les pratiques sont comparées pendant huit semaines. |
| `a-retrieval-weekly` | L'une des pratiques est un rappel court et hebdomadaire. |
| `a-free-rereading` | L'autre pratique est la relecture libre des mêmes contenus. |
| `a-delayed-quiz` | Le résultat principal est un quiz deux semaines après la dernière séance. |
| `a-comparative-effect` | La synthèse cherche un effet comparatif entre les deux pratiques. |
| `a-not-experience` | La synthèse ne cherche pas à décrire le vécu des étudiants. |
| `a-not-mapping` | La synthèse ne cherche pas à cartographier tous les usages du rappel. |

### Projet B

| Clé | Proposition fiable |
| --- | --- |
| `b-qualitative-interviews` | Les études sont qualitatives et fondées sur des entretiens. |
| `b-adults-remote` | Elles portent sur des adultes en formation entièrement à distance. |
| `b-first-six-weeks` | Elles étudient les six premières semaines de formation. |
| `b-perceived-load` | La charge perçue fait partie des phénomènes étudiés. |
| `b-belonging` | Le sentiment d'appartenance fait partie des phénomènes étudiés. |
| `b-no-intervention` | Aucune intervention n'est imposée. |
| `b-no-comparator` | Aucun groupe de comparaison n'est requis. |
| `b-understand-experience` | Le but est de comprendre l'expérience et les situations qui la façonnent. |
| `b-not-effectiveness` | Le but n'est pas de mesurer l'efficacité d'un dispositif. |

Une paraphrase fidèle est recevable. Une information plus précise que le
dossier n'est pas automatiquement fausse, mais elle ne peut pas servir de
preuve et devient une contradiction si elle modifie matériellement le projet.

## 4. Variantes de cadre acceptables

Le contrat n'impose pas un mot-clé unique. Le critère `framework-decision`
observe uniquement qu'un choix est explicite et délimité. La cohérence entre
ce choix et le projet appartient exclusivement à `choice-rationale` ; une
décision clairement formulée ne disparaît pas parce que sa justification est
faible.

| Projet | Variante de référence | Variante recevable sous condition | Non recevable sans modification du dossier |
| --- | --- | --- | --- |
| A | `PICO` : population, intervention, comparaison et résultat sont présents | `PECO` si la pratique de rappel est explicitement traitée comme exposition et si comparaison/résultat restent fidèles | `SPIDER` ou `PCC` s'ils remplacent l'objectif comparatif par une exploration ou une expérience absente du dossier |
| B | `SPIDER` : échantillon, phénomène, design, évaluation et type de recherche sont présents | `PCC` si adultes, expérience de formation et contexte entièrement distant sont explicitement reliés | `PICO` ou `PECO` s'ils inventent intervention, exposition, comparaison ou efficacité |

Ces variantes ont été validées au gate `Rayan B`. Elles sont figées avant le
corpus mécanique et ne pourront pas être élargies après lecture des sorties
d'un modèle sous une identité gelée.

## 5. Les trois critères et leurs niveaux

Chaque élément reste résolu séparément pour les projets A et B et le certificat
conserve ce détail. Le niveau global reconnaît une réponse partielle, mais le
niveau `mastered` exige tous les éléments des deux projets : une excellente
réponse au projet A ne peut jamais compenser le projet B pour atteindre le
niveau complet.

| Critère | `insufficient` | `partial` | `mastered` |
| --- | --- | --- | --- |
| `framework-decision` | Aucun des quatre éléments de décision n'est démontré | Un à trois éléments de décision sur quatre sont démontrés | Choix et traitement des dimensions sont démontrés pour A et B, soit quatre sur quatre |
| `dossier-fidelity` | Aucun des quatre faits attendus n'est démontré, ou un conflit matériel non résolu est utilisé comme appui | Un à trois faits distincts et fidèles sur quatre sont démontrés, sans conflit matériel | Deux faits distincts et fidèles pour A et deux pour B, sans conflit matériel |
| `choice-rationale` | Aucun lien explicite n'est démontré sur un projet où une propriété est formulée | Le lien est démontré pour un seul des deux projets | Le lien est démontré séparément pour A et B |

Le score indicatif est désactivé. Les niveaux servent uniquement à choisir le
feedback formatif ; ils n'alimentent ni progression, ni maîtrise, ni
`PASS/FAIL`.

## 6. Les dix éléments atomiques

| Élément | Type | Propriétaire unique | Scénario | Rôle |
| --- | --- | --- | --- | --- |
| `project-a-framework-choice` | `FACT` | `framework-decision` | A | Un cadre recevable est nommé comme choix final. |
| `project-a-dimension-scope` | `RELATION` | `framework-decision` | A | Les dimensions utilisées ou laissées ouvertes sont reliées au cadre choisi. |
| `project-b-framework-choice` | `FACT` | `framework-decision` | B | Un cadre recevable est nommé comme choix final. |
| `project-b-dimension-scope` | `RELATION` | `framework-decision` | B | Les dimensions utilisées ou laissées ouvertes sont reliées au cadre choisi. |
| `project-a-dossier-fact-1` | `FACT` | `dossier-fidelity` | A | Un premier élément fidèle du dossier A est mobilisé. |
| `project-a-dossier-fact-2` | `FACT` | `dossier-fidelity` | A | Un second élément fidèle, distinct du premier, est mobilisé. |
| `project-b-dossier-fact-1` | `FACT` | `dossier-fidelity` | B | Un premier élément fidèle du dossier B est mobilisé. |
| `project-b-dossier-fact-2` | `FACT` | `dossier-fidelity` | B | Un second élément fidèle, distinct du premier, est mobilisé. |
| `project-a-choice-rationale` | `JUSTIFICATION` | `choice-rationale` | A | Le choix est relié explicitement aux faits fidèles mobilisés pour A. |
| `project-b-choice-rationale` | `JUSTIFICATION` | `choice-rationale` | B | Le choix est relié explicitement aux faits fidèles mobilisés pour B. |

### 6.1 Choix du cadre — A et B

- `SUPPORTED` : un choix final parmi PICO, PECO, SPIDER ou PCC est identifiable
  dans un span exact ;
- `NOT_DEMONSTRATED` : aucun choix final n'est identifiable ;
- `EXPLICITLY_REFUTED` : la réponse affirme explicitement qu'aucun cadre n'est
  choisi ;
- `CONTRADICTED` : plusieurs choix finaux incompatibles restent actifs sans
  condition qui les départage ;
- `AMBIGUOUS` : le texte hésite entre plusieurs cadres et les résolutions
  possibles changent le niveau.

Refuser un cadre précis tout en en retenant clairement un autre ne constitue
pas `EXPLICITLY_REFUTED` pour l'élément générique de choix.

### 6.2 Traitement des dimensions — A et B

- `SUPPORTED` : les dimensions du cadre choisi sont nommées ou décrites, et la
  réponse indique lesquelles sont utilisées ou laissées ouvertes ; déclarer
  qu'aucune dimension n'est laissée ouverte est recevable si toutes sont
  effectivement pertinentes ;
- `NOT_DEMONSTRATED` : le cadre est nommé sans traitement de ses dimensions ;
- `EXPLICITLY_REFUTED` : la réponse refuse explicitement de préciser les
  dimensions ;
- `CONTRADICTED` : une même dimension est simultanément utilisée et déclarée
  ouverte sans explication ;
- `AMBIGUOUS` : le statut d'au moins une dimension peut être compris de deux
  manières matériellement différentes.

Cet élément dépend du choix du cadre. Si le choix n'est pas démontré, il est
`BLOCKED_BY_DEPENDENCY` pour la restitution : LearnX ne publie pas un second
reproche sur les dimensions.

### 6.3 Deux faits distincts — A et B

Les deux éléments forment un groupe non ordonné. Le serveur peut affecter les
faits fidèles aux slots 1 et 2 dans n'importe quel ordre, puis canoniser cette
affectation. Deux reformulations de la même proposition ne valent qu'un fait.

- `SUPPORTED` : un span exact de la réponse reformule fidèlement une proposition
  fiable du scénario et n'est pas déjà affecté à l'autre slot ;
- `NOT_DEMONSTRATED` : aucun fait distinct supplémentaire n'est disponible ;
- `EXPLICITLY_REFUTED` : la réponse affirme explicitement ne pas s'appuyer sur
  le dossier ; ce refus est consigné une seule fois au niveau du groupe ;
- `CONTRADICTED` : un passage présenté comme fait du dossier entre matériellement
  en conflit avec le contexte fiable ;
- `AMBIGUOUS` : une paraphrase peut ou non conserver le sens du dossier et cette
  résolution change le niveau.

Un même span ou une même proposition ne peut satisfaire les deux slots. Un
conflit matériel abaisse une seule fois le niveau de fidélité du scénario ; il
n'est jamais dupliqué artificiellement sur les deux éléments.

### 6.4 Justification du lien — A et B

- `SUPPORTED` : un ou plusieurs spans exacts explicitent une relation entre le
  cadre choisi et au moins un fait fidèle déjà certifié ;
- `NOT_DEMONSTRATED` : des faits fidèles sont disponibles, mais aucun lien avec
  le choix n'est expliqué ;
- `EXPLICITLY_REFUTED` : la réponse indique explicitement qu'elle ne justifie
  pas son choix ;
- `CONTRADICTED` : le lien comporte un conflit interne ou rend le cadre
  incompatible avec les propriétés que la réponse attribue au projet ;
- `AMBIGUOUS` : plusieurs relations plausibles conduisent à des niveaux
  différents.

La relation est évaluée sur les propriétés que la réponse attribue au projet,
même si l'une d'elles est ensuite classée `CONTEXT_MISMATCH` sous
`dossier-fidelity`. La vérité du fait ne rétroagit donc pas sur l'existence du
lien. `CONTEXT_MISMATCH` appartient exclusivement à `dossier-fidelity` ;
`choice-rationale` utilise `INTERNAL_CONFLICT` ou
`FRAMEWORK_MAPPING_MISMATCH`. L'élément est `BLOCKED_BY_DEPENDENCY` uniquement
si aucune propriété du projet n'est formulée : l'absence de faits ne doit pas
générer un second malus ni un second message sous `choice-rationale`.

## 7. Règles de preuve et de relation

| Famille | Spans exacts | Contraintes supplémentaires |
| --- | ---: | --- |
| Choix | 1 à 2 | Le span doit désigner le choix final, pas seulement citer un cadre dans une comparaison. |
| Dimensions | 1 à 4 | La relation doit pointer vers le choix du même scénario ; aucune connaissance externe exigée. |
| Faits du dossier | 1 à 3 par slot | Correspondance sémantique avec une proposition fiable ; slots distincts par proposition et occurrence. |
| Justification | 1 à 6 | La relation référence le choix et un ou deux slots fidèles du même scénario. |
| Contradiction | au moins 2, sauf conflit dossier | Les spans incompatibles doivent porter sur le même scénario et la même propriété. |

Les offsets et hashes sont calculés ou vérifiés par LearnX. Un modèle ne peut
jamais transformer le contexte fiable en preuve apprenant, inventer un élément,
attribuer un niveau ou produire un feedback libre.

## 8. Dépendances non punitives et localité

`BLOCKED_BY_DEPENDENCY` est un état de résolution du compilateur, pas un statut
de preuve proposé par un modèle. Il supprime le feedback dérivé d'une lacune
déjà possédée ailleurs.

| Défaut observé | Propriétaire | Effets interdits |
| --- | --- | --- |
| Aucun cadre choisi pour A | `project-a-framework-choice` | Ne pas reprocher aussi les dimensions de A. |
| Dimensions de A incomplètes | `project-a-dimension-scope` | Ne pas dégrader fidélité ou justification. |
| Aucune propriété du projet A n'est formulée | groupe `project-a-dossier-fact-*` | Ne pas reprocher aussi l'absence de justification pour A. |
| Un seul fait fidèle pour A | `project-a-dossier-fact-2` | La justification peut être `partial` si elle relie ce fait ; ne pas exiger deux liens pour publier le constat partiel. |
| Propriété formulée mais fausse pour A | groupe `project-a-dossier-fact-*` | La fidélité échoue ; l'existence d'un lien explicatif reste évaluée indépendamment. |
| Lien absent avec deux faits présents | `project-a-choice-rationale` | Ne pas retirer les faits déjà certifiés à la fidélité. |
| Lacune du projet A | élément A concerné | Ne jamais modifier le sous-résultat B. |
| Réponse concise mais complète | aucun | Aucun malus de style, détail ou longueur. |
| Faute sans perte de sens | aucun | Aucun malus d'orthographe ou de ton. |

Les mêmes invariants s'appliquent symétriquement au projet B.

## 9. Résolution déterministe

Pour le contrat global :

```text
framework-decision
  insufficient : 0 élément SUPPORTED sur 4
  partial      : 1 à 3 éléments SUPPORTED sur 4
  mastered     : 4 éléments SUPPORTED sur 4

dossier-fidelity
  insufficient : 0 fait fidèle, ou CONTEXT_MISMATCH matériel non résolu
  partial      : 1 à 3 faits fidèles distincts sur 4, sans conflit matériel
  mastered     : 4 faits fidèles distincts sur 4, deux par projet

choice-rationale
  blocked      : aucune propriété de projet formulée ; aucun second reproche
  insufficient : 0 lien SUPPORTED sur les projets évaluables
  partial      : 1 lien SUPPORTED sur 2
  mastered     : 2 liens SUPPORTED sur 2
```

`mastered` ne peut donc jamais être atteint avec un projet incomplet. Un
sous-résultat `blocked` ne devient pas automatiquement `insufficient` : le
certificat expose la dépendance et le feedback se limite au défaut propriétaire.

Pour les éléments positifs, `EXPLICITLY_REFUTED` et `NOT_DEMONSTRATED` ont le
même effet de niveau, mais restent distincts dans le certificat et le message.
`EXPLICITLY_REFUTED` n'est pas appliqué aux signaux négatifs internes du
compilateur ; une phrase comme « je n'invente rien » ne prouve pas l'absence de
conflit avec le dossier.

Toutes les résolutions autorisées d'un `AMBIGUOUS` sont calculées :

- niveau identique pour toutes les résolutions : feedback publiable ;
- plusieurs niveaux possibles : `CLARIFICATION_REQUIRED`, sans niveau exact ni
  score exact pour le critère concerné.

## 10. Templates et remédiations

Les messages utilisent « votre réponse montre » ou « cette réponse ne permet
pas encore d'observer ». Ils ne prétendent jamais décrire la maîtrise réelle.

| Famille | `SUPPORTED` | `NOT_DEMONSTRATED` | `EXPLICITLY_REFUTED` | `CONTRADICTED` | `AMBIGUOUS` | Action de remédiation |
| --- | --- | --- | --- | --- | --- | --- |
| Choix | « Pour le projet {scenario}, le cadre choisi est explicite. » | « Pour le projet {scenario}, nommez le cadre que vous retenez. » | « Pour le projet {scenario}, votre réponse indique explicitement qu'aucun cadre n'est choisi ; retenez-en un pour répondre à la consigne. » | « Pour le projet {scenario}, plusieurs choix finaux incompatibles restent actifs ; conservez un choix ou distinguez leurs conditions. » | « Pour le projet {scenario}, le choix peut être compris de plusieurs façons ; nommez celui que vous retenez. » | Ajouter une phrase autonome : « Je retiens {cadre} pour le projet {scenario}. » |
| Dimensions | « Les dimensions utilisées ou laissées ouvertes sont précisées pour le projet {scenario}. » | « Indiquez quelles dimensions de {cadre} vous utilisez et lesquelles vous laissez ouvertes. » | « Votre réponse refuse explicitement de préciser les dimensions ; ajoutez cette délimitation. » | « Une même dimension est présentée comme utilisée et ouverte ; clarifiez son statut. » | « Le traitement d'une dimension reste équivoque ; précisez si vous l'utilisez ou la laissez ouverte. » | Lister les dimensions du cadre choisi et leur statut, sans remplir artificiellement une dimension non pertinente. |
| Premier fait | « Un élément du dossier {scenario} est repris fidèlement. » | « Appuyez votre choix sur un élément précis du dossier {scenario}. » | « Votre réponse indique ne pas s'appuyer sur le dossier {scenario} ; ajoutez les éléments demandés. » | « Un élément attribué au dossier {scenario} entre en conflit avec celui-ci ; corrigez ce passage. » | « Un passage peut modifier le sens du dossier {scenario} ; reformulez-le plus précisément. » | Reprendre ou paraphraser fidèlement une proposition présente dans le dossier. |
| Second fait | « Un second élément distinct du dossier {scenario} est repris fidèlement. » | « Ajoutez un second élément du dossier {scenario}, distinct du premier. » | Message de groupe uniquement ; aucun doublon. | Message de groupe uniquement ; aucun doublon. | « Le second élément peut répéter le premier ; choisissez une autre propriété du dossier. » | Ajouter une proposition différente, pas une seconde formulation du même fait. |
| Justification | « Le lien entre les éléments du dossier {scenario} et le choix du cadre est explicite. » | « Expliquez en quoi les éléments cités rendent le cadre choisi utile pour le projet {scenario}. » | « Votre réponse indique explicitement qu'elle ne justifie pas ce choix ; ajoutez le lien demandé. » | « Le lien proposé contredit le choix ou un élément cité ; révisez l'explication. » | « Le lien entre le dossier et le choix reste équivoque ; formulez une relation directe. » | Compléter : « Parce que le dossier indique {fait}, la dimension {dimension} de {cadre} est utile pour… » |

Les variables sont remplies uniquement avec le certificat et les valeurs
authorées. Aucun modèle ne reformule librement ces messages au MVP.

## 11. États pédagogiques résultants

- `FEEDBACK_READY` : tous les niveaux publiables sont déterminés et aucun
  élément demandé ne requiert de révision ;
- `REVISION_REQUIRED` : au moins un élément demandé est non démontré, refusé ou
  contredit ; seuls les défauts propriétaires produisent un message ;
- `CLARIFICATION_REQUIRED` : une ambiguïté matérielle change au moins un niveau ;
- `TEMPORARILY_UNAVAILABLE` : état technique externe au présent contrat.

Aucun état n'écrit dans `ConceptProgress`, `StageProgress` ou `VALIDATED`.

## 12. Projection attendue pour V4-002C

Le schéma v1 ne peut pas représenter ce contrat sans perte. Le compilateur v2
devra au minimum prendre en charge :

1. `EXPLICITLY_REFUTED` dans l'ontologie et les templates ;
2. groupes de slots non ordonnés avec cardinalité et distinctivité ;
3. relations vers des éléments certifiés du même scénario ;
4. dépendances `BLOCKED_BY_DEPENDENCY` sans double pénalisation ;
5. règles booléennes `allOf` / `atLeast` qui interdisent le niveau complet si
   un projet est incomplet ;
6. conflits matériels avec le contexte fiable, dédupliqués par scénario ;
7. résolutions d'ambiguïté incluant `EXPLICITLY_REFUTED` ;
8. score indicatif désactivé et progression toujours `NONE`.

La forme JSON machine et le certificat v2 appartiennent à `V4-002C`. Ce DRAFT
est l'autorité pédagogique de leur comportement, sous réserve de `Rayan B`.

## 13. Consultations obligatoires

| Agent | Statut | Conclusion intégrée |
| --- | --- | --- |
| `AGENT-DEV-LEARNX` | `RECEIVED` | Le contrat doit rester un JSON v2 `DRAFT`, car le schéma v1 ne représente ni `EXPLICITLY_REFUTED`, ni les groupes distincts, ni les dépendances non punitives. Les preuves du dossier et les spans apprenant doivent être séparés. |
| `AGENT-METHODOLOGIE` | `RECEIVED_WITH_BLOCKERS` | Les niveaux doivent reconnaître les réponses partielles, la décision explicite doit rester distincte de sa pertinence et un lien explicatif doit être évalué indépendamment de la vérité du fait mobilisé. |

Les consultations ont été menées en lecture seule, sans appel modèle et sans
édition concurrente de ces artefacts.

Un désaccord méthodologique reste présenté à Rayan :

- **faits libres et distincts — recommandé** : chacun des deux slots peut
  recevoir n'importe quelle proposition fidèle du dossier. Cette option est
  exactement conforme à la consigne validée, mais exige un groupe non ordonné
  et une déduplication plus riche dans le compilateur ;
- **familles de faits imposées** : exiger, par exemple, un fait sur le design et
  un fait sur l'objectif. Cette option simplifie le compilateur, mais ajoute une
  contrainte invisible et obligerait à rouvrir `V4-002A` ainsi que la consigne.

Le DRAFT retient la première option. Aucun modèle n'a participé à cet arbitrage.

## 14. Arbitrage `Rayan B` — clos

Rayan a validé explicitement le 21 août 2026 :

1. les trois critères et l'agrégation sans compensation entre A et B ;
2. les dix éléments et leurs propriétaires uniques ;
3. les variantes recevables : A = PICO ou PECO sous condition ; B = SPIDER ou
   PCC sous condition ;
4. la règle des deux faits distincts et le traitement d'un conflit matériel ;
5. les dépendances non punitives qui évitent le double feedback ;
6. `EXPLICITLY_REFUTED` sur les éléments positifs uniquement, avec même effet de
   niveau que l'absence mais message distinct ;
7. les niveaux, les templates et les actions de remédiation ;
8. l'absence de score, de `PASS/FAIL` et de tout effet sur la progression.

Le gate `Rayan B` est clos. Ce document et sa projection JSON deviennent les
entrées pédagogiques approuvées de `V4-002C`, sans devenir `PUBLISHED` ni
`FULLY_COMPILABLE`. Le corpus, le gel expérimental et tout appel modèle restent
fermés.

## 15. Actions interdites

- publication ou déclaration manuelle `FULLY_COMPILABLE` ;
- modification silencieuse de l'activité, de la consigne ou des scénarios ;
- ajout d'un critère de style, longueur, orthographe ou qualité holistique ;
- compensation d'un scénario par l'autre ;
- feedback libre, score modèle ou validation de maîtrise ;
- appel réseau, panel, holdout, tarification, débit ou activation de V4-010 ;
- modification des arbitrages `Rayan B` par `V4-002C` sans nouveau gate
  pédagogique explicite.
