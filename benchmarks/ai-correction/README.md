# Banc d’essai de correction IA

Ce dossier contient le jeu de régression V4-003. Toutes les productions sont
synthétiques, en français et dépourvues de données utilisateur.

- `corpus.v1.json` : quatre types d’exercice et six profils de réponse par type ;
- `benchmark.v1.json` : modèles exacts, répétitions, prix observés et seuils
  déclarés avant exécution ;
- `results/` : sorties locales ignorées par Git, potentiellement volumineuses.

## Garde-fous

Le benchmark live refuse de démarrer tant que `humanReview.status` n’est pas
`APPROVED` dans le corpus et que `OPENROUTER_API_KEY` n’est pas disponible côté
serveur. Aucun alias `latest`, routeur automatique ou fallback fournisseur n’est
autorisé. Une citation absente de la production rend la sortie invalide.

```bash
pnpm ai:benchmark:validate
OPENROUTER_API_KEY="…" pnpm ai:benchmark
```

La clé ne doit jamais être commitée. Après une exécution, le rapport humain doit
examiner les désaccords et reporter uniquement les métriques agrégées dans
`docs/V4_AI_MODEL_BENCHMARK_REPORT.md`. Un modèle qui manque un seuil n’est pas
promouvable, quelle que soit sa moyenne globale.
