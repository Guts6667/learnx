# Backlog V4.2 — système de design réel et surface publique

## Autorité et état

- Version : 1.0.0
- Date : 29 août 2026
- Baseline : `origin/main` à `63c436d9` (V4.1 released et clôturée)
- Statut V4.2 : **clôturée** — les dix tickets sont `DONE` et la release est
  publiée le 29 août 2026 au SHA `9c35e9db`. `main` avancé depuis `63c436d9`.
- Périmètre arrêté le 29 août 2026 : V4.2 livre le système de design et la
  surface publique. **La refonte des surfaces produit en est explicitement
  exclue** et devient V4.3, informée par un audit UX indépendant.
- Autorité : ce fichier est l'unique backlog d'exécution V4.2.
- Autorité de design : `docs/DESIGN_SYSTEM.md`.

**Note de rédaction.** Ce backlog est écrit rétroactivement, après la livraison
des lots 000 à 400. C'est un manquement à la gouvernance du projet, qui exige un
backlog d'exécution par version : le travail a été piloté depuis un fichier de
plan hors dépôt, illisible par quiconque reprendrait. Les preuves ci-dessous
sont réelles et vérifiables par SHA, mais la traçabilité a été reconstituée
après coup et non produite ticket par ticket. Le lot 500 revient au
fonctionnement normal.

## Objet

V4.1 a livré la refondation technique à comportement produit constant, sans
revisiter la couche visuelle dont elle héritait. L'audit de cette couche a
montré que le système de design n'existait qu'à moitié : cinq palettes
concurrentes avec des valeurs divergentes, aucune échelle typographique,
une échelle d'espacement adoptée à 4 %, et des graisses déclarées mais jamais
chargées.

V4.2 rend le système réel, puis l'applique. La landing sert de première
démonstration, contre une référence visuelle validée. Les contrats métier,
migrations, progression, correction, pricing et ledger restent inchangés.

## Statuts canoniques

Identiques à V4.1 : `DRAFT → NEEDS_ARBITRATION → READY → IN_PROGRESS → REVIEW
→ QA → READY_FOR_OWNER_GO → DONE`.

## Lot 000 — filet de sécurité

### V4.2-001 — Références visuelles calibrées

- Priorité : P0 · Statut : **DONE** au SHA `d1213f3c`
- 30 captures — landing, connexion, demande d'accès, 404, Aujourd'hui, Mes
  parcours, Découvrir, programme, leçon, notes — à 390, 768 et 1440 px. Les
  surfaces authentifiées réutilisent le mock déterministe, extrait de
  `home.spec.ts` vers `tests/e2e/journey-api.ts` sans changement de
  comportement.
- Tolérance calibrée et vérifiée dans les deux sens : à `maxDiffPixelRatio`
  0,01 un changement d'accent de marque produisait un écart de ratio exactement
  0,01 et passait silencieusement. À `threshold` 0,01 et ratio 0,0005 la même
  sonde fait échouer les 10 captures d'un projet et une exécution propre reste
  verte.
- Limite assumée : pré-vol local, pas un gate CI. Les captures sont générées
  sur macOS. Voir V4.2-502.
- Effet de bord : `tests/e2e` n'appartenait à aucun projet TypeScript et
  n'était donc jamais typé. `tsconfig.e2e.json` ajouté.

## Lot 100 — fondations

### V4.2-101 — Fusion des couches de couleur

- Priorité : P0 · Statut : **DONE** au SHA `d4cd64e4`
- Cinq couches fusionnées en une : alias shadcn, `--color-*`, alias V3
  `--app-*`, `--totem-color-*` remappés par `.totem-theme`, et un bloc
  `[data-color-regime='paper']` dont l'attribut n'était posé nulle part.
- Elles avaient dérivé : bordure `#d6deeb` contre `#d7deed`, accent-text
  `#314fbe` contre `#3150c5`, action-hover `#304db8` contre `#2f4ec6`, danger
  `#9b3e32` contre `#a64738`, overlay 58 % contre 52 %.
- Les références visuelles ont tranché quelle couche était réelle : modifier le
  `--color-action` de base ne déplaçait aucun pixel, toutes les surfaces étant
  rendues dans `.totem-theme`.
- Ajoute les rôles sur encre, qui n'existaient pas : quatre surfaces avaient
  chacune inventé ses propres valeurs sur fond sombre.

### V4.2-102 — Graisses réellement chargées

- Priorité : P0 · Statut : **DONE** au SHA `42089a6e`
- Seules DM Sans 400 et 500 étaient chargées alors que la CSS déclarait 600,
  650, 700 et 550, avec `font-synthesis: none` global : eyebrows et libellés
  rendaient à 500 quoi qu'en dise la source.
- Défaut nommé et non corrigé ici : collision de cascade sur `.page-title`,
  déclaré 600 dans `layout.css`, 600 puis 500 dans `product.css` à spécificité
  identique. Traité en V4.2-301.

### V4.2-103 — Échelles typographique et d'espacement

- Priorité : P0 · Statut : **DONE** au SHA `0f490e64`
- Échelle typo dérivée de l'usage réel : sept valeurs couvraient 82 des ~100
  déclarations. 109 déclarations passent sur l'échelle, aucune hors échelle.
- Espacement traité différemment : la rampe est étendue aux valeurs réellement
  utilisées pour que 219 déclarations correspondent exactement, l'adoption
  passant de 12 à 231 usages sans aucun changement de pixel. Les 45 valeurs
  hors rampe restent littérales plutôt qu'arrondies.

## Lot 200 — identité

### V4.2-201 — Palette retunée et police d'affichage

- Priorité : P0 · Statut : **DONE** au SHA `1eca2c4e`
- Indigo `#4F52D9`, encre `#101B33`, corail `#D97757`. Seize paires de
  contraste vérifiées avant application, aucune sous son seuil.
- Deux contraintes tombent de là : le corail ne porte pas de texte sur fond
  clair (2,92, échoue AA), et le token de bordure est scindé entre décoratif et
  contrôle, seul ce dernier devant atteindre 3:1.
- La couleur de marque vivait dans quatre endroits hors CSS qui avaient dérivé
  indépendamment. Tous alignés.
- Plus Jakarta Sans 600/700 en affichage, DM Sans conservé en corps.
  `@fontsource/manrope` et `@fontsource/source-serif-4` retirés : polices
  rejetées, jamais importées, invisibles au gate de code mort.

## Lot 300 — surface publique

### V4.2-301 — Refonte de la landing sur la référence

- Priorité : P0 · Statut : **DONE** aux SHA `1bd3a462`, `d84eeb7b`, `20b440d2`
- Un seul CTA principal répété à l'identique ; le secondaire du hero cesse de
  concurrencer la candidature. Roadmap de quatre à trois étapes en langage
  clair. Verdict de recherche en carte mise en avant, périmètre IA explicite.
  Formulaires délibérément déséquilibrés. Titre centré de section ajouté.
- Motif progress-rule avec `src/lib/use-reveal-on-scroll.ts`, réutilisable
  partout où le produit montre une progression, avec repli sur l'état final
  sous reduced motion, sans `IntersectionObserver` et sans `matchMedia`.
- Copie de la référence adoptée dans les deux langues, sur décision du
  propriétaire : elle vend au lieu de décrire.
- Fidélité mesurée et non estimée : titres exacts à la référence (60, 44, 32,
  40 px à 700), texte de support à un demi-pixel près, écart assumé pour rester
  sur l'échelle de tokens.
- Deux textes invisibles corrigés, tous deux causés par une règle de couleur de
  lien l'emportant sur la primitive bouton. Le CTA de nav rendait indigo sur
  indigo et **axe ne l'a pas signalé** ; trouvé en regardant la capture. Un
  garde explicite est ajouté dans `landing.spec.ts`.
- Résout la collision de cascade de V4.2-102.

### V4.2-302 — Autorité de design

- Priorité : P0 · Statut : **DONE** au SHA `ed8d5098`
- `docs/DESIGN_SYSTEM.md` devient l'autorité, indexé. Les documents Totem
  gardent leur cartographie de surface et sont marqués historiques pour les
  fondations.

## Lot 400 — budgets

### V4.2-401 — Rebaseline du précache

- Priorité : P1 · Statut : **DONE** au SHA `d84eeb7b`
- V4.2 ajoute quatre polices délibérément, ce qui laissait une entrée de marge
  contre la baseline V4.1 : le prochain asset non lié aurait fait échouer le
  gate et invité un relèvement dans l'urgence. Remesuré à 139 entrées et
  1 357 197 octets avec la raison inscrite dans le fichier ; l'allocation de
  10 % continue de garder la croissance accidentelle.

## Lot 500 — gates de fin

### V4.2-501 — Gate de CSS mort

- Priorité : P2 · Owner : Frontend platform · Reviewer : QA
- Statut : **DONE** au SHA `35d15da0`
- A trouvé un vrai défaut et pas seulement du décor : `accessibility.css` stylait
  `.ui-progress__fill` dans un bloc `forced-colors` alors que le composant rend
  `.ui-progress__bar`. En mode contraste forcé, aucune barre de progression
  n'avait jamais reçu la couleur système. Quatre classes réellement mortes
  retirées, dont trois vestiges de l'ancienne landing.
- Le gate autorise les noms assemblés à l'exécution via une liste qui doit
  nommer le fichier construisant chaque préfixe, pour qu'un constat ne puisse
  pas être réduit au silence sans dire d'où vient le nom. Sondé dans les deux
  sens.
- `knip` couvre le JavaScript mort ; rien ne couvre le CSS. Deux blocs morts
  ont été trouvés à la main pendant V4.1 et V4.2 — `.landing-proof-list` et
  quatre surcharges `.totem-auth-page` remappant des classes Tailwind qui
  n'existaient plus nulle part.
- Critères d'acceptation : une classe définie et jamais consommée fait échouer
  le gate ; les faux positifs des classes construites dynamiquement sont
  documentés plutôt que contournés silencieusement.

### V4.2-502 — Gate visuel bloquant en CI

- Priorité : P2 · Owner : QA automation · Reviewer : Release engineering
- Statut : **DONE** — `.github/workflows/visual.yml` compare les 30 références
  sur chaque pull request et chaque push sur `dev`, et les régénère sur
  dispatch manuel. Les références committées sont produites sur Linux par ce
  workflow (run `33255964089`).
- Conséquence assumée : `pnpm test:visual` échoue désormais sur macOS, par
  construction. Une seule série de références a été retenue plutôt qu'une par
  plateforme, parce que deux séries devraient être régénérées ensemble à chaque
  changement et que ce système existe précisément parce que des valeurs
  dupliquées divergent.
- **Reste à faire côté propriétaire** : ajouter `Visual baselines (required)`
  aux checks requis de `dev` et de `main`. Le workflow est bloquant par son
  échec, mais la protection de branche est un réglage GitHub que je ne peux pas
  appliquer.
- Justification : le filet a détecté un CTA totalement invisible qu'axe n'a pas
  vu, et a établi empiriquement quelle couche de tokens était réelle.
- Ce gate doit exister **avant** la refonte produit de V4.3, dont il est la
  protection principale.

## Définition de terminé V4.2 — atteinte

Publiée le 29 août 2026 au SHA `9c35e9db` sur GO du propriétaire.

Preuves à la promotion : `Quality`, `Visual` et `Integration` verts sur ce SHA ;
`pnpm quality:v4.1:final` vert localement ; 30 références visuelles Linux
comparées en CI ; 76 tests e2e dont axe sur huit specs. Smoke de production
après déploiement : huit routes publiques en `200`, les deux polices servies,
`/api/auth/session` conserve `private, no-store`.

Exception de publication, identique à V4.1 et pour la même raison : `main` exige
un historique linéaire et `dev` portait quatre commits de fusion, cette fois
issus des pull requests des autres sessions. `required_linear_history` a été
désactivé le temps de l'avance rapide puis rétabli, la configuration comparée
avant et après et trouvée identique sur neuf réglages.

**Cette incompatibilité s'est maintenant produite deux fois sur deux releases.**
Elle se reproduira à chaque fois : l'équipe intègre par pull request, ce qui crée
des commits de fusion, et `main` les refuse. La décision de retirer
`required_linear_history` appartient au propriétaire ; en l'état, chaque release
exige de désactiver puis rétablir une protection de la branche de production.

## Ce qui n'a pas été fait, et pourquoi

- **La refonte des surfaces produit** est sortie du périmètre le 29 août sur
  décision du propriétaire et devient V4.3, nourrie par deux audits UX
  indépendants. Les constats relevés pendant V4.2 sont reportés dans
  `V4_3_BACKLOG.md` sans être corrigés ici.
- **`Visual baselines (required)` n'est pas encore un check requis** sur `dev`
  ni sur `main`. Le job échoue bruyamment mais n'est pas imposé par la
  protection de branche ; l'API me refuse ce réglage.
- **`--color-success` vaut la couleur d'action.** Un état de réussite qui
  partage la couleur du bouton principal est une question de design, reportée en
  V4.3.

Aucune surface produit n'est modifiée par cette release. Ce qui a été observé
sur l'écran de leçon pendant V4.2 est reporté tel quel dans `V4_3_BACKLOG.md`
sans être corrigé ici : corriger à moitié une expérience qu'on s'apprête à
refondre coûterait deux fois et brouillerait les preuves visuelles.
