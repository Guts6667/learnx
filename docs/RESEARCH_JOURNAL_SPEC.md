# Journal public de recherche LearnX

## Décision

La section publique s’appelle **Recherche** en français et **Research** en
anglais. Elle présente les travaux de LearnX comme un journal éditorial
chronologique : hypothèses, protocoles, résultats, limites, décisions et
errata. Elle n’est ni un tableau de bord ni une vitrine marketing.

Le rapport historique sur la correction assistée par IA demeure accessible à
ses URL stables :

- français : `/research/ai-correction/` ;
- anglais : `/research/ai-correction/en.html`.

Son contenu, ses graphiques et ses verdicts ne sont pas réécrits par la mise en
place du journal.

## Contrat éditorial

- Une publication possède un identifiant stable, un type, une date de
  publication, une date de mise à jour, une version, un statut expérimental et
  deux URL canoniques FR/EN.
- Une évolution de méthode, de données, de conclusion ou de verdict crée une
  nouvelle publication. Elle n’écrase jamais l’ancienne.
- Une correction est consignée comme erratum daté. Si elle change
  l’interprétation ou la décision, elle crée une nouvelle version.
- Les types autorisés sont `exploration`, `protocol`, `result`, `decision` et
  `erratum`.
- `experimental` est toujours rendu sous forme textuelle et jamais par la
  couleur seule.
- Aucun faux chiffre, faux article, faux auteur ou fausse preuve n’est permis.

Le manifeste public `public/research/journal.v1.json` est la source structurée
de la chronologie. Chaque article reste un document autonome et indexable.

## Accès public

- Index français : `/research/`.
- Index anglais : `/research/en.html`.
- La landing conserve son bloc de transparence ; son appel à l’action ouvre
  l’index du journal.
- Le footer de la landing expose un lien permanent Recherche/Research.
- Les pages de recherche restent hors du fallback de navigation PWA afin que
  leurs URL statiques ne soient jamais remplacées par le shell applicatif.

## Accessibilité et Atlas

- Largeurs de référence : 320, 390, 720 et 1440 px, plus zoom navigateur à
  200 %.
- Cibles interactives d’au moins 44 px, focus visible de 3 px, ordre clavier
  identique à l’ordre de lecture et aucun mouvement automatique.
- Le statut, la version et le caractère expérimental ne dépendent jamais de la
  couleur.
- Atlas conserve le papier minéral, l’encre bleu ardoise et le laiton rare,
  sans esthétique fintech, halo IA, robot ou graphique décoratif.

## État d’implémentation

Le journal v1 expose six articles chronologiques autonomes sur la correction
assistée, plus le rapport historique de synthèse daté du 12 août 2026 et mis à
jour le 20 août 2026. Les articles rétrospectifs distinguent explicitement la
date des travaux de leur date de publication du 21 août 2026.

Chaque article possède une URL FR/EN, des métadonnées de partage, une navigation
précédent/suivant et une action de partage native avec fallback presse-papiers.
L’index met la dernière publication en avant puis liste toute la chronologie.

Toute publication suivante doit ajouter une entrée au manifeste et une nouvelle
URL ; elle ne doit pas modifier silencieusement les conclusions historiques.
