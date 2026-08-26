# V4-010-R2 — limite des productions textuelles

## Verdict

**GATE AUTOMATIQUE PASSÉ — BORNE V4 FERMÉE À 1 500 CARACTÈRES**

La V4 ne crée pas de classe tarifaire longue sans mesure ni arbitrage Finance.
Elle accepte une production de 1 500 caractères et refuse une production de
1 501 caractères avant sa soumission. Ce refus intervient donc avant tout
devis, réservation de crédits ou appel modèle.

## Contrat vérifié

- le champ annonce en permanence le compteur et la borne de 1 500 caractères ;
- l'attribut natif `maxlength` bloque une nouvelle saisie au-delà de la borne ;
- un ancien brouillon ou un payload direct de 1 501 caractères est signalé et
  ne peut être ni enregistré ni soumis ;
- le serveur répète la même validation et ne fait confiance ni au navigateur
  ni au client ;
- une réponse exactement égale à la borne reste enregistrable et soumettable ;
- le serveur ne tronque jamais silencieusement un texte trop long ;
- le refus précède l'éligibilité financière : zéro devis, zéro réservation,
  zéro débit et zéro appel fournisseur.

## Preuves automatisées

- `src/lib/exercises.test.ts` : frontière 1 500 / 1 501 ;
- `api/exercises/app.test.ts` : rejet API et contenu stocké inchangé ;
- `src/features/exercises/ExerciseCard.test.tsx` : compteur, message, contrôle
  natif et boutons ;
- `api/free-text-correction.acceptance.test.ts` : une réponse de 1 501
  caractères reste brouillon et ne produit aucune écriture de progression.

Validation ciblée : 4 fichiers, 29 tests verts.

## Limite assumée

La prise en charge de productions supérieures à 1 500 caractères n'est pas
une capacité V4. Elle exige une classe `MEDIUM` ou `LONG`, des coûts P50/P90
mesurés et une décision Finance/Propriétaire. La V4 rend donc cette frontière
explicite et sûre au lieu d'extrapoler un prix ou de tronquer la réponse.
