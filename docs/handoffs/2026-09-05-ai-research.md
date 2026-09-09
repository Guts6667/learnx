# Passation — AI Research — 5 septembre 2026

## a. Tâche en cours

V4.5-210 : savoir si un vérificateur étroit et aveugle distingue « établit »
de « à côté ». Branche `ai-research/preserve-artifacts`, poussée le 5
septembre sur le mot de Rayan (tête `98aae786`). État complet dans
`docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md` §14 ; résumé partageable publié
comme artefact « Dossier V4.5-210 ».

- Passe 1 du propriétaire exportée et scellée
  (`adjudication-pass1.owner.2026-09-05.json`) : ne séparait pas les paires.
- Passe 2 en choix forcé, seuils déclarés avant la première réponse
  (`adjudication-pass2.owner.2026-09-05.json`) : **30 originaux sur 37, le
  paquet tient**. Étiquette or = étiquette de paire sur ces 30 paires.
- Reste avant toute dépense : test-retest (10 cartes à J+2, mode à
  construire), seconde personne (15 paires), troisième lecture de 7 paires.
  Mesure du vérificateur ensuite, ≤ 3 USD, sur le mot de Rayan.

## b. Mergé aujourd'hui

Rien dans `main`. Aucun `[deploy]`.

## c. Blocages et coordination avec Head of Development

Rayan veut que Head of Development modifie bientôt cette branche. Fondre
`origin/main` (2 commits, hotfix V4.5-186, PR #108) dedans **conflicte sur
`src/server/api/app.ts` et `app.test.ts`**. Territoire de Head of
Development : je n'y ai pas touché. Deux options, à son choix :

- (a) il fond `main` dans la branche, règle `app.ts`, relance
  `pnpm typecheck && pnpm lint && pnpm format:check`, pousse ; je me recale.
- (b) il part de `origin/main` sur sa propre branche ; fusion plus tard par PR.

Dans les deux cas : pas de `[deploy]` sans build voulu, pas de poussée de
`main` sans le mot de Rayan.

**Fichiers à ne pas modifier** (nouveaux fichiers à côté bienvenus) :
`benchmarks/ai-correction/regression/**` (append-only : paquet v3, clé v3,
questions v1, paires v1, exports et lectures datés, `paste-pack.v1/`),
`scripts/build-adjudication-*.ts`, `scripts/templates/adjudication-*.html`,
`src/lib/ai-correction-adjudication-*.test.ts`,
`docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md`, `docs/V4_5_210_PREREGISTRATION.md`.
Je reste hors de `src/server`.

Message envoyé à la session Head of Development le 5 septembre ; retenu pour
approbation côté récepteur, donc **non délivré** au moment d'écrire ceci.
Cette note est le canal de secours.

## d. Erreurs et leçons

- La page de passe 1 lisait la tranche dans l'adresse après `#` ; le
  visualiseur ne la transmet pas → écran de départ dans la page.
- `display: flex` battait l'attribut `hidden` : vu à l'écran, pas par les
  tests → toujours une capture après un changement de page.
- Ma phrase « les modèles Anthropic répondent non à 5 contre 1 » était
  fausse (4/4/1) : recompter avant d'écrire une ligne de partage.
- Un jugement absolu oui/non est généreux chez l'humain aussi (20 « oui » sur
  37 abîmées) ; la comparaison par paire ne l'est pas (30/37).
- Les contrôles raccourcis portant un atome « chaque … de la copie » ne sont
  plus des positifs (carte 10 : 24/24 « non ») : déclaré, non corrigé.

## e. Besoins

Dépense de la phase : 0,00 USD. Écart de 0,62 USD entre journal et grands
livres toujours à réconcilier avant le prochain achat. Prochain achat
possible : la mesure du vérificateur, ≤ 3 USD, uniquement sur le mot de Rayan
et après les trois lectures humaines restantes.
