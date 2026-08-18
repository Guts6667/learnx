# Validation structurelle — Programmes SourceLab

- Date : 18 août 2026
- Portée : deux programmes LearnX en brouillon, construisant le même produit externe SourceLab.
- Méthode : validation déterministe du JSON, des clés, séquences, banques, références, rubriques et frontières de publication.

## Résultat

- Erreurs bloquantes : **0**
- Avertissements : **0**

## Volumétrie

- Programs : 2
- Stages : 12
- Modules : 12
- Lessons : 24
- Lesson specs : 24
- Stage assessment specs : 12
- Content blocks : 72
- Resources : 64
- Concepts : 24
- Tasks : 24
- Quizzes : 24
- Quiz questions : 72
- Concept banks : 24
- Concept questions : 72

## Contrôles exécutés

- programmes et sidecars conservés en `draft` ;
- aucune spécification marquée prête à publier ;
- types et champs attendus du seed contrôlés ;
- URLs de ressources en HTTPS et consignes guidées présentes ;
- `sourceKeys`, `resourceKeys` et références éditoriales résolus ;
- toute notion obligatoire possède une évaluation et une banque ;
- tailles des banques conformes à `questionCount` ;
- quiz dotés de réponses cohérentes avec leur type ;
- séquences sans doublon, avec cibles résolues et couverture des activités canoniques ;
- rubriques d’étape totalisant 100 % ;
- identifiants `PEDAGOGY_SPEC_126` à `149` et `PEDAGOGY_STAGE_ASSESSMENT_027` à `038` uniques ;
- séparation LearnX / SourceLab explicitée dans les blueprints et activités.

## État de livraison

- Les 44 fichiers finaux sont matérialisés directement dans `content/`, `seed/` et `docs/`.
- Aucun paquet binaire, fragment de transport ou workflow temporaire n’est conservé dans le diff final.
- Les deux programmes restent volontairement en brouillon et ne modifient pas le seed automatique de production.

## Limites restantes

- Ce contrôle ne remplace pas l’exécution du parseur Zod réel de `prisma/seed.ts` dans le dépôt LearnX.
- Les liens et sections ont été préparés à partir de sources officielles, mais une réouverture humaine reste obligatoire avant publication.
- Une revue technique et pédagogique humaine reste nécessaire.
- Les bundles restent volontairement non enregistrés dans le seed par défaut tant que cette revue n’est pas terminée.
