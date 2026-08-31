# Calibration économique et proposition tarifaire V4.5

- **Statut** : `OWNER_VALIDATED_PRICES_NOT_ACTIVATED` (V4.5-007 / ticket V4.5-164)
- **Version** : 1.2.0
- **Date** : 31 août 2026
- **Révision 1.1.0** : qualification fiscale arbitrée (BNC), ACRE et versement
  libératoire écartés, taux de prélèvements porté de 28,00 % à 33,06 %. Les prix,
  la parité et le plafond de réservation sont inchangés.
- **Révision 1.2.0** : plafond de réservation ramené de 45 à **41 crédits** après
  réconciliation avec la voie AI Research. La distribution de coût provient
  désormais de `measured-costs.v2`, source unique, avec sa méthode de percentile
  déclarée. Les prix et la parité sont inchangés.
- **Owner** : Finance & Pricing
- **Reviewer** : Rayan
- **Portée** : achat ponctuel de crédits par les early adopters, correction
  d'exercices en texte libre, `fr-FR`
- **Autorité supérieure** : `ADR_003` (frontières de confiance) et
  `docs/V4_5_AI_QUALITY_CONTRACT.md` (gates de promotion)

## 1. Ce que ce document fait, et ne fait pas

Il fixe une grille tarifaire et démontre sa viabilité en micro-entreprise. Les
montants ont été validés par le Propriétaire le 31 août 2026.

Il **n'active rien**. Aucune ligne de `credit_pack` n'est créée ni passée à
`active = true`, aucune migration n'accompagne ce document, aucun prix n'est
publié. Deux conditions cumulatives restent à lever avant activation :

1. un GO explicite du Propriétaire sur l'activation elle-même ;
2. une promotion de l'identité de correction, aujourd'hui refusée (§3).

Les questions fiscales et juridiques restent des **décisions du Propriétaire**,
jamais des hypothèses retenues par Finance. Le §11 distingue celles qui ont été
rendues le 31 août 2026 de celles qui restent ouvertes.

## 2. Vocabulaire

- **Marge de contribution** : ce qui reste d'un euro encaissé après tous les
  coûts qui varient avec la vente — Stripe, cotisations, impôt forfaitaire,
  coût de l'IA, provisions. Ce n'est ni un bénéfice comptable, ni de la
  trésorerie disponible.
- **Coût fournisseur** : ce qu'OpenRouter facture réellement, en dollars,
  relevé dans `usage.cost` et consigné en `costSource: ACTUAL`.
- **Coût chargé** : le coût fournisseur augmenté des frais qui s'y greffent —
  approvisionnement, TVA non récupérable, coussin de change.
- **P90** : le coût dépassé une fois sur dix. On affiche la médiane au client,
  on réserve le P90.
- **Dette d'exécution** : les crédits vendus mais non consommés. C'est un
  service encore dû, pas une marge.

## 3. Identité chiffrée et son statut

Le workflow facturable est celui épinglé dans
`src/server/corrections/promoted-identity.ts` : un appel au modèle primaire
`anthropic/claude-sonnet-4.6` (profil 2.2.0, prompt 2.2.0, protocole 3.0.1,
sans raisonnement, `maxRetries: 1`), une reprise unique lorsque la réponse est
reçue mais inexploitable, et un appel au vérificateur indépendant
`mistralai/mistral-medium-3-5` sur son point européen, couvrant tous les
critères d'une correction.

**Cette identité n'est pas promue.** L'évaluation du 30 août 2026 sur 240
cellules (`benchmarks/ai-correction/regression/results/2026-08-30T22-21-08-937Z`)
laisse deux gates bloquants rouges :

| Gate                                 | Mesuré       | Seuil  | Verdict  |
| ------------------------------------ | ------------ | ------ | -------- |
| `eventual-unusable-runs`             | 9/240        | ≤ 3 %  | rouge    |
| `mutation-direction-violations`      | 7/47         | ≤ 2 %  | rouge    |
| `evidence-hallucination-any-attempt` | 17/216       | ≤ 1 %  | surveillé, rouge |
| `evidence-hallucination-delivered`   | 0/216        | 0      | vert     |
| `checker-agreement-at-high`          | 374/374      | ≥ 90 % | vert     |
| `checker-false-agree-rate`           | 5/7          | —      | rapporté |

La dernière ligne a une conséquence économique directe : mis en présence de
sept niveaux faux par construction, le vérificateur en a validé cinq. Son
accord de 374/374 n'est donc pas une preuve de fiabilité. **Le surcoût qu'il
représente n'achète aujourd'hui aucune garantie**, et toute modification de son
prompt ou de son modèle invalidera la mesure de coût du §4.

Cette réparation ne menace pas la grille : voir la marge de manœuvre au §10.

## 4. Coût fournisseur mesuré

Source unique : le grand livre du run du 30 août 2026 à 22 h 21, 497
enregistrements tous en `costSource: ACTUAL`, dont 288 appels primaires et 209
appels vérificateur, pour `6,481027649999997 USD` au total et zéro appel non
réconcilié.

La distribution est celle arrêtée avec la voie AI Research le 31 août 2026 et
publiée par `benchmarks/ai-correction/regression/measured-costs.v2.json`, qui en
devient la **source unique** dès la fusion de la PR #177. La méthode est
reproduite ci-dessous pour que ce document reste vérifiable seul, mais elle n'est
plus recalculée ici : en cas d'écart, c'est `measured-costs.v2` qui fait foi.

**Méthode, déclarée.** Une correction est une cellule
`(caseId, candidateId, repetition)` ; son coût est la somme de ses tentatives,
une tentative initiale et au plus une reprise. Un même numéro de tentative
apparaissant deux fois dans une cellule est une relance en double de
l'outillage de répétitions : le second enregistrement est un appel réel, mais il
n'appartient pas à la correction livrée, et il est exclu. Le percentile est pris
en **rang le plus proche** — sur l'échantillon trié, le percentile `p` est la
valeur de rang `plafond(p × n)`, sans interpolation. Un percentile sans méthode
déclarée n'est pas un chiffre : c'est ce qui a produit la divergence corrigée en
1.2.0.

| Distribution                 | Médiane      | P75      | P90      | Maximum  |
| ---------------------------- | ------------ | -------- | -------- | -------- |
| Primaire, par correction     | 0,021801     | 0,024129 | 0,029748 | 0,056868 |
| Vérificateur, par appel      | 0,0011075    | —        | —        | —        |
| **Workflow logique complet** | **0,022908** | 0,025236 | 0,030855 | 0,057975 |

En dollars, sur **240 corrections** et 209 appels vérificateur. Le vérificateur
pèse **5,08 %** de la médiane primaire par correction. Il est ajouté à sa moyenne
par appel, une correction neuve en appelant exactement un ; ce n'est pas le
rapport des dépenses totales du run, qui vaut 3,70 %, 209 appels ayant servi
240 corrections par réutilisation de verdicts déjà achetés.

### Chargement

Les paramètres économiques déjà retenus par LearnX sont appliqués séparément :
approvisionnement OpenRouter `×1,055`, TVA non récupérable `×1,20`, coussin de
change `×1,03`, facteur cumulé `×1,30398`.

| Poste                         | Médiane      |
| ----------------------------- | ------------ |
| Coût fournisseur du workflow  | 0,022908     |
| + approvisionnement 5,5 %     | +0,001260    |
| + TVA non récupérable 20 %    | +0,004834    |
| + coussin de change 3 %       | +0,000870    |
| **Coût chargé final**         | **0,029872** |

Coût chargé au P75 : `0,032908`. Au P90 : `0,040235`. Maximum observé :
`0,075599`.

Aucune conversion USD/EUR datée n'est appliquée : les montants sont des
USD-équivalents à la parité prudente `1 USD = 1 EUR`. Sur une plage de change
large, l'amplitude est inférieure à trois points de marge ; le taux devra
néanmoins être figé et daté dans la version de catalogue au moment de
l'activation, parce qu'il change la capacité annoncée.

Aucun tarif promotionnel n'est en jeu : les deux modèles sont facturés au tarif
de liste public. La mesure est donc déjà le scénario prudent hors promotion.

## 5. Stripe

Grille France relevée le 30 août 2026 sur `stripe.com/fr/pricing` et
`docs.stripe.com/refunds`.

| Ligne                              | Variable | Fixe   |
| ---------------------------------- | -------- | ------ |
| Carte standard EEE                 | 1,50 %   | 0,25 € |
| Carte premium ou affaires EEE      | 2,80 %   | 0,25 € |
| Carte britannique                  | 2,50 %   | 0,25 € |
| Carte internationale hors EEE / UK | 3,15 %   | 0,25 € |
| Conversion de devise               | +2,00 %  | —      |
| Contestation (chargeback)          | —        | 20,00 € |

Apple Pay et Google Pay suivent le tarif de la carte sous-jacente, sans surcoût
listé. Un remboursement ne coûte rien à émettre, mais **les frais de traitement
d'origine ne sont pas restitués**. Aucun service Stripe additionnel n'est
retenu : aucun n'est utilisé dans le périmètre achat de crédits.

`net_après_Stripe = prix_encaissé − 0,25 − taux_carte × prix_encaissé`

Le frais fixe est le facteur dimensionnant des petits paniers : il représente
8,3 % d'un pack à 3 €, contre 1,6 % d'un pack à 16 €.

## 6. Prélèvements micro-entreprise

Taux 2026 **vérifiés le 31 août 2026** auprès de l'Urssaf, de la direction
générale des finances publiques et de Bpifrance Création. Ce ne sont plus des
hypothèses à confirmer.

### Qualification retenue : BNC

L'activité est à la frontière des deux catégories. Le caractère commercial
plaide pour les bénéfices industriels et commerciaux : un service standardisé,
vendu en libre-service, sans intervention personnalisée, dont l'économie
consiste à acheter de l'inférence pour la revendre enrichie. Le caractère
intellectuel plaide pour les bénéfices non commerciaux : la valeur tient aux
barèmes et au contenu pédagogique, exploités par leur auteur.

Aucune des deux lectures n'est infondée. Le **BNC est retenu**, sur arbitrage du
Propriétaire du 31 août 2026, pour deux raisons :

1. il est le plus coûteux sur les quatre paramètres à la fois — cotisations
   25,6 % contre 21,2 %, abattement fiscal 34 % contre 50 %, versement
   libératoire 2,2 % contre 1,7 %, formation professionnelle 0,2 % contre
   0,1 % ;
2. l'erreur n'est pas symétrique. Provisionner en BNC ce qui s'avère BIC laisse
   un excédent disponible. Provisionner en BIC ce qui s'avère BNC crée une dette
   de régularisation.

Une confirmation auprès de l'Urssaf reste utile, mais elle ne conditionne plus
la tarification : le §9 montre que la grille tient dans les deux qualifications.

### Situation établie au 31 août 2026

- Micro-entreprise créée en **début d'année 2026**, déclaration Urssaf
  **mensuelle**. Cette déclaration est due même à chiffre d'affaires nul ; une
  échéance omise déclenche une pénalité forfaitaire par déclaration.
- **Pas d'ACRE.** Depuis le 1er janvier 2026 elle n'est plus automatique et se
  demande à l'Urssaf dans les 60 jours suivant le début d'activité ; le délai
  est écoulé. Elle est donc exclue de toute projection. Pour mémoire, depuis le
  1er juillet 2026 elle ne vaut plus que 25 % d'exonération, et non 50 %.
- **Pas de versement libératoire.** La fenêtre d'option ouverte à la création —
  trois mois — est close. La suivante expire le **30 septembre 2026**, pour un
  effet au 1er janvier 2027.
- **Cotisation foncière des entreprises** exonérée l'année de création. La
  première échéance tombe en **décembre 2027**. C'est un coût fixe, hors marge
  de contribution, à provisionner séparément.

| Régime                                    | Cotisations | CFP        | Impôt sur le revenu | Total sur CA |
| ----------------------------------------- | ----------- | ---------- | ------------------- | ------------ |
| micro-BNC, impôt nul (CA sous 17 600 €)   | 25,60 %     | 0,20 %     | 0,00 %              | 25,80 %      |
| micro-BNC avec versement libératoire      | 25,60 %     | 0,20 %     | 2,20 %              | 28,00 %      |
| **micro-BNC, tranche à 11 % — retenu**    | **25,60 %** | **0,20 %** | **7,26 %**          | **33,06 %**  |
| micro-BNC, tranche à 30 %                 | 25,60 %     | 0,20 %     | 19,80 %             | 45,60 %      |
| micro-BIC prestations de services, VFL    | 21,20 %     | 0,10 %     | 1,70 %              | 23,00 %      |

Hors versement libératoire, l'impôt porte sur 66 % des recettes, après
l'abattement forfaitaire de 34 % du micro-BNC : une tranche marginale de 11 %
coûte donc 7,26 % du chiffre d'affaires, et une tranche de 30 % en coûte
19,80 %.

**Le taux retenu pour toute la calibration est 33,06 %.** Il est délibérément
prudent. La première tranche du barème 2026 s'ouvre à 11 600 € de revenu
imposable, soit environ **17 600 € de chiffre d'affaires** compte tenu de
l'abattement. En deçà de ce seuil, aucun impôt n'est dû et le taux réel est de
25,80 %. C'est la situation la plus probable sur l'exercice de lancement.

### Arbitrage du versement libératoire

Il remplace l'impôt sur le revenu par 2,2 % du chiffre d'affaires, et devient
gagnant dès que la tranche marginale dépasse 3,3 %. La règle de décision est
donc binaire : opter si le foyer est imposable, ne pas opter s'il ne l'est pas —
payer 2,2 % pour remplacer un impôt nul est une perte sèche. L'option suppose un
revenu fiscal de référence inférieur à environ 29 300 € par part, et la fenêtre
revient chaque 30 septembre. Ne pas opter n'expose donc jamais à plus d'un
exercice de retard.

### TVA

La franchise en base s'applique jusqu'à 37 500 € de chiffre d'affaires de
services, avec un seuil majoré à 41 250 € : le prix affiché est le prix
encaissé, sans TVA à reverser.

En contrepartie, l'achat de services à un prestataire établi hors de France —
OpenRouter — rend l'entreprise redevable de la TVA par autoliquidation, sans
seuil de déclenchement et dès le premier euro. Trois conséquences :

1. un **numéro de TVA intracommunautaire** doit être demandé au service des
   impôts des entreprises. Cette demande **ne fait pas perdre la franchise en
   base** : les deux régimes sont distincts ;
2. la taxe se déclare sur le formulaire 3310-CA3, ligne A3 ;
3. elle **n'est pas déductible**, ce qui justifie le facteur `×1,20` du §4 comme
   scénario réaliste et non pessimiste.

Le numéro n'était pas détenu au 31 août 2026, alors que l'obligation court
depuis le premier achat OpenRouter réalisé par l'entreprise. Les montants en jeu
sur la période de calibration sont de l'ordre de quelques dizaines d'euros, mais
la régularisation doit précéder l'ouverture commerciale.

Les frais de traitement des cartes facturés par Stripe relèvent des services
financiers exonérés de TVA : rien à autoliquider dessus. Cela changerait avec
l'activation de Stripe Billing pour un abonnement.

En micro-entreprise, les dépenses Stripe, OpenRouter et infrastructure **ne
réduisent pas** le chiffre d'affaires servant d'assiette aux cotisations. Un
pack encaissé 8 € est déclaré 8 €.

## 7. Parité, prix unitaire et plafond

La parité de **100 crédits par euro** est conservée. Elle est déjà active
(catalogue `4.0.0`, migration `20260824192628_activate_bounded_writing_pilot_catalog`),
le grand livre des crédits offerts s'y appuie, et la granularité au centime est
ce qui rend le mécanisme de libération réellement lisible : avec une unité plus
grossière, la différence entre le plafond réservé et le prix réglé disparaîtrait
dans l'arrondi.

- **Prix d'une correction : 30 crédits**, soit 0,30 €.
- **Plafond de réservation : 41 crédits**, soit 0,41 €.

Le plafond dérive du rapport entre le P90 et la médiane du coût chargé par
correction. Sur les 240 cellules du run, ce rapport vaut
`0,040235 / 0,029872 = 1,3469`, et `30 × 1,3469 = 40,4`, arrondi au crédit
supérieur : **41 crédits**.

Il est **stable sous trois constructions**, ce qui est la raison de le figer :
1,3645 sur le modèle primaire seul, 1,3469 sur le workflow avec le vérificateur
à sa moyenne, 1,3471 avec le vérificateur à sa médiane. Les trois donnent 41.
Ajouter au primaire une quasi-constante — le vérificateur — comprime le rapport,
de sorte que sa prise en compte ne peut que faire baisser le plafond, jamais le
monter.

### 41 contient un choix, pas seulement une mesure

Les 240 cellules incluent celles qui n'ont produit aucun résultat exploitable.
Or une correction ratée n'est jamais réglée : la doctrine de libération rend
l'intégralité de la réservation. Le plafond gouverne donc **les corrections
livrées**, et la série principielle est celle des 231 cellules ayant produit une
tentative valide. Sur cette série le rapport vaut 1,2195 et le plafond
**37 crédits**.

**41 est retenu : c'est 37 plus une marge délibérée de 4 crédits.** Cette marge
a un bénéficiaire, et il faut l'écrire. Elle protège LearnX du transfert de coût
que provoquerait un plafond trop étroit, et elle est payée par l'apprenant, dont
le solde est retenu à hauteur de 41 crédits au lieu de 37 pendant l'exécution.
Sur un devis de 30 crédits, l'écart est de quatre centimes, immobilisés le temps
d'une correction et libérés au règlement. Le choix est défendable ; il n'est pas
neutre, et il ne doit pas être relu comme une nécessité technique.

Chiffres et méthode arrêtés avec la voie AI Research le 31 août 2026 ; les deux
documents publient la même distribution et la même dérivation.

Mécanique de règlement :

```
devis affiché          : 30 crédits — plafond : 41 crédits
réservation            : 41 crédits
règlement              : min(41, arrondi_supérieur(30 × coût_réel / coût_médian))
libération             : 41 − règlement, immédiatement
résultat inutilisable  : règlement 0, libération 41, coût fournisseur absorbé
```

La dernière ligne applique la doctrine argent réaffirmée par l'addendum du
29 août 2026 à `ADR_003` : un résultat `FAILED` libère l'intégralité de la
réservation ; une livraison `COMPLETED_PARTIAL` reste débitée au prix du devis
accepté. Une nouvelle analyse volontaire est une action facturable ; une reprise
technique et l'appel vérificateur ne le sont jamais.

## 8. Paliers proposés

Validés par le Propriétaire le 31 août 2026. Non activés.

| Élément                        | Démarrage | Parcours | Année    |
| ------------------------------ | --------- | -------- | -------- |
| Prix payé                      | 3,00 €    | 8,00 €   | 16,00 €  |
| Crédits                        | 300       | 880      | 2 000    |
| Crédits par euro               | 100       | 110      | 125      |
| Prix affiché par correction    | 0,30 €    | 0,27 €   | 0,24 €   |
| Capacité médiane annoncée      | 10        | 29       | 66       |
| Capacité prudente au plafond   | 7         | 21       | 48       |
| Frais Stripe, carte EEE        | 0,295 €   | 0,370 €  | 0,490 €  |
| Prélèvements micro, 33,06 %    | 0,992 €   | 2,645 €  | 5,290 €  |
| Coût d'exécution couvert       | 0,358 €   | 1,051 €  | 2,390 €  |
| Provisions, 3 %                | 0,090 €   | 0,240 €  | 0,480 €  |
| **Contribution disponible**    | **1,265 €** | **3,694 €** | **7,351 €** |

Coût d'exécution et contribution calculés bonus early adopter inclus et
consommation intégrale supposée, au taux de prélèvements retenu de 33,06 %
(§6), et sur le coût chargé médian de 0,029872 € du §4. La capacité prudente est
calculée au plafond de 41 crédits.

Deux règles accompagnent la grille :

- le nombre de crédits par euro **croît avec la taille du palier**, ce qui
  finance la dégressivité affichée par l'économie de frais fixes réalisée ;
- le palier Démarrage est **limité à un achat par compte**. Acheter 24 € de
  crédits par tranches de 3 € coûterait 2,00 € de frais fixes, soit 8,3 % du
  chiffre d'affaires, contre 0,38 € — 1,6 % — pour le même montant acheté au
  palier Année.

### Avantage early adopter

Un **bonus unique de 20 % en crédits**, jamais une remise sur le prix. Les deux
manières d'accorder le même avantage sur le palier Parcours ne coûtent pas la
même chose :

- **bonus** : 176 crédits supplémentaires, soit 5,87 corrections à 0,029872 € de
  coût chargé, donc **0,175 €** ;
- **remise** : pour porter la contrepartie à 132 crédits par euro sans donner de
  crédits, il faut vendre les 880 crédits 6,67 € au lieu de 8,00 €, donc
  **1,333 €** de chiffre d'affaires abandonné.

La remise coûte **7,6 fois plus cher** pour un avantage identique. Le bonus n'est
de surcroît consommé que s'il est utilisé, alors que la remise est perdue dès
l'encaissement. Ces deux montants remplacent ceux de la version 1.0.0, dont la
dérivation n'était pas reproductible.

L'avantage doit être borné par une période, un nombre maximal de bénéficiaires,
un bonus unique par compte, une date de fin affichée avant l'achat, et l'absence
de renouvellement automatique sauf décision explicite. Aucun crédit illimité,
aucune garantie tarifaire perpétuelle.

Bornes retenues par défaut, modifiables tant qu'aucun prix n'est activé : les
**100 premiers comptes ou le 31 octobre 2026**, au premier des deux atteint, un
bonus unique par compte, sans reconduction. Ces bornes doivent figurer dans les
conditions générales de vente et être affichées avant l'achat.

## 9. Marges de contribution

`contribution = prix − Stripe − prélèvements_CA − coût_exécution − provisions`

| Scénario                          | Démarrage | Parcours | Année  |
| --------------------------------- | --------- | -------- | ------ |
| Favorable                         | 54,1 %    | 58,4 %   | 58,8 % |
| Probable à court terme            | 51,4 %    | 55,6 %   | 55,7 % |
| **Retenu**                        | **44,1 %** | **48,4 %** | **48,4 %** |
| Défavorable                       | 36,5 %    | 40,6 %   | 40,5 % |
| Retenu, bonus early adopter inclus | 42,2 %   | 46,2 %   | 45,9 % |
| Défavorable, bonus inclus         | 34,3 %    | 38,2 %   | 37,8 % |

Définition des scénarios :

| Paramètre                | Favorable  | Probable      | Retenu        | Défavorable       |
| ------------------------ | ---------- | ------------- | ------------- | ----------------- |
| Carte                    | EEE        | EEE           | EEE           | hors EEE + change |
| Taux carte               | 1,50 %     | 1,50 %        | 1,50 %        | 5,15 %            |
| Régime                   | BNC        | BNC           | BNC           | BNC               |
| Impôt sur le revenu      | nul        | nul           | tranche 11 %  | tranche 11 %      |
| Taux sur CA              | 25,80 %    | 25,80 %       | 33,06 %       | 33,06 %           |
| TVA fournisseur          | hors champ | 20 % non déd. | 20 % non déd. | 20 % non déd.     |
| Chargement               | ×1,08665   | ×1,30398      | ×1,30398      | ×1,30398          |
| Point de la distribution | médiane    | médiane       | médiane       | P75               |
| Provisions               | 2 %        | 3 %           | 3 %           | 6 %               |

Les quatre scénarios partagent désormais la même qualification fiscale, le BNC
étant arbitré (§6). Ce qui les sépare est l'impôt sur le revenu, la TVA
fournisseur, l'origine de la carte et le point de la distribution de coût.

Le scénario **probable à court terme** est celui de l'exercice de lancement :
chiffre d'affaires sous 17 600 €, donc aucun impôt sur le revenu, mais TVA
fournisseur bien due. Le scénario **retenu** ajoute l'impôt à la tranche de
11 % : c'est la base de toute la planification, y compris des réserves du §13.

Une tranche marginale de 30 % ferait tomber les marges à 31,6 / 35,8 / 35,9 %.
Ce cas n'est pas traité comme un scénario de lancement : il suppose plus de
50 000 € de chiffre d'affaires, niveau auquel le versement libératoire devient
nettement gagnant et restitue 17,6 points. Il figure au §15 comme condition de
recalcul.

La cible nominale de 40 % est tenue partout en scénario retenu, bonus early
adopter compris, et sur les deux paliers hauts en scénario défavorable. Le
palier Démarrage descend à 36,5 % dans le pire cas, 34,3 % avec le bonus — c'est
le coût assumé d'un ticket d'entrée accessible, et il reste très au-dessus du
minimum acceptable de 25 %.

Le durcissement de l'hypothèse fiscale coûte 5,06 points de marge par rapport à
la version 1.0.0 et ne remet en cause aucun prix.

`prix_minimal = (coûts_fixes + coût_exécution + provisions) / (1 − taux_Stripe − taux_cotisations − taux_CFP − taux_impôt − marge_cible)`

Si le dénominateur devient nul ou négatif, le palier est économiquement
impossible dans ce scénario.

## 10. Seuils, alertes et marge de manœuvre

| Seuil                           | Marge | Déclencheur observable                |
| ------------------------------- | ----- | ------------------------------------- |
| Cible nominale                  | 40 %  | coût chargé médian > 0,0527 € (× 1,8) |
| Minimum acceptable              | 25 %  | coût chargé médian > 0,0936 € (× 3,1) |
| Alerte et révision tarifaire    | 20 %  | coût chargé médian > 0,1072 € (× 3,6) |
| Suspension ou recalcul immédiat | 10 %  | coût chargé médian > 0,1345 € (× 4,5) |

Sur le palier Parcours, hors bonus, au taux de prélèvements retenu de 33,06 %.
À câbler dans le rapport hebdomadaire du ticket V4.5-140. Ces seuils sont plus
serrés que ceux de la version 1.0.0, qui les calculait à 28,00 % de
prélèvements.

**Marge de manœuvre sur le vérificateur.** La réparation de la complaisance
constatée au §3 passera par un autre prompt ou un autre modèle, donc par un coût
différent. Le vérificateur coûte aujourd'hui 0,0014307 € chargé par correction.
La marge du palier Parcours resterait au-dessus de 40 % même s'il coûtait
**17 fois** ce prix, et au-dessus du minimum de 25 % jusqu'à **45 fois** — soit
un vérificateur deux fois plus cher que le modèle primaire lui-même. Le choix
d'un vérificateur fiable n'a donc pas à être arbitré contre la tarification.

Ces multiples remplacent les 31× et 65× de la version 1.0.0, qui les calculaient
avant le durcissement de l'hypothèse fiscale. La conclusion est inchangée.

## 11. Décisions du Propriétaire

### Rendues le 31 août 2026

1. **Qualification BIC ou BNC** : le **BNC** est retenu, comme choix
   conservateur sur une frontière réellement ambiguë (§6). La grille tient dans
   les deux qualifications, donc cet arbitrage ne conditionne plus l'activation ;
   il fixe le montant à provisionner.
2. **ACRE** : écartée. La micro-entreprise a été créée en début d'année 2026 et
   le délai de demande de 60 jours est écoulé. Aucune projection ne s'appuie
   dessus.
3. **Versement libératoire** : non détenu, non retenu. La règle de décision pour
   la fenêtre du 30 septembre 2026 est au §6 : opter si le foyer est imposable,
   ne pas opter sinon.
4. **TVA sur les achats OpenRouter** : autoliquidation à 20 % non déductible,
   déjà portée par le facteur `×1,20` du §4. La demande de numéro de TVA
   intracommunautaire auprès du service des impôts des entreprises reste à faire
   et doit précéder l'ouverture commerciale.
5. **Bornes de l'avantage early adopter** : 100 premiers comptes ou 31 octobre
   2026, au premier des deux atteint, bonus unique par compte, sans reconduction
   (§8). Modifiables tant qu'aucun prix n'est activé.

### Restantes

6. **Conditions générales de vente** : report des crédits,
   non-transférabilité, non-convertibilité en espèces, usage limité à LearnX,
   procédure de remboursement et de clôture de compte, et affichage des bornes
   de l'avantage early adopter avant l'achat.
7. **GO d'activation** des paliers, distinct de la validation des montants et
   subordonné à la promotion de l'identité de correction (§3).

## 12. Ce qui n'est pas chiffrable en l'état

**La génération de programmes.** La capacité `ai.program.generate` existe dans
`src/server/api/_lib/capabilities.ts` mais n'est attribuée à aucun rôle, aucun
modèle n'est promu pour cet usage, aucun benchmark n'existe et aucun appel n'a
jamais été facturé. Aucun volume de programmes générables ne peut être annoncé.

Une borne plancher établie depuis le volume du contenu publié — une seule
passe, sans itération ni revue, hypothèse fausse par construction — situe la
génération d'un cursus d'une année à au moins 17,67 € de coût chargé, soit un
palier à 87 € minimum pour tenir 40 % de marge, et vraisemblablement 150 à
350 € avec un processus de production réaliste. Générer coûte trois à quatre
fois plus que corriger l'intégralité de ce qui a été généré.

Un obstacle d'architecture précède ce chiffrage : toute la correction repose sur
une rubrique publiée et authorée. Générer le programme *et* sa rubrique, puis
corriger contre cette rubrique auto-produite, ferait du modèle l'auteur du
barème et son propre correcteur, ce qu'`ADR_003` interdit.

**L'abonnement.** Un pack se dimensionne sur un coût unitaire, connu. Un
abonnement se dimensionne sur une consommation observée, inconnue : nombre de
corrections par apprenant actif et par mois, régularité, durée de vie, taux de
rachat. Le frais fixe Stripe se répète à chaque échéance — un abonnement à
4 €/mois paie 3,00 € de frais fixes par an, soit 6,2 % du chiffre d'affaires,
contre 0,5 % pour le même montant vendu en un pack annuel. Stripe Billing
ajoute 0,7 % du volume traité.

Recommandation de séquencement : câbler dès le ticket V4.5-161 une provenance
d'allocation récurrente distincte de `PURCHASED`, avec expiration séparée, pour
éviter une migration de solde ultérieure ; n'activer un abonnement qu'après
trois mois de consommation observée, et garder deux compteurs séparés —
allocation d'abonnement expirante, crédits achetés reportables.

## 13. Réserves de trésorerie

Pour 1 € encaissé sur le palier Parcours, scénario retenu, bonus inclus.
Montants arrondis au millième.

| Poche                           | Part        | Disponible ?          |
| ------------------------------- | ----------- | --------------------- |
| Frais Stripe                    | 0,046 €     | non, déjà prélevé     |
| Réserve sociale et fiscale      | 0,331 €     | non, dette exigible   |
| Réserve d'exécution             | 0,131 €     | non, service à livrer |
| Réserve d'incidents             | 0,030 €     | non, aléa provisionné |
| **Marge réellement disponible** | **0,461 €** | oui                   |

Les crédits vendus et non consommés ne sont pas de la marge disponible. Sur
1 000 € de packs encaissés, environ **492 €** doivent rester immobilisés tant
que les crédits n'ont pas été consommés et les échéances Urssaf payées — contre
440 € en version 1.0.0, l'écart venant du durcissement fiscal. La cotisation
foncière des entreprises, due à partir de décembre 2027, se provisionne en
dehors de ce partage : c'est un coût fixe, il n'appartient pas à la marge de
contribution.

La dette d'exécution se valorise au coût médian pour la projection retenue et
au P90 pour la réserve prudente. Sous règlement au prorata du coût, les deux
valeurs sont proches : si le coût réel monte, le prix débité monte
proportionnellement et le nombre de corrections finançables baisse. Ce qui varie
n'est pas l'exposition financière mais la capacité annoncée — d'où l'obligation
d'annoncer une capacité médiane et jamais un nombre garanti.

## 14. Risques de vente à perte

| Risque                          | Ampleur                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Contestation sur le palier bas  | 23,30 € de perte, soit la contribution de 16 packs sains ; la provision de 3 % ne tient que jusqu'à 0,39 % de taux de litige sur ce palier |
| Rachats répétés du petit palier | 8,3 % du chiffre d'affaires en frais fixes ; neutralisé par la limite d'un achat      |
| Carte internationale            | −3,7 points de marge ; tenu dans le scénario défavorable                              |
| Carte premium européenne        | −1,3 point, non détectable avant paiement ; couvert par la provision                  |
| Queue de coût                   | maximum observé 0,076 € chargé ; une correction ne devient déficitaire qu'au-delà de 0,30 € |
| Changement de vérificateur      | invalide la mesure du §4 ; sans effet sur la viabilité de la grille (§10)             |

## 15. Conditions de recalcul

Ce document devient caduc et doit être recalculé si l'un des événements suivants
survient.

**Exécution** : changement du modèle primaire ou du vérificateur, changement de
leur prompt ou de leur profil de requête, changement du tarif fournisseur,
fixation d'un taux de change USD/EUR, ou ouverture de la correction aux
évaluations d'étape (ticket V4.5-130), qui ajoutera 33 exercices facturables au
contenu publié.

**Fiscalité** : requalification en BIC par l'Urssaf, franchissement de 17 600 €
de chiffre d'affaires annuel — au-delà, l'impôt sur le revenu devient
effectivement dû et le taux retenu de 33,06 % cesse d'être prudent —, entrée
dans la tranche marginale de 30 %, option pour le versement libératoire,
franchissement de 37 500 € de chiffre d'affaires qui met fin à la franchise en
base de TVA, ou changement du traitement de la TVA sur les achats OpenRouter.

## 16. Reproductibilité

Les chiffres du §4 se recalculent depuis
`benchmarks/ai-correction/regression/results/2026-08-30T22-21-08-937Z/ledger.jsonl`
selon la méthode déclarée au §4 : cellule `(caseId, candidateId, repetition)`,
un enregistrement par valeur d'`attempt`, coût de la correction égal à la somme
de ses tentatives, percentile en rang le plus proche. Ils sont identiques à ceux
de `measured-costs.v2`, qui porte la même méthode. Les artefacts de
`benchmarks/` sont en ajout seul et ne doivent pas être modifiés.

La version 1.1.0 publiait une distribution primaire différente — P90 0,032591
sur 216 corrections — qui n'est reproductible sous **aucune** des six
définitions testées contre ce registre. Le n de 216 correspond aux cellules
exemptes de doublon, mais cette série donne 0,029982, et non 0,032591. Elle est
retirée, pas corrigée : elle faisait autorité sans méthode déclarée, ce qui est
exactement le défaut que la voie AI Research a mis au jour. Un percentile sans
méthode n'est pas un chiffre.

Les tarifs Stripe et les taux sociaux et fiscaux proviennent de sources
publiques externes, datées au §5 et au §6, et ne sont pas reproductibles depuis
le dépôt.
