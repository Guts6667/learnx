# Inventaire V4 des contrats de correction

- **Date de référence** : 11 août 2026
- **Ticket** : V4-002
- **Portée** : bundles JSON présents dans `seed/`
- **Décision** : inventaire seulement, sans migration ni activation IA

## 1. Méthode

L'inventaire classe les activités depuis leurs types authorés. Il ne déduit
jamais leur éligibilité à partir d'un titre ou d'une consigne :

- candidats exercice : `writing`, `reflection`, `practice`, `project` ;
- candidats d'étape : toute évaluation finale, sous réserve d'une preuve
  strictement textuelle ;
- exclus du moteur IA : tâches passives, ressources, quiz et mini-évaluations
  déterministes ;
- éligible au runtime : contrat publié, valide et limité à `TEXT`.

Une rubrique historique n'est pas un contrat V4. Elle ne contient actuellement
ni niveaux de performance, ni variantes acceptables, ni erreurs fréquentes, ni
exemples étalonnés, ni politique de seconde passe.

## 2. Résultat

| Bundle | Exercices candidats | Évaluations d'étape à qualifier | Tâches passives exclues | Mini-évaluations exclues | Ressources hors progression IA |
| --- | ---: | ---: | ---: | ---: | ---: |
| `officine-express-program.json` | 7 | 1 | 0 | 7 | 29 |
| `pilotage-projets-ia-iso-42001-program.json` | 84 | 8 | 4 | 88 | 89 |
| `platform-apm-interview-program.json` | 6 | 2 | 0 | 6 | 12 |
| `psychology-foundations-pilot-program.json` | 13 | 2 | 5 | 18 | 22 |
| `sample-program.json` | 202 | 13 | 8 | 210 | 400 |
| **Total** | **312** | **26** | **17** | **329** | **552** |

Les cinq bundles ne contiennent aucun quiz de leçon. Les évaluations de notion
restent néanmoins déterministes et sont exclues de la correction IA.

### Éligibles

**Aucune activité.** Aucun bundle ne contient encore de contrat V4 publié.

### Incomplètes

- 312 exercices productifs sont des candidats potentiels, mais leur seed ne
  porte pas de contrat V4 ;
- 26 évaluations finales possèdent une rubrique dont les poids totalisent 100,
  mais cette rubrique historique reste insuffisante pour une correction V4 ;
- les exercices `practice` et `project`, ainsi que les évaluations
  `simulation`, doivent en plus faire l'objet d'une revue attestant que la
  preuve attendue est entièrement textuelle.

### Explicitement incompatibles avec le runtime V4

- tâches binaires de lecture, visionnage, écoute et checklist ;
- ressources et sources bibliographiques ;
- mini-évaluations et quiz déterministes ;
- oral, fichier, image, audio ou autre preuve multimodale sans ticket
  d'activation ultérieur.

## 3. Condition de sortie de l'inventaire

Une activité passe d'« incomplète » à « éligible » uniquement après :

1. authoring et revue humaine d'un contrat conforme au schéma
   `correctionContractSchema` ;
2. publication immuable d'une version ;
3. preuve textuelle compatible avec le runtime V4 ;
4. corpus étalon approuvé dans V4-003 ;
5. persistance et contrôle serveur livrés par les tickets ultérieurs.

Cet inventaire ne modifie aucune activité, rubrique, progression ou donnée
utilisateur existante.
