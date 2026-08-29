# Système de design LearnX

- **Version** : 1.0.0 — V4.2
- **Statut** : autorité de design pour toutes les surfaces, publiques et produit
- **Remplace** : `docs/V4_TOTEM_DESIGN_IMPLEMENTATION_PLAN.md` et la partie
  « fondations » de `docs/V4_TOTEM_IMPLEMENTATION_MAP.md`, qui restent des
  preuves historiques V4 et ne doivent plus être appliquées telles quelles.
- **Référence visuelle validée** : `learnx-landing-reference.html`, appliquée
  sur la landing en V4.2 et étendue au produit à partir de là.

## 1. Ce que le système doit produire

Une seule chose : que la personne sache **où elle en est, quoi faire
maintenant, et ce qui est conservé**. Tout choix visuel qui ne sert pas ça est
décoratif et doit être justifié.

Le contrat émotionnel (`docs/EMOTIONAL_DESIGN_CONTRACT.md`) reste valable et
gouverne le ton : confiance calme, progression tangible, jamais de félicitation
automatique ni de métrique sans action.

## 2. Fondations

Toutes définies une seule fois, dans `src/styles/tokens/theme.css`. Il n'existe
plus de deuxième palette, d'alias de migration ni de couche `.totem-theme` qui
remappe les tokens : cinq couches ont été fusionnées en V4.2 et il est interdit
d'en réintroduire une.

### Couleur

| Rôle | Token | Valeur |
| --- | --- | --- |
| Fond de page | `--color-canvas` | `#F6F7FB` |
| Surface | `--color-surface` | `#FFFFFF` |
| Surface secondaire | `--color-surface-subtle` | `#EEF0FD` |
| Encre (texte) | `--color-text` | `#101B33` |
| Texte secondaire | `--color-text-muted` | `#5B6478` |
| Action, focus, progression | `--color-action` | `#4F52D9` |
| Action au survol | `--color-action-hover` | `#3E41B8` |
| Bordure décorative | `--color-border` | `#E4E6F0` |
| Bordure de contrôle | `--color-control-border` | `#8491A8` |
| Corail — signature rare | `--color-coral` | `#D97757` |

Sur la bande encre, les rôles sont nommés et ne doivent jamais être réinventés
localement : `--color-ink-surface`, `--color-on-ink`, `--color-on-ink-muted`,
`--color-accent-on-ink`, `--color-coral-on-ink`, plus la rampe
`--color-line-on-ink*` et `--color-fill-on-ink*`.

**Discipline du corail.** Accent de signature uniquement : angle décoratif,
point de statut, filet à gauche d'un bloc. Jamais une deuxième couleur d'action,
jamais une réussite, jamais un prix. **Et jamais du texte sur fond clair** :
`#D97757` sur `#F6F7FB` mesure 2,92 et échoue AA. Sur la bande encre il mesure
5,48 et reste autorisé.

**Interdits** : vert, gradient « IA », esthétique fintech, gamification,
couleur portant seule une information.

### Typographie

- **Affichage** — Plus Jakarta Sans 600/700, via `--font-editorial`. Titres.
- **Interface** — DM Sans 400/500/600/700, via `--font-interface`. Corps, UI.

Les quatre graisses DM Sans sont réellement chargées. `font-synthesis: none`
est global : déclarer une graisse non chargée la fait retomber silencieusement
sur la plus proche. N'utiliser que 400, 500, 600, 700.

Échelle : `--text-2xs` 11 → `--text-4xl` 32, plus les `clamp()` d'affichage. Sur
les surfaces publiques, l'échelle de lecture est plus ample que celle du
produit : une page marketing se lit, une surface produit s'opère. Les deux
restent sur les mêmes tokens.

### Espacement, rayons, mouvement

Rampe de 4px, `--space-0-5` à `--space-12`. Une valeur hors rampe reste
littérale plutôt que d'être arrondie — arrondir déplace la mise en page sans
bénéfice. Rayons : `--radius-control`, `--radius-group`, `--radius-surface`.
Mouvement : `--motion-fast|standard|overlay`, easing unique.

## 3. Le motif de progression

Un filet de 2px qui se remplit à l'apparition, via
`src/lib/use-reveal-on-scroll.ts` et la classe `.progress-rule`.

C'est **le** signal visuel de progression du produit. Partout où une surface
montre « vous êtes ici, voici la suite », elle réutilise ce traitement au lieu
d'inventer un indicateur. Il retombe sur son état final sous
`prefers-reduced-motion`, sans `IntersectionObserver`, et dans un runtime sans
`matchMedia` : l'information n'est jamais portée par l'animation seule.

## 4. Règles de composition

- **Une seule action principale remplie par zone.** Sur une page, un seul CTA
  de forte intention, répété à l'identique si nécessaire. Une action secondaire
  ne doit jamais lui faire concurrence — c'est un lien, pas un bouton.
- **Langage clair partout sauf en Recherche.** Le vocabulaire interne
  (« borné », « critériel », « Horizon V5 ») n'a sa place que dans la section
  Recherche, dont la rigueur est le sujet. Ailleurs, traduire en bénéfice.
- **Une métrique sans action est masquée**, `0` compris. Pas de barre de
  progression vide « bientôt disponible ».
- **La preuve au point d'usage.** Une leçon affiche sa source là où elle sert.
  Ce que la landing promet, le produit doit le montrer.
- **Une phrase par idée.** Aucun paragraphe de plus de deux lignes en corps.

## 5. Pièges vérifiés, à ne pas refaire

Chacun a réellement été livré et corrigé en V4.2 :

- **Collision de cascade sur `.page-title`.** Déclaré 600 dans `layout.css`,
  600 à nouveau puis 500 dans `product.css` à spécificité identique : la
  dernière gagnait silencieusement. Avant d'ajouter une règle de titre,
  vérifier qu'aucune autre ne la contredit.
- **Texte invisible par surcharge de couleur.** `.landing-utility a` colorait
  tous les liens de la barre et l'emportait sur la primitive bouton : le CTA
  s'affichait indigo sur indigo. **axe ne l'a pas détecté.** Un contrôle
  d'accessibilité automatique ne remplace pas le fait de regarder.
- **Aucune classe de palette Tailwind brute.** `bg-slate-900` a été livré une
  fois. Le garde dans `totem-foundations.test.ts` couvre désormais toute la
  palette ; passer par `var(--color-*)`.
- **Ne jamais reformater les preuves.** `benchmarks/`, `content/`, `public/`,
  `seed/` et `docs/` sont exclus de Prettier : corpus, specs pédagogiques,
  articles publiés et bundles de seed sont cités par digest ailleurs.

## 6. Vérification

- `pnpm test:visual` — 30 captures de référence, 3 largeurs. Pré-vol local
  avant et après tout changement de design. Tolérance calibrée : `threshold`
  0,01 et ratio 0,0005, vérifiée dans les deux sens.
- `src/server/quality/totem-foundations.test.ts` — palette, contrastes AA
  (texte et bordures de contrôle à 3:1), graisses, géométrie.
- `pnpm test:e2e` — axe WCAG 2.1 AA sur huit specs, plus clavier, zoom 200 %
  et reflow de 320 à 1920.

Un contraste se prouve par test, pas à l'œil. Une régression visuelle se lit
dans une capture, pas dans une intention.
