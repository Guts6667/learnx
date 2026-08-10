# LearnX V3.5 — Catalogue des primitives UI

**Ticket : V3.5-002**

**Statut : ACTIF**

Ce document applique la direction « Minéral calme » approuvée dans
`docs/V3_5_BRAND_DIRECTION.md`. Il décrit les primitives partagées ; les
refontes complètes mobile et desktop restent dans V3.5-003 et V3.5-004.

## Principes communs

- Une zone ne présente qu'une action remplie dominante.
- Une carte représente un bloc autonome, jamais un simple besoin d'espacement.
- Une carte ne peut contenir qu'un seul niveau de groupe surfacé.
- Un état associe texte et, lorsque pertinent, forme ou icône ; la couleur ne
  porte jamais seule l'information.
- Toute cible interactive mesure au moins 44 × 44 px.
- Texte courant : contraste minimal 4,5:1 ; limite de contrôle et focus : 3:1.
- Le DOM suit l'ordre de lecture et reste utilisable au clavier et à 200 %.

## Choisir une structure

| Besoin | Primitive | Ne pas utiliser |
| --- | --- | --- |
| contenu autonome avec action propre | `Card` | carte dans une carte |
| partie du document courant | `Section` | fond et bordure sur chaque partie |
| collection d'éléments comparables | `ListRow` dans `.ui-list` | grille de cartes identiques |
| information secondaire courte | `Metadata` | série de badges |
| état métier | `Badge` | couleur ou icône seule |
| message système | `EmptyState`, `ErrorState`, `OfflineBanner` | carte décorative |
| action GET | `NavigationAction` | bouton avec changement d'URL manuel |
| mutation | `Button` | lien stylé comme une mutation |

## Actions

### Intention et anatomie

`Button` déclenche une mutation locale ou distante. `NavigationAction` change
de route par une requête GET. Leur anatomie commune est : libellé explicite,
icône facultative, indicateur de chargement facultatif et cible de 44 px.

### Variantes

- `primary` : action principale unique de la zone ; fond rempli ;
- `secondary` : alternative importante ; contour visible ;
- `ghost` : action tertiaire ou fermeture ; aucun contour au repos ;
- `danger` : mutation destructive ; contour danger, jamais remplissage
  agressif par défaut.

### États et accessibilité

Repos, hover, focus, pressed, disabled et loading utilisent le même libellé.
`aria-busy` est exposé pendant le chargement et le bouton devient réellement
désactivé. Le focus utilise `--color-focus`, indépendamment du hover.

**Bon usage :** « Enregistrer » primaire et « Annuler » secondaire.

**Anti-exemple :** trois boutons remplis concurrents ou un lien qui effectue une
suppression.

## Champs et sélection

`TextField`, `Textarea` et `Checkbox` conservent un label permanent, puis le
contrôle, puis une description ou une erreur. Le message est relié par
`aria-describedby`, et une erreur active `aria-invalid` et `role="alert"`.

États : vide, renseigné, focus, disabled, readonly et error. La bordure normale
utilise `--color-control-border` ; l'erreur utilise `--color-danger` en plus du
message textuel.

**Bon usage :** une aide concise expliquant le format attendu.

**Anti-exemple :** placeholder utilisé comme unique label ou validation indiquée
uniquement par une bordure rouge.

## Card

Bloc autonome possédant son propre sujet et éventuellement une action. Anatomie
: contenu, métadonnées éventuelles, puis actions. Variantes :

- `default` : surface standard ;
- `accent` : bloc actif ou recommandé, sans remplacer un statut textuel ;
- `muted` : groupe autonome secondaire sans bordure.

Une carte ne contient pas une autre carte. Une sous-partie utilise `Section`,
un filet ou `ListRow`.

**Bon usage :** prochaine activité recommandée.

**Anti-exemple :** chaque paragraphe d'une leçon dans une carte.

## Section

Partie typographique d'une page ou d'un contenu courant. Anatomie facultative :
titre, description, action tertiaire, contenu. Deux sections adjacentes sont
séparées par un filet ; elles n'ajoutent ni fond, ni ombre, ni grand rayon.

**Bon usage :** bloc de connaissance dans la leçon.

**Anti-exemple :** section utilisée comme dialogue ou élément cliquable entier.

## ListRow

Élément d'une collection comparable. `.ui-list` porte les filets externes ; les
`ListRow` portent un filet entre voisins. Une ligne expose une zone de contenu
flexible et un aside facultatif stable. Sur mobile, l'action peut passer sous le
contenu sans comprimer le titre.

**Bon usage :** note, leçon, compte ou demande d'accès dans une liste.

**Anti-exemple :** cinq cartes identiques avec fonds et ombres dans une liste.

## Metadata

`Metadata` est une liste descriptive de couples libellé/valeur : durée, date,
auteur, contexte ou dernière modification. Le libellé peut être visuellement
masqué s'il reste nécessaire au lecteur d'écran. Les métadonnées n'utilisent
pas de pilule sauf si elles expriment un véritable statut.

**Bon usage :** « Durée 12 min · Mise à jour hier ».

**Anti-exemple :** transformer durée et date en badges colorés.

## Badge et états

`Badge` est réservé à un statut bref. Variantes sémantiques : `neutral`, `info`,
`success`, `warning`, `danger`. Le texte décrit toujours l'état.

| État | Ton | Formulation attendue |
| --- | --- | --- |
| disponible | neutral | Disponible |
| actif / en cours | info | En cours |
| terminé | success | Terminé |
| verrouillé | neutral | Verrouillé + explication à proximité |
| attention | warning | Action ou information attendue |
| erreur | danger | Erreur + remédiation |
| désactivé | neutral | raison accessible, contrôle désactivé |
| chargement | aucun badge | skeleton, spinner ou annonce de statut |

**Anti-exemple :** badge décoratif pour une durée ou couleur sans libellé.

## ProgressBar

Anatomie : libellé, valeur facultative, piste et barre. Les attributs
`aria-valuemin`, `aria-valuemax` et `aria-valuenow` exposent la valeur serveur.
La progression utilise `--color-accent`, pas la couleur d'action.

**Bon usage :** progression pédagogique calculée côté serveur.

**Anti-exemple :** barre utilisée comme position de lecture ou valeur recalculée
dans le composant métier.

## Feedback

- `EmptyState` : absence attendue, titre, explication et action facultative ;
- `ErrorState` : erreur bloquante avec `role="alert"` et remédiation ;
- `OfflineBanner` : état réseau avec `role="status"` ;
- `Skeleton` : structure en chargement annoncée ;
- `Spinner` : attente courte dans une action ou une petite zone.

Ces états utilisent un filet latéral ou pointillé plutôt qu'une carte complète.
Un chargement de page préfère un skeleton ; un spinner seul est réservé à une
attente locale.

## Drawer et dialogues

`Drawer` porte les interactions secondaires qui doivent préserver le contexte.
Il utilise `role="dialog"`, `aria-modal`, un titre, un bouton Fermer explicite,
un piège de focus, Échap et une restauration du focus. L'overlay est la seule
surface élevée avec ombre dans ce catalogue.

Les confirmations destructives existantes doivent rejoindre une primitive de
dialogue dédiée lors de leur migration ; une `Card role="alertdialog"` est
dépréciée et ne doit plus être introduite.

## Comparaison représentative

| Contexte | V3 | Fondation V3.5-002 | Migration complète |
| --- | --- | --- | --- |
| Programme | une carte sobre par étape, mais couleurs directes | carte sémantique sans ombre ; badges et progression unifiés | V3.5-003/004 |
| Leçon | chaque contenu dans une carte | contenu courant devient `Section`; activités autonomes gardent une surface | V3.5-003 |
| Administration | cartes et faux dialogues hétérogènes | actions, champs, statuts et surfaces partagent les mêmes rôles | V3.5-004 |
| Notes | une carte complète par note | note représentative rendue en `ListRow` avec filets | V3.5-003/004 |

Cette passe réduit le chrome commun sans modifier l'information, les routes ou
les actions. Les tickets d'écran restent responsables de retirer les derniers
groupes surfacés et styles directs.

## Classification des primitives V3

| Primitive V3 | Décision |
| --- | --- |
| Button / NavigationAction | adapter aux actions sémantiques |
| Card | conserver avec usage autonome strict |
| Badge | adapter et réserver aux statuts |
| TextField / Textarea / Checkbox | conserver et adapter |
| ProgressBar | conserver et adapter |
| EmptyState / ErrorState / OfflineBanner | adapter en feedback léger |
| Drawer | conserver et adapter |
| Skeleton / Spinner | conserver et adapter |
| `Card role="alertdialog"` | déprécier puis supprimer |
| couleurs Tailwind directes dans les pages | déprécier, migrer par famille |
| grands rayons et ombres de contenu | déprécier |

## Validation et rollback

Tests obligatoires : composants, ordre clavier, focus, annonces, contrastes et
largeurs 320, 390, 1024 et 1440 px. Le zoom 200 % et reduced motion sont revus
sur l'échantillon.

Les variables `--app-*` restent des aliases vers les nouveaux tokens pendant la
migration. Le rollback consiste à restaurer les anciennes classes des
primitives sans toucher aux données ni aux écrans métier.
