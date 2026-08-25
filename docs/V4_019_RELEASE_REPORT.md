# V4-019 — Rapport de release du pilote Writing

## Statut

**SMOKE PREVIEW RÉUSSI — preview refermée, aucun GO production.**

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

## Second smoke preview réussi du 25 août 2026

### Autorisation et exécution

Rayan a autorisé la poursuite sous les mêmes bornes : un seul workflow
synthétique, deux appels au maximum si la bande de garde déclenchait la seconde
passe, aucun retry, aucun fallback et `0,10 USD` fournisseur au maximum. Le kill
switch a été ouvert sur le déploiement `dpl_AV3kCgJJ1NyE7sR1xcrpDkebmKfA`, puis
refermé immédiatement après le résultat. Le déploiement fermé
`dpl_6zy9nE7inCpokpvChuR6rvnWss95` est `Ready` et dessert de nouveau les alias
preview.

### Preuves persistées

- correction : `87f1b312-0f37-4e3b-b9d1-21cb8eaa972d`, statut `COMPLETED` ;
- devis : `17d19fcb-7e91-48ad-8b95-81b9c3c2fcd0` ;
- réservation : `aea676c1-adf2-4ab1-8786-feb36115911a`, statut `SETTLED` ;
- fournisseur et modèle : `Anthropic`, `anthropic/claude-sonnet-4.6` ;
- un seul appel, aucune seconde passe, aucun retry et aucun fallback ;
- génération : `gen-1787681295-HGcyd77FGRWhgwA8YCJP` ;
- `3 721` tokens d'entrée, `985` tokens de sortie, `0` token de raisonnement ;
- latence fournisseur enregistrée : `2 637 ms` ;
- coût fournisseur `ACTUAL` : `0,025938 USD`, inférieur au plafond autorisé ;
- trois critères livrés sans incertitude, score indicatif `100 %` et citations
  exactes validées par LearnX ;
- plafond accepté `6` crédits, règlement `3`, libération `3` ;
- ledger cohérent : hold `-6`, release `+6`, settlement `-3`, tous issus de
  l'allocation offerte ;
- aucun effet sur la progression ou la validation de maîtrise.

Le test démontre qu'un workflow borné peut aller du devis à la restitution et
au règlement sur la preview. Il ne transforme pas le dernier examen
scientifique `NO-GO` en promotion générale et n'autorise ni vente publique ni
déploiement production.

L'audit a relevé un défaut d'observabilité non bloquant pour cette preuve :
l'identifiant fournisseur était conservé dans le champ historique
`generationId`, mais pas dupliqué dans le champ dédié `providerRequestId`. Le
correctif local recopie désormais la même valeur dans les deux champs ; il est
couvert par test et ne nécessite aucun nouvel appel pour être vérifié.

Le correctif d'observabilité est livré par `3db856af` et le présent rapport par
`a3d05221` sur `origin/dev`. Le déploiement automatique correspondant,
`dpl_AUs4dQj1GQ3HyDeseUpHpLyuptAg`, est `Ready` et dessert les alias preview. Le
contrôle distant anonyme vérifie l'application, le journal de recherche, la
PWA et les routes publiques. L'environnement preview conserve
`LEARNX_AI_KILL_SWITCH=true` ; aucun appel n'a été effectué après le smoke.

## Matrice finale publique et Totem

Les paquets d'autorité approuvés `learnx-totem-public-authority` et
`learnx-brand-assets-authority` ont été relus intégralement. Les six actifs de
marque servis par l'application ont été comparés par SHA-256 avec leurs sources
approuvées : ils sont identiques. La landing conserve un CTA primaire unique,
le journal reste chronologique et append-only, les sept publications sont
accessibles séparément, et le dossier technique continu demeure distinct.

La QA automatisée couvre :

- landing et journal à 320, 390, 720, 1440 et 1920 px ;
- taille de texte à 200 %, focus clavier et absence de débordement horizontal ;
- Chromium desktop, WebKit mobile et contrôles d'accessibilité sérieux ;
- ordre du plus récent au plus ancien, métadonnées visibles, sommaire
  responsive, URL canonique et action de partage ;
- contraste des tableaux et rendu des pages d'article.

### Audit de conformité de l'autorité publique 1.0.0

| ID normatif | Statut | Preuve de conformité |
| --- | --- | --- |
| `L-P01` | Conforme | Hero resserré, CTA primaire unique, étape active avec pastille cobalt et signature corail intégrée, trois preuves expliquées, aperçu de leçon sourcée, rupture sombre de roadmap et publication de recherche verticale. |
| `R-I01` | Conforme | Sept publications conservées, ordre antéchronologique, filtres sobres, métadonnées type/statut/version, lignes séparées et état sans résultat réversible. |
| `R-A01` | Conforme | Métadonnées type/date/version/statut/périmètre, partage rattaché à l'en-tête, sommaire gauche à partir de 980 px, sommaire natif sous ce seuil, changelog/errata et navigations de série/version distinctes. |

Aucune divergence fonctionnelle ou visuelle connue ne reste ouverte sur ces
trois IDs. Le dossier technique continu demeure volontairement un dossier
historique distinct du gabarit d'article chronologique ; il reste accessible
sans remplacer ni réécrire les sept publications de l'index courant.

La preuve reproductible est `tests/e2e/research-public.spec.ts`, complétée par
`tests/e2e/landing.spec.ts`, `tests/e2e/home.spec.ts` et
`tests/e2e/ui-primitives.spec.ts`. Les captures sont attachées à l'exécution
Playwright et ne sont pas committées comme copies divergentes.

Le domaine canonique public `https://learn-x.app` répond en HTTP 200. L'alias
de convenance `dev.learn-x.app` ne résout plus au DNS lors du contrôle du
25 août ; l'URL immuable du déploiement preview reste disponible. Ce défaut
d'alias ne touche pas la production, mais doit être corrigé avant de présenter
de nouveau ce sous-domaine comme accès de validation.

## Plan de fermeture et rollback

1. Avant ouverture, conserver `LEARNX_AI_KILL_SWITCH=true` et exiger le
   préflight `CONFIGURED_CLOSED` sur l'environnement ciblé.
2. En cas d'écart d'identité, coût, citation, contrat ou règlement, refermer le
   kill switch avant toute nouvelle tentative. Ne jamais reconstruire un coût
   absent comme zéro ; les tentatives concernées restent
   `RECONCILIATION_REQUIRED`.
3. Revenir au déploiement applicatif précédent validé. Les migrations V4 sont
   additives : ne pas exécuter de descente de schéma destructive. Une
   restauration de base n'est envisagée qu'en cas de corruption avérée, depuis
   un point de restauration contrôlé.
4. Réconcilier les réservations encore ouvertes, confirmer qu'aucun nouvel
   appel ne part coupe-circuit fermé, puis rejouer les contrôles publics et
   authentifiés sans fournisseur.
5. Les pages publiques et les parcours déterministes restent utilisables même
   si la correction assistée demeure fermée.

## Gate restant

Les preuves locales et preview sont réunies. Restent exclusivement des actes
de production :

1. configurer les variables production distinctes avec le kill switch fermé,
   le budget fournisseur et le canal d'alerte confirmés ;
2. obtenir le GO production explicite de Rayan avant toute modification de
   `main`, ouverture production ou nouvelle dépense ;
3. après ce GO seulement, vérifier `CONFIGURED_CLOSED`, ouvrir, obtenir
   `READY`, effectuer un smoke borné, puis décider de laisser ouvert ou de
   refermer selon les preuves.

Le smoke réussi constitue une preuve produit bornée sur preview, pas un GO
runtime production ni une preuve de promotion scientifique.

## Candidat pré-merge du 25 août 2026

La réconciliation sélective avec la publication SourceLab de `main` est portée
par `ced5e462` ; elle conserve le runtime V4, les crédits, les recherches et les
surfaces Totem de `dev`. La conformité finale de la landing et du journal à
l'autorité publique Totem 1.0.0 est portée par `ae89a60a`. Ces deux commits sont
sur `origin/dev` ; `main` n'a pas été modifiée.

La preview courante est accessible à
`https://learnx-git-dev-guts6667s-projects.vercel.app`. Le contrôle du contenu
déployé retrouve le bundle attendu et un digest de `journal.css` strictement
identique au fichier de `ae89a60a`. `deployment:check` est vert. La matrice
locale finale compte `906` tests Vitest réussis et `75` scénarios Playwright
réussis, `33` scénarios non applicables au profil courant et `0` échec, en plus
de lint, typecheck et build verts.

Le seul gate volontairement ouvert avant `main` est la recette manuelle de
Rayan sur cette preview. Elle ne vaut ni ouverture du kill switch, ni GO
scientifique, ni activation d'un achat public.

## Correctif de recette L-P01 — 25 août 2026

La recette propriétaire du premier candidat figé a identifié un écart entre
la carte programme du hero et la composition normative de `SCREENS.html`. Le
tag `v4a-premerge-2026-08-25` reste conservé comme preuve historique et est
remplacé par `v4a-premerge-2026-08-25-r1`.

Le correctif reprend les valeurs contractuelles sans modifier le contenu ni
les contrats de collecte :

- grille desktop `.88fr / 1.12fr`, colonne d'aperçu dominante et écart de
  `86 px` ;
- corps de la carte à `34 / 32 / 42 px` en desktop ;
- titre de l'aperçu à `34 px` ;
- signature corail intégrée de `76 × 76 px`, décalée de `-16 px`, au lieu de
  la barre décorative du candidat remplacé ;
- typographie, espacements du chrome, métadonnée et étape active alignés sur
  l'autorité publique Totem `1.0.0`.

Un test Playwright vérifie désormais à `1440 px` que la carte est plus large
que la colonne de copie et contrôle ses paddings, rayons et géométrie corail.
Les rendus réels à `390` et `1440 px` sont sans débordement. Le test landing
ciblé, lint, typecheck, les `906` tests Vitest et le build sont verts. Aucun
appel modèle, changement de progression ou mutation financière n'a été
effectué par ce correctif.

## Correctif de diffusion PWA — 25 août 2026

Le bundle portant la carte L-P01 corrigée était disponible sur la preview,
mais une page déjà contrôlée par l'ancien service worker pouvait rester sur
l'ancien shell jusqu'à un rechargement manuel. Le tag
`v4a-premerge-2026-08-25-r1` reste immuable comme preuve de cet écart et est
remplacé par `v4a-premerge-2026-08-25-r2`.

Le fournisseur PWA écoute désormais le remplacement effectif du service
worker. Lorsqu'un contrôleur existait déjà, la page est rechargée une seule
fois après `controllerchange`. La première installation ne recharge pas la
page, ce qui évite une boucle ou une interruption inutile du parcours. Deux
tests unitaires couvrent ces deux branches ; la matrice Vitest complète compte
désormais `908` tests réussis. Ce mécanisme ne change ni le cache des données
métier, ni les contrats IA, ni les états financiers.

## Correctif de recette Aujourd'hui — 25 août 2026

La recette propriétaire a relevé que la carte principale Aujourd'hui héritait
encore du fond brume des cartes accentuées génériques. Le candidat `r2` reste
immuable et est remplacé par `v4a-premerge-2026-08-25-r3`.

La carte conserve sa bordure cobalt, sa hiérarchie, sa progression et sa
signature corail, mais utilise désormais explicitement le papier blanc
`--color-surface` imposé par l'autorité Totem. La règle est bornée à la carte
principale Aujourd'hui et ne modifie pas les autres surfaces accentuées.
