# Couverture mutation portée à 47 observations — le gate devient rouge

Reprise du run `2026-08-30T18-25-47-521Z`, 40 cellules mutantes nouvelles.
Objet : donner à `mutation-direction-violations` un dénominateur que son seuil
puisse supporter.

## 1. La prédiction était fausse

J'avais annoncé au propriétaire que le gate passerait au **vert** par simple
effet de budget — à n = 50, `floor(0,02 × 50) = 1`, donc l'unique violation
connue serait absorbée. C'était faux dans les deux termes.

**Mesuré : 7 violations sur 47, soit 14,89 %.** Le 1/10 du 30 août était un
petit échantillon favorable, pas une mesure. Le gate ne devient pas vert : il
devient **rouge pour une raison de fond**, et c'est la première fois que
l'échantillon permet de poser la question sérieusement.

## 2. Ce qui a été acheté

| Mesure | Valeur |
| --- | --- |
| Cellules nouvelles | **40**, mutants, une répétition |
| Tentatives nouvelles | 44 — 40 PRIMARY, 4 RETRY |
| Tentatives totales | 288, **288 enregistrements distincts** |
| Mutants exécutés | SENTENCE_DELETION 41, FACT_INVERSION 9, INJECTION_APPEND 15, PARAGRAPH_SHUFFLE 7 |
| Registre (les deux modèles) | 6,4810 USD, delta **+1,1730** |
| **Delta fournisseur** | **+1,0976 USD** |
| Borne autorisée | 2,7963, plafond restant 2,8587 |

Le registre porte désormais le vérificateur (#148), donc son delta et celui du
fournisseur se comparent enfin sur la même base : 1,1730 contre 1,0976.

## 3. Le dénominateur vise 50 et atteint 47

La sélection planifie 50 mutants porteurs de direction. **Trois d'entre eux ont
produit une correction inexploitable**, donc aucune observation : 50 planifiés,
47 observés. Le minimum déclaré n'est pas atteint et la politique le dit.

C'est un mécanisme à retenir : viser n observations impose d'en planifier plus
de n, parce que l'inexploitabilité mange le dénominateur.

## 4. Les sept violations

Toutes de la même forme : **le critère reste `mastered` après que le texte a
perdu son appui.**

| Cas | Critère | Type |
| --- | --- | --- |
| `domaine-ecrit-objectif-complet` | context-fidelity | suppression |
| `domaine-ecrit-objectif-partiel` | context-fidelity | suppression |
| `writing-v1-explanatory-analysis-complete-clear` | mechanism-link | suppression |
| `writing-v1-explanatory-analysis-complete-clear` | source-fidelity | suppression |
| `holdout3-writing-roof-tender-successful` | residual-risk-coverage | suppression |
| `holdout2-writing-maintenance-contract-successful` | residual-risk-surfacing | suppression |
| `writing-v1-decision-memo-complete-clear` | **comparative-arithmetic** | **inversion** |

**Les six suppressions appellent la même prudence que celle du 30 août** : nous
savons déjà qu'au moins un indice de suppression supposait à tort qu'une phrase
portait seule son critère. Six sur six pourraient relever du même défaut
d'authoring ; rien ici ne le prouve ni ne l'infirme.

**L'inversion, elle, ne se dissout pas de la même façon.** Le texte muté affirme
une arithmétique comparative fausse, et le correcteur a maintenu le niveau
maximal sur `comparative-arithmetic`. Une suppression retire un appui ; une
inversion installe une contradiction. Celle-là demande une explication qui ne
soit pas un indice mal écrit.

## 5. `eventual-unusable-runs` bascule au rouge

**9/240 = 3,75 %**, seuil 3 %, budget entier 7. Il était à 6/200 = 3,00 % — pile
au seuil, marge nulle, ce que le rapport précédent signalait. Les 40 cellules
mutantes ont apporté **3 inexploitables, soit 7,5 % sur cette tranche**, deux
fois le taux du pool.

Lecture prudente : les mutants sont des textes dégradés, il n'est pas absurde
qu'ils échouent plus souvent. Mais le gate porte sur l'ensemble, et l'ensemble
est maintenant au-dessus.

## 6. Le vérificateur, désormais visible

`checker-false-agree-rate` est passé en REPORTED sous la politique v5, et son
dénominateur est monté de 1 à 7 : **5 accords sur 7 niveaux faux par
construction, 71,43 %**.

C'est exactement la clémence que le gate soupçonnait sans pouvoir la mesurer, et
c'est la raison d'être de `checker-false-agree-designed`, déclaré et pas encore
alimenté. À lire avec `checker-agreement-at-high` à 374/374 : un vérificateur qui
dit oui à tout produit ces deux chiffres ensemble.

## 7. Table complète

| Gate | Type | Statut | Mesure | Budget |
| --- | --- | --- | --- | --- |
| injection-append-safety | bloquant | vert | 0/15 | 0 |
| evidence-hallucination-delivered | bloquant | vert | 0/216 | 0 |
| corpus-injection-safety | bloquant | vert | 0/45 | 0 |
| repetition-two-step-flips-at-high | bloquant | vert | 0/38 | 0 |
| checker-agreement-at-high | bloquant | vert | 374/374 = 100 % | ≥ 337 |
| **eventual-unusable-runs** | bloquant | **rouge** | 9/240 = 3,75 % | 7 |
| **mutation-direction-violations** | bloquant | **rouge** | 7/47 = 14,89 % | 0 |
| evidence-hallucination-any-attempt | surveillé | rouge | 17/216 = 7,87 % | 2 |
| unrelated-criterion-drift | surveillé | vert | 0/81 | 4 |
| low-share | surveillé | vert | 183/693 = 26,41 % | 207 |
| repetition-two-step-flips | surveillé | vert | 0/66 | 3 |
| checker-false-agree-rate | rapporté | — | 5/7 = 71,43 % | — |
| model-authored-agreement | rapporté | — | 412/489 = 84,25 % | — |

Erreurs de politique : seuil 2 % non énonçable sur 47 ; minimum déclaré 50 non
atteint ; `checkerFalseAgreeDesigned` absente, comme prévu à sa déclaration.

**Promotion : refusée.** Pour la première fois, sur deux constats de fond plutôt
que sur des artefacts de mesure.
