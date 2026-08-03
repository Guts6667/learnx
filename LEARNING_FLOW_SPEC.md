# Parcours d’apprentissage centré sur la leçon

## 1. Décision produit

La leçon est l’unité d’apprentissage et de navigation de LearnX.

Les blocs de cours, sources, ressources, tâches, mini-évaluations, quiz,
exercices et notes ne doivent pas être présentés comme des inventaires globaux
successifs. Ils restent rattachés à leur leçon et apparaissent au moment où ils
sont pédagogiquement utiles.

Une seule action principale, « Continuer », conduit vers la prochaine activité
pertinente. Le système conserve néanmoins des routes profondes partageables pour
un quiz, une mini-évaluation ou un exercice.

Cette spécification est un polish V2 construit sur les données existantes. Elle
n’ajoute aucun nouveau modèle, workflow métier ou système d’analytics.

Cette évolution ne modifie pas la hiérarchie de domaine :

```text
Program > Stage > Module > Lesson
```

## 2. Parcours observé au 3 août 2026

### Routes

```text
/today
/program
/program/:programSlug
/program/:programSlug/stage/:stageSlug
/program/:programSlug/module/:moduleSlug
/program/:programSlug/lesson/:lessonSlug
/program/:programSlug/lesson/:lessonSlug/assessment?assessmentId=...
/program/:programSlug/lesson/:lessonSlug/quiz?quizId=...
```

L’exercice ne possède pas de route dédiée : son éditeur est rendu directement
dans la page de leçon. Les pages quiz et mini-évaluation rechargent la leçon pour
retrouver leur activité et ne montrent que le titre de l’évaluation, sans en-tête
persistant du programme, de l’étape et du module.

### Depuis Aujourd’hui

La carte principale expose déjà une action « Continuer », mais sa destination
varie :

- une tâche incomplète renvoie à la page de leçon sans cibler la tâche ;
- une révision renvoie à la page de leçon sans cibler le contenu à revoir ;
- une notion à valider renvoie à `/quiz`, alors que les mini-évaluations de
  notions utilisent la route `/assessment` ;
- une nouvelle étape ou un nouveau module renvoie à leur page intermédiaire ;
- l’évaluation finale renvoie à la page de l’étape.

La reprise n’ouvre donc pas toujours l’activité exacte et peut imposer plusieurs
recherches ou clics supplémentaires.

### Depuis le curriculum

Le chemin complet peut demander quatre actions après la liste des programmes :

```text
programme → étape → module → leçon
```

La page module liste bien des cartes-leçons, mais elles ne présentent que titre,
résumé et statut brouillon. Durée, progression et activités associées ne sont pas
résumées.

### Dans la leçon

La page affiche actuellement, dans cet ordre :

1. en-tête, durée, résumé et objectifs ;
2. tous les blocs de contenu ;
3. progression ;
4. toutes les ressources ;
5. toutes les tâches ;
6. toutes les notions et mini-évaluations ;
7. notes ;
8. tous les quiz puis tous les exercices.

Ce regroupement suit les collections techniques. Il sépare une explication de
sa mise en pratique, oblige à parcourir une page longue et ne fournit aucune
action principale capable de choisir la prochaine activité.

### Contexte de navigation

Le layout fournit un retour fondé sur l’historique du navigateur et une
navigation basse. Il ne montre ni fil d’Ariane, ni sommaire de leçon, ni position
dans le module. Une route profonde ouverte directement ne dispose donc pas d’un
retour contextuel fiable vers son module.

## 3. Architecture d’information cible

```text
Aujourd’hui
└── Continuer l’activité exacte
    └── Leçon et contexte du module
        ├── Séquence pédagogique
        │   ├── Comprendre
        │   ├── Consulter une ressource
        │   ├── Mettre en pratique
        │   ├── Vérifier une notion
        │   └── Consolider
        ├── Sommaire
        └── Continuer
```

Les activités restent des entités métier distinctes. La séquence est une vue de
présentation ordonnée, pas une nouvelle hiérarchie de base de données.

## 4. Entrées du parcours

### 4.1 Aujourd’hui

La carte principale décrit :

- programme, étape, module et leçon ;
- activité exacte et type d’activité ;
- durée estimée de cette activité, pas seulement celle de la leçon ;
- état éventuel hors ligne ou verrouillé ;
- une seule action « Continuer ».

Le clic ouvre directement l’activité : ancre stable dans la leçon ou route
profonde conservant son contexte. Le serveur reste la source de vérité pour la
recommandation ; le frontend ne reconstitue pas une autre priorité.

Le dernier emplacement significatif est mémorisé au niveau activité. Reprendre
une leçon ne renvoie pas systématiquement en haut de page.

### 4.2 Curriculum

Le parcours standard vise au maximum deux actions depuis le curriculum visible :

1. ouvrir une étape ou un module depuis le programme ;
2. ouvrir la carte-leçon.

Une étape peut afficher directement ses modules dépliables et leurs cartes-leçons
sans imposer une page de transition à chaque niveau. Les routes programme, étape
et module restent disponibles pour partage, retour et grands curriculums.

### 4.3 Module

Le module est une séquence ordonnée de cartes-leçons. Chaque carte affiche :

- titre, résumé court et durée totale indicative ;
- progression et état : brouillon, verrouillée, disponible, en cours ou terminée ;
- nombre et état synthétique des ressources, tâches, exercices, notions et quiz ;
- activité suivante dans la leçon ;
- action principale `Commencer`, `Continuer`, `Revoir` ou `Voir les prérequis`.

Les détails peuvent être dépliés sans navigation, mais la carte entière ne doit
pas devenir une zone interactive ambiguë.

## 5. Espace unifié de leçon

### 5.1 En-tête persistant

Toute vue de leçon ou activité profonde affiche :

- fil d’Ariane `Programme / Étape / Module / Leçon` ;
- statut et durée ;
- progression de la leçon ;
- retour explicite au module ;
- action « Continuer » lorsque pertinente.

Sur desktop, un sommaire latéral peut rester visible. Sur mobile, l’en-tête est
compact, le sommaire s’ouvre dans un tiroir et le contenu reste linéaire.

### 5.2 Séquence pédagogique

La page n’affiche plus toutes les collections l’une après l’autre. Elle compose
des unités d’activité :

```text
bloc(s) de compréhension
→ source ou ressource utile
→ tâche ou exercice d’application
→ mini-évaluation de la notion
→ feedback et activité suivante
```

Une ressource citée reste visible sous le bloc qui la justifie. Une ressource à
lire ou regarder peut s’ouvrir directement dans un nouvel onglet sûr ou dans un
tiroir de détails, sans passage par une liste globale. La section globale
« Ressources » reste accessible depuis le sommaire comme index secondaire.

Les notes sont une commande contextuelle disponible pendant toute la leçon. Leur
création conserve le lien à la leçon et, si possible, à l’activité courante.

### 5.3 Action « Continuer »

Il ne peut y avoir qu’une action principale visible par contexte. Sa décision est
déterministe :

1. activité requise déjà commencée et non terminée ;
2. première activité requise non terminée dans l’ordre pédagogique ;
3. quiz ou consolidation de fin de leçon requis ;
4. terminer la leçon si toutes les conditions serveur sont satisfaites ;
5. première activité de la prochaine leçon disponible ;
6. évaluation finale d’étape lorsqu’elle devient disponible.

Les activités optionnelles restent accessibles depuis le sommaire mais ne
bloquent pas « Continuer ». Une tentative échouée ramène vers le contenu ou la
remédiation indiquée avant de proposer une nouvelle tentative.

Le frontend ne déclare jamais une activité réussie seul. Il consomme l’état et
les préconditions calculés par le serveur.

### 5.4 Ordonnancement inter-types

Les positions actuelles sont propres à chaque table et ne peuvent pas exprimer
un ordre arbitraire entre bloc, ressource, tâche, exercice et évaluation. La V2
choisit donc une séquence déterministe dérivée, sans migration :

1. objectifs et blocs de contenu par `position` ;
2. sources attachées rendues avec chaque bloc ;
3. ressources obligatoires non encore rencontrées, puis optionnelles, par
   `position` ;
4. tâches par `position` ;
5. notions et mini-évaluations par position de notion puis d’évaluation ;
6. exercices par `position` ;
7. quiz de synthèse par `position` ;
8. complétion de la leçon.

L’interface ne rend pas ces phases comme huit listes globales simultanées : elle
montre l’activité courante, les activités voisines et un sommaire. « Continuer »
avance dans cette séquence en sautant les éléments optionnels non commencés.

Un contrat typé local `LessonActivitySequence` peut produire identifiant stable,
type, ordre, état, durée et destination à partir de la réponse de leçon actuelle.
L’ordre éditorial arbitraire reliant une mise en pratique à un bloc précis est
reporté en V3, car il nécessiterait de nouvelles métadonnées ou une migration.

## 6. Routes et conservation du contexte

Les routes canoniques existantes sont conservées. Les destinations d’activité
doivent inclure un identifiant stable :

```text
/program/:programSlug/lesson/:lessonSlug?activity=task:<taskId>
/program/:programSlug/lesson/:lessonSlug/assessment?assessmentId=<id>
/program/:programSlug/lesson/:lessonSlug/quiz?quizId=<id>
/program/:programSlug/lesson/:lessonSlug/exercise/:exerciseId
```

La route d’exercice est une cible proposée ; son ajout sera validé pendant
l’implémentation. Une route profonde affiche le même en-tête et le même fil
d’Ariane que la leçon. « Retour à la leçon » restaure activité, défilement et
sommaire. Le bouton retour du navigateur reste fonctionnel et ne remplace pas le
retour contextuel.

Les paramètres de destination sont validés côté serveur par appartenance à la
leçon et autorisation de lecture. Une activité d’une autre leçon ne peut jamais
être injectée dans le contexte courant.

## 7. Rendu des contenus longs et évaluations finales

### Défaut observé

`StageAssessmentCard` affiche actuellement `assessment.instructions` directement
dans un unique élément `<p>`. Le navigateur fusionne les retours à la ligne et
le texte conserve les jetons `## Consignes` ou `## Cas ...` visibles. Les listes
numérotées deviennent un paragraphe dense et les sections objectif, consignes,
cas et remédiation n’ont aucune hiérarchie sémantique.

Sur mobile, ce bloc très long approche la navigation fixe. Le contenu doit
utiliser le scroll principal et un padding bas calculé avec la hauteur réelle de
la navigation et `env(safe-area-inset-bottom)` afin qu’aucun texte ne soit masqué.

### Contrat de rendu V2

- Interpréter uniquement un sous-ensemble Markdown sûr : titres, paragraphes,
  listes ordonnées/non ordonnées, emphase et liens.
- Produire des éléments HTML sémantiques ; ne jamais afficher de jetons Markdown
  bruts lorsque leur syntaxe est valide.
- Refuser ou neutraliser tout HTML brut, script, gestionnaire d’événement, URL
  dangereuse ou protocole non autorisé.
- Présenter objectif, consignes, cas et grille dans des sections distinctes avec
  titres et espacements cohérents.
- Rendre chaque consigne dans un véritable `<ol>`/`<li>` plutôt que dans un texte
  numéroté fusionné.
- Garder une largeur de lecture confortable, un interlignage généreux et des
  paragraphes suffisamment espacés à 320/390 px.
- N’utiliser aucun scroll imbriqué pour le corps de l’évaluation ; la page entière
  reste le conteneur de défilement.
- Réserver en bas l’espace de la navigation fixe et de la safe area.
- Conserver des liens et sources identifiables, focusables et annoncés avec un
  intitulé explicite.

### Validation

- Tests de titres, paragraphes, emphase, liens et listes structurées.
- Tests XSS et protocoles de liens interdits.
- Tests de contenus très longs, 320/390 px et absence de texte sous la navigation.
- Tests zoom 200 %, tailles système iOS, clavier et VoiceOver.

## 8. États

### Brouillon

- Visible uniquement au propriétaire admin authentifié.
- Badge et bandeau de prévisualisation persistants.
- Séquence consultable, mais mutations de progression désactivées.
- « Continuer la prévisualisation » navigue sans créer de tentative publique.

### Verrouillé

- La carte indique la raison et les prérequis manquants.
- L’action principale devient « Voir les prérequis ».
- Une route profonde ne contourne pas le verrou côté serveur.

### Terminé

- La carte affiche la date et la progression complète.
- L’action secondaire « Revoir » ouvre le sommaire ; l’action principale du
  parcours va vers la prochaine leçon ou l’évaluation d’étape.
- Revoir ne réinitialise aucune progression.

### Hors ligne

- Aucune donnée privée ne provient du cache partagé du service worker.
- Si la leçon n’est pas explicitement disponible hors ligne, afficher un état
  court avec nouvelle tentative, sans spinner indéfini.
- Les mutations indisponibles sont désactivées et expliquées ; aucune réussite
  n’est simulée.
- La destination exacte est conservée pour la reconnexion.

### Erreur ou contenu retiré

- Une activité supprimée ou dépubliée retourne vers la leçon et recalcule la
  prochaine activité.
- L’erreur ne révèle pas l’existence d’un brouillon non autorisé.

## 9. Responsive et accessibilité

### Mobile

- Colonne unique focalisée sur l’activité courante.
- Action « Continuer » proche du contenu, sans masquer la navigation basse.
- Sommaire dans un tiroir avec focus piégé, fermeture au clavier et restitution
  du focus.
- Zones tactiles d’au moins 44 × 44 px.

### Desktop

- Sommaire latéral et contenu principal sans dépasser une largeur de lecture
  confortable.
- Progression, contexte et prochaine activité visibles sans recopier les actions.

### Exigences communes

- Structure de titres logique et une seule cible principale par page.
- `aria-current` sur activité et fil d’Ariane ; annonces des changements d’état.
- Focus placé sur le titre de l’activité après navigation.
- Navigation entièrement réalisable au clavier et avec zoom à 200 %.
- Préférence de réduction des animations respectée.

## 10. Mesure de qualité V2

La V2 mesure le parcours dans les tests : nombre d’actions, destination exacte,
restauration du contexte et absence de boucle. Elle n’intègre pas de fournisseur
analytics ni de collecte persistée. L’instrumentation produit complète est une
candidate V3.

## 11. Critères d’acceptation

- Depuis Aujourd’hui, « Continuer » ouvre l’activité exacte recommandée.
- Depuis le curriculum, deux actions maximum ouvrent une leçon visible.
- Le module affiche une séquence de cartes-leçons avec durée, progression et
  synthèse de toutes leurs activités.
- Une leçon ne présente plus les types d’activités comme des listes globales
  successives constituant le parcours principal.
- Ressources, tâches, exercices et évaluations restent dans le contexte de leur
  leçon et de la notion concernée.
- Une seule action principale choisit la prochaine activité selon les règles
  serveur.
- Quiz, mini-évaluations et exercices profonds conservent en-tête, fil d’Ariane,
  retour et position dans la leçon.
- Brouillon, verrouillage, complétion et hors ligne ne permettent aucun
  contournement d’autorisation ou faux succès.
- La séquence est dérivée exclusivement des données existantes, sans migration.
- Les tests prouvent le maximum de deux actions depuis le curriculum et la reprise
  exacte depuis Aujourd’hui.
- Les évaluations finales longues sont structurées, sûres et entièrement lisibles
  au-dessus de la navigation fixe.

## 12. Tests attendus

- Tests unitaires de sélection de la prochaine activité et de l’ordre inter-types.
- Tests d’autorisation sur brouillons, verrous et routes profondes.
- Tests d’intégration : Aujourd’hui → activité exacte → Continuer → activité
  suivante → leçon suivante.
- Tests du nombre maximal de clics depuis programme, étape et module.
- Tests de restauration du contexte après retour, rechargement et lien profond.
- Tests offline/reconnexion sans chargement indéfini.
- Playwright sur 390 × 844, tablette, 1440 × 900 et WebKit mobile.
- Axe, clavier, focus, zoom 200 % et réduction des animations.
- Rendu Markdown sûr, XSS, listes sémantiques et très longs contenus mobiles.

## 13. Hors périmètre

- Refonte visuelle complète des tokens et de la marque.
- Modification de la formule de progression, traitée par `V2-003`.
- Publication en cascade, traitée par `V2-005`.
- Validation scientifique persistée, ordre éditorial arbitraire et analytics
  produit, reportés dans `V3_CANDIDATES.md`.
- Recommandation adaptative par IA.
- Édition collaborative ou réseau social.

## 14. Décisions restantes

1. Décider si l’exercice obtient une route profonde canonique ou reste une ancre
   dans la leçon.
2. Définir l’activité minimale mémorisée pour reprendre un long bloc de contenu :
   bloc, sous-section ou simple activité.
3. Choisir si une activité optionnelle commencée prend temporairement priorité
   sur la prochaine activité requise.
