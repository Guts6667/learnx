# V4.5-160 / 184 — passe en mode test Stripe

**Statut** : étape 1 jouée le 30 août 2026 — transport et signature prouvés sur
une livraison Stripe authentique (voir plus bas). L'étape 2, l'achat réel, reste
à jouer : tant qu'elle ne l'est pas, **l'attribution des crédits n'a jamais été
exercée de bout en bout** et E4 reste ouvert.

## Ce que cette passe doit établir en premier

**Quels événements Stripe envoie réellement.** Toute l'attribution en dépend :
LearnX crédite à la réception de « payé » et marque lui-même la commande comme
honorée, parce que le fournisseur n'a aucune raison d'émettre un événement
d'attribution — il ignore si l'apprenant a reçu ses crédits. Si le nom de
l'événement de paiement diffère de celui attendu, la commande reste bloquée à
« en attente » : argent encaissé, rien attribué, et rien qui échoue bruyamment.

C'est le point le plus important de cette passe, avant la forme de la signature.

## Ce qui est déjà prouvé sans compte

Les propriétés que le fournisseur ne garantit pas sont testées hors ligne, en
cassant chacune pour vérifier qu'un test tombe :

- signature valide, falsifiée, absente, illisible, hors fenêtre ;
- comparaison en temps constant (assertion structurelle — une mesure de durée
  serait un test instable qui ne prouve rien) ;
- rejeu du même identifiant d'événement : enregistré une fois, attribué zéro
  fois ;
- événement désordonné : `PAID` après `FULFILLED` ne fait pas régresser ;
- encaissement coupé : rien n'est lu, rien n'est écrit.

## Ce que la passe réelle doit ajouter

Ce qu'un enregistrement figé ne peut pas montrer :

1. **La forme réelle de la signature.** L'algorithme et le format d'en-tête
   sont implémentés d'après la documentation ; seule une livraison authentique
   prouve que la vérification accepte ce que Stripe envoie vraiment — y compris
   le cas de plusieurs signatures `v1` pendant une rotation de secret.
2. **Les noms d'événements.** La table de correspondance vers les états
   d'ADR_003 §6.3 est écrite d'après la documentation. Un nom d'événement
   inconnu est traité sans être appliqué, donc une divergence ne casse rien —
   elle laisse simplement des commandes bloquées, ce qu'il faut voir.
3. **L'ordre et les reprises réels.** Combien de fois Stripe réessaie, à quel
   rythme, et dans quel désordre.
4. **Le retour de navigation.** Qu'il n'attribue rien, vérifié sur un vrai aller
   -retour et pas seulement par lecture du code.

## Déroulé

1. Renseigner `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_WEBHOOK_SECRET` et
   `LEARNX_PAYMENTS_ENABLED=true` dans l'environnement d'aperçu **uniquement**.
   `stripe listen --forward-to <url>/api/payments/webhook` donne une livraison
   authentique en local, ce qu'aucun enregistrement figé ne remplace.
2. Créer un ordre depuis l'application, payer avec une carte de test.
3. Vérifier : un `payment_orders` en `FULFILLED`, une suite de `payment_events`
   dont les identifiants sont distincts, aucun crédit attribué deux fois.
4. Rejouer manuellement une livraison déjà reçue : attendue en `DUPLICATE`,
   réponse 200, aucun crédit.
5. Consigner ici la trace réelle des événements observés, y compris leur ordre.

## Étape 1 — livraison authentique (30 août 2026)

**Faite.** Une livraison Stripe réelle a atteint l'aperçu et a été acceptée.
Environnement : *Test mode · LearnX*, destination `learnx-dev-preview`, réponse
**200 à 16:16:29 UTC**. Le déclencheur est `stripe trigger` depuis le tableau de
bord, pas un achat : aucune carte, aucun acheteur, aucune commande LearnX en
face.

### Ce que cette étape établit

1. **Le transport.** Stripe atteint la route, qui répond 200. Un POST non signé
   répond 400 `{"received":false}` — vérifié séparément.
2. **La signature.** La livraison a été acceptée, donc le format d'en-tête réel
   est bien celui qui est implémenté. C'est le point 1 de la liste ci-dessus,
   qu'aucun enregistrement figé ne pouvait donner. Le cas des signatures `v1`
   multiples pendant une rotation reste, lui, non observé.
3. **Un nom d'événement.** `checkout.session.completed`, présent dans
   `STRIPE_EVENT_STATUS` et associé à `PAID`. Identifiant `evt_1UA9…`.

### Ce qu'elle n'établit pas, et pourquoi

- **Le vocabulaire n'est pas prouvé par l'issue enregistrée.** La ligne porte
  `out_of_order`, et ce n'est pas une information sur le nom de l'événement :
  `resolveEvent` teste l'absence de commande **avant** l'absence de
  correspondance de nom, donc une session synthétique — qu'aucune commande
  LearnX ne peut rattacher — ressort en commande inconnue quel que soit le nom
  reçu. La seule preuve disponible ici est le `event_type` consigné mot pour
  mot, comparé à la main à `STRIPE_EVENT_STATUS`. Toute lecture de la colonne
  `outcome` sur les lignes du 30 août est à écarter : elles ont été écrites
  avant V4.5-198, qui repliait trois situations sur deux étiquettes.
- **L'attribution n'est pas exercée.** `payment_orders` est vide : aucun crédit
  n'a été attribué, et le chemin `PAID → FULFILLED` — le seul endroit où des
  crédits sont accordés — n'a jamais été parcouru par une livraison réelle.
- **Ni l'ordre, ni les reprises, ni le retour de navigation** (points 3 et 4).
  Une livraison unique ne dit rien d'un désordre.

### Deux pannes rencontrées avant le 200, consignées parce qu'elles se répètent

- **400 sur le premier renvoi** : la livraison portait l'ancien secret de
  webhook. Attendu.
- **500 ensuite**, et la cause n'est pas dans le code de paiement : la branche
  Neon d'aperçu n'avait pas la migration `20260830120000_add_payment_intent_reference`,
  parce que `vercel:migrate` n'applique les migrations qu'à la production
  (`package.json:62`). La recherche de commande par `provider_payment_intent_id`
  échouait donc **avant** `recordEvent`, ce qui explique aussi qu'aucune trace
  ne subsiste de ces tentatives. Migration appliquée à la main via
  `pnpm db:target … migrate-deploy`. V4.5-200 fait appliquer les migrations aux
  constructions d'aperçu de `dev`.

Conséquence à retenir : **une erreur avant `recordEvent` ne laisse aucune
trace en base.** La reprise de Stripe est le seul filet, et le diagnostic passe
alors par les journaux applicatifs, pas par `payment_events`.

### Étape 2 — ce qui reste à faire

Un achat réel depuis le compte d'aperçu, seul moyen d'exercer l'attribution,
le retour de navigation, et de répondre à E4 (§ audit RGPD) — voir ci-dessous.
À jouer sur un aperçu portant V4.5-198, pour que la colonne `outcome` dise la
vérité sur la première commande réelle.
