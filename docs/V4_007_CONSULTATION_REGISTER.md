# V4-007 — Registre de consultation et d'arbitrage

Statut : **structure technique livrable, activation économique bloquée**

Date de consolidation : 2026-08-12

Périmètre : catalogue tarifaire versionné et devis serveur pour la correction IA

Ce registre est une preuve de consultation. Il ne constitue ni une grille de
prix active, ni une autorisation de commercialisation. Aucun catalogue, prix,
pack ou coefficient n'est créé par le seed ou la migration V4-007.

## Consultations V4-007

### Finance & Pricing — `BLOCKED`

- **Date de demande et de réponse :** 2026-08-12.
- **Périmètre transmis :** unité de crédit, actions facturables, coût fournisseur
  prudent, marge de sécurité, arrondis, plafond, version/date d'effet, packs
  futurs et règle anti-vente à perte.
- **Réponse reçue :** le benchmark V4-003 reste `NO-GO` et ne fournit aucun
  médian/P90 exploitable. Finance autorise une structure générique en brouillon,
  le calcul sur l'ensemble des appels fournisseur et un comportement fermé par
  défaut. Les propositions de parité, coefficients, packs et arrondis sont des
  hypothèses non validées et ne doivent pas être activées.
- **Décisions retenues :** crédits entiers ; coût réel agrégé sur tous les appels,
  retries et contrôles ; plafond accepté non dépassable ; entrée tarifaire liée
  au benchmark, corpus, langue, prompt et modèle ; absence de catalogue actif =
  devis indisponible ; aucun prix fictif ou nul.
- **Inconnues restantes :** parité crédit/euro, conversion USD/EUR, fiscalité et
  frais, coefficient de sécurité, règle d'arrondi, P90 retenu, marge cible,
  packs, capacité annoncée et date d'effet.
- **Arbitrage propriétaire :** Rayan Chambet a validé le squelette réversible et
  l'absence de valeurs actives. Il n'a pas arbitré les inconnues économiques.
  L'activation reste donc bloquée.

### Produit & pédagogie — `RECEIVED`

- **Date de demande et de réponse :** 2026-08-12.
- **Périmètre transmis :** lisibilité des actions, différence entre correction
  primaire, seconde passe automatique et nouvelle analyse volontaire, contenu
  du devis apprenant et formulations interdites.
- **Réponse reçue :** « Correction standard » reste l'option complète de
  référence ; « Correction détaillée » conserve exactement grille, score et
  seuil mais développe le retour ; « Correction renforcée » reste inactive sans
  vérification indépendante benchmarkée ; « Demander une nouvelle analyse » est
  une action distincte avec un nouveau devis. Payer plus ne modifie jamais la
  grille, le seuil ou la probabilité de réussite.
- **Décisions retenues :** la seconde passe automatique est incluse dans le
  plafond initial ; la nouvelle analyse volontaire est séparée ; le devis
  apprenant expose dans l'ordre action/portée, estimation, maximum réservé,
  seconde passe incluse, libération du reliquat et expiration locale ; les
  données fournisseur et de marge restent internes.
- **Inconnues restantes :** activation effective de la correction renforcée et
  textes UI finaux lors de l'intégration de l'écran de confirmation.
- **Arbitrage propriétaire :** le plan technique sans activation a été validé.
  Les valeurs tarifaires et l'exposition commerciale restent hors arbitrage.

## Inventaire rétrospectif V4-001 à V4-006

L'absence de preuve ci-dessous ne rouvre pas automatiquement un ticket. Un
conflit matériel avec une décision métier devra faire l'objet d'un correctif
autonome.

| Ticket | Preuve retrouvée | Statut | Écart ou conflit matériel |
| --- | --- | --- | --- |
| V4-001 | `ee9ace2`, ADR de confiance avec séparation produit/finance et garde-fous explicites | `RECEIVED` | Pas de registre horodaté par consultant retrouvé ; aucun conflit matériel identifié. |
| V4-002 | `e07f4d5`, adaptateur OpenRouter gardé et sans activation implicite | `RECEIVED` | Preuve de revue technique présente ; preuve formelle Produit/Finance non centralisée. |
| V4-003 | `633fc35`, `5a1040a`, `814f555`, corpus revu puis rapport benchmark `NO-GO` | `ARBITRATED` pour la pédagogie, `BLOCKED` pour Finance | La revue pédagogique finale est explicite. Finance confirme qu'aucune mesure tarifaire exploitable ne peut être dérivée du run actuel. Aucun prix ne doit être activé. |
| V4-004 | `04253c7`, contrats de correction versionnés | `BLOCKED` | Aucun registre Produit autonome retrouvé. Le contrat garde grille/seuil identiques et aucun conflit matériel n'est actuellement démontré. |
| V4-005 | `4c65e9d`, workflow de correction persistant | `BLOCKED` | Aucun registre Produit autonome retrouvé. La seconde passe et l'historique devront être vérifiés contre les libellés Produit lors de leur exposition UI. |
| V4-006 | `853474d` et correctifs `da4fb33` à `a45146d`, ledger immuable | `BLOCKED` | Aucun registre Finance autonome retrouvé. Le ledger ne fixe toutefois ni prix, ni parité, ni pack : aucun conflit économique actif n'est démontré. |

## Gate d'activation

Le catalogue V4-007 doit rester `DRAFT` ou `INACTIVE` et l'API doit répondre
« estimation indisponible — aucune correction ne sera lancée » tant que les
conditions suivantes ne sont pas toutes remplies :

1. benchmark V4-003 valide avec mesures par action et classe de taille ;
2. arbitrage écrit de Finance sur les inconnues économiques ;
3. validation explicite de Rayan Chambet sur les valeurs et la date d'effet ;
4. activation d'une version immuable, sans modifier les historiques antérieurs ;
5. test de non-vente à perte sur tous les appels réellement facturés.
