# Lancement refusé par le garde interne — 0 USD, preuve d'incident

Répertoire produit par une tentative de lancement de V4.5-125 le 30 août 2026,
refusée **avant tout appel fournisseur**. Aucune dépense.

Il ne contient qu'un `budget-preflight.json`, et c'est précisément ce qui en
fait une preuve utile : ce préflight porte `fitsWithinCap: true` sous la
convention `measured-p90-v2`, borne 13,98 USD sous un plafond de 14 — puis le
run a échoué sur `BENCHMARK_SUPPLIER_BUDGET_CONTINGENCY_REQUIRED`, parce que
`runBenchmark` recalculait une seconde borne sous la convention conservatrice
(23 USD). Deux préflights, deux verdicts, et un run autorisé qui ne pouvait pas
démarrer.

Corrigé le même jour : la borne autorisée est transmise au runner, dont le
contrôle redevient un garde de dépense et cesse d'être un second avis sur la
borne.

**Un quatrième répertoire de la même série, `2026-08-30T00-38-10-031Z`, a été
supprimé par erreur** au cours du nettoyage qui a suivi. Il ne contenait lui
aussi qu'un préflight et n'avait engagé aucune dépense. La suppression reste une
faute : `benchmarks/` est append-only précisément pour que personne ne décide
après coup de ce qui méritait d'être conservé. Consigné ici plutôt que passé
sous silence.
