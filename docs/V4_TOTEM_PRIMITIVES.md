# V4-016E — Catalogue des primitives Totem

Statut : implémentation isolée, en attente de validation et d’intégration.

## Frontière de migration

`TotemTheme` constitue l’unique frontière d’activation. Il remappe les alias
visuels existants vers les tokens V4-016D sans modifier les surfaces Atlas qui
n’ont pas encore été migrées. Le retrait de cette frontière restaure donc la
présentation précédente sans migration de données.

La route `/design/totem-primitives` est disponible uniquement avec le serveur
de développement. Elle sert à la revue visuelle et d’accessibilité ; elle ne
constitue ni une page produit ni une source de données de démonstration.

## Contrat des composants

| Primitive | Intention et contenu autorisé | États/variantes | Accessibilité et reflow |
| --- | --- | --- | --- |
| `TotemAppShell` | Composer sidebar, topbar, page-head, contenu, rail et navigation mobile sans connaître routes ou permissions | rail et navigation basse optionnels | landmarks fournis par le contenu ; sidebar/rail disparaissent sous 1024 px, aucune donnée supprimée |
| `TotemPublicShell` | Encadrer navigation, contenu et footer publics | contenu libre, aucune promesse intégrée | landmarks publics conservés et ordre DOM logique |
| `Button` / `NavigationAction` | Mutation pour le bouton, navigation GET pour le lien | primary, secondary, editorial, ghost, danger ; tailles et loading | cible ≥ 44 px, focus visible, largeur stable en chargement, `aria-busy` pour une mutation |
| `TextField`, `Textarea`, `Checkbox` | Saisie avec libellé toujours visible | default, focus, disabled, error, aide | label natif, `aria-describedby`, `aria-invalid`, message d’erreur annoncé |
| `Badge` | Statut court obligatoirement libellé | neutral, info, success, warning, danger | la couleur ne porte jamais seule le statut |
| `Card` | Regrouper un bloc autonome, sans imbrication décorative | default, accent, muted, signature | l’angle corail de `signature` est décoratif et n’encode aucun état |
| `ProgressBar` | Afficher une progression calculée par le serveur | valeur visible ou masquée | rôle `progressbar`, bornes et valeur accessibles ; aucune animation utile avec reduced motion |
| `Notice` | Expliquer une information, une attention, un état sûr ou une erreur | info, attention, safe, danger | titre obligatoire, marqueur de forme et rôle `alert` seulement pour danger |
| `StatePanel` | États empty, loading, error et safe d’une zone | action de récupération optionnelle | titre obligatoire, `aria-busy` pour loading, rôle `alert` pour error |
| `ConsentGroup` | Regrouper des choix liés sans fusionner des consentements indépendants | description optionnelle | `fieldset` et `legend` natifs ; chaque choix conserve son label et son état |
| `ResponsiveTable` | Présenter des données administratives tabulaires | colonnes et lignes fournies par le contrat appelant | table à partir de 720 px ; enregistrements `dt/dd` sous 720 px, sans suppression de champ |

## Règles d’usage

- Une seule action principale remplie domine une zone fonctionnelle.
- L’action éditoriale sert à lire, approfondir ou ouvrir une publication ; elle
  ne confirme pas une mutation.
- Le corail reste rare : signature décorative ou attention explicitement
  libellée. Il ne représente ni réussite, ni progression, ni prix.
- Aucun composant n’embarque prix, score, preuve, volume, témoignage ou règle de
  progression. Ces valeurs proviennent exclusivement des contrats serveur.
- Une table mobile conserve toutes les cellules et leurs libellés ; elle ne
  devient jamais une liste de cartes tronquées.
- Un état sûr décrit ce qui est conservé et l’action éventuelle. Il ne promet
  jamais un succès métier que le serveur n’a pas confirmé.

## Matrice de preuve

Le test Playwright `tests/e2e/ui-primitives.spec.ts` contrôle la route locale à
320, 390, 720, 1440 et 1920 px, le reflow à 200 %, le focus clavier, reduced
motion, l’absence de débordement horizontal et les violations WCAG sérieuses ou
critiques. Les tests de composants vérifient séparément les rôles, libellés,
états, consentements et représentations desktop/mobile.

## Dépendances suivantes

V4-016C, V4-016F, V4-016A, V4-016I et V4-016B peuvent adopter ces primitives
par surface, après intégration de V4-016D puis V4-016E. V4-016G reste bloqué par
ses contrats correction, crédits et paiement.
