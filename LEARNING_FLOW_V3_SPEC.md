# Spécification consolidée du parcours d'apprentissage V3

## Statut

- Version : 0.1.0
- Statut : **DRAFT À VALIDER**
- Ticket gate : `V3-016`
- Baseline : V2 clôturée à `ba3c352`
- Autorité pédagogique : responsable pédagogique LearnX

Ce document rassemble exclusivement les décisions produit et pédagogiques déjà
transmises. Il ne vaut pas encore autorisation d'implémenter V3-017 à V3-022.
Le responsable pédagogique doit le relire, résoudre les décisions ouvertes et
l'approuver explicitement. Codex implémente ensuite l'ordre fourni, signale les
contraintes et propose des variantes techniques ; il ne déduit jamais la
pédagogie depuis l'interface ou les tables existantes.

## 1. Principes

1. La hiérarchie reste strictement :

   ```text
   Program > Stage > Module > Lesson
   ```

2. La leçon est l'unité de contexte du parcours. Contenus, ressources, tâches,
   mini-évaluations, exercices, quiz, sources et notes restent rattachés à elle.
3. Une seule séquence globale, explicitement authorée dans la spécification
   pédagogique, détermine l'ordre des activités.
4. Le moteur n'impose ni « tous les contenus puis toutes les pratiques », ni
   alternance mécanique entre types.
5. Une intention pédagogique est comptée une seule fois. Les sources ne sont
   jamais des activités ni des preuves de maîtrise.
6. `Continuer` suit la prochaine activité exacte de la séquence serveur.
7. L'interface ne décide jamais seule d'une réussite, d'un verrouillage ou d'une
   progression.

## 2. Orientation globale

### 2.1 Depuis Aujourd'hui

- L'action principale reprend l'activité exacte recommandée, pas seulement la
  leçon ou le module.
- Le contexte annonce programme, étape, module, leçon et type d'activité sans
  exposer l'arborescence technique sous forme de multiples liens.
- Une reprise conserve la destination profonde et la position utile.

### 2.2 Depuis Parcours

- La vue Programme présente une timeline verticale d'étapes numérotées.
- Une seule étape est développée à la fois.
- À la première visite, l'étape ouverte est la première non terminée ; l'étape 1
  n'est choisie que lorsqu'aucune progression n'existe.
- Aux visites suivantes, la dernière étape développée est restaurée pour ce
  compte et ce programme. Cette préférence UI reste distincte de la progression.
- Une étape repliée affiche uniquement : numéro, titre, durée,
  progression/statut compact et chevron. Elle n'affiche jamais le nombre
  d'activités ni les descriptions détaillées.
- Une étape développée affiche un résumé court, ses modules sous forme compacte
  et un CTA principal `Commencer` ou `Reprendre`.
- Ouvrir/replier une étape ne navigue pas ; le CTA reste une action distincte.

### 2.3 Module

- Le module présente une séquence compacte de leçons.
- Chaque entrée permet d'identifier titre, durée, progression/statut et action
  principale, sans recopier tous les contenus ou activités.
- Le retour depuis une leçon ou une route profonde possède une destination
  stable vers son contexte, sans dépendre uniquement de l'historique navigateur.

## 3. Séquence globale de leçon

### 3.1 Autorité de l'ordre

Chaque future `PEDAGOGY_SPEC` fournit explicitement l'ordre inter-types. Les
types supportés par la séquence sont :

```text
CONTENT
RESOURCE
TASK
CONCEPT_ASSESSMENT
EXERCISE
QUIZ
COMPLETE
```

`COMPLETE` est terminal. Les sources bibliographiques ne figurent pas dans
cette liste ; elles sont attachées aux contenus soutenus.

Une séquence valide peut par exemple être :

```text
LIRE ressource A
→ CONTENU 1
→ LIRE ressource B
→ MINI-ÉVALUATION
→ CONTENU 2
→ EXERCICE
→ COMPLETE
```

Cet exemple démontre une capacité du moteur, pas un patron à appliquer à toutes
les leçons. Seule la spec approuvée décide du placement réel.

### 3.2 Invariants

- Chaque identité d'activité est stable et unique dans sa leçon.
- Une activité supprimée, ajoutée ou déplacée ne crée aucune référence orpheline.
- Une ressource facultative peut être visitée mais ne bloque pas `Continuer` et
  ne compte pas dans les préconditions.
- Une ressource obligatoire est une activité guidée uniquement lorsque la spec
  la déclare et la positionne ainsi.
- Tâche légère et exercice avec production ne sont jamais deux représentations
  de la même intention.
- Quiz et mini-évaluation restent des validations distinctes quand la spec le
  prévoit.
- Sommaire, reprise, `Précédent`, `Continuer`, progression, préconditions et
  recommencement de module consomment la même séquence.

### 3.3 Compatibilité V2

Avant toute réorganisation éditoriale, le backfill technique doit reproduire
exactement l'ordre V2 existant. Le programme ne change de flow qu'après
publication de specs explicitement réordonnées par le responsable pédagogique.

## 4. Ressources guidées

### 4.1 Suppression de la liste globale

La grande liste `Ressources de la leçon` en tête du flux disparaît. Une ressource
apparaît une seule fois, à l'endroit précis fourni par la spec et également à
la même position dans le sommaire.

### 4.2 Libellé selon le média

Le type dicte le verbe visible, par exemple :

- `Lire` ;
- `Regarder` ;
- `Écouter` ;
- `Explorer`.

L'interface n'utilise pas seulement le terme abstrait `Ressource`.

### 4.3 Ressource obligatoire

La spec fournit, sans complétion automatique par Codex :

- placement ;
- type et verbe ;
- contexte `Avant de continuer` ou objectif explicite ;
- titre ;
- périmètre exact à consulter : section, pages ou timestamps ;
- consigne courte sur ce qu'il faut chercher ou retenir ;
- durée ;
- caractère obligatoire ;
- destination et éventuelle alternative accessible.

La carte affiche ces informations, un badge `Obligatoire`, un CTA adapté comme
`Ouvrir la lecture`, puis l'état `Consultée` ou `Terminée`. Après consultation,
l'apprenant revient dans la séquence à l'activité pertinente.

### 4.4 Ressource facultative

- Libellé `Pour aller plus loin`.
- Accès possible au point prévu par la spec.
- Aucun blocage de `Continuer` ni poids dans la progression obligatoire.

### 4.5 Indisponibilité

Une ressource obligatoire inaccessible ne doit pas enfermer l'apprenant. La
spec éditoriale doit fournir une alternative ou revenir en révision. Le produit
affiche un état explicite et ne simule jamais la consultation réussie.

## 5. Sources bibliographiques

- Source/référence et ressource restent les deux modèles déjà distincts.
- Une source justifie une affirmation interne ; elle n'est pas une activité, ne
  possède aucune progression et n'est pas implicitement requise pour comprendre.
- Chaque source apparaît après le bloc précis qu'elle soutient, dans un panneau
  secondaire/repliable `Sources de ce contenu`.
- Citation, auteur et lien sûr restent accessibles sans recopier le contenu de
  la source.
- Une même URL peut être représentée séparément comme source et comme ressource,
  mais aucun statut ou progrès n'est partagé implicitement.
- Le programme psychologie fait l'objet d'un audit éditorial : un passage qui
  suppose une lecture externe devient autoportant ou la lecture déjà modélisée
  reçoit une consigne et un placement explicites.

## 6. Activité courante et navigation finale

### 6.1 Ordre du document

Pour chaque activité, l'ordre du flux est :

1. contexte et contenu intégral de l'activité ;
2. ressource(s) guidée(s) et source(s) attachée(s), si prévues ;
3. action secondaire de prise de note ;
4. bouton secondaire `Sommaire de la leçon` ;
5. ligne finale `Précédent` à gauche et action droite à droite.

### 6.2 Comportement

- La navigation pédagogique n'est jamais `sticky` ou `fixed` ; elle reste dans
  le flux, sous le contenu, sans recouvrir la barre principale.
- Un seul bouton d'avancement est visible.
- `Précédent` mène à l'activité précédente exacte et conserve sa place quand il
  est indisponible.
- `Continuer` mène à l'activité suivante exacte, même si elle est une ressource
  obligatoire ; il ne saute pas les types.
- À la dernière activité, le libellé devient `Terminer la leçon` ou
  `Leçon suivante` selon l'état fourni par le serveur.
- Le sommaire ouvre toutes les activités autorisées, montre leur position,
  verbe, titre et état, puis restitue le focus à la fermeture.

## 7. Prise de note contextuelle

- `Prendre une note` est un vrai bouton secondaire/outlined avec icône note ou
  crayon, cible tactile d'au moins 44 px.
- Il apparaît dans le flux normal avant la navigation finale et ne concurrence
  jamais l'action primaire.
- Un panneau ou tiroir s'ouvre sans perdre la position de lecture.
- Le produit annonce avant sauvegarde que la note sera liée à la leçon ou à
  l'activité courante.
- Après sauvegarde, une confirmation accessible et `Voir la note` sont proposés.
- L'autosauvegarde, la propriété et l'idempotence existantes restent applicables.

## 8. Reprise et progression

- Aujourd'hui et `Continuer` consomment la recommandation/activité serveur.
- Le dernier emplacement significatif est mémorisé au niveau activité sans
  remplacer la source de vérité de progression.
- Les activités facultatives commencées restent accessibles, mais ne remplacent
  pas la prochaine obligation.
- Une tentative échouée ne donne jamais de réussite et conduit à une remédiation
  précise prévue par la spec.
- Recommencer un module crée une nouvelle reprise et n'hérite pas arbitrairement
  des anciennes tentatives ; les notes sont conservées.
- Progression leçon/module/étape/programme compte chaque activité canonique une
  seule fois.

## 9. États

### Brouillon

- Visible uniquement au propriétaire/admin autorisé avec badge explicite.
- Aucun accès anonyme/non autorisé ; les mutations suivent la politique de
  prévisualisation validée.

### Verrouillé

- Motif et prérequis manquants sont annoncés.
- Une route profonde ne contourne jamais le verrou serveur.

### Terminé

- État et date sont visibles ; revoir ne réinitialise pas la progression.
- La prochaine action suit la séquence ou la hiérarchie validée.

### Hors ligne

- App shell et contenus explicitement disponibles restent lisibles.
- Mutations désactivées ou en attente explicite ; aucun faux succès.
- La destination est conservée pour la reconnexion, sans spinner infini.

### Contenu retiré ou erreur

- Recalcul serveur d'une destination sûre.
- Aucun message ne révèle un brouillon non autorisé.

## 10. Mobile et accessibilité

- Colonne unique à 320/390 px, aucun débordement horizontal.
- La navigation principale peut rester fixe ; le contenu réserve barre basse et
  `env(safe-area-inset-bottom)`.
- Aucun texte, CTA ou panneau n'est masqué à 200 % de zoom/texte.
- Cibles tactiles ≥ 44 px, focus visible, ordre DOM logique et titres
  sémantiques.
- Toutes les opérations sont possibles au clavier et annoncées au lecteur
  d'écran ; l'état actif ne dépend jamais uniquement de la couleur.
- Le sommaire mobile est un tiroir à une colonne, scroll vertical unique, fond
  inerte, focus piégé, Échap et restauration du focus.
- `prefers-reduced-motion` est respecté.
- Desktop peut employer un contexte latéral, sans modifier l'ordre ni créer une
  seconde source de vérité.

## 11. Responsabilités

### Responsable pédagogique

- Définit l'ordre, le placement, les prérequis et toutes les consignes.
- Valide les specs et la réorganisation du programme psychologie.

### Éditorial

- Vérifie sourcing, accessibilité, disponibilité, durée, langue, alternative et
  cohérence des évaluations.

### Codex/technique

- Valide la compatibilité du contrat et l'intégrité des références.
- Implémente fidèlement, signale une impossibilité et propose des options
  techniques sans trancher la pédagogie.

## 12. Critères d'acceptation de la spec

La spec pourra passer de `DRAFT À VALIDER` à `APPROUVÉE` lorsque :

- le responsable pédagogique confirme chaque section et les libellés terminaux ;
- le contrat de séquence authorée est défini pour les futures
  `PEDAGOGY_SPEC` ;
- les états brouillon, verrouillé, terminé, hors ligne et indisponible sont
  acceptés ;
- le comportement des ressources obligatoires/facultatives et des sources est
  non ambigu ;
- reprise, progression et recommencement ne se contredisent pas ;
- mobile, clavier, focus, lecteur d'écran et texte 200 % ont des critères
  vérifiables ;
- les décisions ouvertes ci-dessous sont résolues.

## 13. Décisions encore ouvertes pour validation produit

1. Persistance exacte de la dernière étape développée : locale privée ou serveur.
2. Libellé terminal précis selon les cas `Terminer la leçon` et
   `Leçon suivante`.
3. Comportement de progression d'une ressource obligatoire : consultation
   déclarative, confirmation explicite ou autre règle fournie pédagogiquement.
4. Forme exacte du contrat authoré dans les `PEDAGOGY_SPEC` et stratégie
   d'identité stable.
5. Comportement des activités facultatives déjà commencées dans la reprise.
6. Périmètre de liaison d'une note : leçon seulement ou activité précise lorsque
   le modèle le permet.

## 14. Tests attendus après approbation

- Ordre inter-types, backfill V2 exact, reprise et progression.
- Ressource obligatoire/facultative, lien externe, indisponibilité et retour.
- Sources au point d'usage, liens sûrs et absence de double comptage.
- Sommaire, Précédent/Continuer, première/dernière activité et deep links.
- Brouillon/public, verrouillage, utilisateur non autorisé et deux comptes.
- Notes contextuelles, autosauvegarde, erreur et idempotence.
- Chromium/WebKit, 320/390/desktop, axe, clavier, zoom/texte 200 %, VoiceOver et
  reduced motion.
