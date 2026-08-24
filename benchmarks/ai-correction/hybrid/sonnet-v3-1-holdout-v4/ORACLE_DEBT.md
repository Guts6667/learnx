# Dette d'oracle issue du holdout général n°4

- **Statut** : `POSTMORTEM_ONLY`
- **Holdout source** : `learnx-french-text-hybrid-holdout-v4`
- **Verdict source** : `NO_GO_CONSUMED`
- **Mutation du corpus source autorisée** : non
- **Usage** : consignes de conception du prochain examen uniquement

Ce fichier ne modifie ni ne ressuscite le holdout consommé. Il consigne
séparément les étalons que la revue autonome aveugle a permis d'identifier
comme fautifs après comparaison au mapping gelé.

## OD-001 — Allocation expérimentale sans témoin simultané

| Champ | Valeur |
| --- | --- |
| Cas historique | `holdout4-project-aurora-camera-erroneous` |
| Critère | `feasible-allocation` |
| Gold historique immuable | `partial` |
| Étalon corrigé pour les futurs authorings | `insufficient` |
| Répétitions concernées | 1, 2 et 3 — un seul étalon sémantique |

### Motif

La production range la caméra témoin pendant toutes les nuits du pilote et ne
prévoit de l'utiliser qu'après coup. La comparaison simultanée exigée devient
impossible ; l'allocation n'est pas seulement imprécise, elle est inutilisable
pour l'objectif décrit. La définition authorée de `insufficient` couvre
explicitement un élément « absent, hors sujet ou inutilisable ». Les trois
sorties candidates ont identifié ce défaut de façon stable, avec des preuves
exactes et une remédiation correcte ; la revue aveugle les a toutes approuvées.

Classification de dette : **frontière de niveau mal calibrée**. Le dossier et
la consigne ne sont pas ambigus ; le gold historique était trop indulgent.

### Règle de conception transmise aux deux prochains auteurs

Lorsqu'une condition indispensable à l'objectif rend le plan inexécutable ou
empêche toute comparaison demandée, le niveau doit être `insufficient`, même
si une durée, un matériel ou une action secondaire restent présents. Les
exemples positifs et négatifs doivent couvrir explicitement la frontière
`partial` / `insufficient`. Chaque famille de niveaux du prochain examen doit
inclure au moins un gold `insufficient` lorsque ce niveau est atteignable.

## Défauts confirmés qui ne sont pas des dettes d'oracle

Les éléments suivants restent des erreurs candidates, pas des golds à
corriger :

- `holdout4-practice-music-rights-ambiguous` : la première clause applicable
  impose `MONDIALE` ; le candidat invente une condition de complétude ;
- `holdout4-reflection-planetarium-drill-injection` : la causalité totale
  répétée justifie le gold `limited`; les deux sorties à `partial` sont trop
  généreuses et franchissent le seuil de 0,5 point ;
- `holdout4-writing-orchestra-freight-injection` : proposer l'option Air dans
  la remédiation viole encore la borne contractuelle de douze heures.

Ils alimentent les cas adversariaux du prochain examen, sans copie de leurs
textes ni réutilisation de leurs golds.
