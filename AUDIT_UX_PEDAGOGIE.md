# Audit UX & pédagogique — LearnX

## Statut

- Version : 1.0.0
- Nature : **diagnostic en lecture seule**. Ce document décrit des constats et des
  preuves. Il ne contient aucune solution ni consigne d'implémentation : celles-ci
  vivent dans `RECOMMANDATIONS_CODEX.md`, référencées par les mêmes identifiants
  (`AI-1`, `FL-1`, …).
- Baseline observée : état courant de la branche de travail (V2 clôturée, lot V3
  en cours, `LEARNING_FLOW_V3_SPEC.md` encore `DRAFT À VALIDER`).
- Règle d'autorité : le code et le comportement observés priment sur une
  documentation manifestement dépassée ; les écarts sont signalés en section 6.

Ce rapport distingue systématiquement le **fait** (observé), l'**interprétation**
(impact) et la **cause probable**. Il ne préjuge pas qu'une fonctionnalité V3 non
encore implémentée soit une régression : chaque finding est rattaché à son statut
(défaut réel, comportement V2 volontaire, ou item déjà planifié en V3).

---

## 1. Contexte et méthode

### 1.1 Périmètre

Documentation active (`AGENTS.md`, `docs/INDEX.md`, `BACKLOG_V3.md`,
`UX_SPEC.md`, `LEARNING_FLOW_V3_SPEC.md`, `ASSESSMENT_SPEC.md`,
`EDITORIAL_GUIDELINES.md`, `PEDAGOGY_AUTHORING_GUIDE.md`,
`PEDAGOGY_CHANGE_POLICY.md`, `CURRICULUM_BLUEPRINT.md`), code
(`src/`, `api/`), contenu (`seed/sample-program.json`,
`content/fondamentaux-psychologie/`).

### 1.2 Échantillon raisonné

L'audit ne parcourt pas les 70 `PEDAGOGY_SPEC`. Il s'appuie sur un échantillon
représentatif et justifié :

- une **leçon simple** : `definir-la-psychologie` (étape 1, 5 blocs de contenu,
  3 notions) ;
- une **leçon dense** : `grands-domaines` (`PEDAGOGY_SPEC_002.json`, 5 blocs,
  3 ressources, 3 notions, 3 tâches dont 2 productives) ;
- une **leçon avec ressource obligatoire** : `grands-domaines`
  (`openstax-psychology-2e-1-3`, `isRequired: true`) ;
- un **quiz / une mini-évaluation** : banques `conceptAssessmentBanks` du seed ;
- un **exercice** : tâches de type `writing`/`practice` canonicalisées en
  `EXERCISE` (`src/lib/canonical-activities.ts`) ;
- une **évaluation finale d'étape** :
  `content/.../stage-assessments/PEDAGOGY_STAGE_ASSESSMENT_001.json`.

### 1.3 Parcours simulés

Deux points de vue ont été reconstitués depuis le code : un **nouvel
utilisateur** (première visite, aucune progression) et un **utilisateur qui
reprend** (progression existante, dernière activité mémorisée).

### 1.4 Public cible du contenu

`CURRICULUM_BLUEPRINT.md` fixe le public : **adulte débutant sans prérequis
universitaire**, volume 130–170 h, progression spiralaire en 13 étapes cibles
(5 étapes et 21 leçons seedées à l'origine, seed depuis étendu). Les critères de
formation d'adultes sont évalués à cette aune.

---

## 2. Synthèse exécutive

### 2.1 Appréciation générale

LearnX repose sur des fondations solides : hiérarchie
`Program > Stage > Module > Lesson` respectée, calcul de maîtrise côté serveur,
tentatives conservées, sourcing éditorial d'un niveau rare, et une base
d'accessibilité réellement soignée. Le point faible n'est pas la rigueur mais le
**séquencement du flux de leçon** : le moteur regroupe encore les activités par
type, exactement ce que la spécification V3 veut supprimer. Le produit est dans un
**état de transition inachevé entre le modèle V2 et l'intention V3**, et plusieurs
artefacts V2 cohabitent avec un moteur d'activités partiellement V3.

### 2.2 Cinq forces à préserver

1. **Deep-link vers l'activité exacte** depuis « Aujourd'hui »
   (`api/today/app.test.ts:136-248` montre des `href` avec `?activity=…`).
2. **Expérience d'évaluation** : une question à la fois, correction par question
   avec explication + réponse attendue, historique des tentatives conservé avec
   `runSequence` (`src/features/assessments/QuestionAssessmentExperience.tsx`).
3. **Reprise de module avec aperçu explicite** « remis à zéro / conservé » avant
   confirmation destructive (`src/pages/CurriculumPages.tsx:465-535`).
4. **Carte de validation d'étape** listant les prérequis manquants en texte
   (`src/pages/CurriculumPages.tsx:145-196`).
5. **Socle d'accessibilité** : skip-link, gestion du focus, cibles ≥ 44 px,
   `aria-current`, safe-areas iOS, `prefers-reduced-motion` et
   `prefers-contrast: more` (`src/components/layout/MobileLayout.tsx`,
   `src/components/layout/BottomNavigation.tsx`, `src/styles/index.css`).

### 2.3 Cinq problèmes les plus importants

1. **`FL-1` — Séquence de leçon figée par type** : concaténation
   contenu → tâches → mini-évals → exercices → quiz, sans ordre inter-types
   authoré ; les ressources ne sont même pas dans la séquence.
2. **`RS-1` — Ressources non guidées** : la liste globale « Ressources de la
   leçon » subsiste en tête, sans consigne ni point d'usage.
3. **`FL-2` — `Continuer` saute des activités et peut reculer** : ne suit pas
   « l'activité suivante exacte ».
4. **`AI-1` — Progression fantôme** : « Progression — bientôt disponible » à 0 %
   sur Programmes/Programme/Étape/Module, alors qu'« Aujourd'hui » sait la
   calculer.
5. **`AI-2` — Écrans trop longs** : la page Programme déroule tout l'arbre
   étapes → modules → leçons, sans accordéon compact.

### 2.4 Niveau global de cohérence

- **UX** : moyen. Fondations et périphérie (Aujourd'hui, navigation, a11y)
  fortes ; cœur du flux leçon en transition inachevée.
- **Pédagogie** : bon sur le contenu et l'évaluation unitaire ; moyen sur le
  séquençage et l'alternance théorie/pratique.

---

## 3. Parcours actuel reconstitué

### 3.1 Entrée et orientation

`/login` → `/today`. « Aujourd'hui » (`src/pages/TodayPage.tsx`) affiche une carte
d'action primaire (badge de type via `actionLabels`, contexte
étape · module · leçon, durée, CTA `Continuer` deep-link vers l'activité exacte),
la progression **réelle** du programme actif (`program.percent`, l.110-113), les
révisions dues et la dernière activité. C'est l'écran le plus abouti du produit.

### 3.2 Accès au contenu

Via « Parcours » (`/program`, `ProgramsPage`) : liste des programmes avec une
barre de progression **placeholder à 0 %** (`ProgressPlaceholder`,
`CurriculumPages.tsx:130-132`, appelée l.236). Ouvrir un programme
(`ProgramPage`, l.250-325) rend **tout l'arbre** étapes → modules → leçons, chaque
leçon étant une **carte lourde** (`LessonSummaryCard`, l.42-116 : résumé, badge,
durée, « X activités », prochaine activité, barre de progression, accordéon
« Détail des activités », CTA). La même carte réapparaît au niveau Étape
(`StagePage`, l.387-394) et Module (`ModulePage`, l.455-463). Aucun accordéon
d'étapes ; la page programme est très longue et se répète verticalement.

### 3.3 Déroulé d'une leçon

`LessonPage` (`src/pages/LessonPage.tsx`) : en-tête de contexte, éventuel bandeau
brouillon, résumé, puis **liste globale des ressources** (l.362-389), puis une
**activité courante** pilotée par `buildLessonActivitySequence`
(`src/lib/lesson-activity-sequence.ts`). La séquence concatène par type
(l.230-237). Sous l'activité : un bouton note `ghost` peu visible (l.437-443),
puis une **barre de navigation pédagogique collante** (Sommaire, Précédent,
Continuer) via `PedagogicalNavigation` (l.446-458), positionnée `sticky`
(`PedagogicalNavigation.tsx:54-61`). Quiz, exercice et mini-évaluation s'ouvrent
sur des routes dédiées (`src/app/routes.tsx:261-263`) puis reviennent dans la
séquence.

### 3.4 Fin et reprise

Fin de leçon : `Terminer la leçon` si `progress.canComplete`, sinon message « des
activités obligatoires restent à terminer » (`LessonPage.tsx:329-341, 425-433`).
Reprise : « Aujourd'hui » et `Continuer` consomment la recommandation serveur ;
l'activité courante est mémorisée en `localStorage` par leçon
(`lesson-activity-sequence.ts:88-102`). Le retour possède une destination stable
via `BackNavigationProvider` (`src/components/layout/MobileLayout.tsx:39-51`).

---

## 4. Findings détaillés

Pour chaque finding : **Fait** · **Preuve** · **Impact utilisateur** · **Impact
pédagogique** · **Cause probable** · **Gravité** · **Statut**.

### A. Architecture de l'information & progression

#### AI-1 — Progression fantôme sur les vues de parcours · MAJEUR

- **Fait** : Programmes, Programme, Étape et Module affichent
  « Progression — bientôt disponible » à 0 %.
- **Preuve** : `src/pages/CurriculumPages.tsx:130-132` (`ProgressPlaceholder`),
  utilisé l.236, 283, 365, 447. La progression réelle existe : par leçon
  (`LessonSummaryCard`, l.85-88) et par programme dans `TodayContent`
  (`TodayPage.tsx:110-113`). Contredit `UX_SPEC.md` (sections Programmes, Étape,
  Module) et le principe « progression toujours compréhensible ».
- **Impact utilisateur** : incohérence — la progression est visible sur
  Aujourd'hui et sur une leçon, mais « bientôt disponible » entre les deux ; signal
  d'un chantier inachevé exposé à l'utilisateur.
- **Impact pédagogique** : l'apprenant adulte perd le repère de progression
  d'étape/module, central pour l'autorégulation.
- **Cause probable** : agrégation programme/étape/module non branchée sur ces
  vues.
- **Statut** : défaut réel ; conserver la formule serveur, Module recevant une
  agrégation serveur — préalable serveur de V3-019.

#### AI-2 — Écrans trop longs, pas d'accordéon d'étapes · MAJEUR

- **Fait** : la page Programme rend l'arbre complet étapes → modules → leçons,
  déplié.
- **Preuve** : `CurriculumPages.tsx:290-322` (chaque étape rend chaque module qui
  rend chaque `LessonSummaryCard`). Aucune vue compacte/repliable. `UX_SPEC.md`
  décrit une « liste ordonnée des étapes » ; `LEARNING_FLOW_V3_SPEC.md §2.2` et le
  ticket V3-019 décrivent une timeline à une seule étape ouverte.
- **Impact utilisateur** : défilement long, décisions prématurées, information
  répétée ; sur mobile 390 px, dizaines de cartes lourdes à scanner.
- **Impact pédagogique** : la structure du programme (unités de sens) est noyée
  dans le détail des leçons.
- **Cause probable** : absence de composant timeline/accordéon.
- **Statut** : déjà planifié (V3-019).

#### AI-3 — Carte de leçon lourde dupliquée aux trois niveaux · MODÉRÉ

- **Fait** : `LessonSummaryCard` (dense) est affichée à l'identique sur
  Programme, Étape et Module.
- **Preuve** : `CurriculumPages.tsx:310-316` (Programme), `:387-394` (Étape),
  `:455-463` (Module).
- **Impact utilisateur** : redondance ; l'utilisateur revoit trois fois la même
  carte selon le chemin emprunté.
- **Impact pédagogique** : dilue la spécificité de chaque niveau (l'étape devrait
  cadrer, le module lister, la leçon détailler).
- **Cause probable** : composant unique réutilisé sans variante de densité.
- **Statut** : défaut réel, à traiter avec V3-019.

### B. Flux de leçon (cœur de l'audit)

#### FL-1 — Séquence figée par type, sans séquence ordonnée par l'auteur · MAJEUR

- **Fait** : la séquence d'activités est un concaténé par type ; il n'existe
  aucune séquence pédagogique ordonnée par l'auteur (séquence inter-types), et
  `RESOURCE` n'est pas un type de séquence.
- **Preuve** : `src/lib/lesson-activity-sequence.ts:230-237`
  (`[...content, ...tasks, ...assessments, ...exercises, ...quizzes, completion]`) ;
  `LessonActivityKind` sans `RESOURCE` (l.1-7) ; le contrat d'auteur ne porte
  aucun ordre global — chaque liste (`contentBlocks`, `resources`, `concepts`,
  `tasks`) n'a qu'un `position` interne (`PEDAGOGY_AUTHORING_GUIDE.md §4` ;
  structure de leçon dans `seed/sample-program.json`). Contredit
  `LEARNING_FLOW_V3_SPEC.md §1.4` et `§3.1`.
- **Impact utilisateur** : l'apprenant voit tout le cours, puis toutes les
  pratiques ; pas d'alternance lecture → application.
- **Impact pédagogique** : perte d'entrelacement (interleaving) et de « pratique
  proche du concept » ; impossible de placer une ressource obligatoire « avant de
  continuer ».
- **Cause probable** : héritage V2 ; le modèle de données n'expose pas de
  séquence unifiée.
- **Statut** : **tranché** — le contrat est décidé :
  `PEDAGOGY_SPEC.lesson.sequence` = liste ordonnée de références typées
  `{kind, key}` stables ; `COMPLETE` ajouté automatiquement en dernière position
  par le moteur ; le backfill initial reproduit exactement le parcours V2 sans
  insérer les ressources dans la séquence avant la réorganisation éditoriale.
  Reste à implémenter (V3-016 contrat → V3-017).

#### FL-2 — `Continuer` saute des activités et peut reculer · MAJEUR

- **Fait** : `Continuer` ne mène pas à l'activité suivante exacte : il saute les
  activités non-requises et peut revenir à une activité requise antérieure non
  terminée.
- **Preuve** : `src/lib/lesson-activity-sequence.ts:244-270`. La chaîne
  `afterCurrent.find(isIncompleteRequired) ?? activities.find(isIncompleteRequired)`
  fait repartir la recherche du début de la leçon. Contredit
  `LEARNING_FLOW_V3_SPEC.md §6.2` (« mène à l'activité suivante exacte … ne saute
  pas les types »).
- **Impact utilisateur** : désorientation (« pourquoi je recule ? ») ; les
  activités facultatives deviennent invisibles au fil linéaire.
- **Impact pédagogique** : la logique « prochaine obligation » se confond avec la
  navigation linéaire ; l'apprenant ne contrôle plus sa progression.
- **Cause probable** : une seule fonction mélange navigation linéaire et calcul de
  la prochaine obligation.
- **Statut** : défaut réel, à corriger dans le cadre de V3-017 (séquence unifiée).

#### FL-3 — Alternance théorie/pratique perdue · MODÉRÉ

- **Fait** : à cause du regroupement par type, les exercices d'application
  arrivent après la validation des notions et après tout le contenu.
- **Preuve** : `lesson-activity-sequence.ts:230-237` ; sur
  `PEDAGOGY_SPEC_002.json`, la séquence rendue est
  5 contenus → tâche lecture → 3 mini-évals → 2 exercices. Le practice « Orienter
  six questions » suit la validation au lieu de la préparer.
- **Impact utilisateur** : on teste avant d'avoir fait pratiquer.
- **Impact pédagogique** : contraire aux principes de formation d'adultes
  (application précoce, montée en autonomie).
- **Cause probable** : conséquence directe de FL-1.
- **Statut** : éditorial, planifié (V3-018), conditionné à FL-1.

#### FL-4 — Navigation pédagogique collante · MODÉRÉ

- **Fait** : la barre Sommaire/Précédent/Continuer est `sticky` et positionnée
  au-dessus de la tab-bar.
- **Preuve** : `src/components/learning/PedagogicalNavigation.tsx:54-61`
  (`sticky z-30 … bottom: calc(var(--app-navigation-height) + env(safe-area-inset-bottom))`).
  Contredit `LEARNING_FLOW_V3_SPEC.md §6.2` (« jamais sticky ou fixed ») et
  V3-021.
- **Impact utilisateur** : recouvrement potentiel de contenu long ; empilement de
  deux barres basses sur mobile (voir MA-1).
- **Impact pédagogique** : faible directement, mais nuit à la lecture continue.
- **Cause probable** : choix V2.
- **Statut** : comportement V2 volontaire, planifié (V3-021).

### C. Ressources & sources

#### RS-1 — Liste globale de ressources non guidée · MAJEUR

- **Fait** : la liste « Ressources de la leçon » est rendue en tête de leçon,
  sans verbe média, badge obligatoire/facultatif, consigne, périmètre ni durée au
  point d'usage.
- **Preuve** : `src/pages/LessonPage.tsx:362-389`. Contredit
  `LEARNING_FLOW_V3_SPEC.md §4.1-4.4`. Les données existent pourtant :
  `resources[].description/isRequired/estimatedMinutes/type` (seed et specs, ex.
  `PEDAGOGY_SPEC_002.json:65-101`).
- **Impact utilisateur** : impossible de savoir si une ressource est requise, quoi
  y lire, pour quelle activité ; risque de la traiter comme une activité
  obligatoire.
- **Impact pédagogique** : confond ressource (support) et activité ; noie la
  consigne éditoriale déjà rédigée.
- **Cause probable** : composant V2 non migré ; le point d'usage n'est câblé que
  pour les *sources* de bloc (`ContentActivity`, l.95-122) et les supports de
  tâche (`TaskActivity`, l.144-166).
- **Statut** : déjà planifié (V3-020), dépend de FL-1.

#### RS-2 — Ressources comptées comme « activités » · MODÉRÉ

- **Fait** : la carte de leçon compte les ressources dans le total d'activités.
- **Preuve** : `CurriculumPages.tsx:52-57`
  (`activityTotal = resources + tasks + concepts + exercises + quizzes`), affiché
  l.80-81 et détaillé l.93-99.
- **Impact utilisateur** : gonfle le nombre d'« activités » annoncé.
- **Impact pédagogique** : brouille la distinction ressource/activité, pourtant
  centrale au produit (`AGENTS.md`, invariant 10).
- **Cause probable** : comptage indifférencié.
- **Statut** : défaut réel, à traiter avec V3-019.

#### RS-3 — Sources au point d'usage · À PRÉSERVER

- **Fait** : les sources bibliographiques d'un bloc sont affichées après le bloc,
  dans un encart « Sources de ce bloc », avec lien externe sécurisé.
- **Preuve** : `LessonPage.tsx:95-122` (`ContentActivity`) ;
  `getSafeExternalUrl` (l.65-75) filtre les protocoles. Conforme à
  `LEARNING_FLOW_V3_SPEC.md §5`.
- **Statut** : réussite à conserver ; ne pas transformer les sources en
  activités.

### D. Évaluation & feedback

#### EV-1 — Feedback des évaluations : expérience actuelle conservée · NON RETENU POUR V3

- **Fait** : les mini-évaluations et quiz présentent une question à la fois, puis
  score et correction détaillée après soumission (pas de feedback après chaque
  question).
- **Preuve** : `QuestionAssessmentExperience.tsx:322-365`. `ASSESSMENT_SPEC.md:38-40`
  recommande un « feedback immédiat », mais le responsable produit a tranché en
  faveur du maintien de l'expérience actuelle.
- **Décision produit** : conserver cette expérience en V3 ; ne pas introduire de
  feedback immédiat après chaque question. La distinction reste **fonctionnelle** —
  mini-évaluation = validation ciblée d'une notion, quiz = consolidation plus large
  de la leçon — mais l'expérience de réponse et de correction est identique.
- **Statut** : non retenu pour la V3 ; écart avec `ASSESSMENT_SPEC.md` assumé comme
  décision produit (à refléter dans une future mise à jour de la spec).

#### EV-2 — Remédiation non surfacée à l'échec · MODÉRÉ

- **Fait** : à l'échec, l'écran de résultat montre explication + réponse attendue,
  mais aucune remédiation ciblée (contenu, ressource ou exercice prévu par la
  spécification) pour retravailler.
- **Preuve** : `QuestionAssessmentExperience.tsx:225-260` (corrections sans rappel
  des `resourceKeys` du concept). `ASSESSMENT_SPEC.md:86-91` (« les ressources
  liées sont suggérées »). Les `concept.resourceKeys` existent
  (`PEDAGOGY_SPEC_002.json:111-114`).
- **Impact utilisateur** : l'apprenant sait qu'il a échoué mais pas où
  retravailler.
- **Impact pédagogique** : boucle « échec → révision guidée → nouvelle tentative »
  incomplète.
- **Cause probable** : l'écran de résultat ne connaît pas les ressources de la
  notion.
- **Statut** : défaut réel, à traiter avec V3-020.

#### EV-3 — Correction, seuil et historique · À PRÉSERVER

- **Fait** : score, seuil, badge réussi/à reprendre, correction par question avec
  explication et réponse attendue (uniquement si incorrect), historique des
  tentatives avec `runSequence`.
- **Preuve** : `QuestionAssessmentExperience.tsx:193-263` et `:101-133`. Conforme
  à `ASSESSMENT_SPEC.md` et à `AGENTS.md` (tentatives conservées, calcul serveur).
- **Statut** : réussite à conserver.

### E. Actions & affordance

#### AC-1 — Bouton note discret · MODÉRÉ

- **Fait** : « Prendre une note liée » est un bouton `ghost` (transparent, sans
  bordure ni icône).
- **Preuve** : `LessonPage.tsx:437-443` + `src/components/ui/actionStyles.ts:8`
  (`ghost: bg-transparent … hover:bg-slate-800`). Contredit
  `LEARNING_FLOW_V3_SPEC.md §7` (vrai bouton secondaire/outlined, icône, ≥ 44 px).
- **Impact utilisateur** : action peu identifiable sur fond sombre.
- **Impact pédagogique** : la prise de note, levier clé pour l'adulte, est
  sous-exploitée.
- **Cause probable** : variante par défaut trop discrète.
- **Statut** : déjà planifié (V3-022).

#### AC-2 — Hiérarchie primaire/secondaire/destructive à clarifier · MODÉRÉ

- **Fait** : sur plusieurs écrans, les actions ne suivent pas une hiérarchie
  visuelle constante ; « Voir le module » est `ghost` (l.301-307), « Ouvrir le
  module » est `secondary` (l.380-386), la reprise destructive est `danger` mais
  posée dans le flux normal du module.
- **Preuve** : `CurriculumPages.tsx:301-307, 380-386, 465-535`.
- **Impact utilisateur** : l'action principale d'un écran n'est pas toujours
  évidente ; deux libellés différents pour « ouvrir le module » selon la vue.
- **Impact pédagogique** : friction de navigation.
- **Cause probable** : choix ponctuels non gouvernés par un système d'actions.
- **Statut** : défaut réel, à traiter avec V3-021/022.

### F. Système visuel & UI

#### UI-1 — Densité des cartes et élévation uniforme · MODÉRÉ

- **Fait** : toutes les cartes utilisent `.ui-card` avec une ombre forte et un
  rayon 1.25rem ; empilées, elles créent du bruit visuel.
- **Preuve** : `src/styles/index.css:97-103` (`.ui-card`,
  `box-shadow: 0 18px 48px rgb(0 0 0 / 0.16)`), appliqué à toutes les cartes de
  liste (`LessonSummaryCard`, cartes de programme, d'étape).
- **Impact utilisateur** : pas de hiérarchie d'élévation ; la carte primaire ne se
  distingue pas des cartes de liste.
- **Cause probable** : composant `Card` unique sans variante.
- **Statut** : défaut réel, à traiter avec V3-019.

#### UI-2 — Sur-usage de l'accent cyan · MODÉRÉ

- **Fait** : l'accent cyan sert aux eyebrows, aux labels d'activité
  (« Comprendre »), aux liens, au bouton primaire, à la progression et à l'état
  actif.
- **Preuve** : `--app-accent: #22d3ee` (`styles/index.css:16`) ; usages :
  `page-eyebrow` (l.74-80), labels d'activité `text-cyan-300`
  (`LessonPage.tsx:91, 397`), CTA primaire `bg-cyan-400`
  (`actionStyles.ts:9`), état actif nav (`BottomNavigation.tsx:39`).
- **Impact utilisateur** : hiérarchie aplatie ; l'œil ne trouve pas une action
  unique par écran (contraire à `UX_SPEC.md`, « une seule action principale par
  écran »).
- **Cause probable** : absence de règle d'emploi de l'accent.
- **Statut** : défaut réel, à traiter avec V3-019/021.

#### UI-3 — Pas de sémantique visuelle par type d'activité · MODÉRÉ

- **Fait** : les verbes d'activité existent mais partagent tous le même style
  textuel cyan, sans icône ni ton distinctif.
- **Preuve** : `activityLabels` (`lesson-activity-sequence.ts:65-72` :
  `Comprendre`, `Vérifier une notion`, `Mettre en pratique`, `Consolider`,
  `Réaliser une tâche`) rendus uniformément (`LessonPage.tsx:397`). Le jeu
  d'icônes n'existe que pour la navigation basse (`NavigationIcon`).
- **Impact utilisateur** : avec la future séquence entrelacée (FL-1), l'apprenant
  ne distinguera pas d'un coup d'œil cours / pratique / validation / ressource.
- **Cause probable** : jeu d'icônes limité à la navigation.
- **Statut** : défaut réel, à traiter avec V3-017/020.

#### UI-4 — Statuts éparpillés · MINEUR

- **Fait** : les libellés et tons de statut divergent entre fichiers.
- **Preuve** : `lessonStatusLabel` (`CurriculumPages.tsx:23-30` :
  « Disponible/En cours/Terminée/À revoir/Verrouillée/Brouillon ») vs
  `statusLabels` (`PedagogicalNavigation.tsx:20-25` :
  « À faire/En cours/Terminée/Brouillon ») vs `stageStatusLabels`
  (`CurriculumPages.tsx:138-143`). `UX_SPEC.md` fixe pourtant un vocabulaire de
  maîtrise (« À apprendre / En cours / Validée / À revoir »).
- **Impact utilisateur** : incohérence de vocabulaire d'un écran à l'autre.
- **Cause probable** : absence de mappings métier centralisés (progression,
  maîtrise, publication, accès, consultation) partageant `Badge`, tons et icônes.
- **Statut** : défaut réel ; mappings métier (progression, maîtrise, publication,
  accès, consultation) partageant Badge/tons/icônes — à traiter au fil des
  refontes (V3-019 à V3-021).

### G. Mobile & accessibilité

#### MA-1 — Double barre basse · MODÉRÉ

- **Fait** : la navigation pédagogique collante se superpose à la tab-bar fixe sur
  mobile.
- **Preuve** : `PedagogicalNavigation.tsx:54-61` (sticky, ancrée au-dessus de
  `--app-navigation-height`) + `BottomNavigation.tsx:27-29` (fixed bottom).
- **Impact utilisateur** : deux barres empilées réduisent la zone de lecture ;
  risque de recouvrement à 200 %.
- **Cause probable** : conséquence de FL-4.
- **Statut** : à résoudre avec V3-021.

#### MA-2 — Contrastes de texte méta à vérifier · MINEUR

- **Fait** : le texte méta et désactivé utilise `text-slate-400`/`text-slate-500`
  sur surfaces sombres.
- **Preuve** : nombreux usages, ex. `CurriculumPages.tsx:76-84` (méta leçon),
  `PedagogicalNavigation.tsx:98-99` (état désactivé `text-slate-500`). Le token
  clair `--app-text-muted: #aebbd0` (`styles/index.css:15`) n'est pas
  systématiquement employé.
- **Impact utilisateur** : lisibilité potentiellement sous le seuil AA pour les
  petits textes.
- **Cause probable** : classes Tailwind ponctuelles au lieu du token muted.
- **Statut** : défaut potentiel, à vérifier ; à traiter au fil des refontes
  (V3-019 à V3-021).

#### MA-3 — Base d'accessibilité · À PRÉSERVER

- **Fait** : skip-link, focus géré au changement de route, cibles ≥ 44 px,
  `aria-current`, safe-areas, `prefers-reduced-motion`, `prefers-contrast: more`,
  Drawer sommaire à focus piégé.
- **Preuve** : `MobileLayout.tsx:55-96`, `routes.tsx:228-242`,
  `BottomNavigation.tsx`, `styles/index.css:172-213`,
  `PedagogicalNavigation.tsx:127-173`.
- **Statut** : réussite à conserver et à ne pas régresser lors des refontes.

### H. Contenu & gouvernance éditoriale

#### CE-1 — Notes éditoriales contredites par le seed · MINEUR

- **Fait** : une note éditoriale affirme que des banques de questions ne sont pas
  importées, alors qu'elles le sont.
- **Preuve** : `PEDAGOGY_SPEC_002.json` `editorial.review.notes` (« Les banques de
  questions sont prêtes mais non importées par le seed actuel ») ↔
  `seed/sample-program.json` contient bien la banque pour `grands-domaines`
  (groupe `conceptAssessmentBanks`, `lessonSlug: "grands-domaines"`,
  `conceptSlug: "diversite-domaines-psychologiques"`, …).
- **Impact** : risque de piloter par une doc obsolète.
- **Cause probable** : sidecar figé à une date antérieure à l'extension du seed.
- **Statut** : écart doc/code à corriger (éditorial).

#### CE-2 — Statut de publication des specs ambigu · MINEUR

- **Fait** : la plupart des specs sont en `editorial_review` /
  `readyForPublication: false` alors que leur contenu est intégré au seed.
- **Preuve** : `PEDAGOGY_SPEC_002.json:185, 596-607`
  (`status: "editorial_review"`, `readyForPublication: false`,
  `scientificAccuracy: false`) ; contenu présent dans le seed.
- **Impact** : ambiguïté sur « qu'est-ce qui est réellement publié/validé ».
- **Cause probable** : la **traçabilité de la chaîne** n'est pas explicitée — cinq
  états distincts coexistent (`editorial.readyForPublication` = préparation
  pédagogique ; seed = paquet d'importation ; base/`isPublished` = visibilité
  runtime ; `ProgramVersion` = photographie publiée ; validation scientifique =
  état indépendant et non bloquant). Le problème n'est pas « seed contre sidecar ».
- **Statut** : gouvernance à clarifier — documenter la chaîne (V3-018/026).

---

## 5. Ce qui est déjà réussi (à préserver explicitement)

- Deep-link vers l'activité exacte depuis Aujourd'hui (`api/today`).
- Évaluation : une question à la fois, correction + réponse attendue + historique
  conservé (`QuestionAssessmentExperience.tsx`).
- Reprise de module avec aperçu reset/conservé et confirmation destructive
  (`CurriculumPages.tsx:465-535`).
- Carte de validation d'étape avec prérequis manquants textuels
  (`CurriculumPages.tsx:145-196`).
- Sources au point d'usage, liens externes filtrés (`LessonPage.tsx:65-122`).
- Base d'accessibilité et safe-areas (`MobileLayout.tsx`, `styles/index.css`).
- Qualité éditoriale : sourcing avec locators, `evidenceLevel` A–E, `urlStatus`,
  `alternativeResourceKey`, distracteurs plausibles, cadrage adulte, progression
  spiralaire du blueprint (`PEDAGOGY_SPEC_002.json`, `CURRICULUM_BLUEPRINT.md`).

---

## 6. Écarts documentation ↔ code

- `UX_SPEC.md` (section « Leçon », ordre : titre → objectifs → notions →
  contenu → **ressources** → activité de validation → tâches → notes → terminer)
  décrit le **modèle V2 groupé par type**. Le code implémente une variante de cet
  ordre via `buildLessonActivitySequence`. `LEARNING_FLOW_V3_SPEC.md` demande au
  contraire une séquence pédagogique ordonnée par l'auteur (ordre inter-types) :
  `UX_SPEC.md` est donc à considérer comme un état V2, pas comme la cible.
- `LEARNING_FLOW_V3_SPEC.md` est encore `DRAFT À VALIDER` (gate V3-016) : le code
  a partiellement implémenté un moteur d'activités (séquence, sommaire,
  navigation, reprise) tout en conservant des artefacts V2 (liste globale de
  ressources, bouton note ghost, navigation collante). L'état réel est un
  **hybride V2/V3**.
- `PEDAGOGY_SPEC_002.json` : note éditoriale obsolète vis-à-vis du seed (CE-1).

---

## 7. Questions ouvertes (arbitrage produit/pédagogique)

1. **Tranché** — Séquence pédagogique ordonnée par l'auteur :
   `PEDAGOGY_SPEC.lesson.sequence` = liste ordonnée de références typées
   `{kind, key}` stables ; `COMPLETE` ajouté automatiquement en dernière position
   par le moteur ; backfill initial reproduisant exactement le parcours V2 sans
   insérer les ressources avant la réorganisation éditoriale — FL-1.
2. **Tranché** — Ressource obligatoire : navigation linéaire autorisée sans
   confirmation immédiate ; la ressource reste une **obligation incomplète** et
   **bloque « Terminer la leçon »** (donc la complétion du module et de l'étape) ;
   la confirmation atteste la **consultation déclarée**, jamais la compréhension — RS-1.
3. **Tranché** — Feedback des évaluations : conserver l'expérience actuelle
   (question par question, correction après soumission) ; pas de feedback immédiat
   en V3 — EV-1.
4. **Tranché** — Progression : conserver la formule serveur actuelle ; Programme et
   Étape exposent les valeurs serveur existantes, Module reçoit une agrégation
   serveur ; toute nouvelle pondération est hors périmètre de ce correctif — AI-1.
5. **Reformulé** — Publication : documenter la **traçabilité de la chaîne**
   (`readyForPublication` → seed → `isPublished` → `ProgramVersion`, validation
   scientifique indépendante et non bloquante) ; ce n'est pas « seed contre
   sidecar » — CE-2.
6. **Tranché** — Dernière étape ouverte : préférence **persistée côté serveur**
   par compte + programme, synchronisée entre appareils, strictement séparée de la
   progression — AI-2.

Les recommandations correspondantes figurent dans `RECOMMANDATIONS_CODEX.md`.
