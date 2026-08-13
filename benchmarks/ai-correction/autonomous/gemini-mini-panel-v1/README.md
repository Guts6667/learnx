# Campagne Gemini autonome WRITING/fr-FR — historique remplacé

**Statut : `SUPERSEDED_NOT_EXECUTABLE`.** Cette préparation demandait encore à
Gemini d'attribuer des niveaux. La décision du 14 août 2026 la remplace par le
moteur de rubrique exécutable décrit dans
`docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md` et par la campagne de recherche de
preuves `benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-mini-panel.v1.json`.

Les fichiers restent conservés comme trace de méthode. Ils ne doivent pas être
complétés, autorisés ou utilisés comme identité de campagne.

Cette identité expérimentale est nouvelle et ne reprend aucun workflow des
campagnes Gemini historiques. Sa matrice contient les dix cas autonomes de
développement, exécutables deux fois chacun uniquement après levée de tous les
blocages.

La configuration est volontairement non exécutable :

- feature désactivée et appels réseau interdits ;
- autorisation propriétaire absente ;
- identifiant exact du modèle, snapshot et route fournisseur non validés ;
- prompt et profil de requête non épinglés ;
- budget, plafond, nombre maximal de tentatives et snapshot tarifaire non
  arbitrés ;
- correctif P0 dispatch/coût non prouvé ;
- répétition sur branche Neon jetable non effectuée.

Ces champs ne doivent pas être remplis en place. Leur validation crée une
nouvelle version de configuration, une nouvelle empreinte et un manifeste mis à
jour avant toute autorisation. Aucun prix historique n'est réutilisé.

Le holdout reste interdit. Une campagne autorisée doit toujours exécuter les
vingt workflows frais ; elle ne peut sélectionner ni importer les neuf succès
de l'ancien panel interrompu.
