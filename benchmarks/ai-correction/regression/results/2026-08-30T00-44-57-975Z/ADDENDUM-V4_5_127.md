# Addendum V4.5-127 — le gate des preuves, mesuré après coup

`REPORT.md` reste tel qu'il a été écrit : `benchmarks/**` est en ajout seul, et
un rapport qu'on récrit après avoir vu le résultat ne vaut rien. Cet addendum
corrige deux de ses lignes, sans en effacer une seule.

Rien n'a été racheté. Tout ce qui suit sort des artefacts déjà payés, par
`--analyse`.

## 1. Ce que le rapport disait, et ce qui est vrai

| Ligne de `REPORT.md` | Statut |
| --- | --- |
| §2, `evidence-hallucination` : « non branché » | **caduque** — branché et mesuré |
| §8 : « Il ne prouve pas l'absence de preuves inventées » | **partiellement caduque** — voir §3 |

Le reste du rapport tient. Aucun chiffre publié n'a bougé.

## 2. Pourquoi le gate avait disparu

Il était déclaré bloquant et n'atteignait jamais le tableau. Sa métrique étant
absente, l'évaluateur consignait une erreur de politique et **sautait le gate** :
le tableau affichait onze gates pour une politique qui en déclare douze, sans
rien dire du douzième. La promotion était refusée dans les deux cas — c'est
précisément pour cela que le défaut a traversé un run payant sans se faire voir.

Un gate bloquant qui disparaît est pire qu'un gate rouge : le rouge, on le voit.

Le gate figure désormais toujours au tableau. Sans convention choisie il est
`NOT_MEASURED`, jamais absent, et jamais un zéro fabriqué — un zéro se lirait
comme un succès.

## 3. La mesure, dans les deux conventions

| Convention | Mesure | Verdict |
| --- | --- | --- |
| `any` — toute tentative | **12/152 = 7,89 %** | rouge (seuil 0) |
| `delivered` — ce qui a été remis | **0/152 = 0,00 %** | vert |

Décomposition des 12 cellules, vérifiée cellule par cellule plutôt que déduite
de l'agrégat :

- **10×** première tentative rejetée pour preuve inventée → reprise **valide et
  propre**
- **2×** rejetées deux fois, **aucune correction remise** (elles font partie des
  4 inexploitables du §1 du rapport)

**Aucune correction remise à un apprenant ne contenait de preuve inventée.**
L'écart entre 7,89 % et 0 % est le travail de la garde de preuves, plus celui de
`maxRetries: 1` (V4.5-124), qui transforme 10 de ces 12 cellules en corrections
utilisables au lieu de refus.

Sur les 152 cellules bien formées, 149 ont effectivement remis quelque chose.

## 4. Ce qui est exclu, et pourquoi c'est dit plutôt qu'absorbé

24 cellules portent **deux tentatives numérotées 1 toutes les deux**. C'est la
signature, dans les données, du défaut de décalage de répétition décrit au §4 du
rapport : la passe de répétitions relançait la première observation. L'artefact
ne peut donc pas dire laquelle est venue d'abord, ni ce qui a été remis.

Elles sont **exclues du dénominateur des preuves et nommées**, jamais
renumérotées. Inventer un ordre que le run n'a pas enregistré reviendrait à
inventer la réponse. C'est aussi une confirmation indépendante du §4 : le
travail en double est visible dans les données, pas seulement déduit de la
colonne des répétitions.

## 5. La décision qui reste ouverte

Le défaut suit la configuration en vigueur (`benchmark.v1.json`, sans seuils de
politique v2), donc **`any`**, donc **rouge**. `delivered` n'a **pas** été promu
en défaut : c'est la convention qui fait passer le gate, et la choisir en
silence serait accorder un gate à son résultat.

`--evidence-convention=delivered|any` la sélectionne explicitement. Le choix de
la convention que la politique doit tenir appartient à la revue, pas à l'outil
qui la mesure.
