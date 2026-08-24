# V4-007 — Registre de consultation et d'arbitrage

Statut : **arbitrage propriétaire reçu, activation pilote offerte autorisée**

Date de consolidation : 2026-08-24

Périmètre : catalogue tarifaire versionné et devis serveur pour la correction IA

Ce registre est une preuve de consultation. Il autorise uniquement le catalogue
pilote version `4.0.0` décrit ci-dessous ; il ne constitue pas une autorisation
de commercialisation. Aucun pack, SKU ou paiement n'est créé par V4-007.

## Addendum pilote Writing — 24 août 2026

La décision produit du 24 août autorise un pilote `writing/fr-FR` financé par
crédits offerts malgré le `NO-GO` scientifique. Elle ne permet ni vente
publique, ni activation implicite d'une valeur de crédit.

La campagne Writing finale apporte les mesures qui manquaient le 12 août : 72
workflows logiques, 72 appels primaires, 6 secondes passes, aucun retry et
`1,551831 USD` de coût fournisseur réconcilié. La médiane est `0,019680 USD`,
le P90 `0,0230361 USD` et le maximum `0,045228 USD`. Sous l'hypothèse chargée
défavorable `×1,30398`, ils deviennent respectivement `0,025662`, `0,030039`
et `0,058976 USD-éq.`.

La taille mesurée reste courte : 176 à 589 caractères. Deux options ont donc
été préparées, sans activation :

- **A — mesurée stricte** : 600 caractères, estimation 3 crédits, réserve 4 ;
- **B — pilote produit borné** : 1 500 caractères, estimation 3 crédits,
  réserve 6, avec extrapolation explicitement signalée.

Rayan a validé l'option B et la parité pilote provisoire de 100 crédits par
euro le 24 août 2026. `docs/V4_007_PILOT_CALIBRATION.md` conserve les tradeoffs
et l'artefact machine porte désormais la décision horodatée. Cette activation
reste limitée aux crédits offerts : aucun prix public, pack, SKU ou paiement
n'est autorisé.

## Consultations V4-007

### Finance & Pricing — `SUPERSEDED_FOR_BOUNDED_PILOT`

- **Date de demande et de réponse :** 2026-08-12.
- **Périmètre transmis :** unité de crédit, actions facturables, coût fournisseur
  prudent, marge de sécurité, arrondis, plafond, version/date d'effet, packs
  futurs et règle anti-vente à perte.
- **Réponse reçue :** le benchmark V4-003 reste `NO-GO` et ne fournit aucun
  médian/P90 exploitable. Finance autorise une structure générique en brouillon,
  le calcul sur l'ensemble des appels fournisseur et un comportement fermé par
  défaut. Les propositions de parité, coefficients, packs et arrondis sont des
  hypothèses non validées et ne doivent pas être activées.
- **Clarification 1.0.3 reçue :** Terra, Sonnet et Gemini Flash sont des
  candidats alternatifs ; une correction utilise un seul modèle promu. La
  seconde passe automatique reprend ce même modèle. Une nouvelle analyse
  volontaire est une nouvelle action facturable ; il n'existe aucune
  « réparation gratuite ». Les plafonds reposent sur les tarifs fournisseur
  hors promotion. Le coût futur réglé additionne tous les `usage.cost`; tout
  dépassement du plafond accepté est absorbé et alerté par LearnX.
- **Décisions retenues :** crédits entiers ; coût réel agrégé sur tous les appels,
  retries et contrôles ; plafond accepté non dépassable ; entrée tarifaire liée
  au benchmark, corpus, langue, prompt et modèle ; absence de catalogue actif =
  devis indisponible ; aucun prix fictif ou nul.
- **Hypothèses restées inactives commercialement :** packs 10/25/50 € et
  stress-test micro-BNC avec 10 % de marge de contribution disponible. Ils ne
  constituent ni prix public, ni SKU, ni qualification fiscale, ni bénéfice
  net.
- **Décision pilote ultérieure :** la parité provisoire `100 crédits/€` est
  activée uniquement comme unité interne du pilote offert. La réserve 6 crédits
  assume explicitement l'extrapolation jusqu'à 1 500 caractères.
- **Inconnues restantes avant toute vente :** conversion USD/EUR, fiscalité et
  frais définitifs, marge cible, packs, capacité annoncée et date d'effet
  commerciale.
- **Arbitrage propriétaire :** Rayan Chambet a validé l'option B et sa parité
  interne le 24 août 2026. Cette décision lève le blocage du pilote offert, pas
  celui d'une offre payante.

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

## Gate d'activation — franchi pour le pilote offert uniquement

Le catalogue V4-007 reste fermé hors du périmètre `STANDARD`, `writing/fr-FR`,
exercice et 1 500 caractères. Dans ce périmètre, les conditions suivantes sont
désormais remplies pour le pilote financé par crédits offerts :

1. mesures Writing réconciliées utilisées comme calibration produit malgré le
   `NO-GO` scientifique explicitement conservé ;
2. hypothèses économiques prudentes et extrapolation de taille consignées ;
3. validation explicite de Rayan Chambet sur l'option B, la parité provisoire
   et la date d'effet ;
4. activation d'une version immuable, sans modifier les historiques antérieurs ;
5. monitoring du coût réel et absorption des dépassements par LearnX.

## Vérification de cohérence avec l'implémentation

- **Conforme :** chaque catalogue porte un seul `modelId`; aucune orchestration
  multi-modèle n'existe. `includesAutomaticSecondPass` est une propriété du
  devis primaire, pas une action séparée.
- **Conforme :** `RECONSIDERATION` utilise un nouveau devis et une nouvelle clé
  d'idempotence. Aucun chemin de réparation gratuite n'est défini dans V4-007.
- **Conforme :** le prix final additionne la liste complète des coûts fournisseur
  et refuse de dépasser le plafond accepté. La politique d'absorption et
  d'alerte sera reliée au règlement dans V4-009.
- **Conforme après correctif 1.0.3 :** la version et la date du tarif fournisseur,
  le caractère hors promotion et la parité crédit/euro sont maintenant des
  champs versionnés. Une version active exige ces preuves et interdit un tarif
  promotionnel.
- **Activé dans le scope pilote :** les rôles apprenants possèdent
  `ai.assessment.correct`, mais l'entrée active unique n'accepte que `STANDARD`,
  `writing/fr-FR`, exercice et 1 à 1 500 caractères. L'orchestrateur réserve
  explicitement des lots offerts et ne peut pas sélectionner un lot acheté.
- **Toujours désactivé :** `DETAILED`, `REINFORCED`, `RECONSIDERATION`, packs,
  SKU, recharge et paiement. Aucun code V5 n'a été commencé.
