# Backlog V4.1 — refondation technique et visuelle

## Objet

V4.1 intervient uniquement après la clôture de V4. Elle remet le workspace et
la codebase sur des bases simples, documentées et maintenables, puis migre
Preact vers React et introduit shadcn pour fiabiliser les primitives UI.

V4.1 doit conserver la parité fonctionnelle de V4. Elle n'ajoute ni paiement,
ni évaluation textuelle d'étape, ni nouveau pipeline de correction IA.

## Principes bloquants

- Auditer avant de supprimer ou migrer.
- Préserver les contrats métier, données, migrations et historiques V4.
- Une seule source de vérité par décision ; les documents obsolètes sont
  archivés ou supprimés avec un manifeste de redirection.
- Migrer par lots vérifiables, jamais par réécriture globale non auditable.
- Chaque écran migré conserve ses états, son accessibilité et son responsive.
- shadcn fournit des primitives maîtrisées ; il ne redéfinit pas le produit ni
  la direction artistique.

## P0 — audit et assainissement

### V4.1-001 — Audit exhaustif du workspace

- Inventorier branches, worktrees, dépendances, scripts, migrations, routes,
  composants, styles, tests, documents, artefacts et sources de vérité.
- Classer chaque élément : actif, dette, doublon, archive, dangereux ou à
  supprimer après validation.
- Produire une carte des dépendances et des risques de migration.

### V4.1-002 — Nettoyage documentaire et backlog canonique

- Conserver le contexte minimal suffisant pour reprendre le projet.
- Archiver ou supprimer les instructions obsolètes sans effacer l'historique de
  recherche utile.
- Reconstituer un backlog ticket par ticket avec responsable, dépendances,
  critères d'acceptation et statut prouvé.

### V4.1-003 — Baseline de parité V4

- Geler les parcours critiques et leurs résultats attendus avant migration.
- Couvrir authentification, parcours, leçons, notes, révisions, corrections,
  crédits, administration, landing et recherche publique.
- Capturer les références mobile, desktop, clavier et zoom 200 %.

## P0 — migration React

### V4.1-004 — Couche de compatibilité Preact vers React

- Cartographier APIs Preact, router, hooks, tests et dépendances incompatibles.
- Définir la stratégie de migration et le rollback sans maintenir durablement
  deux runtimes concurrents.
- Valider build, taille du bundle, PWA, SSR éventuel et environnement de test.

### V4.1-005 — Migration applicative vers React

- Migrer providers, routing, composants partagés puis pages par lots.
- Maintenir TypeScript strict et déplacer la logique métier hors composants.
- Supprimer la compatibilité Preact seulement après parité complète.

## P0 — shadcn et overhaul

### V4.1-006 — Fondation shadcn contrôlée

- Installer uniquement les primitives réellement utilisées.
- Relier tokens, focus, contrastes, rayons et états à la direction visuelle
  LearnX sans importer une esthétique générique.
- Interdire les composants dupliqués et les variantes locales non documentées.

### V4.1-007 — Migration des primitives et layouts

- Migrer boutons, champs, dialogues, navigation, tables, formulaires, retours
  d'état et surfaces éditoriales.
- Unifier shells mobile/desktop et supprimer les CSS devenus inaccessibles.
- Conserver une seule action principale et les règles d'accessibilité V4.

### V4.1-008 — Overhaul progressif des écrans

- Reprendre les écrans par parcours utilisateur, avec validation visuelle avant
  le lot suivant.
- Ne jamais modifier un contrat métier pour faciliter un composant UI.
- Documenter toute divergence approuvée.

## P1 — clôture de refondation

### V4.1-009 — Réduction de dette et performances

- Supprimer dépendances, styles, composants et feature flags devenus inutiles.
- Mesurer bundle, rendu, requêtes, accessibilité et stabilité PWA.
- Corriger les régressions avant toute nouvelle fonctionnalité V4.5.

### V4.1-010 — Gate de release V4.1

- Rejouer la baseline V4 et les parcours critiques sur environnements réels.
- Produire rapport de migration, dette résiduelle, rollback et nouvelle carte
  documentaire.
- V4.5 reste fermée tant que la parité fonctionnelle n'est pas démontrée.

## Définition de terminé V4.1

- React est l'unique runtime UI ;
- les primitives shadcn retenues sont adaptées et documentées ;
- aucune fonctionnalité V4 n'est perdue ;
- tests, build, PWA, accessibilité et responsive sont verts ;
- workspace, backlog et documentation ont une source de vérité explicite ;
- rollback et dette résiduelle sont documentés.
