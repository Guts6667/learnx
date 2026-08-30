# Refus au plafond restant 0,8369 USD — aucune dépense

Reprise au plafond demandé 7 USD, refusée avant tout appel :

```
REGRESSION_RUN_EXCEEDS_CAP: borne 1.6778 USD > plafond restant 0.8369 USD
(plafond 5.522320999999998 USD moins 4.6854 USD déjà dépensés)
```

Le plafond effectif n'était pas 7 mais **5,5223** : l'enveloppe de 14 USD s'est
crue entamée de 8,4777 USD, soit exactement 4,6854 + 3,7923 — la dépense réelle
du 30 août, **plus le report identique** consigné par le run avorté
`2026-08-30T14-06-23-829Z`. La même monnaie comptée deux fois.

`ledgerSpendSince` sommait tous les registres sans dédoublonner. Un run repris
écrit dans son propre registre les tentatives qu'il hérite ; l'enveloppe les
facturait une seconde fois. Le `NOTE.md` du répertoire avorté disait qu'il
ne fallait pas lire ces 3,7923 USD comme un achat — c'est le code qui les a
ainsi lus, pas un lecteur.

Corrigé : une entrée de registre qui nomme l'appel qu'elle facture (candidat,
cas, répétition, tentative) n'est comptée qu'une fois, quel que soit le nombre
de registres qui la consignent. Une entrée qui ne nomme aucun appel reste
comptée — sous-évaluer un budget est la direction dangereuse.

Après correctif, à sec : plafond 7, restant 2,3146, borne 1,6778, tient.
