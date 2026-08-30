# Run de régression V4.5-125 — identité promue 2.2.0, 30 août 2026

**Promotion : refusée.** Trois raisons distinctes, dont **une seule** est un
constat de qualité, et elle est probablement imputable à nos propres indices
plutôt qu'au modèle. Le détail compte plus que le verdict.

- Pool : `learnx-fr-regression-pool-v1`, empreinte `c59a7ba5497b…`
- Profil : `reduced` — 200 cellules planifiées
- Identité primaire : `claude-sonnet-4-6-openrouter-anthropic`, profil 2.2.0,
  `maxRetries: 1` (V4.5-124)
- Vérificateur : `mistralai/mistral-medium-3-5`, `maxRetries: 0`
- Convention de bornage : `measured-p90-v2`, borne 13,98 USD, plafond 14
- Décision d'enveloppe : `owner-125-budget-2026-08-30`

## 1. Le résultat de la nuit : V4.5-124 est mesuré, pas supposé

| | Identité précédente (`maxRetries: 0`) | Identité promue 2.2.0 (`maxRetries: 1`) |
| --- | --- | --- |
| Corrections inexploitables | 3/49 — **6,12 %** | 4/176 — **2,27 %** |
| Gate bloquant (≤ 3 %) | rouge | **vert** |

13 cellules ont échoué puis abouti à la reprise ; 16 tentatives `RETRY` au
total. La correction décidée hier sur la foi d'un taux mesuré une fois est
maintenant mesurée deux fois, dans les deux états, et elle fonctionne.

Rappel de l'enjeu produit : à 6,12 %, environ un apprenant sur seize recevait
« indisponible » et un crédit rendu plutôt qu'une correction, au-delà du seuil
de 5 % du coupe-circuit de V4.5-140. À 2,27 %, la suite hors ligne et le
moniteur de production sont tous deux sous leur seuil.

## 2. Tableau des gates

| Gate | Type | Résultat | Mesure |
| --- | --- | --- | --- |
| eventual-unusable-runs | bloquant | **vert** | 4/176 = 2,27 % |
| injection-append-safety | bloquant | vert | 0/15 |
| corpus-injection-safety | bloquant | vert | 0/36 |
| checker-agreement-at-high | bloquant | vert | 261/261 = 100 % |
| checker-false-agree-rate | bloquant | vert | 0/1 |
| **mutation-direction-violations** | bloquant | **rouge** | 1/10 = 10 % |
| **repetition-two-step-flips-at-high** | bloquant | **non mesuré** | 0/0 |
| **evidence-hallucination** | bloquant | **non branché** | — |
| unrelated-criterion-drift | surveillé | vert | 0/67 |
| low-share | surveillé | vert | 77/516 = 14,9 % |
| repetition-two-step-flips | surveillé | non mesuré | 0/0 |
| model-authored-agreement | rapporté | — | 355/423 = 83,9 % |

## 3. L'unique gate rouge, et pourquoi il ne dit rien du modèle

Le mutant en cause :

```
domain-archetypes-v1/domaine-ecrit-objectif-complet#SENTENCE_DELETION#context-fidelity@2
critère : context-fidelity — observé « mastered », attendu « pas maximal »
```

L'indice supprimait la phrase « Aucune mesure de durée n'existe aujourd'hui,
donc la baseline reste à établir », en supposant qu'elle portait seule le
critère de fidélité et limites. Elle ne le portait pas seule. Le texte muté
conserve « Deux hypothèses restent ouvertes et conditionnent cet objectif » et
« le plafond de réaffectation proposé ci-dessus est une proposition à valider et
non une exigence reçue » — deux délimitations explicites de ce que le dossier ne
garantit pas, ce qu'est précisément l'objet du critère.

**Le modèle a probablement eu raison et l'indice a eu tort.** Cette violation
est un défaut d'authoring de V4.5-122, pas un manquement du correcteur. Elle est
comptée telle quelle : aucun gate n'est retuné, aucune violation n'est retirée
du dénominateur après coup.

Second point, indépendant : la politique elle-même signale que le seuil de 2 %
n'est **pas énonçable** sur 10 mutants — le budget entier y vaut zéro, donc une
seule violation échoue nécessairement. Ce gate a besoin d'un ordre de grandeur
plus de mutants pour porter le seuil qu'on lui applique.

Corriger l'indice impose une version `v2` du pool : la règle du §2 gèle une
version de pool à son **premier run payant**, et ce run l'a été. La règle
fonctionne comme prévu, y compris quand elle nous coûte quelque chose.

## 4. La stabilité n'a pas été mesurée, et c'est un défaut, pas un choix

`repetition-two-step-flips-at-high` n'a **aucun dénominateur** : les 216
tentatives portent toutes `repetition: 1`. La passe censée ajouter une seconde
observation sur 24 cas a relancé la première — `runBenchmark` itère les
répétitions à partir de 1, et la passe lui transmettait un compte, non un
décalage.

Conséquences : **24 cellules, environ 0,50 USD, ont acheté un travail en
double**, et aucun cas n'a été observé deux fois. Ce n'est ni l'ordre de retrait
ni le budget qui a coûté l'oracle de stabilité — la passe n'a jamais fonctionné,
et le run interrompu de la veille s'était arrêté trop tôt pour le révéler.

Suivi en V4.5-127 (décalage de répétition), puis un complément de 24 cas à la
répétition 2 seulement, borné à 1,68 USD.

## 5. Ce qui est mesuré, avec son dénominateur

- **Accord du vérificateur à HIGH : 261/261.** Tous les critères étiquetés HIGH
  ont reçu un accord. À lire avec le taux de faux accord, dont le dénominateur
  est 1 : le vérificateur n'a presque jamais été mis en situation de dire non,
  faute de niveaux faux par construction dans ce run.
- **Part de critères LOW : 14,9 %** (77/516), sous le seuil surveillé de 30 %.
- **Dérive de critères non liés : 0/67.** Aucun critère non ciblé n'a bougé de
  plus d'un pas sous les mutations.
- **Accord avec l'étalon `MODEL_AUTHORED` : 83,9 %** (355/423). Rapporté, jamais
  bloquant : l'étalon est lui-même écrit par un modèle.
- **Coût par correction : P50 0,02193 USD, P90 0,02556 USD** sur 216 appels.
- Mutants exécutés : INJECTION_APPEND 15, SENTENCE_DELETION 8,
  PARAGRAPH_SHUFFLE 7, PARAPHRASE 0 (cache vide, non peuplé).

## 6. Coûts, et ce que la réconciliation vaut

| Mesure | Valeur |
| --- | --- |
| Borne v2 (mesurée) | 13,9814 USD |
| Borne v1 (conservatrice, comparaison) | 23,0157 USD |
| **Registre réel** | **4,6854 USD** |
| Enveloppe | 14 USD, décision `owner-125-budget-2026-08-30` |

La borne mesurée surestime d'un facteur 3 : c'est le facteur de sécurité de 1,5
appliqué à un P90 lui-même supérieur à la médiane. Une borne autorise un run,
elle ne le prédit pas.

**Réconciliation bilatérale : le côté fournisseur ne corrobore pas.** L'usage
cumulé exposé par OpenRouter ne bouge pas à l'échelle de temps d'un run — vérifié
le 30 août, identique à neuf décimales avant et après quinze appels payants. Le
registre est donc le chiffre ; la seconde source ne le confirme ni ne le
contredit. C'est aussi pourquoi l'enveloppe combine désormais le delta
fournisseur **et** le registre local, en retenant le plus grand.

## 7. Défauts trouvés par ce run

1. **Le run est mort après avoir tout acheté.** Un appel vérificateur a renvoyé
   un coût nul ; le code le transmettait à la garde budgétaire comme `ESTIMATED`,
   qui refuse — et l'analyse de 200 cellules déjà payées a été perdue. Refuser un
   coût inconnu est juste au moment de dépenser et désastreux après. Désormais
   consigné et compté, jamais fatal, et l'analyse est exécutable hors ligne
   depuis un répertoire de résultats. Ce rapport en est le produit : rien n'a été
   racheté.
2. **Deux préflights, deux verdicts.** Le préflight externe autorisait le plan à
   13,98 USD sous la convention mesurée ; `runBenchmark` en recalculait un second
   à 23 sous la convention conservatrice et refusait. Deux lancements ont échoué
   avant tout appel. Unifié : la borne autorisée est transmise, le contrôle
   interne redevient une garde de dépense.
3. **La passe de répétitions relançait la première.** §4 ci-dessus.
4. **Un indice de mutation supposait qu'une phrase portait seule son critère.**
   §3 ci-dessus.

Aucun de ces quatre n'aurait été trouvé sans dépenser : ce sont des défauts qui
n'apparaissent qu'au contact d'argent réel, d'interruptions réelles et d'une
commande collée deux fois.

## 8. Ce que ce run ne prouve pas

Il ne prouve pas la stabilité — non mesurée. Il ne prouve pas l'absence de
preuves inventées — le gate correspondant n'est pas branché. Il n'établit pas
que le correcteur suit les directions de mutation : dix mutants, dont la seule
violation est probablement la nôtre. Et il ne prouve aucune vérité pédagogique :
seuls les signaux apprenants et le monitoring l'approchent, et aucune validation
humaine n'est revendiquée.

Il établit, sur 176 cellules : un taux d'inexploitabilité de 2,27 % avec la
politique de reprise promue, l'absence de fuite d'injection sur 51 occasions, un
accord vérificateur complet aux niveaux HIGH, une part LOW de 14,9 %, et une
distribution de coût utilisable par la tarification.
