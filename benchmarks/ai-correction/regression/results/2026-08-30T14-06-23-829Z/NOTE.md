# Refus au plafond 7 USD — aucune dépense nouvelle

**Ce répertoire ne mesure rien et n'a rien acheté.** Il contient 177 tentatives
et un registre de 3,7923 USD : chacune de ces 177 entrées est identique — même
candidat, cas, répétition, tentative, coût **et latence** — à une entrée du
registre de `2026-08-30T00-44-57-975Z`. Ce sont les tentatives déjà payées le
30 août, reportées par la passe « pool complet × 1 » qui n'avait plus rien à
acheter. Les 39 entrées manquantes (0,8931 USD) sont celles des mutants, que la
troisième passe aurait reportées si le run l'avait atteinte.

**Dépense nouvelle : 0,0000 USD.** Le run est mort dans le garde-fou de
dispatch de `runBenchmark`, qui s'exécute après l'écriture du préflight et
**avant la première requête fournisseur**.

## Pourquoi il a refusé

L'ordre de retrait pesait le plan contre le plafond entier (7 USD) alors que la
garde de dispatch portait déjà les 4,6854 USD hérités de la reprise. Le
préflight a donc écrit `fitsWithinCap: true` pour une borne de 3,3555 USD que
le runner a aussitôt refusée : 4,6854 + 3,3555 = 8,0409 > 7.

Deux nombres, un seul plafond, et le refus au mauvais étage — la même forme que
le défaut nº 2 du rapport du 30 août, sur un autre axe.

Corrigé : l'ordre de retrait travaille désormais contre le plafond **restant**
(plafond moins dépense héritée). Sous le même plafond de 7, le plan se réduit
de lui-même à 24 cellules à la répétition 2, borne 1,6778 USD, et
4,6854 + 1,6778 = 6,3632 ≤ 7.
