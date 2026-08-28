# V4.1-404 — preuve de parité du découpage CSS

- Baseline : `848ded02c42bbfee2a41e20b5a78822976ee48fc`
- Branche de travail : `codex/v4-1-404-css`
- Date : 2026-08-28
- Portée : sous-lot CSS de V4.1-404 uniquement

## Invariants

- `src/styles/index.css` reste l'unique point d'entrée importé par TypeScript et
  la cible déclarée dans `components.json`.
- Les règles sont réparties en segments contigus de l'ancien monofichier :
  polices, thème, surfaces publiques, base, primitives, shells, administration,
  produit, overlays/contenus, accessibilité et correction/évaluations/révisions.
- L'ordre de cascade est strictement identique. Aucun sélecteur, breakpoint,
  token, `@layer`, niveau de spécificité ou déclaration n'a été modifié.
- Les chevauchements historiques, notamment `min-width: 48rem` et
  `max-width: 48rem`, restent donc résolus dans le même ordre.

Le helper `stylesheet-source.ts` résout les imports locaux en profondeur,
refuse cycles et doublons, et permet aux tests de contrat de lire la feuille
logique complète sans réintroduire un second point d'entrée applicatif.

## Parité source

La concaténation dans l'ordre du graphe reproduit octet pour octet l'ancien
`src/styles/index.css` :

```text
taille avant : 92 336 octets
taille après : 92 336 octets
SHA-256 avant : 2e115a2e0970f6bfb8e99a9b46b93fc05b5ad8d6cccac1eb20c4a82eca3a9c8c
SHA-256 après : 2e115a2e0970f6bfb8e99a9b46b93fc05b5ad8d6cccac1eb20c4a82eca3a9c8c
```

## Parité compilée et budgets

Après `pnpm build`, Vite émet exactement le même CSS que la baseline :

```text
taille avant : 105 185 octets
taille après : 105 185 octets
SHA-256 avant : eac76ac163d1272199fc2bb751b24236797a9e4ca3f5c06f3cd0bf648764cf0c
SHA-256 après : eac76ac163d1272199fc2bb751b24236797a9e4ca3f5c06f3cd0bf648764cf0c
CSS initial gzip : 18 553 / 25 000 octets
PWA : 134 / 140 entrées ; 1 289 688 / 1 371 224 octets
```

Le diagnostic de JavaScript total reste au-dessus de son seuil non bloquant ;
il est préexistant et sans lien avec ce découpage CSS. Les budgets bloquants
CSS, JS initial, plus gros chunk différé et PWA restent verts.

## Validations

```bash
pnpm exec vitest run \
  src/server/quality/stylesheet-source.test.ts \
  src/server/quality/shadcn-maia-foundation.test.ts \
  src/server/quality/totem-foundations.test.ts \
  src/pages/credits-surfaces.test.ts
pnpm lint
pnpm typecheck
NODE_OPTIONS=--no-experimental-webstorage pnpm test
pnpm build
pnpm quality:bundle
```

Résultats : 11/11 tests ciblés, 1 052/1 052 tests complets, lint, typecheck,
build et génération PWA verts.

Ce document ne clôt pas V4.1-404 : les sous-lots i18n et runner de benchmark
gardent leurs propres preuves et doivent être intégrés avant le verdict global
du ticket.
