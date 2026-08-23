# Recommandations d'implémentation pour Codex — UX, UI & pédagogie

## Statut et usage

- Version : 1.0.0
- Nature : **cadrage et intention**, pas de micro-spécification ligne à ligne.
  Chaque recommandation donne l'objectif, une direction technique (fichiers et
  composants indicatifs), des critères d'acceptation testables, un effort et un
  rattachement V3. Codex garde la latitude d'implémentation.
- Base de diagnostic : `AUDIT_UX_PEDAGOGIE.md` (mêmes identifiants `AI-*`,
  `FL-*`, `RS-*`, `EV-*`, `AC-*`, `UI-*`, `MA-*`, `CE-*`).
- Contraintes non négociables : rester dans la hiérarchie
  `Program > Stage > Module > Lesson` ; ne jamais laisser le frontend décider
  d'une réussite, d'un verrouillage ou d'une progression ; ne pas introduire de
  migration de schéma tant que l'architecture actuelle suffit ; respecter les
  quatre documents de gouvernance pédagogique avant toute évolution de contenu.
- Priorité de mise en œuvre : les décisions tranchées de la section 6 cadrent les
  tickets dépendants ; le seul point encore ouvert (traçabilité de publication,
  CE-2) n'est pas bloquant pour le flux.

---

## 1. Principes directeurs

Ces principes cadrent toutes les recommandations qui suivent.

1. **Une seule séquence pédagogique ordonnée par l'auteur (séquence inter-types)
   fait autorité.** L'ordre des activités d'une leçon est fourni par le contenu
   pédagogique, pas déduit d'un regroupement par type dans le client. Sommaire,
   `Continuer`, `Précédent`, reprise, progression et recommencement de module
   consomment cette même séquence.
2. **L'UI ne décide jamais.** Réussite, verrouillage, complétion et progression
   restent calculés côté serveur. Le client rend un état, il ne le produit pas.
3. **Distinguer préférence UI et progression.** L'étape ouverte, l'activité
   mémorisée, l'accordéon plié/déplié sont des préférences d'affichage ; elles ne
   modifient jamais la progression réelle.
4. **Une action primaire par écran.** L'accent visuel est réservé à cette action
   et à l'état actif. Tout le reste est neutre ou secondaire.
5. **Le statut n'est jamais porté par la seule couleur.** Toujours libellé +
   icône + ton, via un mapping unique.
6. **Ressource, source et preuve de maîtrise sont distinctes.** Une ressource est
   distincte d'une source et d'une preuve de maîtrise ; sa consultation peut
   cependant constituer une activité de la séquence. Une source justifie une
   affirmation et n'a pas de progression ; une activité est comptée une seule fois.

---

## 2. Flow cible (wireframes textuels)

### 2.1 Page Programme (accordéon compact) — AI-2, AI-3, UI-1

```
Programme — titre
Progression réelle globale ●●●○ 62 %
─────────────────────────────────────────────
▸ 1. Étape 1 · 8 h · Terminée · chevron                 (repliée)
▾ 2. Étape 2 · 10 h · En cours                          (ouverte — seule)
     Module A                                            (intertitre, si utile)
     Leçon 1 · 25 min · En cours · chevron
     ───────────────────────────────────────
     Leçon 2 · 40 min · Disponible · chevron
     Module B                                            (intertitre, si utile)
     Leçon 3 · 30 min · Verrouillée · verrou
▸ 3. Étape 3 · 6 h · Verrouillée · chevron
```

- Une seule étape ouverte. Première visite → première étape non terminée ;
  visites suivantes → dernière étape ouverte restaurée (préférence UI).
- Une seule progression graphique sur l'écran : celle du programme.
- Repliée : numéro dans le titre, titre, durée, statut compact, chevron.
  **Jamais** le nombre d'activités, une barre secondaire ni une description.
- Dépliée : aucune sous-carte. Les modules sont de simples intertitres et les
  leçons des lignes séparées par des filets. Avec un seul module, son intertitre
  peut être omis visuellement et reste présent dans le nom accessible de la liste.
- Ouvrir/replier l'étape ne navigue pas ; sélectionner une ligne de leçon est
  l'action distincte qui ouvre ou reprend cette leçon.

### 2.2 Étape

```
Étape — titre · objectif
Statut temporel : « Dans les temps » / « 13 points de retard » (déjà spec'é)
Modules (compacts)
Carte « Évaluation finale » + prérequis manquants (déjà présente — conserver)
```

### 2.3 Module

```
Module — titre · description courte · progression
Leçons (compactes) : titre · durée · statut · [Commencer/Reprendre/Revoir]
Carte « Recommencer ce module » (aperçu reset/conservé — conserver)
```

### 2.4 Leçon (séquence pédagogique ordonnée par l'auteur, navigation en flux) — FL-1, FL-4, RS-1

```
En-tête contexte (programme · étape · module · leçon) · progression leçon
─────────────────────────────────────────────
[ Activité courante = 1 élément de la séquence ordonnée par l'auteur ]

  • Contenu       → texte + « Sources de ce contenu » (repliable)
  • Ressource     → [Lire] badge Obligatoire · périmètre · consigne · 25 min · [Ouvrir]
  • Mini-éval     → route dédiée, retour en séquence
  • Exercice/Quiz → route dédiée, retour en séquence

[ Prendre une note ]   (bouton secondaire outlined + icône, ≥ 44 px)
[ Sommaire de la leçon ]
Précédent                                   Continuer →     (dans le flux, non collant)
```

- `Continuer` = activité n+1 exacte de la séquence (y compris ressource ou
  facultative). Un rappel séparé signale les obligations restantes ; il ne fait
  jamais reculer la navigation.
- **Ressource obligatoire** : la navigation linéaire n'est jamais bloquée, mais
  tant qu'elle n'est pas confirmée « consultée », elle reste une obligation
  incomplète qui **bloque `Terminer la leçon`** (et donc la complétion du module
  et de l'étape). La confirmation atteste la consultation déclarée, jamais la
  compréhension.
- Ordre du document par activité : contenu → ressources/sources → note →
  Sommaire → Précédent/Continuer.

### 2.5 Ressource guidée — RS-1

```
[Lire]  Badge: Obligatoire | Pour aller plus loin
Titre de la ressource · auteur
Périmètre : section 1.3 / pages 12–18 / 00:10:03–00:13:08
Consigne : « Relever la définition et trois critères… »
Durée : 25 min · Langue : EN · [Ouvrir la lecture]
État : À consulter / Consultée   ([Marquer comme consultée] pour une obligatoire)
```

- Pour une ressource obligatoire, `Marquer comme consultée` lève l'obligation
  incomplète (consultation déclarée, jamais compréhension) ; sans cela,
  `Terminer la leçon` reste bloqué. `Continuer` n'est jamais bloqué.

### 2.6 Exercice / Quiz (conserver la base) — EV-2

- Une question à la fois, score et correction détaillée après soumission, seuil,
  historique : **inchangé et conservé en V3** (voir EV-1).
- Distinction fonctionnelle conservée : mini-évaluation = validation ciblée d'une
  notion ; quiz = consolidation plus large de la leçon ; même expérience de réponse
  et de correction.
- À l'échec : bloc « Revoir avant de retenter » pointant vers la remédiation
  prévue par la spécification (un contenu, une ressource ou un exercice) + retour
  ciblé à l'activité.

### 2.7 Fin de leçon

```
Un seul emplacement d'action (jamais deux CTA primaires simultanés) :
  [ Terminer la leçon ]  ──(succès serveur)──▶  [ Leçon suivante ]
Si incomplet : liste explicite des obligations restantes (déjà partiellement là)
```

### 2.8 Reprise

- Aujourd'hui / `Continuer` → activité serveur exacte (déjà OK).
- Dernière étape ouverte **persistée côté serveur** par compte + programme,
  synchronisée entre appareils, strictement séparée de la progression.

---

## 3. Recommandations par thème

Format : **Intention** · **Direction technique** · **Critères d'acceptation** ·
**Effort** · **Rattachement**.

### A. Architecture de l'information & progression

**AI-1 — Progression réelle sur les vues de parcours**
- Intention : supprimer « bientôt disponible » en s'appuyant sur la **formule
  serveur actuelle**, sans nouvelle pondération.
- Direction : Programme et Étape exposent les **valeurs serveur existantes** ;
  Module reçoit une **agrégation serveur** dédiée ; remplacer `ProgressPlaceholder`
  (`CurriculumPages.tsx:130-132`) par ces valeurs. Ne pas recalculer une « somme
  des leçons » côté client ni introduire de nouvelle pondération (hors périmètre).
- Acceptation : aucun libellé « bientôt disponible » ; Programme/Étape/Module
  affichent une valeur serveur ; deux comptes distincts voient leur progression
  respective.
- Effort : faible-moyen. Rattachement : **préalable serveur de V3-019**
  (l'agrégation Module doit exister avant l'accordéon).

**AI-2 — Accordéon plat d'étapes avec lignes de leçons**
- Intention : remplacer l'arbre déplié et la timeline visuelle par un accordéon
  sans axe, sans points et sans `Card` imbriquée, à une seule étape ouverte.
- Direction : composant d'accordéon consommé par `ProgramPage` ; état
  d'ouverture **séparé de la progression** ; première étape non terminée ouverte à
  la première visite. La dernière étape ouverte est **persistée côté serveur** par
  compte + programme (préférence synchronisée entre appareils), pas en
  `localStorage`. L'étape ouverte reste l'unique surface ; ses modules sont des
  intertitres plats et ses leçons des lignes à filets directement actionnables.
- Acceptation : une seule étape ouverte ; préférence retrouvée à l'identique sur
  un autre appareil du même compte ; ouvrir/replier ne navigue pas et ne modifie
  jamais la progression ; aucun axe vertical, point numéroté, sous-carte ou CTA
  pleine largeur ; étape repliée sans nombre d'activités ; usable à 320/390 px,
  texte 200 %, clavier, lecteur d'écran, `reduced-motion`.
- Effort : faible-moyen après V3-019. Rattachement : V3-021A ; la préférence
  serveur déjà livrée est conservée.

**AI-3 — Ligne de leçon compacte**
- Intention : rendre les leçons directement accessibles depuis l'étape ouverte
  sans recréer un niveau de cartes.
- Direction : ligne entière actionnable contenant titre, durée, statut avec
  icône/libellé et chevron ; filet horizontal entre lignes, sans fond, bordure,
  résumé long, nombre d'activités, barre ni bouton pleine largeur. `IN_PROGRESS`
  reprend l'activité serveur, `AVAILABLE` ouvre le début, `COMPLETED` permet la
  relecture et `LOCKED` affiche un verrou sans faux lien.
- Acceptation : au plus quatre informations ; mobile 390 px sur une ligne sauf
  titre autorisé à revenir à la ligne ; focus visible et nom accessible incluant
  le contexte du module lorsque son intertitre est masqué.
- Effort : faible-moyen. Rattachement : V3-021A.

### B. Flux de leçon

**FL-1 — Séquence pédagogique ordonnée par l'auteur (séquence inter-types) — préalable structurant**
- Décision tranchée : `PEDAGOGY_SPEC.lesson.sequence` = **liste ordonnée de
  références typées `{kind, key}` stables**. `COMPLETE` est **ajouté automatiquement
  en dernière position par le moteur** (jamais authoré). Le **backfill initial
  reproduit exactement le parcours V2 sans insérer les ressources dans la
  séquence** avant la réorganisation éditoriale.
- Direction : (1) étendre le contrat `PEDAGOGY_SPEC` avec `lesson.sequence`
  (`{kind, key}`, kinds `CONTENT | RESOURCE | TASK | CONCEPT_ASSESSMENT | EXERCISE | QUIZ`,
  `COMPLETE` implicite) ; (2) ajouter `RESOURCE` à `LessonActivityKind` et faire
  consommer la séquence serveur par `buildLessonActivitySequence` au lieu de
  `[...content, ...tasks, …]` (`lesson-activity-sequence.ts:230-237`) ; (3) backfill
  V2 exact (mêmes types, même ordre, ressources hors séquence) avant tout
  réordonnancement éditorial.
- Acceptation : après réorganisation éditoriale, une leçon peut déclarer
  `ressource A → contenu 1 → mini-éval → contenu 2 → exercice` et l'app la rend
  ainsi ; le parcours V2 reste identique après backfill seul ; `COMPLETE` toujours
  en dernier ; une seule séquence serveur fait autorité dans toutes les routes.
- Effort : élevé. Rattachement : V3-016 (contrat) puis V3-017. **Bloquant pour
  FL-3, RS-1.**

**FL-2 — `Continuer` suit l'activité suivante exacte**
- Intention : séparer navigation linéaire et « prochaine obligation ».
- Direction : dans `lesson-activity-sequence.ts:244-270`, faire pointer `next` vers
  `activités[index+1]` (y compris facultatives et ressources) et déplacer la logique
  « prochaine obligation incomplète » dans un signal distinct (rappel d'obligations
  restantes, aussi utilisé par Aujourd'hui) qui ne repositionne jamais la navigation
  en arrière.
- Acceptation : depuis l'activité k, `Continuer` va toujours à k+1 ; `Précédent` à
  k-1 ; aucun saut arrière implicite ; couverture par test unitaire de la séquence.
- Effort : moyen. Rattachement : **V3-017** (intégré à la séquence unifiée, pas un
  correctif isolé).

**FL-3 — Alternance théorie/pratique**
- Intention : permettre de placer l'application avant/entre les validations selon
  l'intention pédagogique.
- Direction : purement éditorial une fois FL-1 disponible ; le responsable
  pédagogique fournit l'ordre par leçon ; Codex l'intègre fidèlement sans inventer
  de placement.
- Acceptation : chaque leçon réordonnée justifie la place de ses exercices ; plus
  de « tout tester à la fin » mécanique ; aucun placement inventé par Codex.
- Effort : élevé (éditorial). Rattachement : V3-018.

**FL-4 — Navigation pédagogique en flux**
- Intention : sortir la navigation du mode collant.
- Direction : dans `PedagogicalNavigation.tsx:54-61`, retirer `sticky`/`bottom`
  et poser la navigation en fin d'activité, dans le flux, sous le contenu ; un
  seul `Continuer` visible.
- Acceptation : aucune zone masquée à 200 % ; safe-area respectée ; pas de double
  barre basse (voir MA-1) ; historique/focus conservés.
- Effort : faible-moyen. Rattachement : V3-021.

### C. Ressources & sources

**RS-1 — Ressources guidées au point d'usage**
- Intention : supprimer la liste globale ; afficher chaque ressource une seule
  fois à sa place ordonnée par l'auteur, avec guidage complet.
- Direction : retirer le bloc « Ressources de la leçon »
  (`LessonPage.tsx:362-389`) ; rendre chaque ressource comme carte d'activité de
  la séquence (verbe média `Lire/Regarder/Écouter/Explorer`, badge
  Obligatoire/Pour aller plus loin, périmètre, consigne, durée, langue, CTA,
  état). Les champs existent déjà côté données. La **précondition de complétion**
  d'une ressource obligatoire (consultation déclarée) est calculée **côté serveur**
  et intégrée à `canComplete` ; le client ne débloque jamais `Terminer la leçon`
  de lui-même.
- Acceptation : aucune ressource dupliquée ; **obligatoire = navigation linéaire
  autorisée sans blocage de `Continuer`, mais obligation incomplète tant qu'elle
  n'est pas confirmée consultée, ce qui bloque `Terminer la leçon` (donc module et
  étape)** ; la confirmation atteste la consultation déclarée, jamais la
  compréhension ; facultative sans poids de progression ; ressource obligatoire
  inaccessible → état explicite + alternative, jamais de faux succès.
- Effort : moyen. Rattachement : V3-020 (dépend de FL-1).

**RS-2 — Ne pas compter les ressources comme activités**
- Intention : rétablir la distinction ressource/activité dans les décomptes.
- Direction : exclure `resources` de `activityTotal`
  (`CurriculumPages.tsx:52-57`) ; réserver les compteurs à la vue leçon.
- Acceptation : « X activités » n'inclut plus les ressources.
- Effort : faible. Rattachement : V3-019.

**RS-3 — Conserver les sources au point d'usage** — ne pas régresser
`ContentActivity` (`LessonPage.tsx:95-122`).

### D. Évaluation & feedback

**EV-1 — Feedback des évaluations : conserver l'expérience actuelle (non retenu en V3)**
- Décision produit : ne pas introduire de feedback immédiat après chaque question.
  Conserver l'expérience actuelle — une question à la fois, puis score et correction
  détaillée après soumission — pour les mini-évaluations comme pour les quiz.
- Direction : **aucun changement** de `QuestionAssessmentExperience` sur ce point.
  La distinction mini-évaluation (validation ciblée d'une notion) / quiz
  (consolidation de la leçon) reste fonctionnelle, sans divergence d'expérience de
  réponse ni de correction.
- Acceptation : l'expérience de réponse et de correction reste identique à
  l'existant ; aucune régression.
- Effort : nul. Rattachement : aucun (statu quo, à noter en V3-016). Écart avec
  `ASSESSMENT_SPEC.md §feedback immédiat` assumé comme décision produit.

**EV-2 — Remédiation surfacée à l'échec**
- Intention : compléter la boucle échec → révision guidée → nouvelle tentative.
- Direction : dans l'écran de résultat (`QuestionAssessmentExperience.tsx:193-263`),
  afficher en cas d'échec un bloc « Revoir avant de retenter » pointant vers la
  **remédiation prévue par la spécification — un contenu, une ressource ou un
  exercice** (pas seulement `concept.resourceKeys`) + retour ciblé à l'activité.
- Acceptation : un échec propose au moins une remédiation pertinente (contenu,
  ressource ou exercice) et un retour ciblé ; aucune réussite simulée.
- Effort : faible-moyen. Rattachement : V3-020.

**EV-3 — Conserver correction/seuil/historique** — ne pas régresser.

### E. Actions & affordance

**AC-1 — Bouton note identifiable**
- Intention : rendre la prise de note visible sans concurrencer `Continuer`.
- Direction : remplacer la variante `ghost` (`LessonPage.tsx:437-443`) par un
  bouton secondaire outlined avec icône crayon/note, libellé `Prendre une note`,
  cible ≥ 44 px ; panneau/tiroir sans perte de position, annonce de liaison,
  confirmation + `Voir la note`.
- Acceptation : cible ≥ 44 px ; lien exact à la leçon/activité annoncé ;
  autosauvegarde/idempotence préservées ; focus restauré.
- Effort : faible. Rattachement : V3-022.

**AC-2 — Système d'actions cohérent**
- Intention : hiérarchie primaire/secondaire/destructive constante.
- Direction : définir une règle d'emploi des variantes (`primary` = action
  principale unique, `secondary` = actions de contexte, `danger` = destructif
  isolé et confirmé) et l'appliquer ; unifier les libellés (« Ouvrir le module »
  vs « Voir le module ») (`CurriculumPages.tsx:301-307, 380-386`).
- Acceptation : une seule action primaire par écran ; libellés cohérents ;
  destructif toujours confirmé.
- Effort : faible-moyen. Rattachement : V3-021/022.

**AC-3 — Liaison optionnelle d'une note à l'activité (tranché)**
- Décision tranchée : la note **reste liée à la leçon** (identité stable et source
  de vérité) et **peut posséder une référence facultative vers l'activité exacte**
  pour revenir au passage concerné. Livraison **après les identités d'activité
  stables de V3-017**. Une **petite migration est acceptée si nécessaire**.
- Direction : ajouter une référence d'activité **nullable** (clé `{kind, key}`
  stable issue de FL-1/V3-017) sur `Note` + capture de la clé courante dans le
  panneau note (V3-022). Dégradation gracieuse : si la clé ne résout pas dans la
  version courante, le deep-link se désactive silencieusement ; la note reste sur
  la leçon ; jamais d'erreur ni de note orpheline.
- Acceptation : une note sans référence d'activité fonctionne comme aujourd'hui ;
  une note avec référence ouvre l'activité exacte quand elle existe ; aucune note
  orpheline au déplacement/suppression/versionnement (V3-010).
- Effort : moyen (petite migration + API acceptée). Rattachement : V3-022, **après
  V3-017** (identité stable) et cohérent avec le versionnement V3-010.

### F. Système visuel & UI

#### Direction visuelle cible progressive

Les écrans V3 doivent converger progressivement vers une interface calme et
éditoriale : hiérarchie typographique nette, largeur de lecture maîtrisée,
espacements réguliers, peu de surfaces bordées, séparateurs fins et actions
immédiatement identifiables. L'accent bleu est réservé à la progression, à
l'état actif et à l'action primaire ; les statuts utilisent des badges compacts
avec icône ou libellé, jamais la couleur seule. Les états verrouillés peuvent
être atténués sans descendre sous le contraste requis.

Cette direction est un système à appliquer au fil des tickets concernés, pas
une demande de copie pixel-perfect ni une refonte globale glissée dans
V3-021A. Les composants restent génériques, compatibles avec tous les programmes,
les tailles tactiles de 44 px, le texte à 200 % et les largeurs 320/390 px.

**UI-1 — Échelle d'élévation et densité de cartes**
- Intention : introduire une hiérarchie visuelle de cartes.
- Direction : étendre `Card` avec 3 niveaux — `flat` (bordure fine, sans ombre,
  padding réduit) pour les listes, `raised` (`.ui-card` actuel) pour les blocs
  autonomes, `accent` pour l'action primaire (carte Aujourd'hui, activité
  courante). Adoucir l'ombre par défaut (`styles/index.css:97-103`,
  `0 18px 48px` → plus discrète) et réserver l'élévation forte à `accent`. Une
  `Card` ne contient jamais directement une seconde `Card` de même rôle visuel ;
  une sous-liste utilise filets, espace et typographie.
- Acceptation : sur une liste, les cartes sont `flat` ; une seule carte élevée par
  écran ; aucune régression de contraste.
- Effort : faible-moyen. Rattachement : V3-019.

**UI-2 — Discipline de l'accent cyan**
- Intention : restaurer la hiérarchie en réservant l'accent.
- Direction : règle « accent = action primaire + état actif uniquement » ;
  basculer eyebrows et labels d'activité de `text-cyan-300` vers
  `--app-text-muted` ; réserver `--app-accent` aux CTA primaires, à la progression
  et à l'état actif de navigation.
- Acceptation : sur chaque écran, l'accent ne marque qu'une action primaire et
  l'état actif ; audit visuel des écrans clés (Aujourd'hui, Programme, Leçon).
- Effort : faible-moyen. Rattachement : V3-019/021.

**UI-3 — Sémantique visuelle par type d'activité**
- Intention : rendre chaque type d'activité reconnaissable d'un coup d'œil (clé
  pour la séquence entrelacée de FL-1).
- Direction : étendre `NavigationIcon` en jeu d'icônes couvrant les kinds
  (`CONTENT`, `RESOURCE`, `TASK`, `CONCEPT_ASSESSMENT`, `EXERCISE`, `QUIZ`,
  `COMPLETE`) et les verbes média de ressource ; associer icône + label + ton
  discret (jamais couleur seule). Table de correspondance à définir avec les
  libellés existants (`activityLabels`, `lesson-activity-sequence.ts:65-72`).
- Acceptation : chaque activité de la séquence et du sommaire porte icône +
  label ; distinction cours/pratique/validation/ressource lisible au lecteur
  d'écran.
- Effort : moyen. Rattachement : V3-017/020.

**UI-4 — Mappings de statut cohérents (par domaine métier)**
- Intention : des rendus cohérents, sans forcer un vocabulaire unique.
- Direction : centraliser **plusieurs mappings métier** — **progression, maîtrise,
  publication, accès, consultation** — qui **partagent `Badge`, tons et icônes**
  mais **pas nécessairement le même vocabulaire**. Chaque mapping remplace les
  libellés dispersés correspondants (`lessonStatusLabel`/`statusLabels`/
  `stageStatusLabels`) dans `CurriculumPages`, `PedagogicalNavigation`,
  `StageAssessmentCard`.
- Acceptation : chaque domaine a un vocabulaire cohérent d'un écran à l'autre ;
  tons/icônes partagés ; statut jamais porté par la seule couleur.
- Effort : faible-moyen. Rattachement : **V3-019 à V3-021** (au fil des refontes).

**UI-5 — Invite d'installation PWA secondaire et mémorisée**
- Intention : ne jamais faire précéder le contenu pédagogique par une grande
  carte d'installation.
- Direction : conserver les alertes critiques hors ligne/mise à jour, mais
  déplacer l'action `Installer` et l'aide iOS dans une section `Application` de
  Profil. Mémoriser par appareil la fermeture de l'aide ; ne pas utiliser une
  préférence de progression ni une donnée serveur sensible.
- Acceptation : sur `/program/...` à 390 × 844, le titre et la progression du
  programme sont visibles sans scroll ; aucune invite d'installation n'occupe le
  flux avant le titre ; l'aide fermée ne réapparaît pas après rechargement sur le
  même appareil.
- Effort : faible. Rattachement : V3-021A.

### G. Mobile & accessibilité

**MA-1 — Supprimer la double barre basse** — résolu par FL-4 (navigation en flux).
Acceptation : sur mobile 390 px, une seule barre basse (tab-bar) ; pas de
recouvrement à 200 %.

**MA-2 — Vérifier les contrastes de texte méta**
- Direction : auditer `text-slate-400`/`text-slate-500` sur surfaces sombres ;
  router le texte méta vers `--app-text-muted` (#aebbd0) ; conserver le bump
  `prefers-contrast: more`.
- Acceptation : textes méta ≥ AA ; run axe sans violation de contraste sur les
  écrans clés.
- Effort : faible. Rattachement : **V3-019 à V3-021** (au fil des refontes).

**MA-3 — Ne pas régresser la base a11y** — skip-link, focus, 44 px, safe-areas,
`reduced-motion`, focus piégé du sommaire.

### H. Contenu & gouvernance

**CE-1 — Réconcilier notes éditoriales et seed**
- Direction : passe éditoriale mettant `editorial.status`/notes en accord avec
  l'état du seed (ex. note obsolète de `PEDAGOGY_SPEC_002.json`).
- Acceptation : aucune note contredite par le seed.
- Effort : faible-moyen (éditorial). Rattachement : V3-018.

**CE-2 — Documenter la traçabilité de la chaîne de publication**
- Intention : le problème est la **traçabilité de la chaîne**, pas « seed contre
  sidecar ». Expliciter les cinq états distincts et leur enchaînement.
- Direction : documenter la chaîne — `editorial.readyForPublication` (préparation
  pédagogique) → seed (paquet d'importation) → base/`isPublished` (visibilité
  runtime) → `ProgramVersion` (photographie publiée) ; la **validation scientifique**
  reste un état **indépendant et non bloquant**.
- Acceptation : chaque état est distinct, documenté et traçable de bout en bout ;
  aucune confusion entre préparation pédagogique, importation, visibilité runtime,
  version publiée et validation scientifique.
- Effort : moyen (gouvernance/documentation). Rattachement : V3-018/026.

---

## 4. Recommandations UI / design system (approfondissement)

Ancrage sur `src/styles/index.css` (tokens existants) et les composants `ui/`.

### 4.1 Tokens et échelle d'élévation

- Conserver la palette dark actuelle (`--app-background`, `--app-surface`,
  `--app-surface-raised`, `--app-accent`).
- Ajouter une échelle d'élévation explicite (3 niveaux) et une **variante de
  densité** de carte. Objectif : les listes respirent, l'action primaire ressort.
- Adoucir l'ombre par défaut ; réserver l'ombre forte à la carte `accent`.

### 4.2 Emploi de la couleur

- Accent = action primaire + état actif + progression. Point.
- Labels, eyebrows, méta → `--app-text-muted`.
- Statuts → tons dédiés (succès/info/avertissement/danger/neutre) portés par le
  mapping UI-4, toujours avec icône + texte.

### 4.3 Typographie et lisibilité

- La mesure de lecture 72ch (`--app-reading-max`) est déjà appliquée via
  `.ui-prose` dans `SafeMarkdown` : **à préserver**.
- Vérifier qu'aucun texte long n'échappe à `.ui-prose` — ex. le `summary` de
  leçon rendu `text-slate-300` en pleine largeur dans un `max-w-6xl`
  (`LessonPage.tsx:344, 361`) : le contraindre à la mesure de lecture.
- Conserver `text-wrap: balance` sur les titres et `clamp()` sur `.page-title`.

### 4.4 Iconographie

- Étendre le jeu d'icônes au-delà de la navigation : types d'activité et verbes
  média de ressource (UI-3), plus les statuts (UI-4). Un seul module d'icônes,
  cohérent, décoratif (`aria-hidden`) doublé d'un label textuel.

### 4.5 Cartes de liste (cible concrète)

```
Titre de la leçon · 25 min       ⟳ En cours  ›
─────────────────────────────────────────────
```

- Retirer de la liste : « X activités », l'accordéon « Détail des activités » et le
  résumé long (les garder dans la vue leçon).
- Ligne sans surface propre, ombre nulle et padding réduit. La carte Étape est
  l'unique conteneur visuel.

### 4.6 États système

- `Skeleton`, `EmptyState`, `ErrorState` existent et sont utilisés de façon
  cohérente : **à conserver**. Étendre le même soin aux nouveaux composants
  (accordéon, cartes ressources) : chargement, vide, erreur, hors ligne, verrouillé,
  brouillon — sans jamais simuler un succès hors ligne.

---

## 5. Priorisation

Aucun item n'est présenté comme un « quick fix » autonome : chaque recommandation
est **intégrée au ticket dépendant** qui la porte.

### 5.1 Intégration aux tickets dépendants

| Item | Rattachement |
| --- | --- |
| FL-2 `Continuer` sans saut arrière | V3-017 |
| CE-1 réconcilier notes éditoriales / seed | V3-018 |
| RS-2 ne pas compter les ressources comme activités | V3-019 |
| AI-1 progression serveur (agrégation Module) | préalable serveur de V3-019 |
| AI-2/AI-3 accordéon plat et lignes de leçons · UI-5 invite PWA | V3-021A |
| UI-4 mappings de statut · MA-2 contrastes | V3-019 à V3-021 |
| AC-1 bouton note | V3-022 |
| AC-3 liaison note↔activité | V3-022, après V3-017 |

### 5.2 Ordre structurant V3 (dépendances)

1. FL-1 contrat de séquence pédagogique ordonnée par l'auteur (V3-016) → moteur (V3-017).
2. RS-1 ressources guidées (V3-020), FL-4 navigation en flux (V3-021),
   AI-2 accordéon plat (V3-021A, après le préalable serveur AI-1), FL-3 réordonnancement
   éditorial (V3-018).
3. UI-1/UI-2/UI-3 système visuel, et UI-5 dans V3-021A, avant V3-022.

### 5.3 Améliorations ultérieures (V3.1 / V4)

- EV-2 remédiation enrichie (si non traitée avec V3-020).
- Activité de synthèse de fin de leçon (non modélisée aujourd'hui) — à cadrer
  côté spec.

### 5.4 À tester avant décision (ne pas retenir tel quel)

- **Pas de gamification** : rien ne la justifie ; la valeur est dans le séquençage
  et la clarté de progression.
- Pas de refonte visuelle globale : corrections ciblées + système d'élévation
  suffisent.

---

## 6. Décisions

### 6.1 Points encore ouverts

1. **Traçabilité de publication (CE-2)** : documenter la chaîne
   `editorial.readyForPublication` (préparation pédagogique) → seed (paquet
   d'importation) → base/`isPublished` (visibilité runtime) → `ProgramVersion`
   (photographie publiée), la validation scientifique restant un état **indépendant
   et non bloquant**. Le sujet est la traçabilité de la chaîne, pas « seed contre
   sidecar ».

### 6.2 Décisions tranchées par le responsable produit

- **Séquence ordonnée par l'auteur (FL-1)** : `PEDAGOGY_SPEC.lesson.sequence` =
  liste ordonnée de références typées `{kind, key}` stables ; `COMPLETE` ajouté
  automatiquement en dernière position par le moteur ; backfill initial reproduisant
  exactement le parcours V2 sans insérer les ressources avant la réorganisation
  éditoriale.
- **Ressource obligatoire (RS-1)** : navigation linéaire autorisée ; obligation
  incomplète tant que non confirmée consultée ; bloque `Terminer la leçon` (donc
  module et étape) ; confirmation = consultation déclarée, jamais compréhension.
- **Feedback des évaluations (EV-1)** : conserver l'expérience actuelle ; pas de
  feedback immédiat en V3.
- **Progression des vues de parcours (AI-1)** : conserver la formule serveur
  actuelle ; Programme et Étape exposent les valeurs serveur existantes, Module
  reçoit une agrégation serveur ; aucune nouvelle pondération dans ce correctif.
- **Dernière étape ouverte (AI-2)** : persistée côté serveur par compte +
  programme, synchronisée entre appareils, séparée de la progression.
- **Liaison note↔activité (AC-3)** : note liée à la leçon avec référence
  facultative vers l'activité exacte ; livraison après les identités stables de
  V3-017 ; petite migration acceptée si nécessaire.

---

## 7. Ce qu'il ne faut pas faire

- Ne pas laisser le frontend décider d'une réussite, d'un verrouillage ou d'une
  progression.
- Ne pas introduire de migration de schéma tant que l'architecture actuelle
  couvre le besoin (démontrer l'impossibilité d'abord).
- Ne pas inventer d'ordre, de placement ou de consigne pédagogique : ils viennent
  du responsable pédagogique via les specs.
- Ne pas ajouter de gamification ni d'effets visuels sans utilité démontrée.
- Ne pas régresser les réussites existantes (deep-link activité, correction +
  historique, reprise avec aperçu, base a11y, sources au point d'usage).
- Ne pas traiter les items structurants avant d'avoir tranché les décisions de la
  section 6 dont ils dépendent.
