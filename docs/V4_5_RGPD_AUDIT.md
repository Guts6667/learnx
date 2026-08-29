# Audit RGPD V4.5 — correction IA et paiement

- **Statut** : `ACTIVE_AUTHORITY` (ticket V4.5-165, partie IA) ·
  partie paiement `EN_ATTENTE` (V4.5-160)
- **Version** : 1.0.0
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
| Neon | hébergement base | tout | **à confirmer** (région du projet) | plan Launch, PITR selon plan | §7 |
| Vercel | hébergement app/API, logs | requêtes, logs d'erreur (stack, pas de corps) | **à confirmer** (région des fonctions) | — | §7 |
| OpenRouter | routeur d'inférence | T2, T3 | US (siège) | `data_collection: 'deny'`, `allow_fallbacks: false`, `only`/`order` épinglés, `require_parameters: true` (`ai-correction-provider-adapters.ts`) | rétention **à attester** |
| Anthropic | modèle primaire (Sonnet 4.6) | T2 | via OpenRouter, route `anthropic` | idem | rétention **à attester** |
| Mistral | vérificateur (Medium 3.5) | T3 (extraits) | endpoint `mistral/eu` | idem | rétention **à attester** |
| Resend | e-mails transactionnels | e-mail, contenu d'invitation/vérification ; alertes owner (142) | **à confirmer** | — | §7 |
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

Aucune de ces lignes n'est une hypothèse de ce document ; chacune bloque une
partie de V4.5-151 (rollout) tant qu'elle n'est pas tranchée.

1. **Rétention fournisseurs** : obtenir et consigner, avec source (URL et
   date), la politique de rétention effective d'OpenRouter, d'Anthropic (via
   OpenRouter, `data_collection: deny`) et de Mistral (`mistral/eu`). Sans
   cela, la phrase « ne pas conserver » du §5 reste une demande, pas un fait.
2. **Régions** : région du projet Neon, des fonctions Vercel et de Resend.
3. **E2** : purge de `raw_output_json` à 180 jours — oui/non/autre durée.
4. **E1** : suppression = anonymisation avec conservation du ledger — valider
   le principe avant le ticket.
5. **Politique de confidentialité publique** et adresse de réclamation : à
   publier avant le pilote (page statique, hors périmètre de ce document).
6. **DPO / registre formel** : exploitation solo, pas de traitement à grande
   échelle de données sensibles → pas de DPO obligatoire selon la lecture
   courante ; **à confirmer par un conseil** si le pilote dépasse le cercle
   des early adopters.
7. **Paiement (V4.5-160)** : compléter §2–§3 à la livraison de l'ADR Revolut.

## 8. Ce que ce document n'autorise pas

- afficher une durée de rétention non attestée ;
- envoyer un texte d'apprenant dans un e-mail d'alerte ou un artefact de
  recherche ;
- supprimer ou réécrire une écriture du ledger au titre de l'effacement.
