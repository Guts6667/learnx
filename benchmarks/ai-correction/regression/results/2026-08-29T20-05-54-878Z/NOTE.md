# Run de fumée — pas une mesure

Ce répertoire est le produit d'un **run de fumée** du 29 août 2026, exécuté sous
un plafond de 0,20 USD pour vérifier le câblage avant la première exécution
payante réelle (V4.5-121).

Il porte sur **un seul cas de base, une répétition, aucun mutant**. Il prouve
qu'un appel primaire réel, un appel vérificateur réel, la réconciliation du coût
auprès du fournisseur et l'écriture d'une ligne de registre fonctionnent.

Il ne mesure **rien** sur la qualité du système. Les gates figurant dans
`REPORT.md` sont calculés sur un unique critère×cas : leurs dénominateurs sont
trop petits pour porter une conclusion, et `promotionEligible` y est faux pour
des raisons de câblage (métrique `evidenceHallucination` non branchée) et non
pour des raisons de qualité. Ne pas citer ces chiffres comme un résultat.

Coût réconcilié : 0,0199 USD.
