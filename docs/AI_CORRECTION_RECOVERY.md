# Reprise de la correction IA — 17 septembre 2026

Autorité : plan de reprise explicitement approuvé par Rayan le 17 septembre.
Cette autorité remplace le cadrage « nouvelle campagne de prompt 2.3.0 » de
V4.5-210. Elle ne constitue ni une qualification, ni un GO de déploiement.

## État vérifiable

| Surface | Révision immuable | Ce que la preuve établit |
| --- | --- | --- |
| Ancien workspace `learnx` | `74d0b24f` | Branche ancienne, conservée avec ses modifications locales |
| Dernière production enregistrée / `main` | `194e57e92c0bd2c2d1d51aeadcc5ba8297217c4a` | Ancien pipeline ; les valeurs effectives des flags restent à relever |
| Intégration `dev` | `7a120bed3ec0b4b966f9566e5174c509d51cea23` | Implémentation V4.5, distincte d'une qualification ou d'une mise en production |
| Recherche préservée, PR #213 | `17b07a7367aacd8345c50ed6fe530cb886dc4a21` | Expériences et instrumentation de septembre non promues |
| Base locale consolidée de reprise | `e874f943cb3d75469547571d0fbadff236f7eaa4` | Merge sans conflit des deux dernières lignes, dans `codex/ai-correction-recovery` |

Les révisions de `main`, `dev` et de recherche ont été relues sur le remote.
Une branche locale consolidée n'est pas une livraison. Les artefacts historiques
de recherche restent inchangés ; les nouveaux instruments portent une nouvelle
version. V4.3 est **parquée**, conformément à sa décision du 29 août : elle
n'est plus un prédécesseur implicite de cette reprise.

## Travaux et responsabilité

| Lot canonique | Owner / revue | Sortie nécessaire | État |
| --- | --- | --- | --- |
| V4.5-210-R1 — baseline et livraison | Architecture/Produit / QA/Release | Révisions, backlog, Airtable et descriptions de PR concordants | Implémentation et revue locale |
| V4.5-210-R2 — runtime et comptabilité | Backend/Data / QA/Release | FAKE sans réseau, projection LOW uniforme, coûts préservés, arrêt avant dispatch | Implémentation et tests locaux ; voir rapport QA de reprise |
| V4.5-210-R3 — instrument de qualification | IA/Recherche / Backend/Data | Politique complète exécutable, probes non circulaires, budget partagé et résultats UNMEASURED | Implémentation et tests locaux ; voir rapport QA de reprise |
| V4.5-210-R4 — capacité Writing étroite | IA/Recherche / Rayan | Rubrique approuvée, 30 sources indépendantes + 60 mutations, références verrouillées et retest aveugle | Outils hors ligne disponibles ; données et revue propriétaire requises |
| V4.5-210-R5 — pilote fermé | QA/Release / Rayan | Zéro niveau affiché incorrect, ≥70 % de critères utilisables, sécurité et recette de déploiement | BLOQUÉ, aucune preuve empirique nouvelle |

Les owners sont des responsabilités de travail, pas une affirmation qu'une
équipe humaine distincte a revu ces résultats. Rayan est l'unique référence
humaine prévue. Aucune validation humaine indépendante n'est revendiquée.

## Ordre de livraison

1. Conserver la recherche à son SHA et corriger le périmètre de PR #213.
   Son ancien résumé « 84 fichiers » ne décrit pas ses 88 commits / 341 fichiers.
2. Intégrer la suppression du gate circulaire (intention de PR #211), puis
   la politique nouvelle et ses métriques. Le résultat historique reste lisible
   sous sa politique d'origine.
3. Conserver les conclusions de PR #212 comme conclusions d'expérience,
   sans les transformer en changement d'identité de production.
4. Corriger les tests d'adjudication et reprendre la portée du filtre
   d'intégration de PR #218 sur la baseline courante ; vérifier la fermeture
   des conflits avant de décider du sort de cette PR.
5. Revue croisée du lot consolidé, gates locaux puis CI ; seulement ensuite
   recette sur une cible non-production explicitement identifiée.

Le merge de PR distantes et la promotion de production sont des étapes de
release séparées. Aucun statut DONE scientifique ne découle du vert des tests.

## Protocole Writing et outils

La spécification se trouve dans
[`AI_CORRECTION_WRITING_RECOVERY.md`](AI_CORRECTION_WRITING_RECOVERY.md).
Le contrat exécutable est `explanatory-writing-recovery/1.0.0` ; il ne remplace
aucune rubrique de production et n'importe ni poids, ni seuil de réussite
historique. Aucun score numérique n'est créé.

Les commandes `pnpm ai:recovery prepare`, `lock` et `evaluate` sont hors ligne.
Elles ne contiennent aucun transport fournisseur. Les sorties sont écrites
avec création exclusive et ne remplacent jamais une preuve existante. Le
format des observations est validé par Zod. Le rapport numérique laisse
toujours la revue sécurité/release ouverte, même si les deux bras passent.

Le bras « preuve fournie » substitue uniquement les rôles et identifiants de
phrases approuvés par Rayan ; il ne fournit jamais son niveau au modèle.
Le bras complet utilise l'extraction proposée. Les deux passent par le même
constructeur aveugle et les mêmes règles de restitution. Le vérificateur
reçoit le dossier, la consigne, toute la réponse et les rôles de preuve,
jamais le niveau proposé, la justification primaire ou le statut de mutant.

Une extraction manquante, des IDs invalides, une preuve incomplète, un désaccord
de niveau ou une incertitude produisent un critère visible mais sans niveau.
Cette mécanique borne l'affichage ; elle ne démontre pas la justesse sémantique
d'un vérificateur. Le holdout sert précisément à mesurer celle-ci.

## Budget et résultats historiques

Le dernier run atomique comporte 720 appels et **2,59762031 USD** ; c'est le
total de ce run, jamais le cumul V4.5-210. Les 124 sorties tronquées de Kimi
ne qualifient aucune comparaison : UNMEASURED. Les autres résultats rejettent
le protocole testé ; 30 paires issues de 11 sources ne sont pas 30 observations
indépendantes. Le signal des 12 paires avec extrait fourni reste exploratoire.

Le récit de campagne de 8,97 USD et l'agrégat antérieurement relevé de 9,59 USD
laissent **0,62 USD non réconcilié**. Ne pas ajouter ce montant au run de
2,59762031 USD, ni inventer une réconciliation. Owner Backend/Data : rapprocher
chaque request ID fournisseur et chaque ligne de ledger avant clôture du coût
cumulé. Toute nouvelle dépense exige une enveloppe explicite ; aucun budget
de campagne n'est autorisé par cette seule implementation.

## Gates avant ouverture

- Références absolues et retest aveugle verrouillés avant toute sortie mesurée ;
  30 sources indépendantes, 60 mutations, trois répétitions par bras.
- Zéro niveau critériel incorrect affiché et ≥70 % de critères utilisables ;
  incertains inclus dans le dénominateur, sans retuning après lecture.
- Tous les gates de sécurité applicables, preuve liée à l'identité exacte et
  dépenses connues/réconciliées. Aucun résultat de test synthétique n'est une
  preuve de correction.
- Révision réellement déployée, flags effectifs, limite de durée de fonction,
  parcours authentifié complet, alertes, rollback et interruption/reprise
  vérifiés sur l'environnement cible.
- Aucun write IA dans la maîtrise ou la progression. GO explicite de Rayan.

Les appels réels, tests DB de production et corrections authentifiées de
production ne font pas partie des preuves acquises par cette reprise locale.


## Reproduire les contrôles de l'instrument

Préflight gratuit du probe de faux-accord :

```bash
pnpm ai:benchmark --false-agree-probe --qualification-run-id=recovery-qualification-001 --dry-run
```

La simulation de famille validée est désactivée par défaut. Pour étudier le
comportement HIGH prospectif, `--simulate-validated-family` doit être explicite
sur le probe et le run de pool ; l'hypothèse est enregistrée et liée aux preuves,
jamais assimilée à une qualification réelle du runtime. L'analyse
`--analyse=<répertoire>` réutilise les preuves figées sans appel. Une preuve
checker historique non liée à l'identité, au prompt, à la répétition et à la
sortie exacte reste UNAVAILABLE : aucun accord n'est transféré entre réponses.


Portée de protection financière : runner atomique, probe de faux-accord,
`--run-pool` V7 (primaire/retries/checker) et nouveau runner Writing partagent
le garde durable. L'ancien `--measure-checker` est retiré au profit du probe.
L'exécution générique de comparaison multi-modèles hors `--run-pool` reste
historique et ne bénéficie pas de cette nouvelle garantie : elle n'est pas
l'entrée de la reprise. Un ledger nouveau ne certifie pas la réconciliation
rétroactive de l'ancienne enveloppe ; conserver le blocage de 0,62 USD et
obtenir une décision de budget explicite avant toute nouvelle campagne.
