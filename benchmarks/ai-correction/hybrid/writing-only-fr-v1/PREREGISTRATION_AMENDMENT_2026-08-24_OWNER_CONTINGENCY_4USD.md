# Amendement de préenregistrement — contingency propriétaire à 4 USD

- **Identifiant** : `WRITING_EXAM_OWNER_CONTINGENCY_4USD_2026_08_24`
- **Autorisé à** : `2026-08-24T13:06:21Z`
- **Moment** : avant scellement du corpus et avant toute sortie candidate
- **Plafond précédent** : `3,00 USD`
- **Nouveau plafond fournisseur absolu** : `4,00 USD`
- **Appel réseau ou modèle** : aucun

Rayan a autorisé : « je te laisse 4 $ de buget max ». Cet amendement
supersède uniquement l'enveloppe de 3 USD ; il ne modifie aucun seuil qualité,
gold, corpus, prompt, modèle, route, répétition, garde ou retry.

La borne conservatrice calculée sur le corpus draft est de `3,859497 USD` pour
les 72 primaires et `0 USD` pour les retries. Sous 4 USD, le reliquat théorique
est `0,140503 USD` avant coût réel réconcilié. Le préflight final doit refaire
ce calcul sur le corpus scellé, lier son digest et déterminer mécaniquement le
nombre de secondes passes finançables.

Le plafond reste absolu :

1. si les primaires scellés dépassent 4 USD, zéro appel ;
2. s'ils tiennent, leur enveloppe complète est garantie avant le premier appel ;
3. aucune seconde passe ne peut consommer cette enveloppe ;
4. un manque de budget en phase 2 produit
   `SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET` ;
5. aucune réconciliation financière ne doit transformer le garde budgétaire en
   interruption silencieuse de la phase primaire déjà commencée.
