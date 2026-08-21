# Funnel d'authoring — contrat de correction V4

- **Statut** : `APPROVED_FOR_OFFLINE_USE`
- **Version** : `1.0.0`
- **Portée** : premier contrat `WRITING/fr-FR`, texte, faible risque
- **Autorité** : Produit et pédagogie, avec approbations explicites du
  Propriétaire

Ce funnel transforme une activité existante en contrat de feedback autonome.
Il ne crée pas un programme complet et ne remplace pas le futur funnel V5.

## 1. Gate d'éligibilité de l'activité

Avant tout authoring, répondre oui à toutes les questions :

- la production est-elle textuelle, en français et à faible risque ?
- la consigne demande-t-elle des propriétés observables dans la réponse ?
- ces propriétés peuvent-elles être séparées sans jugement holistique ?
- une abstention ou une clarification est-elle acceptable ?
- le feedback peut-il rester sans effet sur la progression ?

Sinon, l'activité est `UNSUPPORTED_AUTONOMOUSLY` pour le MVP.

**Arbitrage Propriétaire 1** : confirmer l'activité pilote et sa consigne.

## 2. Définir l'objectif borné

Écrire une phrase :

> À partir de cette réponse, LearnX peut établir si…

La phrase décrit une conformité observable, pas la psychologie, le potentiel ou
la maîtrise générale de l'apprenant.

## 3. Authorer les critères

Pour chaque critère :

- une seule question pédagogique ;
- un label compréhensible ;
- trois niveaux réellement atteignables ;
- aucun recouvrement implicite avec un autre critère ;
- aucun style, longueur ou orthographe exigé sans décision explicite.

Le nombre de critères découle de la cohérence pédagogique, pas d'un quota.

## 4. Décomposer en éléments atomiques

Chaque élément possède :

- `key` stable ;
- type `FACT`, `RELATION`, `JUSTIFICATION` ou `CONTRADICTION` ;
- critère propriétaire ;
- obligation et niveau à partir duquel il est requis ;
- exemples positifs, négatifs et variantes acceptables ;
- règle de preuve ;
- contradictions possibles ;
- exclusions ;
- remédiation et templates authorés.

Un élément `HOLISTIC` rend le critère non pleinement compilable.

## 5. Propriété et double pénalisation

Construire une table « défaut → propriétaire → critères interdits ». Une lacune
ne doit modifier qu'un critère, sauf observations indépendantes explicitement
authorées.

Exemples d'invariants :

- absence de cible → `success-indicator`, jamais automatiquement
  `plan-coherence` ;
- recommandation absente → `decision-position`, pas fidélité des preuves ;
- concision complète → aucun malus ;
- faute sans perte de sens → aucun malus.

## 6. Authorer les statuts

Chaque élément définit le sens de :

- `SUPPORTED` ;
- `NOT_DEMONSTRATED` ;
- `EXPLICITLY_REFUTED` si la réponse peut refuser explicitement l'exigence ;
- `CONTRADICTED` ;
- `AMBIGUOUS` et ses résolutions permises.

Le statut `EXPLICITLY_REFUTED` suit
`docs/V4_EVIDENCE_SEMANTIC_ARBITRATION.md`. Il ne peut pas être ajouté après
lecture des résultats d'un modèle sous une identité déjà gelée.

## 7. Définir les règles déterministes

Une table versionnée transforme les statuts en points/niveaux. Le compilateur
doit prouver :

- tous les niveaux sont atteignables ;
- toutes les combinaisons ont une décision ;
- ajouter une preuve correcte ne réduit jamais le niveau ;
- l'incertitude est résolue sur toutes ses possibilités ;
- aucune pénalité ne se propage hors de son propriétaire.

Pour le premier MVP, `NOT_DEMONSTRATED` et `EXPLICITLY_REFUTED` ont le même
effet de niveau sur les éléments positifs requis, mais des templates distincts.

## 8. Authorer le feedback et la remédiation

Pour chaque statut, écrire un message borné :

- force observée ;
- élément attendu ;
- tension exacte ;
- clarification minimale.

Le feedback provient exclusivement de ces templates et des spans certifiés.
Il ne doit ajouter aucune nouvelle exigence. Chaque élément non satisfait
pointe vers une action ou une ressource de remédiation.

**Arbitrage Propriétaire 2** : valider critères, propriété des lacunes et ton
des templates avant constitution du corpus.

## 9. Construire les preuves de conception

Trois ensembles restent séparés :

1. corpus mécanique à oracle exécutable ;
2. corpus sémantique synthétique, explicitement pseudo-oracle ;
3. shadow réel consentant, sans revendication d'exactitude pédagogique.

Le corpus mécanique contient au minimum :

- paires minimales par élément ;
- suppression et ajout d'une preuve ;
- refus explicite, contradiction et ambiguïté ;
- paraphrase, ordre, typographie, fautes superficielles ;
- concision et verbosité inutile ;
- injection et canari ;
- mutations de propriétaire et de règles.

## 10. Compiler et prévalider

Le contrat reste `DRAFT` tant que :

- le schéma n'est pas valide ;
- un niveau est inatteignable ;
- un élément n'a pas de propriétaire unique ;
- une combinaison n'a pas de décision ;
- les tests de localité, monotonie ou mutation échouent ;
- les templates/remédiations sont incomplets.

`FULLY_COMPILABLE` est un résultat du compilateur et des preuves, pas une
étiquette éditoriale accordée manuellement.

## 11. Geler l'expérience

Une fois le contrat prévalidé, figer ensemble :

- contrat, règle et empreinte ;
- corpus et ordre des cas ;
- mapping sémantique ;
- modèle, route, profil et fournisseur ;
- runner, évaluateur et stop-policy ;
- budget et nombre maximum d'appels.

**Arbitrage Propriétaire 3** : approuver la version gelée. Finance arbitre le
budget séparément. Sans les deux accords, aucun appel n'est permis.

## 12. Promotion bornée

```text
gate 4 cas
  -> corpus de développement complet
  -> demande d'ouverture one-shot du holdout
  -> GO_AUTONOMOUS_FORMATIVE
  -> publication du contrat
  -> pilote fermé V4-010
```

Un échec ferme l'identité. Une modification crée une nouvelle version ; aucun
retuning opportuniste ou replay sous la même empreinte.

## Fiche de cadrage du premier pilote

| Champ | Valeur actuelle |
| --- | --- |
| Modalité | `WRITING` |
| Langue | `fr-FR` |
| Risque | faible |
| Contrat publié | non |
| Contrat de travail | `writing-go-no-go-recommendation-fr.v2`, DRAFT, `EVIDENCE_ASSIST_ONLY` |
| Objectif de la prochaine tranche | authorer et compiler une sous-grille réellement déterministe |
| Appels modèle autorisés | 0 |
| Effet progression | aucun |
