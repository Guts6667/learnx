# Audit RGPD V4.5 — correction IA et paiement

- **Statut** : `ACTIVE_AUTHORITY` (ticket V4.5-165, partie IA) ·
  partie paiement `EN_ATTENTE` (V4.5-160)
- **Version** : 1.2.0 (attestations fournisseurs du 29 août 2026)
- **Date** : 29 août 2026
- **Owner** : Architecture/Produit (Head of AI) · **Reviewer** : Rayan
- **Autorité supérieure** : `ADR_003` §7, `docs/V4_5_AI_QUALITY_CONTRACT.md`
- **Méthode** : lecture du schéma Prisma (`prisma/models/*.prisma`), du code
  serveur (`src/server/corrections/**`, `src/server/maintenance/retention.ts`,
  `src/lib/ai-correction-provider-adapters.ts`) et des catalogues i18n, au
  SHA `dev` du 29 août 2026. Aucune donnée réelle consultée.

## 1. Ce que ce document est

Le registre des traitements de LearnX pour la correction assistée par IA et,
à terme, le paiement : quelles données, pour quelle finalité, vers quel
destinataire, combien de temps, et ce que l'utilisateur en sait. Il liste
séparément (§7) les points qui exigent une décision du Propriétaire ou un
conseil externe. Il ne remplace ni une politique de confidentialité publiée
ni un avis juridique.

Responsable de traitement : le Propriétaire (exploitation solo, sans DPO
obligatoire à ce stade — à confirmer, §7).

## 2. Registre des traitements — correction IA

| # | Traitement | Données | Base envisagée | Destinataires | Rétention constatée |
| --- | --- | --- | --- | --- | --- |
| T1 | Devis et réservation de crédits | `userId`, identifiant d'exercice, classe de taille du texte, quote, réservation | Exécution du service demandé | LearnX (Neon) | Illimitée (ledger append-only, ADR_003 §6) |
| T2 | Correction primaire | production textuelle de l'apprenant, snapshot du contrat, prompt versionné, corrélation pseudonyme | Exécution du service, consentement explicite avant lancement | OpenRouter → Anthropic (route épinglée `anthropic`, `only` + `data_collection: deny`, V4.5-115) | Côté LearnX : illimitée (`ai_corrections.submission_snapshot_json`, `ai_correction_attempts.raw_output_json`). Côté OpenRouter/Anthropic : **à attester** (§7) |
| T3 | Vérification indépendante | **extraits cités seulement** (jamais la production complète, `correction-checker.ts:37,93`), ligne de rubrique, niveau proposé | Idem T2 | OpenRouter → Mistral, endpoint `mistral/eu` (décision `owner-checker-residency-eu-2026-08-29`) | Côté LearnX : `raw_output_json` de la tentative ; côté Mistral : **à attester** |
| T4 | Retour apprenant par critère (V4.5-112) | `correctionId`, `criterionKey`, `HELPFUL/WRONG`, horodatage | Intérêt légitime (qualité), volontaire | LearnX | Illimitée |
| T5 | Monitoring et coupe-circuit (V4.5-140/142) | agrégats sur 50 corrections ; journal des déclenchements avec `actor_id`, note ≤ 500 car. | Intérêt légitime (sécurité du service) | LearnX ; e-mail owner via Resend (142, **sans texte apprenant**) | Illimitée (journal d'audit) |
| T6 | Échantillonnage de cohérence (V4.5-141, non livré) | corrections récentes ré-analysées, ≤ 10 %/semaine, anonymisées | Intérêt légitime, information préalable (ligne de consentement §5) | OpenRouter → Anthropic, Mistral | Artefacts sans texte brut ni identifiant (`benchmarks/**`) |
| T7 | Historique et reconsidération | corrections passées, argument de reconsidération ≤ 500 car. | Exécution du service | LearnX | Illimitée |

Ce qui **ne quitte jamais** LearnX (ADR_003 §7.2, vérifié dans
`runtime-correction-prompt.ts` et `correction-checker.ts`) : e-mail, nom, rôle,
solde, autres notes, autres programmes, historique non requis.

Ce qui n'est **pas collecté** : adresse IP et user-agent ne figurent dans
aucun modèle Prisma (`identity-access.prisma`) ; le rate-limit de connexion
est indexé par e-mail normalisé et purgé sous 24 h.

## 3. Sous-traitants et destinataires

| Destinataire | Rôle | Données | Localisation | Paramètres LearnX | Attestation |
| --- | --- | --- | --- | --- | --- |
| Neon | hébergement base | tout | AWS eu-central-1 (Francfort), attesté 29 août 2026 (console) | plan Launch, PITR selon plan | §7 |
| Vercel | hébergement app/API, logs | requêtes, logs d'erreur (stack, pas de corps) | fonctions `fra1` (Francfort), attesté 29 août 2026 (console) | — | §7 |
| OpenRouter | routeur d'inférence | T2, T3 | US (siège) | `data_collection: 'deny'`, `allow_fallbacks: false`, `only`/`order` épinglés, `require_parameters: true` (`ai-correction-provider-adapters.ts`) | rétention **à attester** |
| Anthropic | modèle primaire (Sonnet 4.6) | T2 | via OpenRouter, route `anthropic` | idem | rétention **à attester** |
| Mistral | vérificateur (Medium 3.5) | T3 (extraits) | endpoint `mistral/eu` | idem | rétention **à attester** |
| Resend | e-mails transactionnels | e-mail, contenu d'invitation/vérification ; alertes owner (142) | eu-west-1 (Irlande), domaine `send.learn-x.app`, attesté 29 août 2026 (console) | — | §7 |
| Revolut Merchant | paiement (V4.5-160) | référence d'ordre, montant, devise, pack | — | jamais de données de carte chez LearnX (ADR_003 §7.3) | partie paiement `EN_ATTENTE` |

## 4. Rétention — état réel et écarts

Purge planifiable (`src/server/maintenance/retention.ts`, jamais exécutée en
production à ce jour — V4.5-173) : sessions (7 j de grâce), rate-limits
(24 h), jetons de vérification et invitations (30 j), prospects publics
(730 j).

**Aucune cible de purge n'existe pour les données IA** : `ai_corrections`
(production de l'apprenant en snapshot), `ai_correction_attempts`
(`raw_output_json`, jetons, coûts), `ai_correction_criterion_feedback`.
Elles ne disparaissent qu'avec le compte (`onDelete: Cascade` vers `User`) —
et **aucun parcours de suppression de compte n'existe** dans le code serveur
(seuls les prospects publics ont une suppression, `public-leads/repository.ts`).

Écarts à traiter :

- **E1** — Droit à l'effacement non outillé pour les comptes (art. 17). Un
  compte supprimé à la main en base cascade correctement sur les corrections,
  mais le ledger de crédits est append-only par conception (ADR_003 §6) : la
  suppression doit **anonymiser** le compte (e-mail remplacé, sessions
  révoquées) et conserver les écritures financières sans identifiant direct.
  Ticket à créer (voie A, après 163) ; le ledger n'est jamais réécrit.
- **E2** — `raw_output_json` conserve la sortie brute du modèle sans limite.
  Elle sert à l'audit d'une correction contestée ; proposer une purge à
  **180 jours** après `completed_at`, en conservant `structured_result_json`
  (ce que l'apprenant a vu). Décision §7.
- **E3** — Le snapshot de la production (`submission_snapshot_json`) duplique
  la soumission d'exercice ; nécessaire à l'idempotence et à la
  reconsidération. Conserver tant que la correction existe ; suivre E1.

## 5. Information et consentement — écart principal

ADR_003 §7.4 exige, avant confirmation : IA sans validation humaine ;
catégories de données qui sortent et finalité ; tiers et politique de
rétention validée ; prix, plafond, provenance, règle de libération.

Constat : `aiCorrection.consentNotice` (`src/i18n/catalogs/correction.ts`)
ne couvre que la règle de compensation. **Les tiers, les catégories de
données et la rétention ne sont pas affichés.** Le rollout production est
donc fermé par l'ADR lui-même tant que ce texte n'est pas livré.

Textes à intégrer par la voie C (ticket 113 ou suite ; clés à créer dans
`correction.ts`) — versions courtes, exactes au code d'aujourd'hui :

FR — `aiCorrection.dataNotice` :

> Votre texte est envoyé, sans votre nom ni votre e-mail, à un modèle
> d'Anthropic via OpenRouter pour produire ce retour ; les extraits cités
> sont ensuite vérifiés par un modèle de Mistral hébergé dans l'UE. Nous
> demandons à ces services de ne pas conserver ni entraîner sur vos données.
> Ce retour est produit par une IA et n'est relu par personne.

EN — `aiCorrection.dataNotice`:

> Your text is sent, without your name or e-mail, to an Anthropic model via
> OpenRouter to produce this feedback; the quoted excerpts are then checked
> by a Mistral model hosted in the EU. We ask these services not to retain
> or train on your data. This feedback is produced by an AI and reviewed by
> no one.

Ligne V4.5-141 (à n'afficher que lorsque 141 est actif) :

> FR — Un échantillon anonymisé de corrections peut être ré-analysé pour
> contrôler la qualité du système.
> EN — An anonymised sample of corrections may be re-analysed to check the
> system's quality.

La mention « conservées pendant N jours » est **absente à dessein** : elle ne
peut être écrite qu'après la décision E2 et l'attestation des fournisseurs.

## 6. Droits des personnes — état

| Droit | État | Action |
| --- | --- | --- |
| Accès / portabilité | Historique des corrections visible dans l'app ; pas d'export | Export JSON des corrections d'un utilisateur : ticket (voie A, P2) |
| Rectification | E-mail modifiable ? **à vérifier** | — |
| Effacement | Non outillé (E1) | Ticket E1 |
| Opposition (141) | Non applicable tant que 141 n'est pas livré | Ligne de consentement §5 |
| Réclamation | Adresse de contact : `PublicContact` existe ; à publier | §7 |

## 7. Décisions du Propriétaire et attestations externes

Décisions prises le 29 août 2026 (`owner-rgpd-2026-08-29`) :

1. **Rétention fournisseurs** — GO pour que le Head of AI consulte et
   consigne les politiques d'OpenRouter, d'Anthropic et de Mistral avec URL et
   date. **En cours** ; tant que ce n'est pas fait, le §5 dit « nous
   demandons », pas « ils ne conservent pas ».
2. **Sortie brute du modèle** — pas de purge : à 180 jours, la correction est
   **détachée de l'identité** (pseudonyme de recherche) et conservée, sortie
   brute comprise, en vue d'une réutilisation ultérieure (RAG). Cette
   réutilisation est une **nouvelle finalité** : information préalable dans
   la notice IA, aucun export tant que le ticket dédié n'existe pas.
   → V4.5-168.
3. **Suppression de compte** — parcours à créer ; les réponses données sont
   conservées, anonymisées ; le ledger n'est jamais réécrit. → V4.5-166.
4. **Politique de confidentialité et adresse de réclamation** — intégrées à
   V4.5. Texte rédigé par le Head of AI (`docs/V4_5_PRIVACY_POLICY.md`, à
   venir), intégré par la voie C. → V4.5-167.
5. **Régions** — Neon Francfort, Vercel `fra1`, Resend Irlande : **tout dans
   l'UE** (§3). Seuls OpenRouter (US) et Anthropic (via OpenRouter) sont hors
   UE ; Mistral est épinglé `mistral/eu`.
6. **DPO** — pas de délégué à la protection des données obligatoire
   (exploitation solo, pas de suivi à grande échelle ni de données
   sensibles) ; lecture à faire confirmer par un conseil si le pilote
   dépasse les early adopters.
7. **Paiement (V4.5-160)** — §2–§3 complétés à la livraison de l'ADR Revolut.

## 7.1 Attestation de rétention des fournisseurs IA (29 août 2026)

Sources consultées le 29 août 2026 par le Head of AI (GO Rayan, décision 1).
Citations traduites ; texte original en anglais aux URL indiquées.

| Fournisseur | Source (date du document) | Ce qu'il dit | Ce qu'il ne dit pas |
| --- | --- | --- | --- |
| OpenRouter | `openrouter.ai/privacy` (mis à jour le 6 juillet 2026) ; `openrouter.ai/docs/features/privacy-and-logging` | « OpenRouter n'utilise pas vos entrées ou sorties pour entraîner des modèles. » Conserve « aussi longtemps que raisonnablement nécessaire » à ses obligations ; les fichiers image/audio/vidéo ne sont pas persistés au-delà du routage. Le réglage de collecte (`data_collection: deny`) restreint le routage aux fournisseurs qui ne collectent pas ; « ce réglage n'a aucune incidence sur les politiques propres d'OpenRouter ». | **Aucune durée chiffrée** de rétention des prompts/complétions texte par OpenRouter lui-même. |
| Anthropic (via OpenRouter) | `privacy.claude.com` — « How long do you store personal data » (1er juillet 2026) | « Nous supprimons automatiquement les entrées et sorties sur notre backend dans les 30 jours suivant leur réception ou génération », sauf accord contraire (ZDR), application de la politique d'usage ou obligation légale. | Le ZDR est un accord contractuel direct ; LearnX passe par OpenRouter et n'en bénéficie pas. Rétention effective : **≤ 30 jours**. |
| Mistral (endpoint `mistral/eu`) | `legal.mistral.ai/terms/data-processing-addendum` (en vigueur le 27 juillet 2026) | Données inaccessibles « à l'expiration d'un délai de trente (30) jours suivant la fin de l'accès du client » ; l'entraînement est possible « sauf si le client a opté pour l'exclusion » ; modération automatisée sauf « zero data retention activé ». | Le DPA **ne garantit pas** un traitement UE-only ; la résidence UE tient à l'endpoint `mistral/eu` choisi côté OpenRouter, pas au contrat. L'opt-out d'entraînement est porté par `data_collection: deny` côté OpenRouter (fournisseurs classés « ne collecte pas »). |

Conclusion pour la notice (§5) : la phrase « nous demandons à ces services de
ne pas conserver ni entraîner sur vos données » reste exacte ; « ils ne
conservent pas » serait faux. Formulation à retenir : « ces services les
conservent au plus 30 jours (Anthropic, Mistral) et ne les utilisent pas pour
entraîner leurs modèles ; OpenRouter ne publie pas de durée ». Décision Rayan du 29 août 2026
(`owner-openrouter-retention-2026-08-29`) : accepter l'absence de chiffre et
l'écrire telle quelle dans la notice ; aucune demande contractuelle à OpenRouter.

## 8. Ce que ce document n'autorise pas

- afficher une durée de rétention non attestée ;
- envoyer un texte d'apprenant dans un e-mail d'alerte ou un artefact de
  recherche ;
- supprimer ou réécrire une écriture du ledger au titre de l'effacement.
