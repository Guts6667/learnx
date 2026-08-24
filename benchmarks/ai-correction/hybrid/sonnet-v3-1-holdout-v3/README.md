# Holdout hybride Sonnet v3.1 — REJETÉ

Ce brouillon a été rejeté par une revue autonome indépendante Codex
explicitement identifiée comme IA, et non comme reviewer humain. Il ne constitue
ni une approbation, ni un scellement, ni une autorisation d'exécution.

## Interdiction de réutilisation

Le corpus, ses 24 cas et ses 72 golds ne doivent pas être corrigés en place,
recyclés, mélangés à un autre holdout, scellés ou exécutés. Ils sont conservés
uniquement comme preuve du rejet. Toute suite exige une réauthoring complète
depuis zéro sous un nouvel `corpusId`, un nouveau digest et une nouvelle revue
indépendante.

Rapport exhaustif : `INDEPENDENT_REVIEW_REJECTED.md`.

## Identité gelée visée

- modèle : `anthropic/claude-sonnet-4.6` ;
- route unique : `Anthropic` via OpenRouter ;
- prompt : `2.2.0` ;
- protocole : `3.0.1` ;
- livraison : `PARTIAL_CRITERION` ;
- trois répétitions et deux retries maximum par cellule ;
- seuils identiques à `benchmark.v3_1.json` au commit `70579d1a`.

## Artefacts

- `corpus.draft.json` : corpus rejeté, préservé sans correction comme preuve ;
- `configuration.draft.json` : snapshot non exécutable de l'identité visée ;
- `manifest.draft.json` : métadonnées du rejet et digest du corpus revu ;
- `INDEPENDENT_REVIEW_REJECTED.md` : revue autonome indépendante exhaustive.

La catégorie pédagogique `PARTIAL` ne prouve pas la livraison partielle. Cette
dernière ne peut être mesurée qu'après une exécution autorisée, dans les
artefacts de tentatives finales, via `unsureCriteria` et
`unsureCriterionRate`. Le corpus contient seulement des cas de stress conçus
pour exercer ce chemin sans préjuger de son résultat.

## Gates historiques — ouverture désormais interdite

La liste ci-dessous décrivait le chemin envisagé avant la revue. Le verdict
`REJECT` l'annule pour ce corpus : aucune finalisation ni ouverture n'est
permise.

1. validation de schéma et contrôles déterministes locaux ;
2. revue indépendante des 72 golds, des calculs et de l'indépendance des
   critères ;
3. correction de tous les findings avant gel ;
4. mutation explicite des contrats vers `PUBLISHED` et de la revue vers
   `APPROVED`, sans autre changement de contenu ;
5. manifeste de revue lié aux digests ;
6. scellement sous une nouvelle identité immuable ;
7. autorisation propriétaire séparée avec plafond fournisseur ;
8. une seule exécution, sans retuning après ouverture.

Le budget attendu est de 1,70 à 2,20 USD fournisseur. Le plafond prudent
proposé est de 3 USD, soit une réserve chargée indicative de 3,91194 USD avec
le facteur historique 1,30398. Ces montants ne sont ni un prix utilisateur ni
une autorisation d'appel.
