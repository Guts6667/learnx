# Audit RGPD V4.5 — correction IA et paiement

- **Statut** : `ACTIVE_AUTHORITY` (ticket V4.5-165) — partie IA et
  partie paiement
- **Version** : 1.5.0 (registre du paiement au code livré, V4.5-160/184)
- **Date** : 29 août 2026
- **Owner** : Architecture/Produit (Head of AI) · **Reviewer** : Rayan
- **Autorité supérieure** : `ADR_003` §7, `docs/V4_5_AI_QUALITY_CONTRACT.md`
- **Méthode** : lecture du schéma Prisma (`prisma/models/*.prisma`), du code
  serveur (`src/server/corrections/**`, `src/server/payments/**`,
  `src/server/maintenance/retention.ts`,
  `src/lib/ai-correction-provider-adapters.ts`), des migrations
  `20260829250000_add_payment_orders` et `20260829260000_add_credit_packs`
  et des catalogues i18n, au SHA `dev` du 30 août 2026. Aucune donnée réelle
  consultée. La partie paiement décrit le code livré ; ce que Stripe **envoie
  réellement** n'est pas encore observé (passe bac à sable
  `docs/qa/V4_5_160_SANDBOX.md`, en attente du compte). Les deux sont
  distingués ligne à ligne.

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

Adresse IP : **jamais en clair**. Correction du 29 août 2026 (constat voie
A) : les limites de tentatives (`access-request-rate-limit.ts`,
`auth/app.ts`) stockent une empreinte SHA-256 **non salée** de l'IP —
réversible par table précalculée sur l'espace IPv4 — purgée sous 24 h.
V4.5-147 la remplace par un HMAC sous secret serveur ; la politique ne parle
d'« empreinte non réversible » qu'à partir de là.

| T8 | Anti-abus de l'essai gratuit (V4.5-163) | table `trial_allocation_markers` : `key_hash` = HMAC(`trial-allocation:ip:<adresse>`, `LEARNX_BUCKET_HMAC_SECRET`), `grants`, `first_seen_at`, `last_seen_at` ; cycles `credit_grant_cycles` avec la cohorte enregistrée | Intérêt légitime (prévention de la fraude) | LearnX | **12 mois** depuis `last_seen_at` (`LEARNX_RETENTION_TRIAL_MARKER_MS`, défaut 365 j), purge `cleanup-expired-data` ; **survit à l'effacement** (sinon la suppression de compte redonnerait un essai) — nommé dans la politique |
| --- | --- | --- | --- | --- | --- |

User-agent : non collecté.

## 2bis. Registre des traitements — paiement (V4.5-160/184)

| # | Traitement | Données | Base envisagée | Destinataires | Rétention constatée |
| --- | --- | --- | --- | --- | --- |
| P1 | Création d'une commande | `payment_orders` : `user_id`, `provider_order_id`, `pack_key`, `amount_minor`, `currency`, statut, horodatages | Exécution du contrat | LearnX (Neon) | **Illimitée** — aucune purge (§4) |
| P2 | Redirection vers le paiement | `reference` = `<userId>:<packKey>`, montant, devise (`checkout.ts:60`) | Exécution du contrat | Stripe | Chez Stripe : politique Stripe (§3) |
| P3 | Réception des événements | `payment_events` : `provider_event_id`, `event_type`, `outcome`, **`payload_json` = le corps de l'événement tel que reçu** (`payment-webhook.ts:104`), horodatage | Exécution du contrat ; obligation comptable | LearnX | **Illimitée** — aucune purge, aucune rédaction (§4) |
| P4 | Attribution et remboursement | écritures `PURCHASE` / `REFUND` du ledger, `written_off_credits` sur la commande | Exécution du contrat | LearnX | Illimitée (ledger append-only, ADR_003 §6) |

Ce que LearnX **ne voit jamais** : le numéro de carte, le cryptogramme, la
date d'expiration. Le paiement est hébergé chez Stripe et l'instrument ne
transite pas par nos serveurs (ADR_004 §1, §7).

**Ce que LearnX transmet à Stripe** : l'identifiant interne de l'utilisateur
(UUID), dans `reference`. C'est un pseudonyme, pas un identifiant direct,
mais c'est une donnée personnelle : il relie durablement une transaction
Stripe à un compte LearnX.

## 3. Sous-traitants et destinataires

| Destinataire | Rôle | Données | Localisation | Paramètres LearnX | Attestation |
| --- | --- | --- | --- | --- | --- |
| Neon | hébergement base | tout | AWS eu-central-1 (Francfort), attesté 29 août 2026 (console) | plan Launch, PITR selon plan | §7 |
| Vercel | hébergement app/API, logs | requêtes, logs d'erreur (stack, pas de corps) | fonctions `fra1` (Francfort), attesté 29 août 2026 (console) | — | §7 |
| OpenRouter | routeur d'inférence | T2, T3 | US (siège) | `data_collection: 'deny'`, `allow_fallbacks: false`, `only`/`order` épinglés, `require_parameters: true` (`ai-correction-provider-adapters.ts`) | rétention **à attester** |
| Anthropic | modèle primaire (Sonnet 4.6) | T2 | via OpenRouter, route `anthropic` | idem | rétention **à attester** |
| Mistral | vérificateur (Medium 3.5) | T3 (extraits) | endpoint `mistral/eu` | idem | rétention **à attester** |
| Resend | e-mails transactionnels | e-mail, contenu d'invitation/vérification ; alertes owner (142) | eu-west-1 (Irlande), domaine `send.learn-x.app`, attesté 29 août 2026 (console) | — | §7 |
| Stripe | paiement (V4.5-160/184) | P2 : `reference` (UUID interne), montant, devise ; puis, côté Stripe, ce que le payeur saisit sur la page hébergée (carte, e-mail, nom, adresse de facturation selon configuration) | Stripe Payments Europe (Irlande) ; groupe Stripe aux États-Unis | jamais de données de carte chez LearnX (ADR_003 §7.3, ADR_004 §1) ; page de paiement hébergée | politique Stripe **à consigner** comme l'ont été les fournisseurs IA (§7, décision 8) |

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
  suppression doit **pseudonymiser** le compte (e-mail remplacé, sessions
  révoquées) et conserver les écritures financières sans identifiant direct.
  Ticket à créer (voie A, après 163) ; le ledger n'est jamais réécrit.
- **E2** — `raw_output_json` conserve la sortie brute du modèle sans limite.
  Elle sert à l'audit d'une correction contestée ; proposer une purge à
  **180 jours** après `completed_at`, en conservant `structured_result_json`
  (ce que l'apprenant a vu). Décision §7.
- **E3** — Le snapshot de la production (`submission_snapshot_json`) duplique
  la soumission d'exercice ; nécessaire à l'idempotence et à la
  reconsidération. Conserver tant que la correction existe ; suivre E1.
- **E4 — le corps des événements de paiement est conservé intégralement, sans
  limite, et l'effacement ne le touche pas.** Constat au code, pas une
  hypothèse : `payment-webhook.ts:104` écrit `payload: JSON.parse(rawPayload)`
  et `prisma-payment-webhook-ports.ts:70` le passe tel quel à Prisma. Aucune
  rédaction, aucun filtrage, aucun champ retenu ou écarté. `retention.ts` ne
  connaît ni `payment_events` ni `payment_orders` : aucune purge n'existe.
  `account-erasure-service.ts` pseudonymise le compte, supprime sessions et
  notes, et **ne touche à aucune table de paiement**.

  Conséquence : après une demande d'effacement, ce que le fournisseur nous a
  envoyé sur cette personne reste en base, indéfiniment, rattaché à une
  commande qui porte encore son `user_id`.

  Ce que contient ce corps n'est pas encore observé — c'est le premier objet
  de la passe bac à sable. D'après la documentation Stripe,
  `checkout.session.completed` porte `customer_details` (e-mail, nom,
  téléphone, adresse de facturation) et `charge.refunded` porte
  `billing_details` ainsi que les métadonnées de l'instrument (réseau,
  quatre derniers chiffres, pays). Si c'est bien le cas, alors **des
  identifiants directs entrent en base par ce chemin**, alors que l'ensemble
  du dispositif est construit pour qu'ils n'y entrent pas.

  À noter, sans corriger le fichier : l'en-tête de la migration
  `20260829250000_add_payment_orders` affirme « aucune colonne ici ne peut
  contenir de données de carte, et aucune ne devrait jamais être ajoutée qui
  le pourrait ». C'est exact des colonnes déclarées et démenti par
  `payload_json`, qui accueille ce que le fournisseur veut bien y mettre. La
  migration est appliquée : la modifier casserait sa somme de contrôle. Le
  démenti est consigné ici, et l'en-tête cite encore Revolut.

  Correction proposée, à décider (§7, décision 9) : ne persister du corps que
  ce que la réconciliation lit réellement — identifiant d'événement, type,
  identifiant de commande, montant, devise, statut — et écarter le reste à
  l'écriture plutôt qu'à la lecture. Le corps intégral n'est nécessaire qu'au
  moment de la vérification de signature, qui a déjà eu lieu.

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
| Effacement | Outillé côté administration : `POST /api/admin/accounts/:userId/erase` (`account-routes.ts:57`), pseudonymisation irréversible. **Pas de parcours en libre-service** : la personne écrit, le Propriétaire exécute — tenable en exploitation solo, à revoir si le volume grandit. **Ne couvre pas le paiement** (E4) | Décision 9, puis ticket |
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
3. **Suppression de compte** — parcours à créer (V4.5-166). Décision
   complémentaire du 29 août (`owner-erasure-2026-08-29`), après constat de
   la voie A qu'un texte libre reste une donnée personnelle même détaché du
   compte : les textes (réponses, snapshots, extraits cités, sorties brutes)
   sont **conservés sous pseudonyme irréversible** — c'est une
   **pseudonymisation**, pas une anonymisation, et la politique de
   confidentialité le dit ; les notes privées sont supprimées ; le ledger
   n'est jamais réécrit.
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
7. **Paiement (V4.5-160/184)** — §2bis et §3 sont écrits au code livré. Le
   fournisseur est Stripe et non Revolut ; `ADR_004` a été amendé en place,
   ce document suit.

Décisions ouvertes, ajoutées le 30 août 2026 — aucune n'est supposée :

8. **Politique de rétention de Stripe** — à consulter et consigner comme
   l'ont été OpenRouter, Anthropic et Mistral au §7.1, avec URL et date.
   Tant que ce n'est pas fait, aucune durée ne peut être affichée pour le
   paiement, exactement comme pour l'IA.
9. **Que garder du corps des événements (E4)** — trois options, et elles ne
   s'équivalent pas :
   (a) ne persister que les champs lus par la réconciliation, et écarter le
   reste à l'écriture — l'écart disparaît, mais un litige futur ne peut plus
   être tranché sur ce que le fournisseur avait envoyé ;
   (b) tout garder et purger après un délai — il faut alors choisir ce délai
   en connaissance de l'obligation comptable ;
   (c) tout garder indéfiniment, et l'écrire dans la politique de
   confidentialité plutôt que de le laisser tacite.
   Le choix est celui du Propriétaire ; c'est un arbitrage entre preuve
   commerciale et minimisation, pas une question technique.
10. **Durée de conservation comptable** — les pièces justificatives d'un
    achat doivent être conservées (droit commercial français : dix ans pour
    les livres et pièces comptables). Cela **impose** de garder
    `payment_orders` et les écritures du ledger malgré une demande
    d'effacement, et **n'impose pas** de garder l'e-mail, le nom et l'adresse
    reçus dans `payload_json`. Le point mérite d'être confirmé par le conseil
    qui tranchera aussi le statut fiscal et la TVA (ADR_004 §8) : ce sont les
    mêmes obligations et le même interlocuteur.

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
- supprimer ou réécrire une écriture du ledger au titre de l'effacement ;
- affirmer que l'effacement d'un compte retire toutes ses données tant que
  E4 n'est pas tranché — c'est faux du corps des événements de paiement ;
- afficher une durée de rétention pour le paiement avant la décision 8.
