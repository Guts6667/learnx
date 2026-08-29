# Run dupliqué, tué — artefact d'incident, exclu de l'analyse

La commande de lancement a été collée deux fois : deux runs concurrents ont
démarré à deux secondes d'intervalle. Celui-ci est le second, tué après environ
huit minutes ; l'autre (`2026-08-29T20-49-50-434Z`) a continué et porte
l'analyse.

**35 tentatives, 0,6400 USD réconciliés.** Conservé au titre de l'append-only :
une dépense réelle doit laisser une trace vérifiable. **Exclu de toute analyse**
— l'agréger au run principal compterait deux fois des cellules qui portent sur
les mêmes cas.

Il a néanmoins une valeur de preuve : son taux d'inexploitabilité, 2 sur 35,
concorde avec les 3 sur 49 du run principal. Deux processus indépendants
mesurant le même taux rendent celui-ci moins susceptible d'être un artefact
d'ordonnancement.

L'incident a mis au jour une lacune de conception : deux runs concurrents
portent chacun leur propre garde budgétaire, si bien que deux plafonds de 12,60
USD autorisent ensemble 25,20 USD. La garde protège un run, pas une enveloppe.
Correctif suivi en V4.5-123.
