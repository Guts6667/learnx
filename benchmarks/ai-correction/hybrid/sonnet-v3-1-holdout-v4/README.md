# Holdout fermé Sonnet v3.1 — brouillon v4

## Statut

- identité corpus : `learnx-french-text-hybrid-holdout-v4` ;
- statut d’authoring : `DRAFT` ;
- revue indépendante : `PENDING` ;
- exécution : `false` ;
- appel réseau ou modèle pendant l’authoring : aucun ;
- sortie ou résultat candidat consulté : aucun.

Ce dossier réauthore les 24 cas depuis zéro après le rejet du holdout v3. Il
ne corrige, ne recycle, ne scelle et n’exécute pas le dossier rejeté. Aucun
fichier de ce dossier ne constitue une revue humaine ou une décision de
promotion.

Une revue indépendante a rejeté un digest antérieur de ce brouillon v4. Les
défauts signalés ont été corrigés hors ligne ; le corpus courant porte le
SHA-256 `51782c195cd56a3fd9229e03c13ba33c61f8253ea10d016ce1e80cf8e219b38b`.
Ce nouveau digest n’hérite d’aucune approbation : il requiert une nouvelle
revue indépendante et reste `PENDING`.

## Contenu

- `corpus.draft.json` : 24 cas synthétiques `fr-FR`, 4 contrats nouveaux,
  3 critères par contrat, 72 golds et des variantes/exemples calibrés non
  vides pour les 12 critères ;
- `configuration.draft.json` : overlay v3.1, 3 répétitions et exactement
  6 cas de panel ;
- `manifest.draft.json` : manifeste d’authoring et de provenance uniquement ;
- `review-manifest.pending.json` : placeholder bloquant du futur gate de revue
  indépendante, distinct du manifeste d’authoring ;
- `SOURCE_DRAFT_AUDIT.md` : périmètre des sources, audit propriétaire des
  golds et limites restantes ;
- `author-corpus.mjs` : source locale reproductible de `corpus.draft.json` ;
- `check-draft.mjs` : contrôles de schéma, identité, calcul, injection,
  provenance et différences exactes/surfaciques.

Le `reviewManifestPath` de la configuration pointe volontairement vers le
placeholder `PENDING`. Celui-ci n’a pas la forme `APPROVED` requise par le
runner : le benchmark doit donc refuser l’exécution tant qu’une véritable
revue autonome indépendante n’a pas produit son propre artefact.

## Identité hybride évaluée

Le brouillon vise le MVP HYBRID v3.1 : Sonnet propose niveau, citations et
feedback pour chaque critère ; LearnX valide ensuite chaque critère de manière
déterministe. Les métriques doivent séparer les critères livrés et rejetés et
les états `COMPLETE`, `PARTIAL` et `UNAVAILABLE`. Une projection historique
n’est jamais présentée comme une preuve live.

L’identité cible est :

- pipeline `learnx-french-text-correction-v3-1@3.1.0` ;
- `anthropic/claude-sonnet-4.6`, provider et route `Anthropic` ;
- prompt `2.2.0`, protocole `3.0.1`, enveloppe de sûreté `1.0.0` ;
- livraison `PARTIAL_CRITERION` ;
- profil `OPENROUTER_CHAT`, reasoning `OFF`, 1 500 tokens visibles et totaux,
  température `null`, timeout 60 s, 3 tentatives maximum ;
- runtime live désactivé.

## Contrôles hors ligne

Depuis la racine du dépôt :

```bash
node benchmarks/ai-correction/hybrid/sonnet-v3-1-holdout-v4/author-corpus.mjs
node --import tsx benchmarks/ai-correction/hybrid/sonnet-v3-1-holdout-v4/check-draft.mjs
```

La première commande réécrit mécaniquement le corpus. Toute modification
change son SHA-256 : il faut alors actualiser les digests de brouillon avant de
relancer le check. La seconde commande ne fait aucun appel externe et échoue
si un digest, un gold calculé, une frontière d’injection ou une identité ne
correspond plus.

Le hardening du runner et de son schéma étant concurrent, le manifeste conserve
les SHA historiques réellement consultés et marque
`requiredNextGate.runnerSourceDigest=PENDING_GATE_HARDENING`. Aucun rebinding
vers une source mouvante ne doit être confondu avec le gel propre du corpus.

## Gate suivant

Une revue autonome indépendante, aveugle aux sorties candidates, doit encore :

1. vérifier les faits, opérations et propriétaires de critères des 24 cas ;
2. contester l’indépendance sémantique au-delà des contrôles exacts et
   n-grammes ;
3. rendre un verdict réel sous un artefact séparé ;
4. laisser le corpus fermé et inexécuté en cas de rejet.

Jusqu’à ce gate, les statuts restent `DRAFT` / `PENDING` et `execution=false`.
