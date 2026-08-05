# Système d’interface LearnX V2

## Objectif

Cette spécification encadre la migration visuelle du TICKET-008. Elle ne change
ni les routes, ni les règles métier, ni les contrats API. LearnX reste
mobile-first, mais utilise l’espace disponible sur tablette et desktop.

## Fondations

- Fond neutre sombre, surfaces élevées clairement séparées et contraste AA.
- Accent cyan réservé aux actions principales, au focus et aux informations.
- États succès, attention et erreur toujours accompagnés d’un libellé.
- Échelle d’espacement de 4, 8, 12, 16, 24, 32 et 48 px.
- Corps de texte à 16 px minimum, interlignage de lecture entre 1,6 et 1,75.
- Largeur de lecture longue limitée à environ 72 caractères.
- Zones tactiles d’au moins 44 × 44 px et focus visible de 2 px.

## Gabarits responsive

| Largeur | Organisation |
| --- | --- |
| 320–639 px | Une colonne, contenu prioritaire, marges de 16–20 px |
| 640–1023 px | Cartes en deux colonnes lorsque leur contenu le permet |
| 1024 px et plus | Cadre large, contenu de lecture limité et panneaux secondaires |

Le scroll principal appartient toujours à la page. Un contenu pédagogique ou
une évaluation ne crée jamais de scroll vertical imbriqué. Le padding inférieur
inclut la navigation fixe et `env(safe-area-inset-bottom)`.

## Composants et états

- `Card` porte les surfaces ; ses variantes distinguent contenu, accent et état.
- `Button`, champs et zones de texte partagent rayon, focus, hauteur et états.
- `Badge` complète la couleur par un texte explicite.
- `Skeleton` indique un chargement structurel sans provoquer de saut brutal.
- `EmptyState` et `ErrorState` utilisent une hiérarchie et une annonce dédiées.
- `SafeMarkdown` rend uniquement titres, paragraphes, listes, emphase et liens
  HTTP(S). Le HTML brut reste du texte et les protocoles dangereux ne sont pas
  transformés en liens.

Les états à documenter et tester sur chaque verticale sont : chargement, vide,
erreur, brouillon, verrouillé, terminé et hors ligne.

## Hiérarchie des pages

- Un en-tête contient un surtitre, un titre unique et une description courte.
- Aujourd’hui met la recommandation principale en avant et les métriques à côté
  sur grand écran.
- Curriculum et admin utilisent des grilles de cartes progressives.
- Leçon, quiz et exercice conservent une colonne de lecture confortable dans un
  cadre pouvant accueillir un sommaire secondaire.
- Notes, révisions et profil privilégient des cartes scannables.

La sémantique des liens et commandes reste inchangée dans ce ticket ; sa
clarification appartient au TICKET-009. La navigation principale appartient au
TICKET-010.

## Évaluations longues

Une évaluation finale sépare explicitement : objectif, consignes, cas, format,
remédiation et grille. Les listes numérotées sont de vrais éléments `ol/li`. La
grille expose le critère, son poids et ses exigences. Aucun HTML provenant du
contenu n’est injecté dans le DOM.

## Validation

- Aucun débordement horizontal à 320, 390, 768 et 1440 px.
- Navigation clavier, focus visible et ordre de titres cohérent.
- Zoom 200 %, tailles système iOS et préférence de mouvement réduit.
- Tests unitaires du Markdown sûr, des URL interdites, des listes et des états.
- Vérification des contenus très longs au-dessus de la navigation et safe area.
