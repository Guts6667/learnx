# Run interrompue à 2 minutes — aucun appel fournisseur nouveau

Reprise lancée au plafond 7, tuée par le délai de 2 minutes du shell. Le
répertoire porte 267 tentatives et un registre de 5,8161 USD. **Les deux
nombres sont faux, et aucun dollar nouveau n'a été dépensé.**

Vérification : les 267 enregistrements se réduisent à **216 empreintes
distinctes**, et aucun n'est dépourvu de jumeau identique au bit près dans
`2026-08-30T00-44-57-975Z`. Pas un seul appel primaire nouveau. Les 51
enregistrements en trop sont les 24 cas du sous-ensemble écrits deux fois.

## Deux défauts, tous deux dans le chemin de reprise

1. **Le décalage de répétition n'arrivait jamais au runner.** La ligne 1092
   passait `repetitionOffset` à `pendingCellsFor`, qui calculait correctement 24
   cellules dues à la répétition 2 ; l'appel à `runBenchmark` juste en dessous ne
   le passait pas. Le runner repartait de la répétition 1, ne trouvait aucune de
   ses cellules dans `pendingCells`, et **n'a rien acheté du tout**. Les deux
   moitiés du correctif V4.5-127 étaient justes et n'avaient jamais été reliées.
   Aucun test ne couvrait le fil entre elles.

2. **Les passes qui se recouvrent reportaient deux fois.** La passe de
   répétitions tire ses cas de la passe de pool : les deux portaient les mêmes
   tentatives reprises et les empilaient toutes les deux. D'où 216 → 267 et
   4,6854 → 5,8161 dans le registre — de l'argent jamais facturé, que
   l'enveloppe aurait ensuite opposé à une run ultérieure.

Le verrou laissé par le pid 25384 est périmé ; `acquireRunLock` le reprend seul.

Corrigés tous deux, chacun vérifié par mutation : sans le fil du décalage, la
reprise achète 24 des 48 cellules dues ; sans le dédoublonnage, `attempts.json`
en compte 296 au lieu de 224.
