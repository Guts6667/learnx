# V4-019 — Rapport de release du pilote Writing

## Statut

**EN COURS — preview refermée, aucun GO production.**

Ce rapport est append-only à l'échelle des essais de release. Un smoke en
échec reste consigné ; sa correction ne le transforme pas rétroactivement en
succès.

## Identité contrôlée

- activité : `writing`, langue `fr-FR`, texte et faible risque ;
- contrat : `v4-writing-framework-selection-fr@1.0.0`, publié ;
- identité : `learnx-french-text-correction-v3-1` ;
- modèle : `anthropic/claude-sonnet-4.6`, fournisseur attendu `Anthropic` ;
- prompt : `2.2.0` ;
- aucune vente publique, crédits offerts uniquement ;
- seconde passe du même modèle dans la bande de garde, aucun retry ni fallback.

## Smoke preview du 25 août 2026

### Autorisation et bornes

Rayan a autorisé un workflow de correction borné sur une réponse synthétique,
avec au plus deux appels si la seconde passe était déclenchée, sans retry ni
fallback et avec un plafond fournisseur de `0,10 USD`. Six crédits offerts ont
été attribués au compte pilote. Le kill switch n'a été ouvert que pour cette
tentative, puis refermé.

### Résultat observé

- déploiement : `dpl_3gUHcNx5D4yxQTg9V4h7jA5VkCmp` ;
- requête : `5d9ed8c5-8e7a-4c03-8d83-71456bcda57f` ;
- endpoint : `POST /api/ai-corrections` ;
- durée : `25 371,2 ms` ;
- réponse : HTTP `500`, message utilisateur générique ;
- erreur persistante : PostgreSQL `23514`, contrainte
  `ai_corrections_terminal_result_check` ;
- devis : estimation `3` crédits, plafond réservé `6` crédits ;
- aucune ligne `AiCorrection` ni `AiCorrectionAttempt` n'a été validée par la
  transaction ;
- la réservation a été libérée explicitement et le solde reconstruit est
  revenu à `6` crédits offerts et `0` crédit acheté ;
- le statut d'accès temporaire à l'étape pilote a été restauré à `LOCKED` ;
- le kill switch preview est revenu à `true` avant toute autre tentative.

### Interprétation

Le transport a terminé avant l'échec de création Prisma : le défaut se situe
dans la persistance, pas dans le préflight, l'authentification ou l'accès à
l'exercice. La contrainte SQL héritée exigeait encore une décision PASS/FAIL,
un score autoritaire et une confiance pour un résultat `single_model`
terminal. Le contrat V4 actuel est formatif : la décision reste nulle, le
score éventuel est indicatif et la confiance du modèle n'a aucune autorité.

Le coût exact de ce workflow n'est pas reconstructible depuis LearnX : la
transaction ayant été annulée, les identifiants fournisseur et les usages des
tentatives n'ont pas été conservés. L'API de clé OpenRouter indiquait une
activité agrégée quotidienne de `0,027993 USD` au moment du diagnostic, mais
cette valeur n'est pas liée par identifiant à la requête et ne doit donc pas
être présentée comme son coût exact. Le smoke reste un incident de coût non
réconcilié, jamais un coût nul.

## Correctif préparé

- migration additive autorisant un résultat formatif terminal sans réactiver
  PASS/FAIL ;
- résultat complet persisté en `COMPLETED`, résultat partiel ou indisponible en
  `PROVISIONAL`, avec `indicativeScore` séparé ;
- sortie rejetée stockée comme raw borné de tentative, jamais comme résultat
  structuré réussi ;
- coût `ACTUAL`, génération et dispatch confirmés persistés lorsque présents ;
- libération immédiate de la réservation si l'exécution ou la persistance
  échoue avant livraison ;
- tests de compatibilité du schéma, des trois états formatifs, des tentatives
  et de la libération sur échec.

La migration corrective a été appliquée sur la base preview avec le kill
switch fermé. `prisma migrate status` confirme les `41` migrations à jour. Une
répétition transactionnelle a créé un résultat formatif complet et sa tentative
dans la base, contrôlé leur forme et leurs liens immuables vers le devis et la
réservation, puis annulé intégralement la transaction : `verified=true`,
`financialLinksVerified=true`, `rolledBack=true`. Digest SHA-256 de la migration :
`1ef23ea0360f86871046ee51a9d6e9eb2d7b944997f26d2a545d2eb5dbdde042`.

## Gate restant

1. déployer le code correctif sur la preview fermée ;
2. vérifier le préflight `CONFIGURED_CLOSED` et la réconciliation du ledger à
   coût nul ;
3. obtenir une nouvelle autorisation propriétaire distincte avant tout nouveau
   workflow facturable ;
4. si cette tentative réussit, consigner coût, générations, appels, résultat,
   règlement et libération ;
5. exécuter ensuite la matrice finale et rendre un verdict V4-019 explicite.

Le smoke du 25 août ne constitue ni un GO runtime ni une preuve de promotion
scientifique.
