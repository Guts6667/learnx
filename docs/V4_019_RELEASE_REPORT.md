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

## Correctif déployé et durcissement complémentaire

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

Le correctif a ensuite été livré sur `origin/dev` par le commit `5933c142`
et déployé sous `dpl_Biu3LTSztGb2dbdkqEFDt9gNb6MR`. Le déploiement est
`Ready` et alimente les alias preview `dev.learn-x.app` et
`learnx-git-dev-guts6667s-projects.vercel.app`.

### QA sans appel fournisseur après déploiement

- `deployment:check` passe sur la preview ; landing, journal de recherche,
  manifeste, service worker et routes d'authentification publiques répondent ;
- la session pilote authentifiée retrouve l'exercice et le devis : estimation
  `3` crédits, plafond `6` crédits, contrat
  `v4-writing-framework-selection-fr@1.0.0` ;
- l'administration affiche `CONFIGURED_CLOSED`, l'identité
  `learnx-french-text-correction-v3-1`, `0` correction persistée et `0`
  tentative au coût inconnu après nettoyage de l'incident ;
- une confirmation effectuée coupe-circuit fermé renvoie
  `AI correction is not configured on this deployment.` sans réserver ni
  débiter : le compte pilote reste à `6` crédits offerts et `0` acheté ;
- matrice locale : lint, typecheck, build et `890` tests unitaires verts ;
  E2E : `69` réussis, `15` non applicables, `0` échec sur Chromium desktop,
  mobile, tablette et WebKit mobile.

Le diagnostic du smoke a aussi révélé une frontière d'idempotence à fermer
avant toute nouvelle dépense. Le durcissement complémentaire persiste donc un
`CALL_INTENT` local avant chaque futur dispatch, conserve chaque outcome dans
une ligne de tentative, refuse qu'un coût inconnu soit reconstruit comme zéro,
et consulte l'état réel de la réservation avant tout rejeu. Si la correction
est persistée mais le règlement encore `RESERVED`, la relance termine seulement
le règlement idempotent sans rappeler le fournisseur. Tout autre désaccord
financier devient `RECONCILIATION_REQUIRED` et bloque un nouvel appel.

Ce durcissement est livré sur `origin/dev` par `d0e479cb`. Après mise à jour de
l'alias preview, `deployment:check` repasse et l'administration authentifiée
confirme encore `CONFIGURED_CLOSED`, `0` correction, `0` tentative au coût
inconnu et le solde pilote `6/0`. Aucun appel fournisseur n'a été envoyé pour
ces contrôles.

## Gate restant

1. obtenir une nouvelle autorisation propriétaire distincte avant tout nouveau
   workflow facturable ;
2. si cette tentative réussit, consigner coût, générations, appels, résultat,
   règlement et libération ;
3. exécuter ensuite la matrice finale et rendre un verdict V4-019 explicite.

Le smoke du 25 août ne constitue ni un GO runtime ni une preuve de promotion
scientifique.
