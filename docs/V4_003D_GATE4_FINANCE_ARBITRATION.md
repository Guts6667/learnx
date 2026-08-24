# V4-003D — Enveloppe Finance du nouveau gate quatre cas

- **Statut** : `FINANCE_ARBITRATED`
- **Date** : 21 août 2026
- **Identité** : `cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31`
- **Appel modèle, achat, holdout ou activation** : aucun
- **Autorisation réseau propriétaire** : non accordée

## 1. Décision

Finance arbitre pour le seul gate quatre cas :

- coût fournisseur maximal par tentative : **0,177082 USD** ;
- quatre tentatives maximum, une par cas ;
- plafond fournisseur total : **0,708328 USD** ;
- zéro retry et zéro fallback ;
- arrêt au premier défaut ;
- reliquat non transférable à une autre campagne ;
- coût réel `ACTUAL` obligatoire pour toute tentative envoyée.

Cette enveloppe n'est ni un prix utilisateur, ni une permission d'appel, ni une
activation. Le panel 10 × 2 et le holdout en sont exclus.

L'artefact machine est :

`benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json`

Empreinte :

`256431012e251498ae021c2bf14f6e11f8373e8baf4117a0bcc7f8436a88e765`

## 2. Tarif vérifié

Le catalogue public OpenRouter a été relu le 21 août 2026 pour la route exacte
`Anthropic` de `anthropic/claude-sonnet-5` :

- entrée : `0,000002 USD/token` ;
- sortie : `0,000010 USD/token` ;
- cache read : `0,0000002 USD/token` ;
- cache write 5 minutes : `0,0000025 USD/token` ;
- cache write 1 heure : `0,000004 USD/token` ;
- remise : `0`.

La borne ne suppose ni cache ni promotion. Le snapshot est consigné dans
`sonnet-5-anthropic-pricing-snapshot-2026-08-21.json`.

## 3. Borne par tentative

Le runner v2 n'est pas encore sérialisé. Une taille moyenne ou un prompt mesuré
serait donc une fausse précision. La décision retient un plafond architectural
vérifiable avant dispatch : **65 536 octets UTF-8** pour l'ensemble des messages
sérialisés.

Le calcul reste volontairement pessimiste : un octet est compté comme un token,
puis le schéma et une provision transport sont ajoutés.

| Composant | Borne |
| --- | ---: |
| Messages sérialisés | 65 536 |
| Schéma structuré | 477 |
| Provision transport | 2 048 |
| Entrée facturable majorée | 68 061 tokens |
| Sortie maximale | 4 096 tokens |

Calcul :

`68 061 × 0,000002 + 4 096 × 0,000010 = 0,177082 USD`.

Le runner doit échouer **avant le réseau** si les messages dépassent 65 536
octets. Si cette limite s'avère insuffisante pendant l'implémentation hors
ligne, il faut une nouvelle enveloppe Finance ; elle ne peut pas être relevée
silencieusement.

## 4. Borne du gate

`4 × 0,177082 = 0,708328 USD`.

Le contrôle avant chaque appel vérifie que le budget restant couvre encore une
tentative au plafond. La stop-policy peut donc réduire la dépense réelle, mais
jamais augmenter le nombre de tentatives.

## 5. Stress de trésorerie, sans prix produit

Les facteurs Finance historiques sont présentés séparément du plafond
fournisseur :

| Hypothèse | Exposition maximale USD-éq |
| --- | ---: |
| Fournisseur seul | 0,708328 |
| Approvisionnement OpenRouter ×1,055 | 0,747286040 |
| Approvisionnement + TVA défavorable ×1,266 | 0,896743248 |
| Précédent + coussin FX 3 % ×1,30398 | 0,923645545 |

Aucune conversion EUR n'est appliquée et aucun de ces montants ne calibre un
pack ou un prix utilisateur.

## 6. Réconciliation obligatoire

Pour toute tentative `SENT`, `CONFIRMED` ou `ORPHANED` :

- `actualCostUsd=null` implique `RECONCILIATION_REQUIRED`, même sans identifiant
  fournisseur ;
- le coût absent n'est jamais traité comme zéro ;
- aucun règlement, libération définitive ou publication de résultat avant
  réconciliation ;
- un timeout après dispatch ou un résultat orphelin ferme immédiatement le
  gate selon la stop-policy ;
- `requestedRoute` et `observedProvider` restent séparés.

## 7. Ce que Finance ouvre — et n'ouvre pas

L'arbitrage rend `V4-009C-S2` reprenable **hors ligne** pour :

1. adapter le runner au compilateur v2 et au dossier gelé ;
2. prouver les empreintes, le plafond de 65 536 octets, l'idempotence et la
   réconciliation avec un faux provider ;
3. produire le préflight `HARD_OFF`.

Il n'autorise pas le réseau. Après ces preuves, Rayan devra autoriser
explicitement le modèle, les quatre données synthétiques, quatre appels
maximum et le plafond fournisseur de `0,708328 USD`.

## 8. Limites

- Cette borne est prudente, pas une estimation de dépense moyenne.
- Les coûts réels P50/P75/P90 ne seront calculables qu'après des workflows
  réconciliés.
- Le panel 10 × 2 exigera une nouvelle enveloppe calculée à partir du runner
  effectivement validé et des mesures du gate.
- Toute modification du modèle, de la route, du profil, du corpus, du mapping,
  du runner ou de la stop-policy invalide cette enveloppe.

## 9. Preuves de validation hors ligne

Le 21 août 2026, après gel de l'enveloppe :

- tests ciblés V4-003C/V4-003D/routage/manifeste : **18/18** ;
- suite complète : **1 127/1 127 tests** ;
- lint : valide ;
- typecheck : valide ;
- build de production : valide.

Ces preuves valident la cohérence documentaire et machine de l'enveloppe. Elles
ne valident ni le comportement du futur runner, ni la qualité du modèle, ni une
autorisation réseau.
