# Paquet d’authoring — Programmes SourceLab

Ce paquet contient le lot complet généré pour les deux programmes LearnX qui construisent un seul produit externe, SourceLab.

## Programmes

1. **Ingénieur logiciel en production — Construire SourceLab** : 5 étapes, 10 leçons et 5 évaluations finales.
2. **AI Product Engineer — SourceLab, RAG et évaluation** : 6 étapes, 12 leçons et 6 évaluations finales.

## Contenu

L’archive `.source-packages/sourcelab_learnx_content.tar.gz` contient 42 fichiers :

- 22 `PEDAGOGY_SPEC` complètes, numérotées de 126 à 147 ;
- 11 évaluations d’étape, numérotées de 027 à 037 ;
- deux blueprints et deux README ;
- deux bundles seed en statut `draft` ;
- un importeur explicite `prisma/seed-sourcelab.ts` ;
- un validateur `scripts/validate-sourcelab-programs.ts` ;
- la mise à jour de `docs/INDEX.md`.

Chaque leçon possède des contenus sourcés, deux ressources guidées, deux notions obligatoires avec mini-évaluation, deux productions, un quiz et une séquence déterministe. Chaque étape possède une rubrique finale totalisant 100 points.

## Matérialisation et contrôle

Depuis la racine du dépôt :

```bash
bash scripts/materialize-sourcelab-programs.sh
```

Le script extrait les fichiers à leurs emplacements définitifs puis exécute :

```bash
pnpm exec tsx scripts/validate-sourcelab-programs.ts
```

Après revue du diff, supprimer les paquets de bootstrap avant le commit final :

```bash
rm -rf .source-packages .sourcelab-bootstrap scripts/.sourcelab-payload
rm SOURCELAB_PROGRAMS_PACKAGE.md scripts/materialize-sourcelab-programs.sh
```

## Import explicite

Les programmes ne sont pas ajoutés au seed automatique de production. Après matérialisation, les importer uniquement sur une base contrôlée :

```bash
ADMIN_EMAIL=<compte-admin> pnpm exec tsx prisma/seed-sourcelab.ts
```

Vérifier `DATABASE_URL`, disposer d’une sauvegarde et conserver les programmes en brouillon jusqu’aux revues humaines éditoriale, pédagogique et technique.
