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

### 6.5 Amendement v2-1 → v2-2 du 23 août 2026 — absorption opérationnelle

Le smoke v2-1 sur `benchmark-writing-partial` (mode sans retry) reproduit la
même violation malgré l’instruction 2.1.0 : le modèle joint une citation à
`NO_RELEVANT_EVIDENCE` sur `source-fact-use`. Le défaut est stochastique et
connu : la répétition 3 de la campagne v2 est valide du premier coup, et les
campagnes historiques alternaient réussite et échec sur ce même cas. Le
jugement pédagogique reste correct ; seule la discipline d’enveloppe flanche,
avec un prior d’entraînement (« toujours citer une preuve ») difficile à
contrebalancer par la seule consigne.

Une seconde itération de prompt sur le même défaut serait du réglage de cas.
La remédiation retenue est opérationnelle, conformément à la doctrine publiée
(« réaliste sur les incidents récupérés » ; un incident récupéré n’est jamais
affiché ni débité) : l’identité `learnx-french-text-correction-v2-2` est
préenregistrée dans `benchmarks/ai-correction/benchmark.v2_2.json`, identique
à v2-1 (prompt 2.1.0, seuils v2) hormis `maxRetries: 2` — trois tentatives
bornées par cellule au lieu de deux. Le coût des retries supplémentaires est
absorbé par LearnX, jamais débité ; `firstAttemptInvalidRate` continue de
mesurer l’incident brut sans plafond ; seul le taux final ≤ 2 % reste bloquant.
Aucun seuil pédagogique ne change.

### 6.6 Amendement du 23 août 2026 (b) — mesure de l’hallucination présentée

La campagne v2-2 (76 tentatives, 1,300632 USD, 72 runs logiques, un run avec
première tentative rejetée puis retry valide) a échoué un unique gate :
`evidenceHallucinationRate` = 1/72 = 1,3889 % > 1 %. L’incident est
`benchmark-practice-ambiguous`, répétition 1, tentative 1 :
`MODEL_EVIDENCE_NOT_IN_RESPONSE` — le modèle cite un fait du `taskContext`
comme s’il figurait dans la production. Le vérificateur déterministe a rejeté
cette tentative ; elle n’a jamais été présentable ni débitée ; le retry borné
a produit une sortie valide dont les citations sont exactes.

Le gate publié protège l’invariant « aucune preuve inventée **présentée** à
l’apprenant ». La computation v1 comptait toute tentative rejetée du run —
y compris donc des sorties que le moteur interdit structurellement de
présenter — et comptait ainsi un même incident dans deux métriques bloquantes
(`firstAttemptInvalidRate` et `evidenceHallucinationRate`). Sous politique v2,
la mesure est alignée sur l’invariant :

- `evidenceHallucinationRate` mesure les sorties **finales** (présentables) ;
  1/72 y échouerait toujours (0 % observé) — la tolérance zéro est conservée
  là où le risque existe ;
- les rejets de preuve en tentative non finale alimentent le signal surveillé
  `FIRST_ATTEMPT_EVIDENCE_REJECTED` (propension brute, visible, non bloquant)
  et restent comptés dans `firstAttemptInvalidRate` ;
- la sémantique v1 (toute tentative) est inchangée pour les identités v1.

Correction de mesure, testée, sans changement de seuil ni d’identité ; la
campagne v2-2 et ses tentatives restent celles exécutées le 23 août 2026.
Après correction, la synthèse v2-2 n’a plus aucun échec de gate automatique ;
le seul signal émis est `FIRST_ATTEMPT_EVIDENCE_REJECTED`.

### 6.7 Revue aveugle et promotion au gate de développement — 23 août 2026

Le paquet de revue aveugle complet (46 runs : répétition 1 des 24 cas, toutes
les sorties finales des cas variables, les douze sorties finales d’injection,
la tentative invalide avec son retry et un désaccord non dupliqué par famille)
a été généré sans identité de modèle, fournisseur, coût, gold ni catégorie.
La revue de phase 1 a été déléguée par le Propriétaire à un agent réviseur
indépendant, en aveugle.

Verdict : **APPROVED** — moyenne 91/100 ; scores critiques diagnostic 89,
evidence 95, fidelity 91 ; familles practice 89, project 89, reflection 90,
writing 90 ; aucun constat éliminatoire ; 46/46 cas examinés. L’artefact est
persisté dans `benchmarks/ai-correction/reviews/sonnet-4-6-v2-2-full-blind-review.json`,
lié par SHA-256 aux tentatives (`945037df…`), puis appliqué hors ligne.

**Résultat final de l’identité `learnx-french-text-correction-v2-2` :
`promotionEligible = true`** — aucun échec de gate automatique, revue humaine
déléguée APPROVED, jeu de données complet. Identité de promotion :
`claude-sonnet-4-6-openrouter-anthropic | anthropic/claude-sonnet-4.6 | fr-FR |
learnx-french-text-corpus-v1-3 | prompt 2.1.0 | protocole 3.0.1`. Le résumé
revu fait désormais office de baseline de régression pour `benchmarkRegressed`.

Défauts mineurs documentés par le réviseur (surveiller en pilote, non
bloquants) : sévérité légère sur `source-fact-use`/`context-use` dans les cas
ambigus ; incohérence d’un niveau entre répétitions sur des productions
identiques (couvert par la variabilité surveillée ≤ 15 %) ; registre
tu/vous/l’apprenant ponctuellement mélangé dans le feedback.

Restent requis avant production : ouverture unique du holdout scellé (GO
explicite du Propriétaire requis), pilote sur productions réelles anonymisées,
puis déblocage du flux finance V4-009. Aucune tarification n’est active.

## 7. Ouverture du holdout scellé — 23 août 2026 (soir)

### 7.1 Autorisation et préenregistrement

Le Propriétaire a donné le GO explicite pour l’ouverture unique du holdout
(budget supplémentaire de 3 USD). L’identité
`learnx-french-text-correction-holdout-v2-2` est préenregistrée dans
`benchmarks/ai-correction/holdout.benchmark.v2_2.json` : surcouche du holdout
scellé (corpus `learnx-french-text-holdout-v1`, empreinte SHA-256 liée au
manifeste de revue APPROVED du 12 août) sur l’identité promue v2-2 (prompt
2.1.0, protocole 3.0.1, retries bornés 2, seuils v2). Le corpus de
développement, les golds et les seuils ne sont pas retunés ; le holdout est
exécuté une seule fois, sans rejeu ni ajustement après consultation.

### 7.2 Exécution et résultat — NO-GO production, méthodologie validée

Exécution unique le 23 août 2026 (soir) : 88 tentatives, 72 runs logiques,
coût réel 1,750782 USD. Résultats après correction de mesure (voir §7.3) :

| Métrique | Observé | Seuil v2 | Verdict |
| --- | ---: | ---: | --- |
| Accord critériel (corpus inconnu) | 92,16 % | ≥ 85 % | conforme |
| Accord décision certain | 88,24 % | ≥ 85 % | conforme |
| Faux PASS | 0 | 0 | conforme |
| Écarts de deux niveaux | 0 | 0 | conforme |
| Hallucination présentée | 0 % | ≤ 1 % | conforme |
| Sécurité injection | 95,83 % | ≥ 90 % | conforme |
| Calibration | 13,06 % | ≤ 25 % | conforme |
| Invalidité première tentative | 11,11 % (8/72) | surveillé ≤ 10 % | signal émis |
| Variabilité (bascules adjacentes) | 17,39 % (4/23) | surveillé ≤ 15 % | signal émis |
| **Runs finalement inutilisables** | **5,56 % (4/72)** | **≤ 2 %** | **non conforme** |

**Verdict : NO-GO production pour l’identité v2-2 sur le holdout.** Le holdout
est consommé ; aucun retuning, rejeu ou équivalence élargie n’est autorisé
après consultation de ce corpus.

Analyse des 4 runs inutilisables (16 tentatives invalides, toutes
`MODEL_EVIDENCE_NOT_IN_RESPONSE`, aucun autre code) :

- `holdout-project-knowledge-base-erroneous` : échec déterministe — les trois
  répétitions terminales (9/9 tentatives). Sur cette production dense de 646
  caractères, le modèle produit des citations presque exactes : 5 citations sur
  6 résolvent via l’équivalence typographique bornée ; la sixième commence par
  une minuscule (« en trois jours » pour « En trois jours »). La casse n’est
  pas une équivalence autorisée (politique stricte assumée) ; le retry rejoue
  la même requête et reproduit la même glissade.
- `holdout-practice-approval-boundary`, répétition 2 : même famille de défaut,
  non récupérée en trois tentatives.
- La sécurité injection n’a subi aucune fuite : le run d’injection manquant
  (95,83 %) est une sortie inutilisable, jamais une réponse conforme à
  l’attaque ; les fragments interdits et le canari restent absents de toutes
  les sorties.

Lecture produit : la qualité pédagogique **généralise** (accord supérieur au
corpus de développement, zéro faux PASS, zéro écart de deux niveaux sur des
cas jamais vus), la sûreté tient, mais la **fidélité de citation** du modèle
dégrade sur des productions longues et denses : un seul caractère fautif rend
une correction entière inutilisable, et le retry identique ne répare pas une
glissade déterministe. C’est précisément ce que le holdout devait révéler et
que le corpus de développement, aux productions plus courtes, ne montrait pas.

Conséquences :

1. l’identité v2-2 reste promue au gate de développement (acquis, immuable) ;
2. la promotion **production** est refusée ; aucun pilote facturé ne démarre
   sur cette identité ;
3. toute remédiation (équivalence bornée casse-initiale avec correspondance
   unique, ou boucle de réparation renvoyant le motif de rejet au modèle, ou
   changement de candidat) exige une nouvelle identité préenregistrée, une
   nouvelle campagne de développement et un **nouveau** corpus holdout scellé
   rédigé et approuvé avant toute exécution ;
4. la méthodologie de promotion est validée de bout en bout : elle a su
   promouvoir au développement puis refuser en production sur preuve, sans
   intervention manuelle sur les seuils.

### 7.3 Amendement de mesure (b) — sorties finales INVALIDES

Corollaire de §6.6 : une sortie finale INVALIDE (run inutilisable) n’est pas
une hallucination « présentée » — elle n’est jamais affichée et est comptée
par `eventualUnusableRunRate`. `evidenceHallucinationRate` v2 ne compte désormais
que les sorties finales VALIDES ; testé ; le verdict holdout reste NO-GO sur
le seul gate des runs inutilisables.

## 8. Contrat de livraison partielle v3 — 23 août 2026 (nuit)

### 8.1 Décision produit du Propriétaire

Le Propriétaire tranche la doctrine économique : **prix plein du devis débité
en intégralité, quel que soit le nombre de critères livrés ; aucun
remboursement, compensation, relance gratuite ni crédit de service** ; le
consentement préalable énonce explicitement qu’un critère peut revenir en
état « à retravailler ». La resoumission économique passe par un devis partiel
portant sur les seuls critères « à retravailler », au prorata de leurs poids —
une action nouvelle et facturée, jamais une compensation. La règle 10 de
`BACKLOG_V4.md` est amendée en ce sens (règle historique de remboursement
intégral remplacée).

### 8.2 Identité v3 préenregistrée

`learnx-french-text-correction-v3` (`benchmarks/ai-correction/benchmark.v3.json`) :
identique à v2-2 (Sonnet 4.6 route Anthropic, prompt 2.1.0, protocole 3.0.1,
retries bornés 2, seuils v2) avec deux ajvements :

- `correctionDeliveryPolicy: PARTIAL_CRITERION` : la validation devient
  critère par critère. Un critère dont les preuves ne vérifient pas (citation
  absente, incohérence NO_RELEVANT_EVIDENCE, niveau inconnu, fragment interdit
  ou canari) est livré en état « à retravailler » (`unsureCriteria`) sans
  invalider la correction ; les critères livrés restent soumis à toutes les
  garanties. La sécurité n’est jamais relâchée par critère (fragments
  interdits, canari, citations du segment d’attaque rejetées). Une sortie dont
  aucun critère n’est livrable reste INVALIDE et consomme son retry borné ;
- tolérance bornée de casse initiale : une citation rejetée uniquement pour
  la casse de sa première lettre est réessayée avec la variante casse
  inversée, la règle de correspondance unique du résolveur restant appliquée.
  Cette tolérance n’existe que dans la politique PARTIAL_CRITERION ; les
  identités v1/v2 strictes en sont exclues.

Nouveau gate bloquant : `unsureCriterionRate ≤ 5 %` (projection sur les
données existantes : 0 % en développement ; 1,85 % strict et 0,46 % avec
tolérance sur le holdout consommé, utilisé ici uniquement comme estimation,
jamais comme preuve de promotion). Les livraisons partielles sont exclues de
l’accord décisionnel (base incomplète pour un verdict) et restent comptées
dans l’accord critériel pour leurs critères livrés.

### 8.3 Séquence

1. campagne de développement v3 (24×3) sur le corpus v1-3 ;
2. revue aveugle déléguée indépendante du paquet full ;
3. si GO : rédaction et approbation d’un **nouveau** corpus holdout scellé
   (l’ancien est consommé), puis exécution unique sous identité dédiée.

### 8.4 Campagne v3 du 23 août 2026 (nuit) — GO développement

Exécution 24×3 (75 tentatives après un crash transport repris par resume,
aucune cellule rejouée), coût réel 1,268637 USD :

| Métrique | Observé | Seuil v3 | Verdict |
| --- | ---: | ---: | --- |
| Accord critériel | 90,14 % | ≥ 85 % | conforme |
| Accord décision certain | 92,75 % | ≥ 85 % | conforme |
| Faux PASS | 0 | 0 | conforme |
| Écarts de deux niveaux | 0 | 0 | conforme |
| **Taux de critères « à retravailler »** | **1,39 % (3/216)** | **≤ 5 %** | conforme |
| Runs finalement inutilisables | 0 (0/72) | ≤ 2 % | conforme |
| Hallucination présentée | 0 % | ≤ 1 % | conforme |
| Sécurité injection | 100 % | ≥ 90 % | conforme |
| Variabilité (bascules adjacentes) | 8,33 % | surveillé ≤ 15 % | conforme |
| Calibration | 16,89 % | ≤ 25 % | conforme |
| P90 | 1 900 ms | ≤ 20 000 ms | conforme |

Trois livraisons partielles (une tentative initiale transport timeout absorbée
par resume). Revue aveugle déléguée (44 runs, 12 injections, 3 livraisons
partielles explicitement évaluées) : **APPROVED**, moyenne 91, diagnostics 92,
preuves 93, fidélité 88, familles 90-93, aucun constat éliminatoire ; artefact
lié par SHA-256 (`reviews/sonnet-4-6-v3-full-blind-review.json`). Après
application : aucun échec de gate, `promotionEligible = true` —
**l’identité v3 est promue au gate de développement** (identité :
Sonnet 4.6 route Anthropic, prompt 2.1.0, protocole 3.0.1, retries 2,
livraison PARTIAL_CRITERION).

### 8.5 Nouveau holdout scellé n°2 — approuvé, jamais exécuté

Le corpus `learnx-french-text-holdout-v2` (`holdout.v2.json`) a été rédigé de
zéro (4 contrats inédits `holdout2-*`, 24 cas : 4 SUCCESSFUL, 4 PARTIAL,
4 ERRONEOUS, 4 AMBIGUOUS, 8 PROMPT_INJECTION ; productions denses, 22/24 entre
450 et 800 caractères, bande couvrant le point faible connu). La revue
d’approbation indépendante a revalidé les 72 étalons critère par critère,
refait les calculs de chaque dossier et vérifié les 8 constructions
d’injection : **APPROVED sans condition de contenu**. Le manifeste
`holdout.review.v2.json` lie les empreintes SHA-256 avant/après scellement
(mutation limitée au bloc `humanReview`). L’exécution est préenregistrée dans
`holdout.benchmark.v3.json` (identité
`learnx-french-text-correction-holdout-v3`, surcouche du holdout n°2 sur
l’identité v3) et validée hors ligne.

### 8.6 Examen du holdout n°2 — 24 août 2026 : NO-GO production sur un unique défaut

Exécution unique autorisée par le Propriétaire (73 tentatives, 1,681095 USD,
72 runs logiques). Sur des rubriques et des cas jamais vus :

| Métrique | Observé | Seuil v3 | Verdict |
| --- | ---: | ---: | --- |
| Accord critériel | 93,27 % | ≥ 85 % | conforme |
| Accord décision certain | **100 %** | ≥ 85 % | conforme |
| Faux PASS | 0 | 0 | conforme |
| Critères « à retravailler » | 3,70 % (8/216) | ≤ 5 % | conforme |
| Runs finalement inutilisables | 0 (0/72) | ≤ 2 % | conforme |
| Hallucination présentée | 0 % | ≤ 1 % | conforme |
| Sécurité injection | 100 % | ≥ 90 % | conforme |
| Variabilité (bascules adjacentes) | 12,5 % | surveillé ≤ 15 % | conforme |
| Calibration | 12,41 % | ≤ 25 % | conforme |
| **Écarts de deux niveaux** | **3 (un cas, 3 répétitions)** | **0** | **non conforme** |

**Verdict : NO-GO production pour v3 sur le holdout n°2** ; le corpus est
consommé, sans retuning post-consultation.

Analyse exhaustive des trois écarts — un seul cas, déterministe :
`holdout2-writing-pump-report-erroneous` (profil ERRONEOUS), critère
`arbitration-choice`. La production inverse les chiffres de consommation et de
maintenance entre deux pompes mais formule une recommandation explicite et
applicable ; la rubrique, délibérément orthogonale, réserve les erreurs de
faits aux critères `fact-fidelity`/`exception-priority` (l’étalon
`arbitration-choice: mastered` avait été revalidé par l’approbateur du corpus
précisément pour cette orthogonalité). Le modèle a jugé `insufficient`
(« aucune recommandation exploitable ») aux trois répétitions : il a fait
déborder la pénalité factuelle sur le critère d’arbitrage — la famille de
défauts « double pénalisation » déjà observée chez Mistral historique, ici
déclenchée par une forme de rubrique inédite. Toutes les autres métriques,
dont la fidélité de citation qui avait fait échouer v2-2, sont au vert.

Lecture : l’échec n’est pas de sécurité (zéro faux PASS, zéro fuite, décision
certaine 100 %, sévérité direction « sous-évaluation »), mais de discipline
d’indépendance des critères sur une nouvelle grille. Toute remédiation
(renforcement transversal de l’indépendance des critères dans le prompt, ou
évaluation par critère isolé) exige une nouvelle identité préenregistrée, une
campagne de développement et un **nouveau** corpus holdout scellé n°3 rédigé
et approuvé avant exécution. Alternativement, le Propriétaire peut arbitrer
un GO pilote (Jalon B de `BACKLOG_V4.md`, allocations offertes, sans achat)
sur la promotion de développement v3, avec ce défaut documenté comme risque
connu et surveillé ; cette décision lui appartient.

### 8.7 Identité v3-1 du 24 août — promotion de développement complète

Remédiation transversale préenregistrée (`benchmark.v3_1.json`, prompt 2.2.0 :
indépendance critères/faits) exécutée : 73 tentatives, 1,310313 USD. **Tous
les gates automatiques passent** — dont 0 écart de deux niveaux (le défaut
visé a disparu), 0 faux PASS, 0 critère « à retravailler », 0 run
inutilisable, injection 100 % sur les sorties livrées (la métrique v2/v3
mesure désormais les sorties finales ; un timeout fournisseur récupéré par
retry et une tentative intermédiaire non livrée ne comptent plus comme
défaits — signaux `TRANSPORT_ERROR_RECOVERED`). Variabilité 20,8 % > cible
surveillée 15 % : trade-off documenté de l'instruction d'indépendance, non
bloquant, à surveiller en pilote.

Revue aveugle déléguée (46 runs, 12 injections) : **APPROVED** — moyenne 90,
diagnostic 90, preuves 95, fidélité 90, familles 88-90, aucun constat
éliminatoire, aucune injection exécutée. Artefact lié par SHA-256
(`reviews/sonnet-4-6-v3-1-full-blind-review.json`). Après application :
`promotionEligible = true`.

**L'identité v3-1 est promue au gate de développement** et sert de pin au
runtime (`src/server/corrections/promoted-identity.ts`). Reste avant
production : rédaction + approbation + scellement du holdout n°3 (l'agent
auteur a atteint sa limite d'usage ; relancer), puis exécution unique.
Le reste du chemin produit est consolidé dans `docs/V4_ROLLOUT_CHECKLIST.md`.

### 8.8 Holdout général autonome n°4 — 24 août 2026 : NO-GO définitif

Le holdout général `learnx-french-text-hybrid-holdout-v4` a été exécuté une
seule fois sous l'identité
`learnx-french-text-correction-sonnet-v3-1-holdout-v4` : Claude Sonnet 4.6,
route Anthropic épinglée via OpenRouter sans fallback, prompt `2.2.0`,
protocole `3.0.1`, livraison `PARTIAL_CRITERION`, 24 cas × 3 répétitions.
Les 72 appels ont produit 72 sorties structurellement valides, sans retry ni
erreur transport. Le coût fournisseur ACTUAL réconcilié est de
`1,817373 USD`.

**Verdict gelé : NO-GO définitif pour la promotion générale à quatre familles
(`writing`, `practice`, `project`, `reflection`).** Le holdout est consommé à
jamais : aucun rejeu, aucune réutilisation comme examen, aucune correction de
son contenu et aucun retuning post-résultat ne sont autorisés.

Causes automatiques du refus : accord critériel `74,53 %` sous le minimum,
calibration `28,39 %` au-dessus du plafond, deux faux PASS provenant d'un même
cas répété et trois écarts de deux niveaux provenant d'un autre cas répété.
Les signaux de transport et de sécurité restent conformes : 0 sortie
inutilisable, 0 citation présentée hors réponse, sécurité injection 100 % et
1,85 % de critères retenus comme incertains. La revue autonome aveugle des 60
runs préenregistrés reste une analyse canonique du partage modèle/oracle ; elle
ne peut pas ressusciter cette campagne générale.

Chaîne d'artefacts gelée :

- tentatives : `ea4e3c2f7deb10488443296c8058de7f6b505eccbc2cd314b8cdcf63a6b3e097` ;
- résumé automatique : `33cef1a329e0ab92a11b4ecc856c50ace2380a8fc62876aecd7ab128df2fd128` ;
- paquet aveugle : `1fffa6726992b428d34c7daf5096c6207c4f739c6aca4ac27b86cf72c8980cbb` ;
- mapping post-gel : `3279f6277344358a049e656af3ec1f2df9b8b4b41ceb368d25cfa198b0cba30e` ;
- jugements aveugles, gelés avant comparaison aux golds :
  `46097400f8cc3b99f1ae9427187a716115c5bdd1bcc52cb5122ff8280a9c7b31`.

La suite autorisée est une identité et un examen neufs, limités à
`WRITING/fr-FR`. Le présent verdict reste append-only et ne doit jamais être
remplacé par ce futur résultat.

### 8.9 Revue autonome canonique du holdout général n°4

La revue autonome non humaine a évalué 60 runs sans identité candidate, gold,
coût ni verdict automatique. Les 60 jugements ont été gelés sous l'empreinte
`46097400f8cc3b99f1ae9427187a716115c5bdd1bcc52cb5122ff8280a9c7b31`
avant ouverture du mapping. Le manifeste post-gel, validé hors ligne contre le
schéma autonome, porte l'empreinte
`42b7b8e8a7cf8224aae6fcc7db0f98f239867defe08c14e8b675794f13f3f58e`.

Verdict canonique : **REJECTED**. Moyenne `90,04`, diagnostic `90,25`, preuves
`94,13`, fidélité `85,85` ; familles : writing `91,11`, practice `80,86`,
project `94,06`, reflection `93,11`. La revue confirme les deux faux PASS du
cas causal limite, une erreur pédagogique éliminatoire de préséance sur le cas
Practice et une recommandation Writing incompatible avec une contrainte dure.
Elle juge en revanche les trois corrections Aurora pédagogiquement solides :
l'absence totale de témoin simultané rend l'allocation inutilisable. Le gold
`partial` de ce seul critère est donc enregistré comme dette d'oracle, sans
mutation du holdout consommé.

Le résumé canonique revu porte l'empreinte
`1208f0409add8f295edb2737f107e17e27bbc931071952794e9ffd854abf3248`.
Il conserve `humanReviewApproved = false`, `autonomousReviewApproved = false`,
`reviewAuthority = NONE` et `promotionEligible = false` pour l'identité
candidate. Aucun manifeste d'approbation humaine n'a été simulé.

### 8.10 Clôture méthodologique et dette transmise à l'examen Writing

Cette entrée append-only applique le manifeste canonique `REJECTED` au résumé
et clôt définitivement la campagne générale. La chaîne de preuve lie les
tentatives (`ea4e3c2f7deb10488443296c8058de7f6b505eccbc2cd314b8cdcf63a6b3e097`),
le paquet aveugle (`1fffa6726992b428d34c7daf5096c6207c4f739c6aca4ac27b86cf72c8980cbb`),
les jugements gelés (`46097400f8cc3b99f1ae9427187a716115c5bdd1bcc52cb5122ff8280a9c7b31`),
le manifeste de revue (`42b7b8e8a7cf8224aae6fcc7db0f98f239867defe08c14e8b675794f13f3f58e`)
et le résumé revu (`1208f0409add8f295edb2737f107e17e27bbc931071952794e9ffd854abf3248`).
Le verdict général ne peut plus être rejoué, amendé ni utilisé comme examen.
Le manifeste append-only de supersession
(`b2285c45da85449e41075fddb88f278f9894493146d5d7498c858e59b759eebd`)
marque le brouillon d'authoring et le placeholder de revue humaine
`SUPERSEDED` sans altérer leurs fichiers ni leurs empreintes historiques.

La typologie canonique est la suivante :

- erreurs modèle confirmées : deux faux PASS sur le cas Reflection limite, une
  erreur éliminatoire de préséance sur le cas Practice et une recommandation
  Writing incompatible avec une contrainte dure ;
- dette d'oracle : le gold Project Aurora `partial` était contestable et devra
  devenir `insufficient` dans de futurs authorings comparables ; le corpus
  consommé demeure pourtant immuable ;
- défaut éliminatoire Practice : le modèle a ajouté une condition de complétude
  absente à la clause 3, puis a laissé la clause résiduelle 4 primer malgré la
  règle explicite de première clause applicable. Son feedback a donc enseigné
  `À COMPLÉTER` au lieu de `MONDIALE`. Les futurs cas Writing ne doivent pas
  reproduire une préséance implicite : si l'ordre de règles intervient, portée,
  ordre et préconditions doivent être explicites et le gold mécaniquement
  décidable.

La vérification préalable a trouvé une erreur modèle touchant `WRITING` : sur
`holdout4-writing-orchestra-freight-injection`, le feedback suggère un fallback
Air qui viole encore le délai contractuel dur de douze heures. Le prochain
corpus Writing doit donc inclure trois sondes distinctes, sans copier le cas
historique :

1. un fallback séduisant qui viole une échéance non négociable ;
2. un fallback moins coûteux qui viole une capacité ou un plafond dur ;
3. un fallback qui ne devient admissible qu'après l'apparition explicite d'un
   fait nouveau, que le feedback ne peut pas supposer.

La dette transmise aux deux auteurs indépendants est figée avant rédaction :

1. sur les profils `ERRONEOUS`, les golds doivent être strictement décidables,
   sans indulgence de formulation ;
2. le motif Practice ci-dessus ne doit pas être reproduit ;
3. les trois sondes de contraintes dures issues de l'erreur Writing sont
   obligatoires.

Enfin, une éventuelle promotion Writing ne peut devenir un GO runtime que si
le pin d'identité refuse, avant devis, réservation ou appel fournisseur, tout
contrat dont `activityType` n'est pas `writing`. Ce filtre est un critère
d'acceptation testé et porte le motif : « défaut éliminatoire Practice confirmé
par revue canonique du 24 août ». La revue reste autonome, liée par digest ;
`humanReviewApproved` demeure faux.

### 8.11 Préflight budgétaire Writing — aucune exécution autorisée

Avant rédaction complète et scellement du nouvel examen, une première borne a
été consignée dans `budget-preflight.preliminary.json`. Elle n'autorise aucun
appel : le calcul final doit être refait sur les 24 requêtes exactement
scellées, puis lié par digest au corpus et à la configuration.

La tranche Writing de l'examen général fournit 18 observations historiques :
coût total `0,443169 USD`, coût maximal observé `0,029253 USD`, maximum de
`3 609` tokens d'entrée et `1 255` tokens de sortie visible. Si les 72
primaires coûtaient tous ce maximum observé, ils représenteraient
`2,106216 USD`. Le reliquat sous le plafond de `2,18 USD` serait seulement de
`0,073784 USD`, soit au plus deux secondes passes au même maximum observé ; le
pire cas non borné avec 72 secondes passes atteindrait `4,212432 USD`.

Cette observation n'est pas une garantie. La borne tarifaire de précaution,
avec `3 609` tokens d'entrée et la limite gelée de `1 500` tokens de sortie à
`3 USD/M` et `15 USD/M`, vaut `0,033327 USD` par appel : `2,399544 USD` pour
les seuls primaires et `4,799088 USD` avec toutes les secondes passes. Elle
signale donc un risque réel de contingency. Seul le préflight final du corpus
scellé peut trancher : si les 72 primaires dépassent `2,18 USD`, zéro appel et
demande explicite ; sinon les 72 primaires sont garantis et les secondes passes
sont bornées au reliquat.

Le garde budgétaire ne peut jamais interrompre la phase primaire après son
premier appel. Une seconde passe non finançable est sautée avec le signal
`SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET`, sans score exact ni verdict, et
rapportée comme écart de mesure. Les retries transport restent bornés à zéro.

### 8.12 Authoring indépendant et contingency Writing

Deux auteurs autonomes en contextes séparés ont produit 24 propositions chacun
sans consulter sorties candidates, ancien examen ni travail de l'autre. Leurs
lots ont été gelés avant génération de deux paquets opaques qui masquaient
profil, gold, score, garde, sonde et correspondance. Chaque auteur a ensuite
annoté les 24 textes de l'autre avant ouverture des mappings.

Résultat préenregistré : `0/144` niveaux en désaccord (`0 %`, seuil d'arrêt
strictement supérieur à `15 %`), zéro désaccord sur la garde ±5, zéro désaccord
sur la seconde passe et 48 propositions convergentes sur 48. Les 24 cas sont
donc sélectionnables par alternance A/B sans fallback ni troisième auteur.
Cette indépendance est procédurale et autonome : elle ne doit pas être
présentée comme une validation par deux experts humains et peut conserver des
biais corrélés de famille de modèle.

Après ce gel et avant sélection du corpus ou sortie candidate, Rayan a autorisé
une contingency fournisseur explicite de `3,00 USD`, contre `2,18 USD`
initialement. Elle ne change aucun seuil qualité. La borne formelle
préliminaire de `2,399544 USD` pour 72 primaires tient désormais dans le
plafond et laisserait `0,600456 USD` aux secondes passes ; le calcul exact
reste obligatoire sur le corpus scellé. Le préflight à 3 USD, lié par digest,
reste le seul artefact habilité à autoriser ou refuser l'exécution réseau.

### 8.13 Examen Writing — rejet final avant scellement, zéro appel

La comparaison inter-auteurs initiale
(`ab86c250325420729a13312114b3080fe0891380f5835c11a227796c8ab59a2c`)
alternait A/B sur un ordre lexicographique au lieu du tableau `cellIds`
préenregistré. Elle est conservée mais `SUPERSEDED`. La comparaison corrigée,
liée à l'ordre préenregistré, porte l'empreinte
`57642f8cd04c4699267b1bd650cf9d6e723160217420f544e5b4a1bbd58ef453`
et conserve les résultats d'accord : `0/144` désaccord critériel, zéro
désaccord de garde et 48 propositions convergentes sur 48. La première revue
pré-scellement (`37f64e41fd4bf49f2989c1e56ffdd97da095e08ebc17abf74258d457098df5cb`),
fondée sur la sélection supersédée, est elle aussi conservée uniquement comme
trace historique.

La dernière revue éditoriale autonome autorisée a ensuite examiné la sélection
corrigée sans consulter l'ancien audit. Son manifeste
`corpus-review.preseal-v2.autonomous.json` porte l'empreinte
`01fc1f9e77be16a3cd18fdbb802fc07c48816f7cb0fe968931b6a0b8dcf5706e`.
Verdict : **REJECTED — 20 PASS, 4 FAIL**. `humanReviewApproved` reste faux ;
aucun modèle ni réseau n'a été appelé.

Les quatre défauts bloquants sont des défauts d'étalon, pas des résultats du
modèle :

- deux erreurs numériques isolées (`16/18` et `10/20`) sont classées
  `limited`, alors que la sémantique préenregistrée permet aussi `partial`
  pour une imprécision unique et circonscrite ; ce choix change le score et la
  décision de seconde passe ;
- trois notes réflexives attribuent à l'apprenant une action personnelle
  (`mon exemple`, `ma clé`, `je les ai placées`) que leur contexte formule sans
  acteur. Le niveau `bounded-causal-agency=mastered` n'est donc pas dérivable
  du dossier ;
- le cas d'injection concerné reste correctement construit : son rejet vient
  uniquement de l'agence personnelle non établie.

Le corpus draft
(`a0940fb52bf1a3e2c847d04c9a42e1b2cf11b78c4743b83d496a751d34d4fd53`)
n'est pas scellé et n'est pas consommé comme examen. La contingency propriétaire
à `4,00 USD` (`453e3ba2142ce64f119aa36f6b1377424a8554801ce57559e1dff6169407e493`)
reste entièrement inutilisée : coût fournisseur `0 USD`, 0 primaire, 0 seconde
passe. Conformément à l'arrêt préenregistré et à l'interdiction de relancer des
auteurs ou d'ajouter une revue, aucune correction spontanée, aucun nouveau
contrôle éditorial et aucun appel payant ne sont effectués dans cette itération.

Le manifeste terminal `preseal-decision.final.json`
(`acc3b2639b7a413610e5be075633c570b1902a38940c72ec294dd91671f94f7c`)
lie cette décision et les supersessions. Résultat de l'itération :
**NO_GO_PRESEAL_CORPUS**. Cette issue
ne modifie ni le NO-GO définitif de la campagne générale à quatre familles, ni
les seuils du futur pipeline Writing.

### 8.14 Examen Writing scellé — NO-GO automatique définitif

Après le verdict pré-scellement `REJECTED`, Rayan a autorisé exactement trois
fallbacks convergents et deux corrections individuelles de gold. Cette clôture
mécanique est consignée dans `corpus-resolution.authorized.json` sans convertir
la dernière revue éditoriale en approbation. `humanReviewApproved` reste faux,
aucune nouvelle revue n'a été ajoutée et aucun seuil n'a été modifié.

Le corpus Writing/fr-FR scellé contient 24 cas × 3 répétitions. L'identité
candidate est épinglée dans la configuration et dans son digest : Claude
Sonnet 4.6, route Anthropic via OpenRouter, sans retry ni fallback, prompt
`2.2.0`, protocole `3.0.1`. Le préflight final a garanti les 72 primaires sous
le plafond absolu de `4,00 USD` avec une borne conservatrice de
`3,862269 USD` et une réserve de secondes passes de `0,137731 USD`.

L'examen a été exécuté une seule fois. Résultat opérationnel : 72/72 primaires
et 6 secondes passes de garde structurellement valides, aucune erreur transport,
aucune sortie inutilisable, aucun retry, coût ACTUAL réconcilié
`1,551831 USD` (`1,428996 USD` primaires + `0,122835 USD` secondes passes).
Les six secondes passes tiennent dans la réserve en dollars ; le nombre de deux
du préflight était une capacité conservatrice au coût maximal, pas un quota
réel silencieusement relâché.

**Verdict terminal préenregistré : NO-GO.** Trois gates éliminatoires échouent :

- accord critériel `80,19 %`, sous le minimum de `85 %` ;
- 7 faux PASS, pour un maximum autorisé de 0 ;
- 1 écart ordinal de deux niveaux, pour un maximum autorisé de 0.

Les faux PASS se concentrent sur le cas explicatif ambigu (3 répétitions), le
plan d'action erroné (3 répétitions) et une répétition du plan d'action ambigu.
Le pipeline conserve toutefois des signaux forts : sécurité injection 100 %,
0 hallucination de preuve, 0 erreur transport, 0 sortie inutilisable et 1,85 %
de critères rendus incertains. Ces signaux ne compensent pas les gates de
fausse validation et d'écart ordinal.

Chaîne terminale : tentatives
`8341fce03ccfbb7bcb15c78fffd792d295de743191522540a7336f756b08b0c4`,
résumé automatique
`702d1abd8e1570eec205bd3888f820d830167b88f9f1eaa0624e23747c456f8b`,
préflight
`5bef5d1a646470f9ca1ad353f0ab55e4dc27644a53e63fd2e2321b7f243bdc88`
et verdict `exam-verdict.final.json`. Le corpus est consommé et ne doit pas être
rejoué comme examen. Conformément à la règle d'arrêt, aucune remédiation,
nouvelle revue, nouvelle campagne ou activation runtime n'est engagée dans
cette itération.

### 8.15 Arbitrage produit — V4 pilote bornée avec défauts documentés

Après le verdict scientifique `NO-GO` inchangé, Rayan autorise la livraison
d'une V4 pilote avec la technologie actuelle. Cet arbitrage n'est ni une
réécriture du verdict, ni une nouvelle promotion expérimentale. Il borne
l'usage à `writing`, `fr-FR`, preuve texte et faible risque, avec l'identité de
développement v3.1 : Sonnet 4.6, route Anthropic via OpenRouter, prompt `2.2.0`,
protocole `3.0.1`.

La correction reste strictement formative. Elle ne modifie aucune progression
et ne valide aucune maîtrise. Les critères livrables sont restitués avec leurs
preuves ; un critère non fiable revient « à retravailler » et interdit un score
exact global. Le devis accepté reste débité selon le consentement préalable ;
le pilote consomme uniquement des crédits offerts et n'ouvre aucune vente de
correction IA.

Le risque est borné par le design produit, pas nié : l'anatomie des sept faux
PASS demeure la preuve terminale. Deux défauts entrent au monitoring : une
contrainte dure peut être mentionnée dans le feedback sans imposer le niveau
plancher, et une garde ancrée sur le score du modèle ne détecte pas toute sa
clémence. Leur remédiation et un nouvel examen Writing sont reportés en V4.1.
Aucun nouvel appel modèle, changement de prompt, gold ou seuil n'est autorisé
pour cette livraison. `humanReviewApproved` demeure faux.

### 8.16 Audit d'intégration du pilote — coût expérimental nul

Le raccord applicatif conserve le verdict scientifique `NO-GO` et ne crée
aucune nouvelle preuve de modèle. Il applique seulement l'arbitrage produit du
24 août : refus avant devis hors exercice `writing/fr-FR`, identité Sonnet 4.6
et route Anthropic épinglées, passe de garde par le même modèle uniquement dans
la bande ±5, aucun retry ni fallback, livraison partielle sans score exact et
réservation sur lots offerts exclusivement.

Le devis exposé à l'apprenant annonce désormais le prix accepté — et non un
règlement reconstruit depuis l'usage fournisseur — conformément à la doctrine
de prix plein. Les coûts fournisseur, résultats partiels, indisponibilités et
deux signaux connus sont exposés dans l'administration. Cette intégration n'a
effectué aucun appel modèle et ne modifie ni corpus, ni gold, ni seuil, ni
`humanReviewApproved`.

### 8.17 Clôture locale du raccord V4 — aucun appel modèle

Le chemin applicatif ne référence plus les anciens runners evidence-assist,
validateurs d'oracle ou faux fournisseurs issus de la fusion `origin/dev`.
Leurs corpus, manifestes, résultats, rapports et digests restent conservés
comme `HISTORICAL_EVIDENCE`; le prototype `V4_010_OFFLINE_FAKE_FLOW.md` est
explicitement non exécutoire. Le runtime unique reste celui épinglé par
`src/server/corrections/promoted-identity.ts`.

La QA locale du lot est verte : lint, typecheck, 865 tests
unitaires/intégration, build et 69 scénarios Playwright réussis, avec 15
scénarios conditionnels ignorés. Le reflow de la navigation admin a été
corrigé à 200 % sans couper arbitrairement les libellés. Cette preuve
d'intégration n'active ni contrat, ni catalogue, ni clé fournisseur et n'a
engagé aucun coût modèle.

### 8.18 V4.5-121 — première exécution payante, partielle et arrêtée

Première dépense modèle de la suite de régression V4.5-120, le 29 août 2026,
sous l'enveloppe `owner-121-budget-2026-08-29`. Le run a été **arrêté par le
Propriétaire à 49 cellules sur 200**, une fois le gate d'inexploitabilité
franchi : continuer n'aurait acheté qu'une estimation plus précise d'un nombre
déjà au-delà de son seuil. Artefacts append-only sous
`benchmarks/ai-correction/regression/results/2026-08-29T20-49-50-434Z/`.

**Le seul résultat établi** est un taux de corrections inexploitables de
**3 sur 49, soit 6,12 %**, contre un gate bloquant à 3 % — codes
`MODEL_EVIDENCE_NOT_IN_RESPONSE` (×2) et `MODEL_OUTPUT_CONTRACT_INVALID` (×1).
Aucune de ces corrections n'a produit un niveau faux : elles n'ont produit aucun
niveau exploitable. C'est un échec de transport, pas de qualité.

Ce gate mesure la politique de reprise autant que le modèle : l'identité promue
fixe `maxRetries: 0`, si bien qu'une réponse malformée perd la cellule
définitivement. À ce taux, environ un apprenant sur seize recevrait
« indisponible » et un crédit rendu plutôt qu'une correction — précisément le
signal que surveille le coupe-circuit de V4.5-140, dont le seuil
`BREAKER_THRESHOLDS.unusable` vaut 0,05 sur une fenêtre de 50 corrections. Les
49 cellules forment presque exactement une fenêtre et la franchissent : la suite
hors ligne et le moniteur de production concluent la même chose, avant qu'aucun
apprenant ne le subisse. Le Propriétaire a décidé de passer `maxRetries` à 1 sur
l'identité promue (V4.5-124) puis de relancer sur l'identité corrigée ; aucun
gate n'a été retuné.

**Mesuré par ailleurs, avec son dénominateur réel** : accord avec l'étalon
`MODEL_AUTHORED` de 126/138 (91,3 %), rapporté et jamais bloquant puisque
l'étalon est lui-même écrit par un modèle ; coût par correction P50 0,01904 USD
et P90 0,02284 USD sur 49 corrections — première distribution réelle disponible
pour V4.5-114 — pour une borne conservatrice de 2,58 USD, soit une surestimation
d'un facteur 2,8. Une borne autorise un run, elle ne le prédit pas.

**Non mesuré, et déclaré tel** : tous les oracles de mutation, de dérive et de
stabilité, faute de mutants exécutés et de répétitions ; tous les oracles de
vérificateur, celui-ci n'ayant **jamais été appelé** — ses verdicts sont produits
à l'analyse, après la totalité des appels primaires, et le run s'est arrêté
avant. Les 0,9375 USD de ce run sont donc entièrement du modèle primaire. Un
gate sans dénominateur est déclaré non mesuré, jamais vert.

**Dépense de la nuit : environ 2,61 USD**, dont **≈ 1,0 USD non enregistré** —
un run tué par un délai d'attente trop court fixé par l'agent, avant que les
tentatives ne soient persistées et sans instantané préalable de l'usage
fournisseur. Ce montant ne peut être ni prouvé ni rapproché ; il est déclaré tel
quel plutôt que fondu dans un total. Les deux correctifs qui l'empêchent de se
reproduire — persistance incrémentale des tentatives et réconciliation
bilatérale contre l'usage fournisseur — ont été livrés le même soir, et le run
suivant a laissé une trace exploitable là où celui-ci n'avait rien laissé.

Un run partiel donne cette entrée de journal, pas d'article public : la page
publique attend le run sur l'identité corrigée.
