# V4-007 — Calibration du catalogue pilote Writing

Statut : **prêt pour arbitrage propriétaire, aucun prix actif**  
Date : 24 août 2026  
Périmètre : correction `STANDARD`, `writing/fr-FR`, exercice faible risque,
crédits offerts uniquement

## Résultat utile

Le dernier examen Writing fournit enfin une distribution de coût exploitable :
72 workflows logiques, 72 appels primaires, 6 secondes passes automatiques et
aucun retry transport. Le coût fournisseur agrégé est de `1,551831 USD`.

| Mesure par correction | Fournisseur | Chargée défavorable ×1,30398 |
| --- | ---: | ---: |
| Médiane | 0,019680 USD | 0,025662 USD-éq. |
| P75 | 0,021398 USD | 0,027902 USD-éq. |
| P90 | 0,023036 USD | 0,030039 USD-éq. |
| Maximum observé | 0,045228 USD | 0,058976 USD-éq. |

Le facteur chargé conserve les hypothèses prudentes déjà documentées : frais
d'approvisionnement OpenRouter `×1,055`, TVA non récupérable `×1,20` et coussin
de change `×1,03`. Il ne remplace pas une conversion USD/EUR datée.

Le verdict scientifique de l'examen reste `NO-GO`. Ces mesures sont utilisées
uniquement pour dimensionner le pilote produit borné explicitement autorisé ;
elles ne requalifient pas sa qualité pédagogique.

## Limite de la mesure

Les réponses du corpus vont de 176 à 589 caractères : médiane 375,5 et P90
527,8. Il s'agit donc d'une classe courte. Aucune distribution mesurée ne
permet d'activer honnêtement une classe `MEDIUM` ou `LONG`.

Le corpus de coût et l'identité runtime ont le même modèle, fournisseur, prompt
et protocole. Leurs identifiants de benchmark diffèrent : l'examen Writing est
la source de coût, tandis que `learnx-french-text-correction-v3-1` reste le pin
runtime. Cette provenance croisée est conservée explicitement dans l'artefact
machine, jamais masquée.

## Arbitrage demandé à Rayan

L'hypothèse historique `100 crédits/€` transforme le coût chargé médian en
environ 3 crédits, le P90 en environ 4 crédits et le maximum observé en environ
6 crédits. Deux options restent possibles ; aucune n'est activée par ce
document.

### Option A — classe mesurée stricte

- réponse limitée à 600 caractères ;
- estimation : 3 crédits ;
- réservation maximale : 4 crédits ;
- avantage : le plafond correspond directement à la classe mesurée et à son
  P90 ;
- limite : 600 caractères peuvent être contraignants pour traiter les deux
  projets du pilote.

### Option B — pilote produit borné

- réponse limitée à 1 500 caractères ;
- estimation : 3 crédits ;
- réservation maximale : 6 crédits ;
- avantage : réponse plus naturelle et réserve couvrant le maximum chargé
  observé ;
- limite : l'extension de taille est une extrapolation prudente, pas un P90
  directement mesuré sur cette classe.

**Recommandation produit : option B pour le pilote fermé.** Elle rend l'exercice
réellement utilisable sans vendre cette capacité au public. La différence entre
6 crédits réservés et 3 crédits réglés est libérée immédiatement. Les
dépassements éventuels restent absorbés et signalés par LearnX.

## Invariants d'activation

- catalogue `DRAFT` jusqu'à validation explicite de l'option et de la parité ;
- `STANDARD` uniquement ; `DETAILED`, `REINFORCED` et `RECONSIDERATION`
  restent inactifs ;
- crédits offerts uniquement, aucun pack, SKU ou paiement public ;
- identité modèle/fournisseur/prompt/protocole strictement égale au pin runtime ;
- seconde passe du même modèle incluse dans le plafond ;
- quote indisponible au-delà de la borne retenue ;
- aucune modification du verdict scientifique `NO-GO` ;
- date d'effet explicite et version immuable lors de l'activation.

## Preuve reproductible

L'artefact
`benchmarks/ai-correction/pricing/writing-pilot-calibration-2026-08-24.json`
lie par SHA-256 les tentatives, le corpus scellé et le verdict terminal. Il
porte les distributions, les hypothèses chargées, les deux options et un
champ `ownerDecision` nul. Le catalogue reste donc fermé par défaut.
