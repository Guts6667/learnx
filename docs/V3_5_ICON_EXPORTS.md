# Exports de l’icône Atlas

La géométrie canonique reste `public/learnx-icon.svg`. Les deux chemins du L et
du X ainsi que le `viewBox="0 0 512 512"` sont immuables.

## Variantes

- principale installée : papier `#F1EEE6`, L encre `#121C24`, X bleu Atlas
  `#557F9A` ;
- favicon technique : `public/learnx-icon-dark.svg`, fond encre `#121C24`, L
  ivoire `#F8F5EE`, X bleu Atlas `#557F9A`.

La variante sombre n’est jamais l’icône principale installée. Aucun export
n’ajoute masque, ombre, bordure, texture ou effet.

## Pipeline reproductible

Exécuter `pnpm icons:export`. Le script
`scripts/export-atlas-icons.ts` et Chromium produisent depuis le SVG principal les tailles
1024, 512, 192, 180, 60, 40, 32 et 29 px. Les tests vérifient les dimensions,
les références et les couleurs SVG avant livraison.

## Affectations

| Usage | Fichier | Variante |
| --- | --- | --- |
| Source canonique | `/learnx-icon.svg` | Papier vectoriel |
| Manifeste PWA | `/learnx-icon-192.png`, `/learnx-icon-512.png` | Papier |
| Apple touch | `/learnx-icon-180.png` | Papier |
| Export App Store/source | `/learnx-icon-1024.png` | Papier |
| Petites tailles natives | `/learnx-icon-60.png`, `-40.png`, `-32.png`, `-29.png` | Papier |
| Favicon | `/learnx-icon-dark.svg` | Sombre technique |

Les anciens fichiers `pwa-*.png` et `apple-touch-icon.png` sont conservés
temporairement pour rollback, mais ne sont plus référencés par les manifestes ou
les métadonnées HTML.
