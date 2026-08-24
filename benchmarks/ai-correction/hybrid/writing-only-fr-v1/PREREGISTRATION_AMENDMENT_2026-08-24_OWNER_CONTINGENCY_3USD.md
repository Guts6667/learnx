# Amendement de préenregistrement — contingency propriétaire à 3 USD

- **Identifiant** : `WRITING_EXAM_OWNER_CONTINGENCY_3USD_2026_08_24`
- **Autorisé à** : `2026-08-24T12:51:53Z`
- **Moment** : après gel des propositions et des annotations croisées, avant
  ouverture de leurs correspondances, avant sélection/scellement du corpus et
  avant toute sortie candidate
- **Ancien plafond fournisseur** : `2,18 USD`
- **Nouveau plafond fournisseur absolu** : `3,00 USD`
- **Appel réseau ou modèle** : aucun

Rayan a donné la contingency explicite : « tu peux consommer jusqu'à 3$ ».
Cet amendement modifie uniquement l'enveloppe financière du futur examen. Il ne
modifie ni corpus, gold, prompt, modèle, route, seuil qualité, garde ±5, règle
d'accord inter-auteurs, nombre de répétitions ou politique de retry.

Le préflight final est recalculé sur le corpus scellé avec `3,00 USD` :

1. si le coût conservateur des 72 primaires et des retries bornés (zéro) dépasse
   `3,00 USD`, verdict `CONTINGENCY_REQUIRED`, zéro appel ;
2. sinon, les 72 primaires sont tous réservés puis exécutés avant toute seconde
   passe ;
3. seules les secondes passes qui tiennent dans le reliquat réel peuvent être
   envoyées ; les autres portent
   `SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET` ;
4. le garde fournisseur ne peut jamais interrompre la phase primaire après son
   premier appel.

Sur la borne préliminaire déjà consignée, `2,399544 USD` pour 72 primaires
laisserait `0,600456 USD`. Ce nombre reste un signal de faisabilité, pas le
préflight final : celui-ci doit être lié par digest aux requêtes du corpus
effectivement scellé.
