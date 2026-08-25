# V4 — cartographie d’implémentation Totem

## Autorité

Statut : **DESIGN VALIDÉ — IMPLÉMENTATION ET QA PREVIEW TERMINÉES**

Date d’arbitrage : 24 août 2026

Validation : Rayan

Les deux paquets ci-dessous constituent le langage visuel ferme de la V4. Ils
priment sur les anciennes captures Atlas et sur les ajustements UI ponctuels :

- mobile et fondations partagées :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-totem-mobile-authority/` ;
- extension desktop :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-totem-desktop-authority/`.

Le manifeste de chaque paquet est `APPROVED`, version `1.0.0`, avec
`implementationHandoffAllowed: true`. Une différence visuelle doit être traitée
comme un défaut à corriger, pas comme une variation libre.

Les surfaces publiques et la marque disposent en outre de deux autorités
approuvées le 24 août 2026. Elles étendent Totem sans modifier les contrats
produit ou scientifiques :

- landing et journal de recherche :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-totem-public-authority/` ;
- icône, marque PWA et favicon :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-brand-assets-authority/`.

Ces deux manifestes sont `APPROVED`, version `1.0.0`. La landing conserve un
CTA primaire unique, le journal reste append-only et chaque article peut être
partagé via son URL canonique. Le dossier technique continu demeure distinct
des publications chronologiques.

## Fondations partagées

| Contrat | Valeur attendue | Cible principale |
| --- | --- | --- |
| Typographie | DM Sans | `src/styles/index.css` |
| Canvas | `#F4F6FB` | tokens CSS |
| Surface | `#FFFFFF` | tokens CSS |
| Encre | `#17233B` | tokens CSS |
| Texte secondaire | `#647087` | tokens CSS |
| Cobalt | `#3B5BD6` | action, focus, progression |
| Brume | `#E7EDFF` | surfaces secondaires |
| Corail rare | `#CC6B57` | angle signature uniquement |
| Interdits | vert, gradient IA, fintech, gamification | revue globale |

Les composants partagés à stabiliser avant les pages sont le shell, la
navigation, les boutons, les champs, les états, les surfaces signature, les
listes, les tableaux administrateur et les retours de correction.

Au 25 août, les tokens, shells produit/admin/auth, Aujourd’hui, Mes parcours,
Découvrir, Notes, Profil, Crédits, correction assistée et les primitives PWA
sont raccordés sur la branche de livraison. La QA locale et preview couvre
lint, typecheck, tests unitaires/intégration, build et Playwright, notamment
320/390/720/1024/1440/1920, zoom 200 %, clavier, focus et reduced motion. Le
smoke preview authentifié a réussi ; cette cartographie n'autorise toutefois
ni `main` ni l'ouverture production, qui restent gouvernées par V4-019.

## Phase 1 — mobile et fondations

| ID | Route LearnX | Implémentation existante ou cible | Tests de référence |
| --- | --- | --- | --- |
| H-01 | `/today` | `src/pages/TodayPage.tsx` | `src/pages/TodayPage.test.tsx` |
| P-01 | `/program` | séparer `ProgramsPage` dans `src/pages/CurriculumPages.tsx` | `src/pages/CurriculumPages.test.tsx` |
| D-01 | `/discover` à créer | nouvelle page dédiée, données `/api/catalog/programs` | nouveau test de page + route |
| N-01 | `/notes` | `src/pages/NotesPage.tsx` | `src/pages/NotesPage.test.tsx` |
| N-D02 | `/notes/:noteId` | `NotePage`, sauvegarde explicite | `src/pages/NotesPage.test.tsx` |
| PF | `/profile` | `src/pages/ProfilePage.tsx` | test de page à compléter |
| AUTH | `/login`, `/request-access`, `/activate`, `/verify-email` | pages d’authentification existantes | tests auth/public existants |
| ADMIN-M | `/admin*` | navigation mobile et surfaces existantes | tests admin existants |
| SHELL-M | toutes routes privées | `MobileLayout`, `BottomNavigation` | `MobileLayout.test.tsx` |

Décisions non négociables :

- H-01 : une reprise dominante, au maximum trois reprises secondaires, aucun
  compteur nul décoratif ;
- P-01 : uniquement les parcours suivis, sans catalogue ni contrôle segmenté ;
- D-01 : route stable et recherche dédiée ;
- N-01 : lignes pleine largeur sans badges ni colonne d’action ;
- N-D02 : action Créer/Enregistrer explicite ; l’autosave ne concerne que le
  brouillon et doit être annoncé via `aria-live` ;
- PF : e-mail et langue uniques, vérité PWA, crédits et administration depuis
  le profil, déconnexion pleine largeur ;
- navigation admin exacte : Parcours, Accès, Comptes, Contacts, Crédits.

## Phase 2 — extension desktop

Le desktop commence à `1024px` CSS et réutilise les mêmes composants et données.
Il ne constitue jamais une seconde application.

| ID | Surface | Contrat desktop |
| --- | --- | --- |
| H-D01 | Aujourd’hui | sidebar 216–224 px, contenu priorisé, rail seulement utile |
| P-D01 / D-D01 | Parcours / Découvrir | séparation identique au mobile, contenu max 1216 px |
| N-D01 / N-D02 | Notes | vrai master-detail, lecture 760–800 px, rail 288–320 px |
| A-D* | Administration | sidebar 232–248 px, tableaux sémantiques, drawer accessible |
| C-D* | Correction et crédits | devis, preuves, résultat et historique sans vocabulaire token |

Les notes master-detail gèrent `ArrowUp`, `ArrowDown`, `Home`, `End` et `Enter`.
Sous `45rem`, les tableaux administrateur se réorganisent sans perdre leurs
libellés. À 720 px et zoom 200 %, aucune sidebar fixe ne subsiste.

## Validation bloquante

- largeurs : 320, 390, 720, 1024, 1440 et 1920 px ;
- zoom et taille de texte : 200 % ;
- cibles interactives : 44 × 44 px minimum ;
- navigation clavier et focus visibles ;
- contraste AA et aucune couleur comme signal unique ;
- ordre DOM cohérent avec l’ordre visuel ;
- zones sûres mobiles ;
- `prefers-reduced-motion` respecté ;
- textes longs en français et en anglais ;
- lint, typecheck, tests ciblés, tests complets et build verts à la fin de
  chaque phase.
## Ordre d’exécution

1. Stabiliser le raccord fonctionnel V4 writing-only.
2. Implémenter les fondations et la phase mobile.
3. Faire la validation mobile complète et corriger les écarts.
4. Étendre les mêmes composants au desktop.
5. Faire la validation desktop et responsive complète.
6. Finaliser correction, crédits et administration sur ces primitives.
7. Mettre à jour la recherche publique et la marque, puis exécuter le gate de
   release.
