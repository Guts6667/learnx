# Consigne D — le recalcul explicite, et ce qu'il laisse passer

| Consigne | Faux accords | Taux | Coût |
| --- | --- | --- | --- |
| A — runtime promue | 3/20 | 15,00 % | 0,008567 USD |
| B — adversariale | 2/20 | 10,00 % | 0,010877 USD |
| **D — adversariale + recalcul explicite** | **1/20** | **5,00 %** | **0,015167 USD** |

## Les deux moitiés sont exactement complémentaires

| Cas | Forme | A | B | D | Oracle déterministe |
| --- | --- | --- | --- | --- | --- |
| `arith-01` | `7 × 6 € + 12 € = 44 €` — expression explicite | accord | accord | **accord** | **détecte** |
| `arith-04` | « trois étapes de 45 minutes, soit 2 heures » | accord | accord | refus | hors périmètre |
| `arith-05` | « 3 litres par minute, donc 180 litres par jour » | accord | refus | refus | hors périmètre |
| `arith-02` | somme en prose | refus | refus | refus | hors périmètre |
| `arith-03` | ratio en prose | refus | refus | refus | hors périmètre |

**D attrape les quatre cas en prose que l'analyseur ne sait pas lire. L'oracle
attrape le seul cas que D laisse passer.** Sur ces vingt cas, les deux ensemble
ne laissent aucun faux accord.

Le résultat contre-intuitif est le sens de la difficulté : le cas le plus facile
pour un lecteur humain — une multiplication posée, opérandes visibles — est le
seul qu'aucune des trois consignes ne rattrape. C'est aussi le seul qu'une
calculatrice traite sans discuter, et c'est celui qui a atteint la production.

## Ce que ça ne prouve pas

Vingt cas, un tirage. Un modèle qui calcule reste probabiliste : D à 1/20 ne
promet rien du vingt-et-unième. L'oracle, sur les formes qu'il couvre, ne varie
pas d'un run à l'autre et ne se laisse pas convaincre. C'est la raison de garder
les deux plutôt que de choisir.

La recommandation qui suit de là : **D pour la prose, l'oracle pour les
expressions explicites.** Aucune des deux ne remplace l'autre, et chacune couvre
précisément l'angle mort de l'autre.

## Provenance

Chiffres relevés sur la sortie console du lancement du 31 août : la persistance
des sondes est dans la PR #167, non encore fusionnée dans cet arbre. Le prochain
lancement écrira son propre artefact.
