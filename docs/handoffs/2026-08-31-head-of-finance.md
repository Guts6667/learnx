# Passation — Head of Finance, 31 août 2026

## a. Tâche en cours

Aucune. V4.5-164 est livré : `docs/V4_5_PRICING_CALIBRATION.md` 1.2.0. La PR
**#179** reste à fusionner, après #177.

## b. Fusionné aujourd'hui

- **#158** — 1.0.0 : coûts, chargement, Stripe, prélèvements, paliers validés.
- **#174** — 1.1.0 : arbitrage fiscal BNC, prélèvements de 28 % à 33,06 %.
- **#179, ouverte** — 1.2.0 : plafond de réservation de 45 à 41 crédits.

## c. Blocages

Aucun côté Finance. Deux dépendances : **l'identité de correction n'est pas
promue** (deux gates rouges au 30 août), sans quoi aucun prix n'est activable ;
et **#179 attend #177**, qui apporte `measured-costs.v2`, source du §4.

## d. Erreurs commises, et ce qu'elles ont appris

- **Dossier initial bâti sur `chore/park-v43`**, six jours en retard, donc sur un
  run périmé. *Lister le run le plus récent sur `origin/dev`.*
- **Règle de déduplication fausse** — « garder la tentative suivante si la
  précédente est INVALID » gardait les quatre enregistrements d'une cellule qui
  en portait quatre invalides. Désormais : un enregistrement par `attempt`.
- **P90 publié sans méthode de percentile déclarée** : 0,032591, reproductible
  sous aucune définition testée, donnait 45 crédits au lieu de 41. *Un percentile
  sans méthode n'est pas un chiffre.*
- `p50PerCorrection`/`p90PerCorrection` sont par tentative, pas par correction.

## e. Besoins

Rien techniquement. Tout ce qui manque relève de Rayan, section h.

## f. Prochaine étape

| Étape                                          | Estimation                 |
| ---------------------------------------------- | -------------------------- |
| Fusionner #177 puis #179                       | immédiat                   |
| Activation des packs, V4.5-212 : `credit_pack` | 1 session, après promotion |
| Clés Stripe en production, encaissement réel   | 1 session                  |

La réconciliation du plafond est **close** : 41 crédits, méthode déclarée.

## g. À savoir pour ton successeur

- Paliers **3 / 8 / 16 €** = 300 / 880 / 2 000 crédits, soit 100 / 110 / 125
  crédits par euro. Parité **100 crédits par euro**, déjà active.
- **Une correction coûte 30 crédits, plafond 41.** Devis à la médiane,
  réservation au P90, règlement au coût réel. Le plafond principiel est 37 :
  **41 = 37 plus une marge choisie de 4 crédits**, au bénéfice de LearnX et payée
  en solde retenu à l'apprenant.
- Pack à 3 € **limité à un achat par compte** — Rayan a levé la limite puis l'a
  rétablie dans la minute, le 31 août.
- Early adopter : **+20 % en crédits, jamais une remise**, 7,6 fois plus chère.
- **Micro-BNC, pas d'ACRE, pas de versement libératoire, 33,06 % du chiffre
  d'affaires.** Prudent à dessein : sous 17 600 € l'impôt est nul, taux réel
  25,80 %. Marges retenues **44,1 / 48,4 / 48,4 %**, jamais sous 36,5 % au pire.
- Sources : run `2026-08-30T22-21-08-937Z` et `measured-costs.v2`.
- **Non chiffrable** : la génération de programmes, faute de modèle promu et de
  mesure ; l'abonnement, faute de consommation observée.

## h. Décisions de Rayan et questions restées à lui

Prises oralement le 31 août : les paliers 3/8/16 €, l'arbitrage fiscal délégué à
Finance avec consigne de retenir toujours l'option la plus conservatrice, et le
maintien de la limite d'un achat sur le pack d'entrée. Restent à lui, aucune
n'étant un blocage tarifaire :

1. **Vérifier ses déclarations Urssaf** depuis janvier — mensuelles, dues même à
   zéro, pénalité par déclaration manquante. Le plus urgent.
2. **Demander un numéro de TVA intracommunautaire**, dû depuis le premier achat
   OpenRouter. Cela ne fait pas perdre la franchise en base.
3. **Versement libératoire** : fenêtre au 30 septembre 2026, à n'exercer que si
   le foyer paie de l'impôt.
4. **CGV**, mentions de l'avantage early adopter, et le **GO d'activation**,
   distinct de la validation des montants.
5. Confirmation du BNC auprès de l'Urssaf, utile mais non bloquante. Première
   cotisation foncière des entreprises en décembre 2027.
