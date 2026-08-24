# Amendement de préenregistrement — budget garantissant la phase primaire

- **Identifiant** : `WRITING_EXAM_BUDGET_COMPLETION_2026_08_24`
- **Ajouté à** : `2026-08-24T12:34:12Z`
- **Plafond fournisseur** : `2.18 USD`
- **Répétitions** : 24 cas × 3 = 72 primaires
- **Retries bornés** : `maxRetries=0`, donc pire coût retry = `0 USD`
- **Appel réseau ou modèle** : aucun

## Calcul gelé

Après scellement du corpus et avant tout réseau, le runner produit
`budget-preflight.final.json`, lié par digest à la configuration et au corpus.
Pour chaque cellule, `C_i` est le coût conservateur d'un appel calculé avec le
profil de requête gelé, les tokens d'entrée du cas et la limite maximale de
sortie.

- pire coût primaire : `C_primary = 3 × Σ(C_i)` pour les 24 cas ;
- pire coût retries : `C_retry = 0 × C_primary = 0` ;
- pire coût de toutes les secondes passes : `C_guard_all = C_primary` ;
- pire cas non borné : `C_total_all = 2 × C_primary` ;
- reliquat de garde borné : `B_guard = 2.18 − C_primary`.

Le fichier final consigne les quatre nombres avec leur précision décimale, le
nombre maximal de secondes passes finançables et le digest des entrées. Ce
calcul ne peut pas utiliser la moyenne observée.

## Politique d'exécution

1. Si `C_primary > 2.18`, verdict de préflight `CONTINGENCY_REQUIRED` et zéro
   appel. Le corpus scellé n'est pas brûlé.
2. Sinon, les 72 primaires sont exécutés en premier. Aucune seconde passe ne
   peut consommer leur réserve.
3. Les runs déclenchés par la garde ±5 sont triés par distance absolue au seuil
   croissante, puis `caseId`, puis répétition.
4. Une seconde passe est envoyée seulement si son coût conservateur tient dans
   le reliquat réel. Sinon elle est sautée sans exception et marquée
   `SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET`.
5. Un run dont la seconde passe est sautée ne publie ni score exact ni verdict
   `PASS/FAIL`. Le saut est mesuré et rapporté comme écart de mesure, jamais
   comme succès silencieux ni échec pédagogique du modèle.
6. Le garde budgétaire ne peut jamais interrompre la phase primaire après son
   premier appel. Toute interruption d'identité, de sécurité ou de coût inconnu
   reste distincte de ce garde budgétaire.

Cette option choisit le budget borné de secondes passes plutôt qu'une demande
immédiate de contingency. Une contingency ne sera demandée que si les 72
primaires ne tiennent pas conservativement dans le plafond préenregistré.
