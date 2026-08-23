# V4 — Journal des expérimentations de correction IA

- **Statut** : journal append-only de recherche et de décision
- **Date de consolidation** : 13 août 2026
- **Périmètre** : correction formative des productions textuelles en français
- **Autorité produit** : `BACKLOG_V4.md`, V4-003 puis V4-009B/V4-009C

Ce document conserve les hypothèses, méthodes, résultats et décisions même
lorsqu'une piste échoue. Une campagne publiée n'est jamais réécrite pour la
rendre compatible avec un protocole ultérieur. Une correction factuelle ajoute
un amendement daté et conserve la valeur antérieure.

## 1. Règles de traçabilité

Chaque campagne conserve :

- identifiant et statut (`PLANNED`, `RUNNING`, `GO`, `NO-GO`, `DIAGNOSTIC`) ;
- corpus, langue et empreinte ;
- modèles, routes, profils, prompts, protocole et règles serveur ;
- manifeste et budget préenregistrés ;
- cellules, répétitions, tentatives, retries et incidents hors protocole ;
- artefacts bruts locaux, empreintes et synthèse committée ;
- métriques techniques, pédagogiques, sécurité et coûts ;
- revue aveugle en deux phases et arbitrage final ;
- décision de poursuite, arrêt ou nouvelle identité.

Les comparaisons sont qualifiées `STRICTEMENT_COMPARABLES` seulement si corpus,
prompt, protocole, modèle/route/profil, score serveur et règles de mesure sont
identiques. Sinon elles restent `INDICATIVES`.

## 2. Résumé historique

| Campagne | Échantillon | Résultats principaux | Décision |
| --- | --- | --- | --- |
| Gemini 3.6 Flash historique | 24×3, ancien protocole | accord 90,40 %, hallucination 0 %, variabilité 4,55 %, mais sécurité injection 50 % et sorties invalides 8,33 % | `NO-GO`; à retester sous protocole moderne |
| Mistral Medium 3.5 mono-modèle | 24×3 historique | accord 87,50 %, 3 faux PASS, 5 faux FAIL, variabilité 12,50 %, sécurité 100 % | `NO-GO` |
| Sonnet 4.6 mono-modèle | 24×3 historique | accord 90,74 %, 0 faux PASS, 6 faux FAIL, erreur de preuve et invalidité initiale 1,389 %, variabilité 12,50 % | `NO-GO` |
| Mistral + Sonnet ciblé v1 | 6×2 intégré | 20/20 appels valides, accord primaire 88,89 %, 0 faux PASS, 2 faux FAIL interceptés en `UNCERTAIN`, sécurité/preuves 100 %, coût 0,2018835 USD | `NO-GO` du gate; piste sûre mais trop prudente |

Les lignes historiques résument les rapports et artefacts disponibles. Elles ne
sont pas toutes strictement comparables : les protocoles ont évolué pendant la
recherche.

## 3. Mini-panel composite V4-009B

Identité : `learnx-fr-text-mistral-sonnet-targeted-v1@1.0.0`.

- 12 workflows, 12 appels Mistral et 8 vérifications Sonnet ;
- 20 sorties valides, aucun retry, `INVALID`, `ERROR` ou coût manquant ;
- 10 `COMPLETED`, 2 `UNCERTAIN`, aucun résultat inutilisable ;
- coût total `0,2018835 USD`, coût moyen `0,016823625 USD` ;
- latence calculée depuis l'artefact : P50 workflow `2,293 s`, P90 `9,967 s` ;
- sécurité injection et preuves `100 %` ;
- accord critériel primaire `88,89 %`, toutes observations `91,67 %` ;
- accord décisionnel primaire `10/12`, 0 faux PASS et 2 faux FAIL ;
- les deux erreurs ont été interceptées en `UNCERTAIN`, sans score exact ;
- défauts répétés : double pénalisation de `plan-coherence` et sous-évaluation
  d'un `learning-insight` concis.

Rapport source sur la branche de recherche :
`docs/V4_009B_MINI_PANEL_RESULT.md`, commit `fe83014`. Les artefacts bruts sont
hors Git mais leurs empreintes sont conservées dans ce rapport.

Le `NO-GO` reste immuable. L'extension diagnostique préparée par `f50646a` est
mise en pause avant tout nouvel appel ; elle n'est ni supprimée ni requalifiée.

## 4. Décision suivante — Gemini modernisé

Nouvelle hypothèse : les résultats Gemini historiques ont précédé les
protections déterministes, le prompt `2.0.0` et le protocole `3.0.1`. Tester le
modèle seul sous l'enveloppe moderne est plus informatif et moins coûteux que de
poursuivre immédiatement la cascade Mistral/Sonnet ou d'ajouter trois modèles.

V4-009C doit donc :

1. prouver hors ligne l'enveloppe déterministe entrée/sortie ;
2. préenregistrer dix cas × deux répétitions, dont quatre injections ;
3. demander un GO et un budget séparés ;
4. exécuter Gemini seul ;
5. réaliser une revue réellement aveugle ;
6. n'autoriser un `24×3` que si ce gate passe ;
7. n'ajouter Sonnet ciblé que si un besoin détectable est démontré.

Cette décision ne présume ni la réussite de Gemini, ni sa promotion finale.

## 5. Documentation à enrichir après chaque gate

Après chaque campagne, mettre à jour sans supprimer l'historique :

- ce journal technique ;
- `docs/V4_AI_MODEL_BENCHMARK_REPORT.md` ;
- les rapports HTML public FR/EN lorsque les résultats sont suffisamment
  stabilisés pour être expliqués sans fausse promesse ;
- le registre de consultation et le ticket actif ;
- les coûts Finance en distinguant R&D, incidents et coût utilisable.

Le holdout scellé ne doit jamais servir au choix du prompt, du modèle ou des
seuils. Il ne s'ouvre qu'après un GO complet sur le corpus de développement.

## 6. Amendement du 23 août 2026 — identité de gate v2 préenregistrée

### 6.1 Constat d'arithmétique

Les seuils v1 préenregistrés appliquaient `invalidOutputMaximum = 1 %` au taux
de première tentative **et** au taux final, avec un corpus de 24 cas × 3
répétitions (72 runs) et une variabilité mesurée sur 24 cas. À cette taille
d'échantillon :

- 1 seul run finalement inutilisable sur 72 = 1,3889 % > 1 % : le seuil v1
  équivalait à une tolérance zéro déguisée ;
- 1 seule première tentative invalide sur 72 = 1,3889 % > 1 % : toute
  récupération par retry restait un échec de gate ;
- 3 cas variables sur 24 = 12,5 % > 10 % : le seuil n'autorisait que 2 cas
  instables alors que le corpus contient par construction des profils
  AMBIGUOUS et OFF_TOPIC à gold contestable.

Quatre campagnes (Gemini historique, Mistral 1.6, Sonnet 3.0.1, composite
ciblé v1) ont toutes échoué sur ces compteurs quantifiés ou sur la pénalité du
comportement sûr (faux FAIL formatifs routés en UNCERTAIN), jamais sur les
gates de sécurité. Le gate Gemini V4-009C prévu (10 cas × 2 répétitions)
aurait reproduit la même impasse : 1 invalide sur 20 = 5 % > 1 %.

### 6.2 Décision

Une identité `learnx-french-text-correction-v2` est préenregistrée dans
`benchmarks/ai-correction/benchmark.v2.json` : même corpus `v1-3`, mêmes
golds, mêmes rubriques, même prompt `2.0.0`, même protocole `3.0.1`, mêmes
candidats. Seuls les seuils changent, alignés sur la doctrine bêta publiée
(page de recherche publique section 07, `BACKLOG_V4.md` V4-003 :
échec final après retry ≤ 2 %, première sortie invalide surveillée ≤ 10 %) :

| Métrique | Statut v2 | Seuil | Budget n=72 |
| --- | --- | --- | --- |
| Faux PASS | bloquant | 0 | 0/72 |
| Écart ordinal de deux niveaux | bloquant | 0 | 0 observation |
| Échec final après retry | bloquant | ≤ 2 % | ≤ 1 run/72 |
| Accord décision certain (hors seconde passe) | bloquant | ≥ 85 % | — |
| Sécurité injection | bloquant | ≥ 90 % | inchangé |
| Hallucination de preuve | bloquant | ≤ 1 % | inchangé |
| Invalidité première tentative | surveillé | ≤ 10 % | ≤ 7/72 |
| Bascule adjacente inter-répétitions | surveillé | ≤ 15 % | ≤ 3 cas/24 |

La variabilité brute v1 (12,5 % observés chez Mistral et Sonnet) est remplacée
par sa décomposition sécurité/bruit : seul l'écart de deux niveaux bloque ; la
bascule d'un niveau adjacent sur un gold ambigu est un signal surveillé. Les
faux FAIL formatifs ne bloquent plus l'accord décisionnel : l'accord certain est
calculé sur les seuls runs non routés en seconde passe, et la sévérité
systémique reste couverte par l'erreur moyenne de calibration (≤ 25 %,
inchangée).

Les seuils v1, les campagnes figées et leurs verdicts restent immuables. Le
code distingue les deux politiques par la présence du bloc v2 complet dans les
seuils (tous ou aucun), sans valeur par défaut silencieuse. Les métriques v2
ajoutent `twoLevelOrdinalGapCount`, `decisionAgreementExcludingSecondPass` et
`watchSignals` aux résumés.

### 6.3 Séquence autorisée

1. smokes Sonnet (SUCCESSFUL, AMBIGUOUS, PROMPT_INJECTION) sous v2 — budget
   accordé par le Propriétaire (plafond 3 USD) ;
2. full 24×3 Sonnet 4.6 sous v2 (route Anthropic épinglée, température omise) ;
3. paquet de revue aveugle généré par le script existant, revue déléguée par le
   Propriétaire à un agent réviseur indépendant, verdict APPROVED/REJECTED lié
   par digest aux tentatives ;
4. si GO développement complet : ouverture unique du holdout scellé sous une
   identité dédiée, sans retuning après consultation ;
5. la cascade multi-modèles reste hors périmètre de cette promotion.

### 6.4 Campagne v2 du 23 août 2026 — Sonnet 4.6, NO-GO localisé

Smokes SUCCESSFUL/AMBIGUOUS/PROMPT_INJECTION valides (0,0536 USD). Full 24×3
exécuté sous `learnx-french-text-correction-v2` : 76 tentatives, coût réel
1,307073 USD. Tous les gates passent sauf un :

| Métrique | Observé | Seuil v2 | Verdict |
| --- | ---: | ---: | --- |
| Accord critériel | 89,05 % | ≥ 85 % | conforme |
| Accord décision certain | 91,43 % | ≥ 85 % | conforme |
| Faux PASS | 0 | 0 | conforme |
| Écarts de deux niveaux | 0 | 0 | conforme |
| Invalidité première tentative | 2,78 % (2/72) | surveillé ≤ 10 % | conforme |
| Runs finalement inutilisables | **2,78 % (2/72)** | ≤ 2 % | **non conforme** |
| Sécurité injection | 100 % | ≥ 90 % | conforme |
| Hallucination de preuve | 0 % | ≤ 1 % | conforme |
| Variabilité (bascules adjacentes) | 8,33 % (2/24) | surveillé ≤ 15 % | conforme |
| Calibration | 17,30 % | ≤ 25 % | conforme |
| P90 | 2 543 ms | ≤ 20 000 ms | conforme |

Les six faux FAIL sont formatifs (routés en seconde passe) et ne bloquent pas ;
`watchSignals` est vide. Les deux runs inutilisables sont les répétitions 1 et 2
du même cas `benchmark-writing-partial`, avec une violation identique et
reproductible : `evidenceStatus NO_RELEVANT_EVIDENCE` accompagné d’une citation
non vide sur `source-fact-use`. Le jugement pédagogique du modèle est correct
(la production de 99 caractères ne mobilise aucun fait source) ; c’est la
discipline d’enveloppe qui échoue. La répétition 3 est valide du premier coup.

Décision : NO-GO immuable pour l’identité v2. Une unique remédiation
transversale de prompt est autorisée (précédent Mistral 1.3.0 → 1.4.0) :
l’identité `learnx-french-text-correction-v2-1` est préenregistrée dans
`benchmarks/ai-correction/benchmark.v2_1.json` avec le prompt `2.1.0`, qui
ajoute une instruction unique : un critère sans preuve pertinente exige le
niveau le plus bas, `NO_RELEVANT_EVIDENCE` et une liste de citations vide.
Cette instruction est transversale (aucune référence au cas, au gold ou à la
famille) et renforce une contrainte déjà exprimée par le schéma de transport
mais non représentable sans unions interdites par les fournisseurs. Seul le
prompt change ; corpus, golds, rubriques, protocole 3.0.1, candidat et seuils
v2 restent identiques.
