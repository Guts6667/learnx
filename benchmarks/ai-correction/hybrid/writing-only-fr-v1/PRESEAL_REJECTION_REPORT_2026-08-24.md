# Examen Writing — rapport terminal de pré-scellement

## Verdict

**NO_GO_PRESEAL_CORPUS** — le corpus draft n'est pas scellé et aucun appel
modèle n'a été effectué.

Ce verdict ne juge ni Claude Sonnet 4.6 ni le pipeline Writing. Il signifie que
le dernier contrôle éditorial autorisé a détecté quatre étalons qui ne peuvent
pas être déduits sans ambiguïté de leur dossier. Les utiliser dans un examen
aurait rendu impossible la distinction entre une erreur du modèle et une
erreur de l'oracle.

## Ce qui est conforme

- 20 cas sur 24 passent la revue autonome ;
- 0 désaccord sur 144 niveaux lors du cross-label indépendant ;
- 0 désaccord sur la bande de garde et la nécessité d'une seconde passe ;
- les trois sondes de contraintes dures sont correctement construites ;
- les quatre injections restent des données non fiables et ne contaminent pas
  les golds ;
- la matrice Writing couvre 4 archétypes × 6 profils, avec 12 sélections A et
  12 sélections B ;
- `humanReviewApproved` reste honnêtement à `false`.

## Les quatre blocages

1. `author-b-explanatory-analysis-erroneous-decidable` : le texte écrit
   `16` au lieu de `18`, mais la sémantique gelée ne tranche pas mécaniquement
   entre `partial` et `limited`. Ce choix change aussi l'entrée dans la garde.
2. `author-b-reflective-note-complete-concise` : « mon exemple » attribue une
   action personnelle alors que le contexte ne nomme aucun acteur.
3. `author-b-reflective-note-erroneous-decidable` : « ma clé » introduit la
   même agence non établie ; le classement de `10/20` au lieu de `8/20` entre
   `partial` et `limited` reste également indécidable.
4. `author-b-reflective-note-prompt-injection` : « je les ai placées » invente
   l'identité de l'acteur. La sonde d'injection elle-même est valide.

## Budget et exécution

- plafond propriétaire disponible : `4,00 USD` ;
- dépense fournisseur : `0 USD` ;
- appels primaires : `0/72` ;
- secondes passes : `0` ;
- corpus : `DRAFT_REJECTED_NOT_SEALED`, donc non consommé par un candidat.

La borne conservatrice de `3,859497 USD` n'est pas le motif d'arrêt. Le budget
était suffisant pour garantir les 72 primaires ; le corpus ne franchit pas le
gate éditorial préalable.

## Chaîne de preuve

- sélection corrigée :
  `57642f8cd04c4699267b1bd650cf9d6e723160217420f544e5b4a1bbd58ef453` ;
- corpus draft :
  `a0940fb52bf1a3e2c847d04c9a42e1b2cf11b78c4743b83d496a751d34d4fd53` ;
- revue autonome finale :
  `01fc1f9e77be16a3cd18fdbb802fc07c48816f7cb0fe968931b6a0b8dcf5706e` ;
- autorisation budgétaire à 4 USD :
  `453e3ba2142ce64f119aa36f6b1377424a8554801ce57559e1dff6169407e493` ;
- décision terminale :
  `acc3b2639b7a413610e5be075633c570b1902a38940c72ec294dd91671f94f7c`.

La comparaison initiale et sa première revue sont conservées comme preuves
historiques mais marquées `SUPERSEDED` dans la décision terminale, car leur
alternance A/B utilisait l'ordre lexicographique au lieu de l'ordre `cellIds`
préenregistré.

## Arrêt méthodologique

Cette itération s'arrête ici : aucun nouvel auteur, aucune revue éditoriale
supplémentaire, aucune correction spontanée et aucun appel modèle. Une future
itération nécessiterait une nouvelle autorisation explicite pour remplacer les
quatre cellules fautives et les soumettre à un nouveau processus préenregistré.
