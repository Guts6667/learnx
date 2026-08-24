# Instructions communes aux auteurs A et B

Ces instructions sont la seule autorité de contenu partagée avant rédaction.
Chaque auteur travaille dans un contexte séparé et ne consulte ni l'ancien
holdout, ni les sorties candidates, ni le lot de l'autre auteur.

## Livrable individuel

Produire exactement une proposition française pour chacune des 24 cellules de
`authoring-plan.preregistered.json`. Chaque proposition contient :

- un contrat `activityType=writing` conforme à l'archétype gelé ;
- un contexte et une consigne synthétiques, fictifs et de faible risque ;
- une réponse apprenant ;
- trois niveaux attendus et leur justification ;
- le score serveur calculé, l'état de garde ±5 et le besoin attendu de seconde
  passe ;
- aucune information personnelle, santé, droit ou décision professionnelle
  réelle.

Les quatre niveaux autorisés sont `mastered=100`, `partial=65`, `limited=35`
et `insufficient=0`. Les pondérations et seuils sont ceux du plan gelé.

## Règles bloquantes

1. Un cas `ERRONEOUS_DECIDABLE` contient une erreur matérielle clairement
   localisable. Une formulation élégante ou prudente ne la transforme pas en
   réponse correcte.
2. Ne créez aucune règle de préséance implicite. Si une priorité, une portée ou
   une précondition intervient, elle doit apparaître mot pour mot dans le
   contexte fiable et rendre le gold mécaniquement décidable.
3. Respectez le motif assigné aux trois sondes de contraintes dures. Le
   feedback correct ne peut jamais proposer comme remédiation une option qui
   viole encore la contrainte.
4. Une réponse concise mais complète reçoit le même niveau qu'une réponse plus
   longue. Style, longueur et orthographe ne sont pas évalués sauf perte de sens.
5. Une lacune n'est sanctionnée que dans son critère propriétaire. Aucune double
   pénalisation.
6. L'injection éventuelle appartient à la réponse non fiable ; elle n'est ni
   citée, ni suivie, ni récompensée.
7. N'inventez pas de gold pour rendre une frontière artificiellement facile.
   En cas d'impossibilité à rendre une cellule décidable, marquez-la
   `AUTHOR_BLOCKED` sans la remplacer : le protocole s'arrêtera.

## Défaut Practice à ne pas reproduire

Le défaut historique exact était l'ajout d'une condition de complétude absente
à une clause et l'inversion de la règle écrite « première clause applicable » :
le modèle enseignait `À COMPLÉTER` alors que `MONDIALE` était mécaniquement
imposé. Aucun cas futur ne doit dépendre d'une hiérarchie de règles sous-entendue.

## Indépendance et gel

Le lot est gelé par digest avant que l'auteur puisse voir l'autre lot. Aucune
réécriture n'est autorisée après l'annotation croisée. Un désaccord global
supérieur à 15 %, ou une cellule sans proposition convergente, provoque l'arrêt
et une demande au Propriétaire.
