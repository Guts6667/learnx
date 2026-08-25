# V4 — cartographie restrictive d’implémentation Totem

## Autorité finale

- **Statut** : `ACTIVE_DESIGN_AUTHORITY_RESTRICTED`
- **Date d’arbitrage** : 25 août 2026
- **Validation** : Rayan
- **Implémentation** : terminée sur la branche de livraison ; recette
  propriétaire sur `dev` requise avant `main`

Trois références visuelles seulement sont autoritaires. Elles ne valent que
pour le périmètre explicitement listé ci-dessous :

1. apprentissage — Leçon, Exercice, Correction formative et Révisions :
   `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-learning-flow.html` ;
2. landing et entrée — Landing, création de compte, vérification e-mail,
   première direction et composants publics/d’entrée présents dans le fichier :
   `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-landing-account-components.html` ;
3. contenu technique SourceLab — principes, bloc de code, trajet de requête,
   Docker/Compose, ERD Prisma, états worker et CI/rollback :
   `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-technical-content-system.html`.

Ces fichiers font autorité à l’exactitude sur leurs surfaces mobile et desktop.
Les contrôles du prototype ne font pas partie du produit.

## Références retirées

Toutes les autres maquettes ou explorations sont non autoritaires, notamment :

- `learnx-totem-product-surfaces.html` ;
- `learnx-totem-entry-admin-surfaces.html` ;
- `learnx-totem-evaluation-public-surfaces.html` ;
- `learnx-totem-v4-final-surfaces.html` ;
- `learnx-totem-core-flow.html` et `learnx-totem-screens/` ;
- `learnx-totem-editorial-system.html` ;
- `learnx-totem-serious-palettes.html` ;
- `learnx-totem-search-bottom-sheet.html` ;
- `learnx-totem-modern-kinetic.html` ;
- les anciens paquets mobile, desktop, public, Atlas et les explorations de
  marque précédemment cités par ce document.

Elles restent des preuves historiques, mais ne peuvent fournir ni composant,
ni composition, ni règle par défaut. Un manque dans les trois références
actives devient `ARBITRATION_REQUIRED`.

## Contrats préservés

- L’accès LearnX reste privé : la référence « création de compte » est adaptée
  au parcours d’activation sans ouvrir une inscription publique.
- La première direction intervient après activation et avant l’arrivée dans
  l’espace d’apprentissage.
- Connexion et demande d’accès restent fonctionnellement et visuellement
  inchangées tant qu’aucune nouvelle référence n’est validée.
- La correction reste formative et sans effet sur la progression.
- Le système technique s’applique uniquement aux contenus SourceLab ; il ne
  devient pas un langage global implicite.

## Matrice d’implémentation

| Surface | Code principal | État au 26 août | Prochaine preuve |
| --- | --- | --- | --- |
| Leçon | `src/pages/LessonPage.tsx` | `IMPLEMENTED_PENDING_OWNER_QA` | recette mobile/desktop sur `dev` |
| Exercice | `src/pages/ExercisePage.tsx`, `src/features/exercises/ExerciseCard.tsx` | `IMPLEMENTED_PENDING_OWNER_QA` | recette de saisie, critères et disclosure sur `dev` |
| Correction formative | `src/features/exercises/AiCorrectionPanel.tsx` | `IMPLEMENTED_PENDING_OWNER_QA` | recette des preuves, limites et états réels sur `dev` |
| Révisions | `src/pages/ReviewsPage.tsx` | `IMPLEMENTED_PENDING_OWNER_QA` | recette de la priorité et de la suite sur `dev` |
| Landing | `src/pages/LandingPage.tsx` | `AUTOMATED_QA_PASSED_PENDING_OWNER` | recette FR/EN sur `dev` |
| Création/activation | `src/pages/ActivateAccountPage.tsx` | `IMPLEMENTED_ADAPTATION_PENDING_OWNER_QA` | recette avec une invitation valide sur `dev` |
| Vérification e-mail | `src/pages/VerifyEmailPage.tsx` | `IMPLEMENTED_PENDING_OWNER_QA` | recette avec un lien réel sur `dev` |
| Première direction | `src/pages/FirstDirectionPage.tsx` | `IMPLEMENTED_NON_BINDING_PENDING_OWNER_QA` | vérifier découverte, reprise et absence d’inscription automatique |
| Bloc de code SourceLab | `src/components/ui/SafeMarkdown.tsx` | `IMPLEMENTED_AND_TESTED` | recette sur une leçon SourceLab publiée |
| Figures SourceLab | `public/learning/sourcelab/*.svg`, `SafeMarkdown` | `IMPLEMENTED_FROM_EXISTING_EVIDENCE` | recette du reflow et des descriptions textuelles sur `dev` |

## Preuves automatiques du 26 août 2026

- lint et typecheck : verts ;
- suite : `913/913` tests verts ;
- E2E : `75` scénarios réussis, `33` scénarios non applicables au profil de
  navigateur concerné et `0` échec ;
- build PWA : vert ;
- contrôle landing FR/EN : aucun débordement à 320, 390, 720, 1440 et
  1920 px ;
- cibles publiques visibles : 44 px minimum, consentements inclus ;
- blocs techniques : code et sorties séparés, copie, numéros de ligne, focus
  authoré, chemin optionnel et défilement local testés.

La preuve automatique ne remplace pas la recette propriétaire des surfaces
authentifiées avec des données réelles. Cette recette est le dernier gate avant
la proposition de merge sur `main`.

## Surfaces sans autorité visuelle active

Aujourd’hui, Parcours, Programme, recherche produit, Notes, Profil, connexion,
demande d’accès, quiz, évaluations hors `learning-flow`, administration,
crédits, devis, traitement V4, historique, articles de recherche et identité
globale ne peuvent pas être refondus sur la base d’une maquette retirée.

Leur fonctionnement et leurs preuves historiques sont conservés. Toute refonte
nécessite une validation visuelle explicite distincte.

## Gates bloquants

- 320, 390, 720, 1440 et 1920 px ;
- zoom et taille de texte à 200 % ;
- clavier, focus visible, ordre DOM et cibles tactiles ;
- contraste WCAG et aucun sens transmis par la couleur seule ;
- `prefers-reduced-motion` ;
- code lisible avec défilement local sur mobile ;
- textes français et anglais ;
- lint, typecheck, tests ciblés, suite complète et build.

Une surface n’est déclarée conforme qu’après comparaison directe avec l’un des
trois fichiers actifs. Aucun ancien PNG ne constitue une cible de QA.
