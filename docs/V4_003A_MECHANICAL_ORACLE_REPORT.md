# V4-003A — Rapport de l’oracle mécanique successeur

- **Statut** : `DONE_OFFLINE`
- **Date** : 21 août 2026
- **Responsable** : `AGENT-METHODOLOGIE`
- **Consulté** : `AGENT-PEDAGOGIE`
- **Périmètre** : `WRITING / fr-FR`, activité pilote « Choisir sans forcer un cadre »
- **Autorité d’entrée** : contrat v2 `DRAFT` compilé par V4-002C
- **Appel modèle, réseau, holdout ou budget** : aucun
- **Publication ou activation produit** : aucune

## Verdict

Le corpus mécanique successeur est complet et reproductible pour le périmètre
de V4-003A. Il constitue un oracle exécutable fondé sur des vecteurs de
construction connus, et non une annotation humaine ou un jugement de modèle.

Ce verdict ouvre uniquement `V4-003B`, l’audit autonome indépendant. Il ne
promet ni qualité pédagogique universelle, ni pipeline promu, ni activité
éligible à la correction en production.

## Livrables

- corpus :
  `benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.mechanical-oracle.v2.json` ;
- validateur : `src/lib/executable-rubric-mechanical-oracle-v2.ts` ;
- tests : `src/lib/executable-rubric-mechanical-oracle-v2.test.ts` ;
- empreinte SHA-256 canonique du corpus :
  `7bbea4ae4d024eed8dc91f0847c8f2021b28fd35e40fe7933b02af4568cf1297`.

Toute modification du corpus, de la rubrique, des attentes ou du validateur
invalide cette preuve et exige une nouvelle empreinte.

## Couverture mécanique

Le corpus contient 19 cas construits et 7 mutations du compilateur.

| Famille | Preuve apportée |
| --- | --- |
| Baseline complète | Les 10 éléments et 3 critères conduisent au résultat attendu. |
| Paires minimales | Retirer ou ajouter un seul élément modifie uniquement son propriétaire. |
| Localité | Une lacune ne pénalise pas un critère voisin ni l’autre scénario. |
| Monotonie | Ajouter une preuve correcte ne peut pas réduire un niveau. |
| Métamorphismes | Paraphrase, ordre, typographie Unicode, faute superficielle, concision et verbosité non pertinente préservent le résultat attendu. |
| Sûreté | Injection et canari restent des données non fiables et ne deviennent jamais des preuves. |
| Incertitude | Ambiguïtés matérielle et non matérielle suivent des sorties distinctes et déterministes. |
| Sémantique | Contradiction, refus explicite et variantes conditionnelles PECO/PCC sont représentés sans compensation. |
| Mutation testing | Propriétaire étranger ou partagé, règle non monotone, niveau inatteignable, combinaison non couverte, condition absente et dérive de prompt sont refusés. |

Chaque cas reconstruit sa réponse, ses spans exacts, deux passes indépendantes
identiques, sa consolidation et son certificat. Le validateur recalcule le
résultat depuis les règles ; il ne fait pas confiance à la sortie attendue du
fichier.

## Frontières d’autorité

- le candidat ne peut définir ni niveau, ni score, ni progression ;
- le certificat conserve `indicativeScore: null` et `progressionEffect: NONE` ;
- les segments `INJECTION` et `CANARY` ne peuvent être utilisés comme preuve ;
- l’identité exacte de la rubrique v2 est vérifiée avant tout cas ;
- le corpus est une vérité mécanique par construction, pas un pseudo-oracle
  sémantique et pas une validation humaine indépendante ;
- aucun résultat historique de modèle n’est réinterprété.

## Validation exécutée

- 6/6 tests dédiés verts ;
- 1 107/1 107 tests globaux verts ;
- validation complète des 19 cas et 7 mutations ;
- JSON valide ;
- lint, typecheck et build verts ;
- contre-lecture pédagogique : deux défauts d’annotation corrigés, puis verdict
  final `APPROVED` sur l’empreinte ci-dessus.

## Limites et étape suivante

V4-003A démontre que LearnX dispose d’une base mécanique cohérente pour auditer
le contrat. Il ne teste aucun chercheur de preuves et ne permet aucun appel.

`V4-003B` doit maintenant auditer cette preuve sans modifier le contrat, les
attentes, le corpus ou les seuils. Sa seule sortie autorisée est
`READY_TO_FREEZE` ou `BLOCKED_WITH_FINDINGS`.
