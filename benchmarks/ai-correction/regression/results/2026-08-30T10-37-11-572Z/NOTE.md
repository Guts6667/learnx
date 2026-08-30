# Refus au plafond 2 USD — aucune dépense

Reprise de `2026-08-30T00-44-57-975Z` demandée avec
`--supplier-cost-cap-usd=2`. Le répertoire ne contient qu'un préflight :
aucune tentative, aucun registre, **0,0000 USD**.

`SupplierBudgetGuard.reconcile` a levé `SUPPLIER_BUDGET_CAP_WOULD_BE_EXCEEDED`
en réconciliant la dépense héritée. Une reprise sème la garde avec ce qui a
déjà été payé — 4,6854 USD — donc un plafond de 2 est mécaniquement
impossible : il est franchi avant le premier appel, par de l'argent déjà
dépensé.

Ce n'est pas un plafond prudent, c'est un plafond inatteignable. Consigné parce
que le refus est le comportement correct et qu'il doit rester lisible.
