# Banc d’essai de correction IA

Ce dossier contient le jeu de régression V4-003. Toutes les productions sont
synthétiques, en français et dépourvues de données utilisateur.

- `corpus.v1.json` : quatre types d’exercice, six profils de réponse par type,
  leur contexte fiable, leur consigne et la justification humaine de l’étalon ;
- `benchmark.v1.json` : modèles exacts, répétitions, prix observés et seuils
  déclarés avant exécution ;
- `results/` : sorties locales ignorées par Git, potentiellement volumineuses.

## Garde-fous

Le benchmark live refuse de démarrer tant que `humanReview.status` n’est pas
`APPROVED` dans le corpus et que `OPENROUTER_API_KEY` n’est pas disponible côté
serveur. Toute modification du corpus repasse cette revue à `PENDING`. Aucun
alias `latest`, routeur automatique ou fallback fournisseur n’est autorisé. Une
citation absente de la production rend la sortie invalide.
L’accord sur le déclenchement d’une seconde passe est mesuré séparément : une
réponse ambiguë ne doit pas être transformée artificiellement en certitude.
Les cas d’injection séparent la réponse légitime du segment d’attaque, tout en
les concaténant dans la production envoyée au modèle. Les preuves autorisées,
les fragments interdits et un canari du prompt sont vérifiés de manière
déterministe dans les citations, feedbacks et raisons de seconde passe, sans
juge LLM supplémentaire.

## Langues

Chaque corpus et chaque configuration déclarent une langue canonique BCP 47
(`fr-FR`, `en-GB`, etc.). Un mismatch bloque le run. Le prompt de contrôle est
localisé et versionné sans fallback silencieux. Le feedback est produit dans
cette langue et les citations restent strictement dans la langue originale de
l’apprenant. Les langues ne sont jamais agrégées dans un même score : l’identité
de promotion combine modèle, langue, corpus et version du prompt. Chaque langue
supportée possède son corpus, sa revue humaine et sa décision de promotion
propres. Le corpus V1 valide uniquement le français de France ; il ne revendique
pas encore une qualité étalonnée en anglais.

```bash
pnpm ai:benchmark:validate
OPENROUTER_API_KEY="…" pnpm ai:benchmark
```

La clé ne doit jamais être commitée. Après une exécution, le rapport humain doit
examiner les désaccords et reporter uniquement les métriques agrégées dans
`docs/V4_AI_MODEL_BENCHMARK_REPORT.md`. Un modèle qui manque un seuil n’est pas
promouvable, quelle que soit sa moyenne globale.
