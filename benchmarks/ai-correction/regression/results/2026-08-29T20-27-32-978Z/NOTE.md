# Run interrompu — conservé comme preuve de dépense, pas comme mesure

Ce répertoire est le produit d'une exécution de V4.5-121 **interrompue par
l'environnement quelques secondes après son démarrage**, le 29 août 2026.

Il contient **une seule tentative**, de statut `INVALID`
(`MODEL_EVIDENCE_NOT_IN_RESPONSE`), pour un coût réconcilié de 0,0165 USD. Il
n'y a ni `summary.json` ni `REPORT.md` : la run n'est jamais allée jusqu'à la
synthèse.

Il est conservé pour deux raisons. D'abord parce que `benchmarks/` est
append-only et qu'une dépense réelle doit laisser une trace vérifiable plutôt
que disparaître. Ensuite parce qu'il démontre la persistance incrémentale
ajoutée le même soir : l'interruption précédente, avant ce correctif, n'avait
laissé aucune trace des appels déjà payés.

Ne rien conclure de la tentative `INVALID` : un échec de validation sur un seul
appel ne dit rien du taux réel. Ce taux se mesure sur la run complète, et s'il
dépasse 3 %, le rapport dira « failed on transport, not quality ».
