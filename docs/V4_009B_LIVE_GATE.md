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

## Suite conditionnelle — aucun appel autorisé à ce stade

Le mini-panel est uniquement un gate d'arrêt économique et pédagogique. Il ne
permet pas de conclure définitivement sur la qualité du pipeline face à une
approche mono-modèle.

Si Produit/pédagogie rend un GO écrit sur le mini-panel, puis si Rayan autorise
explicitement le full sous une identité strictement inchangée :

- matrice finale : 24 cas × 3 répétitions = 72 workflows ;
- réutilisation obligatoire des 12 cellules du mini-panel ;
- seulement 60 appels PRIMARY manquants, jamais 72 nouveaux appels PRIMARY ;
- budget attendu agrégé : `1.10–1.30 USD`, mini-panel inclus ;
- plafond dur agrégé : `2.00 USD`, mini-panel inclus ;
- maximum agrégé : 180 tentatives, retries compris ;
- même préflight atomique avant chaque tentative ;
- arrêt, paquet aveugle et revue humaine avant toute promotion ;
- holdout toujours fermé jusqu'au GO du full.

Les sorties PRIMARY du composite fourniront la baseline Mistral seul sans appel
supplémentaire. Sonnet historique n'est comparable que si corpus SHA, prompt,
protocole, route, profil et scoring sont strictement identiques ; sinon il sera
marqué `NON_COMPARABLE` ou seulement indicatif.
