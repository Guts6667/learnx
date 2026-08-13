# V4-009B — Demande de GO du mini-panel

Statut : `OWNER_GO_REQUIRED`
Date : 2026-08-13

Cette demande ne constitue pas une activation produit. Le catalogue, le
pipeline public, le full et le holdout restent `DRAFT/INACTIVE`.

## Identité immuable proposée

- Pipeline : `learnx-fr-text-mistral-sonnet-targeted-v1@1.0.0`.
- Primaire : `mistralai/mistral-medium-3-5`, OpenRouter route Mistral,
  profil `2.0.0`, prompt `2.0.0`.
- Vérificateur ciblé : `anthropic/claude-sonnet-4.6`, OpenRouter route
  Anthropic, profil `2.0.0`, prompt `2.0.0`.
- Protocole : `3.0.1` ; trigger serveur `1.0.0` ; consolidation `1.0.0`.
- Aucun fallback, alias, route automatique ou retuning après résultats.

## Volume et budget maximum

- 6 cas de développement × 2 répétitions = 12 workflows logiques.
- 12 appels primaires initiaux maximum.
- 10 appels vérificateur initiaux maximum, déclenchés uniquement par la règle
  gelée ou les deux cellules de contrôle préenregistrées.
- Un retry transitoire allowlisté maximum par rôle/cellule.
- Maximum propre à ce manifeste : 44 tentatives fournisseur.
- Garde Finance absolue : 48 tentatives ; les quatre restantes ne sont pas
  utilisables par ce manifeste.
- Coût attendu sans retry : au plus `0.35 USD`.
- Plafond fournisseur dur : `0.75 USD` de `usage.cost` agrégé.
- Avant chaque tentative :
  `actualCostUsd + reservedInFlightUsd + worstCaseNextUsd <= 0.75`.

Toute dépense du panel est un coût R&D LearnX. Aucun crédit, allocation,
réservation ou prix utilisateur n'est utilisé.

## Arrêts immédiats

- injection suivie, fuite canari ou preuve hors `responseText` ;
- identité, route, profil ou tarif différent du manifeste ;
- erreur déterministe 4xx, timeout, coût absent non réconcilié ;
- premier appel que le préflight ne peut garantir sous le plafond ;
- appel hors manifeste ou violation d'idempotence.

Après le panel : arrêt, génération du paquet aveugle phase 1, puis revue
Produit/pédagogie. Aucun `24×3` sans nouveau GO écrit et aucun holdout avant la
réussite ultérieure de ce `24×3`.
