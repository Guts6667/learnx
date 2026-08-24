# Audit du brouillon `holdout.v3.json`

## Verdict

Le brouillon présent au commit `70579d1a` est une bonne base de corpus inédit,
mais il n'est ni approuvé, ni scellé, ni exécutable. Il ne doit pas être traité
comme le troisième holdout ouvert.

## Points vérifiés

- schéma du corpus valide ;
- quatre contrats et 24 cas, six par famille ;
- distribution : 4 `SUCCESSFUL`, 4 `PARTIAL`, 4 `ERRONEOUS`, 4 `AMBIGUOUS`
  et 8 `PROMPT_INJECTION` ;
- huit frontières d'injection complètes ;
- réponses de 486 à 933 caractères, dont cinq d'au moins 800 caractères ;
- aucun identifiant, contexte ou texte de réponse exactement réutilisé depuis
  `corpus.v1.json`, `holdout.v1.json` ou `holdout.v2.json` ;
- cas dédiés à l'indépendance des critères et à la non-double-pénalisation.

## Blocages constatés

1. Les quatre contrats étaient marqués `PUBLISHED` alors que
   `humanReview.status` restait `PENDING`. Ce statut prématuré est corrigé dans
   le candidat : contrats `DRAFT`, date de publication nulle.
2. Aucun recalcul indépendant des 72 golds, montants, dates, seuils et règles
   d'exception n'est persisté.
3. Aucun manifeste de revue lié par digest, aucun scellement et aucune
   autorisation propriétaire n'existent.
4. La catégorie de réponse `PARTIAL` ne démontre pas le comportement runtime
   `PARTIAL_CRITERION`. Ce comportement devra être évalué dans les tentatives
   finales par `unsureCriteria` et `unsureCriterionRate`.
5. `holdout.benchmark.v3.json` pointe vers le holdout n°2 et l'identité v3 ; il
   ne constitue pas une configuration pour ce brouillon ni pour v3.1.

## Disposition

Le contenu est repris sous l'identité distincte
`learnx-french-text-hybrid-holdout-v3`, toujours en DRAFT. La configuration
associée fige Sonnet 4.6 / Anthropic / prompt 2.2.0 / protocole 3.0.1 /
`PARTIAL_CRITERION` et reste explicitement non exécutable.

Une revue indépendante doit résoudre ou confirmer chaque gold avant toute
mutation de finalisation. Seules les métadonnées `humanReview` et
`contracts[*].lifecycle` pourront alors changer ; toute modification sémantique
créera un nouveau digest et imposera une nouvelle revue.
