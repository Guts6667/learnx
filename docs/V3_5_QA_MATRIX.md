# Matrice QA V3.5 — LearnX Atlas

## Statut

- Baseline : `dev` après les revues d'écart V3.5-001 à V3.5-007.
- Références : A1, A2, A3 et A4 de `BACKLOG_V3_5.md`.
- Automatisation : active ; les résultats exacts sont consignés par la matrice
  de commandes de V3.5-008 puis le rapport de clôture V3.5-009.
- Revue humaine de marque : **à valider**.
- Revue humaine d'utilisabilité et VoiceOver : **à valider séparément**.

Ce document ne transforme pas une baseline visuelle en approbation humaine et
ne déclare aucun contrôle manuel réussi sans preuve.

## Matrice des familles

| Famille | Référence | Largeurs automatisées | États et interactions | Preuve actuelle | Décision humaine |
| --- | --- | --- | --- | --- | --- |
| Landing publique | A3 | 320, 390, 768, 1024, 1440, 1920 | FR/EN, CTA, formulaire, absence de navigation privée, axe | `tests/e2e/landing.spec.ts` | À valider |
| Shell et primitives | A2 | 320, 390, 768, 1024, 1440, 1920 | cibles 44 px, zoom 200 %, axe | `tests/e2e/ui-primitives.spec.ts` | À valider |
| Programme et leçon | A1/A3 | 320, 390, 1440, 1920 | accordéon, titres longs, navigation, sommaire, clavier, erreurs | `tests/e2e/home.spec.ts` | À valider |
| Exercice et Réviser | A1 | 320, 390, desktop | activité profonde, correction existante, focus et états | `tests/e2e/home.spec.ts` et tests composants | À valider |
| Notes et Profil | A1/A3 | 320, 390, desktop | Markdown sûr, actions, session et PWA | tests `NotesPage`, `ProfilePage`, `PwaStatus` | À valider |
| Administration | A1 | 390, 768, 1024, 1440, 1920 | navigation profonde, tiroir, Échap, restitution du focus, axe | `tests/e2e/admin.spec.ts` | À valider |
| Contacts landing | A4 | 390, 1440, zoom 200 % | default, loading, empty, error, retry, double finalité, axe | `tests/e2e/admin-contacts.spec.ts` | À valider |
| Correction IA | A1 | — | Surface non livrée en V3.5 | Référence réservée à V4 ; aucune fausse UI | Sans objet V3.5 |

## Contrôles transversaux automatisés

- Palette A2 exacte, fontes locales, espacements, rayons et contrastes :
  `src/server/quality/atlas-foundations.test.ts`.
- Absence de classes vertes, émeraude, teal et cyan électrique : même contrôle.
- Liens publics et renouvellement PWA :
  `src/server/quality/pwa-public-routes.test.ts`.
- Identité de contact dédupliquée :
  `src/server/quality/public-contacts.test.ts`.
- WCAG automatisé : `@axe-core/playwright`, impacts serious/critical bloquants.
- Reduced motion et forced colors : règles CSS versionnées et matrice E2E.
- Mesure de lecture : tokens `--app-reading-max` et gabarits limités à 68–72ch.

## Revue humaine requise avant clôture

Pour chaque famille applicable :

1. comparer au screen pack sans rechercher une copie pixel-perfect ;
2. vérifier hiérarchie, rythme, action dominante et absence de cardification ;
3. tester VoiceOver sur iOS à 390 px et VoiceOver ou lecteur équivalent sur
   desktop ;
4. tester texte système/zoom 200 %, clavier seul et reduced motion ;
5. consigner `accepté`, `écart à corriger` ou `écart accepté`, avec justification.

Un défaut P0/P1, un contenu masqué, une action inaccessible ou une information
exprimée uniquement par couleur bloque V3.5-009.
