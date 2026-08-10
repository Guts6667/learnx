# LearnX V3.5 — Direction de marque et tokens visuels

**Ticket : V3.5-001**

**Statut : APPROUVÉ — validation humaine obtenue le 10 août 2026**

**Portée : cadrage uniquement, aucune modification des écrans**

## 1. Direction approuvée

Le territoire retenu est **Minéral calme**, avec deux régimes complémentaires
de la même marque :

- **application, apprentissage et administration :** régime sombre minéral ;
- **surfaces publiques et éditoriales :** régime papier clair.

Les deux régimes partagent la même typographie, la même échelle d'espacement,
les mêmes formes, le même accent minéral et les mêmes règles d'interaction. Ils
ne constituent pas deux thèmes interchangeables.

Typographies retenues :

- **Source Serif 4** pour le display éditorial et les titres pédagogiques ;
- **Manrope** pour l'interface, le corps, les métadonnées et l'administration ;
- la pile monospace système pour le code et les identifiants techniques.

Ces familles sont distribuées sous SIL Open Font License. L'intégration devra
préférer des fichiers WOFF2 auto-hébergés, conserver les licences et prévoir les
fallbacks ci-dessous. Aucun fichier de fonte n'est ajouté par ce ticket.

### Pourquoi ce territoire

- Il conserve la familiarité d'une application sombre sans reprendre le bleu
  nuit/cyan très technologique de la V3.
- Le vert minéral est calme, distinctif et compatible avec des disciplines très
  différentes ; il ne code pas une matière particulière.
- Le régime papier donne aux pages publiques et aux contenus éditoriaux une
  présence plus chaleureuse sans créer une seconde identité.
- Les contrastes proposés supportent les contenus longs, les listes denses et
  les contrôles administratifs.

Cette direction a été validée explicitement par le propriétaire le 10 août
2026. Elle constitue la référence visuelle des tickets V3.5 suivants.

## 2. Audit de la baseline V3

### Constats mesurés

- `src/styles/index.css` expose seulement sept tokens visuels généraux et reste
  centré sur Inter, un canevas `slate-950` et un accent cyan.
- Le code contient **414 occurrences** d'utilitaires directs `slate`, `cyan`,
  `red`, `amber` ou `emerald` dans les composants TypeScript/TSX.
- **18 fichiers** utilisent la primitive `Card` et **38 occurrences** emploient
  des rayons `xl` ou supérieurs.
- Les variantes d'action répliquent directement les couleurs dans
  `actionStyles.ts` au lieu de consommer des rôles sémantiques.

### Ce qui doit être conservé

- hiérarchie typographique déjà lisible des titres, descriptions et eyebrows ;
- focus visible, cibles tactiles et prise en charge des safe areas ;
- largeur de lecture plafonnée et interligne généreux des contenus ;
- sobriété générale, faible densité décorative et une action primaire dominante ;
- réduction des animations avec `prefers-reduced-motion`.

### Ce qui donne une impression de PWA mobile étirée

- bleu nuit et cyan utilisés presque partout pour la marque, le focus, les
  liens, les états actifs et les actions ;
- accumulation de cartes bordées, arrondies et ombrées, y compris pour des
  groupes qui relèvent d'un simple rythme typographique ;
- même régime visuel pour apprentissage, pages publiques et administration ;
- palette codée dans les composants, rendant les variations et contrôles de
  contraste difficiles ;
- Inter employée sans distinction entre interface et contenu éditorial long.

### Lecture par contexte

| Contexte | Actif à préserver | Écart à corriger |
| --- | --- | --- |
| Apprentissage mobile | focalisation, CTA unique, navigation accessible | cartes trop présentes, accent cyan omniprésent |
| Apprentissage desktop | largeur de lecture, continuité mobile | manque de composition éditoriale et de rythme horizontal |
| Administration | densité maîtrisée, actions explicites | hiérarchie trop proche des écrans apprenants |
| Public / landing | simplicité et clarté | absence d'un régime éditorial public distinct mais cohérent |

## 3. Comparaison des territoires

| Territoire | Forces | Risques | Verdict |
| --- | --- | --- | --- |
| Encre & papier | éditorial, chaleureux, très lisible | fatigue lumineuse en apprentissage nocturne ; rupture forte avec l'application actuelle | alternative crédible, non recommandée comme régime unique |
| Minéral calme | sérieux sans froideur, continuité maîtrisée, régimes sombre/papier cohérents | demande une discipline stricte pour ne pas devenir un thème décoratif vert | **recommandé** |
| Nocturne neutre | premium, sobre, bonne immersion | trop proche du paradigme sombre actuel ; accent ocre moins extensible aux états | non retenu |

L'atlas sert à vérifier l'intention sur fondations, mobile, desktop, landing et
confiance. Ses gabarits et valeurs ne sont pas une spécification pixel-perfect.

## 4. Tokens sémantiques proposés

Les valeurs ci-dessous constituent le jeu candidat à valider. Les composants
consomment des rôles, jamais une couleur de palette directement.

### 4.1 Régime sombre minéral

| Token | Valeur candidate | Usage |
| --- | --- | --- |
| `--color-canvas` | `#111A1B` | arrière-plan principal |
| `--color-surface` | `#1A2626` | groupe autonome ou contrôle |
| `--color-surface-raised` | `#233231` | menu, tiroir, surface élevée |
| `--color-surface-subtle` | `#151F20` | alternance discrète, jamais carte imbriquée |
| `--color-text` | `#F2EEE6` | texte principal |
| `--color-text-muted` | `#B8C2BE` | métadonnées et aide non critique |
| `--color-border` | `#3B504D` | filet structurel non interactif |
| `--color-control-border` | `#66847D` | limite perceptible d'un contrôle |
| `--color-accent` | `#80B5A8` | marque, progression, état actif |
| `--color-action` | `#9BC9BD` | action primaire et focus |
| `--color-on-action` | `#10201D` | contenu sur action primaire |
| `--color-focus` | `#9BC9BD` | anneau de focus de 2 px minimum |
| `--color-success` | `#80B5A8` | succès confirmé, avec texte/icône |
| `--color-warning` | `#D9B77D` | attention, avec libellé explicite |
| `--color-danger` | `#D88B82` | erreur ou action destructive |
| `--color-disabled` | `#63706C` | contenu désactivé, jamais seul signal |
| `--color-overlay` | `rgb(4 10 10 / 72%)` | arrière-plan de dialogue ou tiroir |

Le filet structurel peut être inférieur à 3:1 parce qu'il ne délimite pas un
contrôle et ne porte aucune information seul. Toute limite interactive utilise
`--color-control-border`.

### 4.2 Régime papier public

| Token | Valeur candidate | Usage |
| --- | --- | --- |
| `--color-canvas` | `#F4F0E7` | page publique / éditoriale |
| `--color-surface` | `#FBF8F2` | formulaire ou groupe autonome |
| `--color-surface-raised` | `#FFFFFF` | overlay uniquement |
| `--color-text` | `#1C2625` | texte principal |
| `--color-text-muted` | `#665F58` | texte secondaire |
| `--color-border` | `#D8CFC3` | filet structurel |
| `--color-control-border` | `#6B7773` | contrôle interactif |
| `--color-accent` | `#527B72` | marque et état actif |
| `--color-action` | `#365F56` | action primaire |
| `--color-on-action` | `#FFFFFF` | contenu sur action |
| `--color-focus` | `#365F56` | anneau de focus |
| `--color-overlay` | `rgb(28 38 37 / 45%)` | overlay public |

Les statuts conservent leurs significations et reçoivent des variantes de
surface dédiées ; ils ne changent jamais de sens entre les régimes.

### 4.3 Règles d'usage

- Accent = repère de marque, progression ou sélection ; action = élément
  déclenchant une intention. Ils ne sont pas interchangeables.
- Une couleur de statut accompagne toujours un texte, une icône ou les deux.
- Le focus ne dépend jamais du hover ni de la couleur d'accent d'un composant.
- Une surface n'est créée que pour un groupe autonome, un contrôle ou un
  overlay ; le rythme normal utilise espaces, titres et filets.
- L'administration partage les tokens sombres, mais utilise une densité et une
  composition propres aux outils de gestion.

## 5. Contraste vérifié

Ratios WCAG calculés sur les valeurs candidates :

| Paire | Ratio |
| --- | ---: |
| texte / canevas sombre | 15,28:1 |
| texte atténué / canevas sombre | 9,68:1 |
| texte / surface sombre | 13,45:1 |
| texte atténué / surface sombre | 8,52:1 |
| texte d'action / action primaire | 9,21:1 |
| bordure de contrôle / canevas sombre | 4,35:1 |
| focus / canevas sombre | 9,67:1 |
| texte / canevas papier | 13,64:1 |
| texte atténué / canevas papier | 5,52:1 |
| danger / canevas sombre | 6,68:1 |
| attention / canevas sombre | 9,28:1 |

Les contrôles et le focus dépassent 3:1 ; les textes dépassent 4,5:1. Les
combinaisons de statuts sur leurs futures surfaces devront être recalculées au
moment de créer les primitives.

## 6. Typographie

| Rôle | Famille | Taille / interligne | Règle |
| --- | --- | --- | --- |
| Display éditorial | Source Serif 4, Georgia, serif | `clamp(2.5rem, 6vw, 5rem)` / 0,98–1,05 | landing et titre de programme exceptionnel |
| Titre pédagogique | Source Serif 4, Georgia, serif | `clamp(2rem, 4vw, 3.25rem)` / 1,08–1,18 | H1/H2 de programme, étape et leçon |
| Corps de lecture | Manrope, system-ui, sans-serif | 1–1,125rem / 1,65–1,75 | largeur idéale 62–68ch, maximum 72ch |
| Interface | Manrope, system-ui, sans-serif | 0,875–1rem / 1,4–1,55 | actions, formulaires et navigation |
| Métadonnée | Manrope, system-ui, sans-serif | 0,75–0,875rem / 1,35–1,5 | durée, statut et contexte ; pas tout en capitales |
| Code | ui-monospace, SFMono-Regular, Consolas, monospace | 0,875–1rem / 1,55 | extraits et identifiants techniques |

Les essais FR/EN doivent inclure accents, apostrophes, guillemets, nombres,
libellés anglais longs et fallback lorsque les fontes ne sont pas chargées.
`font-display: swap` est obligatoire.

## 7. Forme, espace et mouvement

### Espacement

Échelle : `4, 8, 12, 16, 24, 32, 48, 64, 96 px`. Les pages utilisent 16 px
de gouttière à 320 px, 20 px à 390 px et 32–48 px sur desktop. Le rythme de
lecture prévaut sur l'alignement à une grille décorative.

### Rayons et bordures

- contrôle compact : 8 px ;
- bouton ou champ : 10 px ;
- groupe autonome : 12 px ;
- dialogue ou tiroir : 16 px ;
- pilule : uniquement statut court ou filtre ;
- filet standard : 1 px ; focus : 2 px minimum.

Les grands rayons ne sont pas une convention de page et les cartes ne sont pas
imbriquées.

### Élévation et icônes

- aucune ombre sur le contenu courant ;
- ombre légère uniquement pour menu, tiroir et dialogue ;
- icônes linéaires cohérentes, 1,75–2 px, toujours accompagnées d'un libellé
  lorsque l'action n'est pas universelle ;
- taille tactile minimale : 44 × 44 px.

### Mouvement

- micro-interaction : 120 ms ; transition de composant : 180 ms ; overlay :
  240 ms maximum ;
- courbe sobre `cubic-bezier(.2,.8,.2,1)` ;
- aucune animation purement décorative ;
- `prefers-reduced-motion` supprime déplacements et transitions non essentiels.

## 8. Cartographie V3 vers V3.5

| Baseline V3 | Destination V3.5 | Migration |
| --- | --- | --- |
| `--app-background` / `bg-slate-950` | `--color-canvas` | alias temporaire, puis remplacement par primitive |
| `--app-surface` / `bg-slate-900` | `--color-surface` | vérifier si une surface est réellement nécessaire |
| `--app-surface-raised` | `--color-surface-raised` | réserver aux overlays |
| `--app-border` / `border-slate-*` | border ou control-border | distinguer filet et contrôle |
| `--app-text` / `text-slate-50` | `--color-text` | remplacement mécanique après primitives |
| `--app-text-muted` / `text-slate-*` | `--color-text-muted` | supprimer les niveaux arbitraires |
| `--app-accent` / `cyan-*` | accent, action, focus ou progress | migration sémantique, jamais recherche/remplacement global |
| `red-*`, `amber-*`, `emerald-*` | danger, warning, success | vérifier chaque intention et son libellé |
| `rounded-xl/2xl/3xl` | échelle de rayons | réduire selon le rôle réel |
| ombre de `Card` | aucune ou élévation overlay | retirer des groupes non autonomes |

## 9. Stratégie de migration et rollback

1. Valider humainement ce document et les quatre contextes à 390 et 1440 px.
2. Introduire les tokens comme couche additive et conserver les variables
   `--app-*` en alias temporaire.
3. Migrer d'abord les primitives d'action, champ, badge, filet et surface sur un
   échantillon représentatif.
4. Vérifier contraste, daltonisme, zoom 200 %, reduced motion, FR/EN et fontes.
5. Migrer écran par écran ; supprimer un alias seulement lorsque `rg` confirme
   qu'il n'a plus de consommateur.

Rollback : chaque lot conserve les aliases V3 jusqu'à validation de son
échantillon. Le retour au régime V3 reste alors un changement de tokens et de
primitives, sans restauration globale de fichiers.

## 10. Validation humaine obtenue

Le propriétaire a confirmé explicitement :

1. **Territoire :** Minéral calme ;
2. **Régimes :** sombre minéral pour le produit, papier clair pour le public ;
3. **Typographies :** Source Serif 4 + Manrope ;
4. **Tokens :** jeu candidat et règles d'usage de ce document ;
5. **Écarts souhaités :** aucun écart demandé avant V3.5-002.

Le gate de décision de V3.5-001 est donc levé. Les tickets V3.5-002 à V3.5-005
restent néanmoins indépendants : aucun thème global ne doit être appliqué en
dehors de leur périmètre et de leurs validations propres.
