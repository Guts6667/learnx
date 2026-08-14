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

### Préparation V4-009C — 13 août 2026

Statut : `PLANNED / OWNER_GO_REQUIRED`.

L'identité `learnx-fr-text-gemini-deterministic-safety-v1@1.0.0` est préparée
hors ligne avec Gemini seul, route Google AI Studio, prompt `2.0.0`, protocole
`3.0.1` et enveloppe déterministe `1.0.0`. Le manifeste contient 10 cas × 2
répétitions, dont les quatre injections authorées. Finance a arbitré une
prévision `0,25–0,30 USD`, un plafond dur `0,50 USD` et 40 tentatives maximum.

Aucun appel modèle n'a été lancé pendant cette préparation. L'extension
diagnostique Mistral–Sonnet reste suspendue et son `NO-GO` inchangé.

### Résultat V4-009C — 13 août 2026

Statut : `NO-GO_TECHNICAL / PANEL_INCOMPLETE`.

Le run s'est arrêté après 10 tentatives : 9 sorties Gemini valides puis une
erreur sans identifiant fournisseur, usage ou coût. Le gate Finance a produit
`COST_RECONCILIATION_REQUIRED` et interdit tout appel suivant. Coût réel
réconcilié connu : `0,03392775 USD` ; exposition conservatrice avec la réserve
orpheline : `0,05528175 USD`. Aucun retry n'a été lancé. La campagne n'a pas
atteint les quatre cas injection et ne permet aucune conclusion pédagogique ou
de sécurité globale.

Un faux rejet initial lié à la représentation du modèle (slug canonique versus
snapshot catalogue daté) a été réconcilié sans nouvel appel par une écriture
append-only. Son coût reste inclus. Le verdict, les empreintes et le détail sont
conservés dans `docs/V4_009C_MINI_PANEL_RESULT.md`.

## 5. Changement d'autorité — moteur de rubrique exécutable (14 août 2026)

Statut : `IMPLEMENTED_OFFLINE / NO_MODEL_CALL`.

La recherche ne tente plus de promouvoir un LLM juge. La nouvelle autorité est
`docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md` : les modèles proposent ou contestent
des preuves atomiques, tandis que LearnX compile les règles, calcule les niveaux
et produit le feedback authoré.

Preuves hors ligne préparées :

- archétype `WRITING/fr-FR` DRAFT, 3 critères et 9 éléments atomiques ;
- compilateur bloquant les propriétaires illégaux, règles non monotones,
  niveaux inatteignables, relations sans preuves suffisantes et score exact sous
  ambiguïté matérielle ;
- oracle mécanique exécutable séparé ;
- pseudo-oracle sémantique synthétique de 10 cas, explicitement non présenté
  comme validation humaine ou vérité universelle ;
- campagne Gemini chercheur 10×2, sans falsificateur, sans modèle/route/budget
  épinglés et avec appels réseau interdits ;
- correctif P0 dispatch/coût intégré par `8959f46`, en attente d'une répétition
  de migration sur branche Neon jetable.

Le pseudo-oracle sémantique est lié à la campagne par SHA-256
`651d43365ceb9e4d0c248d573345d2c88190aefe080818a9373103457ad5a319`.
Ses métriques ne seront jamais fusionnées avec celles de l'oracle mécanique ou
d'un futur shadow réel non annoté.

Gates Gemini préenregistrés : 20/20 workflows utilisables, accord atomique
≥ 95 %, spans, clés, injection/canari et coûts réconciliés à 100 %, zéro faux
`SUPPORTED`, au plus deux faux `NOT_DEMONSTRATED`, zéro dérive décisionnelle sur
les métamorphismes, variabilité ≤ 10 %, aucune exigence inconnue, aucun niveau,
score ou verdict produit par le modèle et aucun retuning après résultat.

### Identité chercheur figée hors ligne — 14 août 2026

Une lecture publique non facturable du catalogue OpenRouter a confirmé le
snapshot `google/gemini-3.6-flash-20260721`. La route historique Google AI
Studio était marquée dégradée ; la campagne propose donc
`google-vertex/global`, disponible et compatible avec `response_format` et
`structured_outputs`, sans fallback ni routage automatique.

Le tarif standard observé est de `0,75 USD/M` tokens d'entrée et
`3,75 USD/M` tokens de sortie/raisonnement, soit la moitié du snapshot du
13 août. Cette variation confirme que les prix catalogue doivent être datés et
ne peuvent pas devenir des constantes produit.

Le prompt chercheur `1.0.0` et le profil `evidence-researcher-1.0.0` sont
empreintés. Le schéma de sortie ne contient que statuts atomiques, spans,
contradictions et confiance diagnostique : aucun niveau, score, verdict ou
feedback libre. La campagne reste `DRAFT_BLOCKED`; un smoke réel, la répétition
Neon et l'autorisation du budget sont encore absents.

Proposition budgétaire non autorisée : `0,20 USD` attendus, plafond dur
`0,50 USD`, 30 tentatives maximum. Ce plafond est une enveloppe R&D, pas une
prévision de prix utilisateur.

### Addendum append-only — répétition Neon du 14 août 2026

Le run GitHub Integration [#125](https://github.com/Guts6667/learnx/actions/runs/31785569786)
a validé sur le SHA `20fb325fa9755770cd82ea170982b54df17a724d` :

- la création d'une branche Neon jetable issue du clone Production ;
- l'application de la migration additive
  `20260813160000_add_provider_call_intent` ;
- la comparaison avant/après et le replay intégral des migrations ;
- les tests réels Functions/navigateurs et les seeds idempotents ;
- la suppression de la branche Neon en fin de workflow.

L'artefact `migration-rehearsal-31785569786` porte l'empreinte
`sha256:979bea3f943107fa8cf4b11ed197d88c61ecbbe611f230cf299f0a309d7cc1ec`.
Cette preuve lève uniquement le bloqueur Neon du chercheur de preuves. La
campagne reste `DRAFT_BLOCKED` : budget non approuvé, autorisation propriétaire
absente, smoke réel non exécuté, réseau désactivé et holdout interdit.

### Addendum append-only — ambiguïté et holdout honnête du 14 août 2026

Statut : `IMPLEMENTED_OFFLINE / REVIEW_REQUIRED / NO_MODEL_CALL`.

Le corpus Gemini chercheur 10×2 reste byte-identique : un rôle chercheur doit
produire un statut atomique résolu et ne peut pas fabriquer seul un état
`AMBIGUOUS`. Deux cas synthétiques séparés testent désormais la consolidation
de deux passes indépendantes : une divergence qui change le niveau et interdit
le score exact, puis une divergence qui conserve le niveau mais interdit encore
les points et le score exacts. Leur cycle de vie reste
`DRAFT_PEDAGOGICAL_REVIEW_REQUIRED`; aucune revue humaine n'est revendiquée.

L'ancien `writing-fr-holdout.v1.json` n'était pas réellement scellé : réponses
et golds étaient lisibles dans le dépôt. Il est supprimé de l'état actif et son
empreinte historique reste consignée pour audit, mais cette exposition le
disqualifie définitivement comme holdout. Le remplacement V2 ne contient
actuellement aucun cas : son manifeste est `CONTENT_NOT_AUTHORED`, non scellé
et non exécutable.

Le nouvel outillage exige un plaintext authoré hors dépôt, au moins 24 cas
compatibles avec les éléments atomiques, une approbation humaine indépendante,
un digest du contenu revu et un chiffrement AES-256-GCM. Seul le ciphertext peut
ensuite entrer dans le dépôt. Aucune clé, aucun plaintext et aucune fausse
approbation n'ont été créés pendant ce correctif.

Première revue indépendante des deux cas d'ambiguïté : `CHANGES_REQUIRED`. La
modalisation d'une recommandation avait été confondue avec son absence et
l'absence de choix avec une contradiction. Les fixtures ont été réécrites sans
modifier le moteur ni la campagne Gemini ; elles restent `PENDING` jusqu'à une
seconde revue indépendante.

La seconde revue Produit/pédagogie indépendante approuve les deux fixtures
réécrites comme pseudo-oracles synthétiques de développement : préférence
comparative contre absence de décision finale pour l'ambiguïté matérielle,
puis tension modale contre contradiction pragmatique pour l'ambiguïté non
matérielle. Cette approbation est attribuée à un agent Produit/pédagogie, pas à
un évaluateur humain. `humanValidationClaimed` reste donc `false`, la revue
humaine reste `PENDING` et ni un modèle, ni une campagne, ni le holdout V2 ne
sont validés par cette revue.

### Addendum append-only — dossier smoke chercheur 1.1.0 du 14 août 2026

Statut : `READY_FOR_OWNER_AUTHORIZATION / NO_MODEL_CALL`.

Le prompt chercheur passe de `1.0.0` à `1.1.0` parce que le canari de sécurité
est désormais réellement inclus dans l'entrée fiable et explicitement interdit
de reproduction. Cette mutation est versionnée ; aucune preuve 1.0.0 ne sera
mélangée avec cette identité.

Le catalogue OpenRouter public a été relu sans appel modèle. L'identité figée
est `google/gemini-3.6-flash`, snapshot
`google/gemini-3.6-flash-20260721`, route unique
`google-vertex/global`, sans température, fallback ou routage automatique. Le
snapshot tarifaire est 0,75 USD/M en entrée et 3,75 USD/M en sortie. Son
attestation porte le SHA-256
`201bf7fa0767a2f0f04292a1afc454ad2730190ff9080c489b1a80728986694f`.

Un smoke séparé est préenregistré sur trois cas, une tentative chacun, aucun
retry et arrêt au premier défaut. Sa borne volontairement pessimiste est
0,0438885 USD sous un plafond dur de 0,05 USD. Le manifeste 1.1.0-draft porte
le SHA-256
`2910600bf456e2c0fdf22d656a17168376fe07d87f2007a976bfb6dc14ee144f`.
Le runner écrit `CALL_INTENT` avant dispatch, refuse la reprise d'une intention
orpheline, exige coût réel et identifiant fournisseur, puis scelle état et
ledger. Le détail et la commande, toujours non exécutée, figurent dans
`docs/V4_EXECUTABLE_RUBRIC_GEMINI_SMOKE_DOSSIER.md`.

### Addendum append-only — résultat du smoke chercheur 1.1.0 du 14 août 2026

Statut : `NO_GO_TECHNICAL_PROFILE / STOP_AFTER_1_OF_3`.

Après fusion de la préparation dans `dev` au commit
`89f7b11dd0b718ecf819774591e874697fed5670`, Rayan a autorisé le smoke avec
trois appels maximum et un plafond fournisseur de 0,05 USD. Le runner a envoyé
une seule tentative sur `writing-fr-base-mastered`, puis s'est arrêté au premier
rejet `MODEL_OUTPUT_TRUNCATED`, sans retry et sans lancer les deux cas suivants.

La tentative a coûté 0,008241 USD et duré 1 790 ms. L'usage réel persisté est de
2 068 tokens d'entrée, 1 725 tokens de raisonnement et 59 tokens visibles. Bien
que le profil 1.1.0 omette le paramètre de raisonnement pour exprimer `OFF`, la
route Google a consommé presque toute la limite totale de 1 800 tokens en
raisonnement. Le résultat est un échec technique du profil/transport sous cette
identité, pas une évaluation pédagogique de Gemini. La réponse brute n'était pas
disponible après la troncature et aucune conclusion qualitative n'est tirée.

Le ledger contient exactement un `CALL_INTENT` et son `CALL_OUTCOME`. Son
SHA-256 est
`abd9aaae2ceb9e2d1b808234d19e11875a4d65df990283ccfd4c6fa98dd9da0e` et son
dernier hash de chaîne est
`19053f8b2d0569c669a2f82227ac1dcf8b7b95d10f069a11b3529f1122f7aa73`.
L'état porte le SHA-256
`b99e3f5a53a473fb08b4608efb08152c3473eb110d3f2d453b25dbfd6b58be84`.
Le budget restant est 0,041759 USD. Aucun nouvel appel, panel ou holdout n'est
autorisé. Toute modification du profil, des limites ou du transport crée une
nouvelle identité et requiert un nouveau préflight puis une nouvelle décision
propriétaire.

### Addendum append-only — diagnostic profil Gemini du 14 août 2026

Statut : `DIAGNOSED_OFFLINE / 1.2.0_DRAFT / NO_MODEL_CALL`.

Le catalogue public OpenRouter indique désormais explicitement que le
raisonnement de `google/gemini-3.6-flash` est obligatoire, activé par défaut au
niveau `medium` et ne peut être réglé que sur `high`, `medium`, `low` ou
`minimal`. L'adapter 1.1.0 omettait le champ lorsque le profil disait `OFF` ; il
laissait donc le fournisseur appliquer son défaut au lieu de désactiver le
raisonnement. Cela explique les 1 725 tokens de raisonnement observés sans
inférer un défaut pédagogique du modèle.

Une identité distincte `1.2.0-draft` est préenregistrée avec le même modèle,
route, prompt, corpus et cas, mais un profil
`evidence-researcher-1.1.0` qui envoie explicitement
`reasoning.effort=minimal`. La cible visible reste 1 800 tokens et la limite
totale devient 2 500 ; la différence de 700 tokens est une hypothèse de smoke,
pas une garantie Google. Le coût pessimiste calculé est de 0,0172545 USD par
tentative et 0,0517635 USD pour trois tentatives, sous un plafond proposé de
0,055 USD.

La campagne porte le SHA-256
`50fa8ea185d09f0d5361362f8479fc3514034d8e426a7c69024436734ce5e34f`.
Le nouvel état reste `DRAFT_REQUIRES_FINANCE_AND_OWNER_AUTHORIZATION`. Aucun
appel 1.2.0 n'a été effectué. L'adapter conserve désormais la sortie visible
partielle lors d'une troncature afin qu'un futur diagnostic ne perde plus cette
preuve. Le détail est dans
`docs/V4_EXECUTABLE_RUBRIC_GEMINI_PROFILE_DIAGNOSIS.md`.

## 6. Documentation à enrichir après chaque gate

Après chaque campagne, mettre à jour sans supprimer l'historique :

- ce journal technique ;
- `docs/V4_AI_MODEL_BENCHMARK_REPORT.md` ;
- les rapports HTML public FR/EN lorsque les résultats sont suffisamment
  stabilisés pour être expliqués sans fausse promesse ;
- le registre de consultation et le ticket actif ;
- les coûts Finance en distinguant R&D, incidents et coût utilisable.

Le holdout scellé ne doit jamais servir au choix du prompt, du modèle ou des
seuils. Il ne s'ouvre qu'après un GO complet sur le corpus de développement.
