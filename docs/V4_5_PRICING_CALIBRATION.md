# Calibration économique et proposition tarifaire V4.5

- **Statut** : `OWNER_VALIDATED_PRICES_NOT_ACTIVATED` (V4.5-007 / ticket V4.5-164)
- **Version** : 1.0.0
- **Date** : 31 août 2026
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

Les questions fiscales et juridiques sont listées au §11 comme **décisions du
Propriétaire**, jamais comme hypothèses retenues par Finance.

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

La distribution par correction est reconstruite en regroupant les
enregistrements primaires par cellule et en ne conservant qu'un enregistrement
par numéro de tentative — une correction ne peut porter qu'une tentative
initiale et au plus une reprise ; tout enregistrement supplémentaire est une
relance en double de l'outillage de répétitions, et n'est pas un coût de
production.

| Distribution                | Médiane      | P75      | P90      | Maximum  |
| --------------------------- | ------------ | -------- | -------- | -------- |
| Primaire, par correction    | 0,021828     | 0,023998 | 0,032591 | 0,056868 |
| Vérificateur, par appel     | 0,0010972    | —        | 0,0012771 | 0,0015807 |
| **Workflow logique complet** | **0,022925** | 0,025105 | 0,033868 | 0,058449 |

En dollars, sur 216 corrections primaires et 209 appels vérificateur. Le
vérificateur pèse **5,07 %** du coût primaire. Le P90 du workflow additionne le
P90 primaire et le P90 vérificateur : l'approximation va dans le sens prudent.

### Chargement

Les paramètres économiques déjà retenus par LearnX sont appliqués séparément :
approvisionnement OpenRouter `×1,055`, TVA non récupérable `×1,20`, coussin de
change `×1,03`, facteur cumulé `×1,30398`.

| Poste                          | Médiane      |
| ------------------------------ | ------------ |
| Coût fournisseur du workflow   | 0,022925     |
| + approvisionnement 5,5 %      | +0,001261    |
| + TVA non récupérable 20 %     | +0,004837    |
| + coussin de change 3 %        | +0,000871    |
| **Coût chargé final**          | **0,029894** |

Coût chargé au P75 : `0,032737`. Au P90 : `0,044163`. Maximum observé :
`0,076216`.

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

Taux 2026, issus de sources publiques secondaires consultées le 30 août 2026.
**Ils doivent être confirmés auprès de l'Urssaf ou d'un professionnel avant
activation** (§11).

| Régime                                    | Cotisations | CFP    | VFL    | Total sur CA |
| ----------------------------------------- | ----------- | ------ | ------ | ------------ |
| micro-BIC prestations de services, VFL    | 21,20 %     | 0,10 % | 1,70 % | 23,00 %      |
| micro-BNC, VFL                            | 25,60 %     | 0,20 % | 2,20 % | 28,00 %      |
| micro-BNC, sans VFL, TMI 11 %             | 25,60 %     | 0,20 % | 7,26 % | 33,06 %      |
| micro-BIC + VFL + ACRE, première année    | 15,90 %     | 0,10 % | 1,70 % | 17,70 %      |

En micro-entreprise, les dépenses Stripe, OpenRouter et infrastructure **ne
réduisent pas** le chiffre d'affaires servant d'assiette aux cotisations. Un
pack encaissé 8 € est déclaré 8 €.

La franchise en base de TVA s'applique jusqu'à 37 500 € de chiffre d'affaires
de services : le prix affiché est le prix encaissé, sans TVA à reverser. En
contrepartie, l'achat de services B2B auprès d'un prestataire étranger relève
de l'autoliquidation, à 20 % non déductibles — ce qui justifie le facteur
`×1,20` du §4 comme scénario réaliste et non pessimiste.

La CFE est exonérée l'année de création ; c'est ensuite un coût fixe, hors
marge de contribution, à provisionner séparément.

## 7. Parité, prix unitaire et plafond

La parité de **100 crédits par euro** est conservée. Elle est déjà active
(catalogue `4.0.0`, migration `20260824192628_activate_bounded_writing_pilot_catalog`),
le grand livre des crédits offerts s'y appuie, et la granularité au centime est
ce qui rend le mécanisme de libération réellement lisible : avec une unité plus
grossière, la différence entre le plafond réservé et le prix réglé disparaîtrait
dans l'arrondi.

- **Prix d'une correction : 30 crédits**, soit 0,30 €.
- **Plafond de réservation : 45 crédits**, soit 0,45 €.

Le plafond n'est pas un arrondi de confort. Le rapport entre le P90 et la
médiane du coût chargé par correction vaut `0,044163 / 0,029894 = 1,4773` ;
`30 × 1,4773 = 44,3`, arrondi au crédit supérieur.

Mécanique de règlement :

```
devis affiché          : 30 crédits — plafond : 45 crédits
réservation            : 45 crédits
règlement              : min(45, arrondi_supérieur(30 × coût_réel / coût_médian))
libération             : 45 − règlement, immédiatement
résultat inutilisable  : règlement 0, libération 45, coût fournisseur absorbé
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
| Prix affiché par correction    | 0,30 €    | 0,28 €   | 0,24 €   |
| Capacité médiane annoncée      | 10        | 29       | 66       |
| Capacité prudente au plafond   | 6         | 19       | 44       |
| Frais Stripe, carte EEE        | 0,295 €   | 0,370 €  | 0,490 €  |
| Prélèvements micro, BNC + VFL  | 0,840 €   | 2,240 €  | 4,480 €  |
| Coût d'exécution couvert       | 0,359 €   | 1,036 €  | 2,392 €  |
| Provisions, 3 %                | 0,090 €   | 0,240 €  | 0,480 €  |
| **Contribution disponible**    | **1,416 €** | **4,114 €** | **8,158 €** |

Coût d'exécution et contribution calculés bonus early adopter inclus et
consommation intégrale supposée.

Deux règles accompagnent la grille :

- le nombre de crédits par euro **croît avec la taille du palier**, ce qui
  finance la dégressivité affichée par l'économie de frais fixes réalisée ;
- le palier Démarrage est **limité à un achat par compte**. Acheter 24 € de
  crédits par tranches de 3 € coûterait 2,00 € de frais fixes, soit 8,3 % du
  chiffre d'affaires, contre 0,38 € — 1,6 % — pour le même montant acheté au
  palier Année.

### Avantage early adopter

Un **bonus unique de 20 % en crédits**, jamais une remise sur le prix. Pour un
avantage affiché identique sur le palier Parcours, la remise coûte 1,215 € de
chiffre d'affaires abandonné contre 0,178 € de coût d'exécution supplémentaire,
soit **6,8 fois plus cher**. Le bonus n'est de surcroît consommé que s'il est
utilisé.

L'avantage doit être borné par une période, un nombre maximal de bénéficiaires,
un bonus unique par compte, une date de fin affichée avant l'achat, et l'absence
de renouvellement automatique sauf décision explicite. Aucun crédit illimité,
aucune garantie tarifaire perpétuelle.

## 9. Marges de contribution

`contribution = prix − Stripe − prélèvements_CA − coût_exécution − provisions`

| Scénario                            | Démarrage | Parcours | Année  |
| ----------------------------------- | --------- | -------- | ------ |
| Favorable                           | 62,2 %    | 66,5 %   | 66,9 % |
| Central                             | 49,2 %    | 53,4 %   | 53,5 % |
| Défavorable                         | 36,5 %    | 40,7 %   | 40,6 % |
| Central, bonus early adopter inclus | 47,2 %    | 51,4 %   | 51,0 % |
| Défavorable, bonus inclus           | 34,4 %    | 38,5 %   | 37,9 % |

Définition des scénarios :

| Paramètre               | Favorable        | Central       | Défavorable            |
| ----------------------- | ---------------- | ------------- | ---------------------- |
| Carte                   | EEE standard     | EEE standard  | internationale         |
| Régime                  | BIC + VFL + ACRE | BNC + VFL     | BNC sans VFL, TMI 11 % |
| Taux sur CA             | 17,70 %          | 28,00 %       | 33,06 %                |
| TVA fournisseur         | hors champ       | 20 % non déd. | 20 % non déd.          |
| Chargement              | ×1,08665         | ×1,30398      | ×1,30398               |
| Point de la distribution | médiane         | médiane       | P75                    |
| Provisions              | 2 %              | 3 %           | 6 %                    |

La cible nominale de 40 % est tenue partout en scénario central, et sur les
deux paliers hauts en scénario défavorable. Le palier Démarrage descend à
36,5 % dans le pire cas — c'est le coût assumé d'un ticket d'entrée accessible,
et il reste très au-dessus du minimum acceptable de 25 %.

`prix_minimal = (coûts_fixes + coût_exécution + provisions) / (1 − taux_Stripe − taux_micro − taux_CFP − taux_VFL − marge_cible)`

Si le dénominateur devient nul ou négatif, le palier est économiquement
impossible dans ce scénario.

## 10. Seuils, alertes et marge de manœuvre

| Seuil                          | Marge | Déclencheur observable                 |
| ------------------------------ | ----- | -------------------------------------- |
| Cible nominale                 | 40 %  | —                                      |
| Minimum acceptable             | 25 %  | coût chargé médian > 0,1074 € (× 3,6)  |
| Alerte et révision tarifaire   | 20 %  | coût chargé médian > 0,1210 € (× 4,0)  |
| Suspension ou recalcul immédiat | 10 % | coût chargé médian > 0,1483 € (× 5,0)  |

Sur le palier Parcours, hors bonus. À câbler dans le rapport hebdomadaire du
ticket V4.5-140.

**Marge de manœuvre sur le vérificateur.** La réparation de la complaisance
constatée au §3 passera par un autre prompt ou un autre modèle, donc par un
coût différent. La marge du palier Parcours resterait au-dessus de 40 % même si
le vérificateur coûtait **31 fois** son prix actuel, et au-dessus du minimum de
25 % jusqu'à **65 fois** — soit un vérificateur aussi cher que trois modèles
primaires. Le choix d'un vérificateur fiable n'a donc pas à être arbitré contre
la tarification.

## 11. Décisions du Propriétaire

Ces points ne sont pas des hypothèses de Finance. Ils restent ouverts et
conditionnent l'activation.

1. **Qualification BIC ou BNC**, à confirmer avec l'Urssaf ou un professionnel.
   L'écart est de 5 points de chiffre d'affaires, soit plus que le coût IA
   complet d'un palier. Le BNC avec versement libératoire est retenu comme
   hypothèse prudente de planification, pas comme qualification établie.
2. **Éligibilité à l'ACRE** et date de création de la micro-entreprise.
3. **Traitement de la TVA sur les achats OpenRouter** (autoliquidation,
   identification, non-déductibilité), à confirmer auprès du service des
   impôts des entreprises.
4. **Conditions générales de vente** : report des crédits, non-transférabilité,
   non-convertibilité en espèces, usage limité à LearnX, procédure de
   remboursement et de clôture de compte.
5. **Mentions de l'avantage early adopter** : période, plafond de
   bénéficiaires, date de fin, absence de reconduction.
6. **GO d'activation** des paliers, distinct de la validation des montants.

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

Pour 1 € encaissé sur le palier Parcours, scénario central, bonus inclus.

| Poche                         | Part    | Disponible ?         |
| ----------------------------- | ------- | -------------------- |
| Frais Stripe                  | 0,043 € | non, déjà prélevé    |
| Réserve sociale et fiscale    | 0,280 € | non, dette exigible  |
| Réserve d'exécution           | 0,130 € | non, service à livrer |
| Réserve d'incidents           | 0,030 € | non, aléa provisionné |
| **Marge réellement disponible** | **0,517 €** | oui              |

Les crédits vendus et non consommés ne sont pas de la marge disponible. Sur
1 000 € de packs encaissés, environ 440 € doivent rester immobilisés tant que
les crédits n'ont pas été consommés et les échéances Urssaf payées.

La dette d'exécution se valorise au coût médian pour la projection centrale et
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
survient : changement du modèle primaire ou du vérificateur, changement de leur
prompt ou de leur profil de requête, changement du tarif fournisseur, fixation
d'un taux de change USD/EUR, qualification fiscale différente de l'hypothèse du
§9, ou ouverture de la correction aux évaluations d'étape (ticket V4.5-130), qui
ajoutera 33 exercices facturables au contenu publié.

## 16. Reproductibilité

Tous les chiffres du §4 se recalculent depuis
`benchmarks/ai-correction/regression/results/2026-08-30T22-21-08-937Z/ledger.jsonl`
en regroupant les enregistrements du modèle primaire par `caseId` et en ne
conservant qu'un enregistrement par valeur de `attempt`. Les artefacts de
`benchmarks/` sont en ajout seul et ne doivent pas être modifiés.

Les tarifs Stripe et les taux sociaux et fiscaux proviennent de sources
publiques externes, datées au §5 et au §6, et ne sont pas reproductibles depuis
le dépôt.
