# Corpus autonome WRITING/fr-FR

Cette famille de corpus est indépendante du benchmark historique V1 et de sa
propriété `humanReview`. Elle ne revendique aucune validation humaine.

- `writing-fr-development-mini-panel.v1.json` : dix cas synthétiques, deux
  répétitions prévues, oracle autonome scellé et relations métamorphiques
  explicites ;
- `writing-fr-holdout.v1.json` : holdout synthétique distinct, fermé et non
  exécutable avant le GO du corpus complet de développement ;
- `manifest.v1.json` : empreintes des deux artefacts et politique d'ouverture.

Le contrat référencé reste `DRAFT_NOT_PUBLISHED`. Ces fichiers sont uniquement
des preuves hors ligne et n'autorisent ni appel modèle, ni publication, ni
activation utilisateur. Toute modification d'un cas, d'un gold ou d'un seuil
crée une nouvelle identité de corpus et de manifeste.

## Oracle

`SEALED_AUTONOMOUS` signifie que les attentes déterministes ont été fixées avant
les candidats. Cela ne signifie ni revue humaine indépendante, ni vérité
pédagogique universelle. Les empreintes rendent toute modification ultérieure
détectable.

Le mini-panel couvre exactement : baseline, paraphrase, concision, fautes et
Unicode sans perte de sens, mutation isolée de chacun des trois critères,
contradiction appartenant au critère de décision et deux injections.

Le holdout emploie un contexte, des formulations et des golds distincts. Il est
inspectable pour audit du dépôt mais demeure fermé par politique : il ne doit
servir ni au prompt, ni au réglage, ni à la sélection d'un candidat.
