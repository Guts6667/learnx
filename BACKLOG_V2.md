# Backlog LearnX V2

## Statut et périmètre de l’audit

Ce backlog succède au backlog V1 conservé dans `BACKLOG_CODEX.md`. Il a été
établi le 3 août 2026 à partir de la branche `dev` au commit `5d58dda`, de la
documentation, du schéma Prisma, des migrations, des API Vercel, des tests et de
la production `https://learnx-eight.vercel.app`.

L’audit public a couvert les vues de connexion aux formats desktop et mobile,
les redirections anonymes, le manifeste, le service worker et les erreurs de
console. Aucune session authentifiée existante n’était disponible : Aujourd’hui,
les parcours, leçons, évaluations, exercices, notes, révisions, profil et admin
ont donc été audités par le code et les tests, pas par une session de production.

### Cap V2

**Statut : plan validé par l’utilisateur.**

La V2 est un gros polish UI/UX construit sur un socle stable. Elle n’est pas une
nouvelle vague fonctionnelle.

Son ordre est volontairement court :

1. corriger les P0 de confidentialité, autorisation et progression ;
2. ajouter les tests backend réels indispensables ;
3. simplifier le parcours de leçon et l’administration ;
4. fiabiliser publication, responsive, actions, accessibilité et états offline.

Les nouvelles capacités métier, migrations non indispensables au polish,
analytics complets et workflows avancés sont reportés dans `V3_CANDIDATES.md`.

### Décisions invariantes

- LearnX reste générique : `Program > Stage > Module > Lesson`, sans année ni
  semestre et sans psychologie codée en dur.
- La publication personnelle et la validation scientifique sont indépendantes.
- Un contenu pédagogiquement complet peut être publié sans revue scientifique.
- Publier ne signifie jamais « validé scientifiquement ».
- La validation scientifique reste une vision future optionnelle ; elle n’est
  pas un ticket V2.
- Les calculs de progression, de maîtrise et de validation restent côté serveur.
- Un ticket correspond idéalement à un commit. Aucune migration n’est introduite
  pour le polish ; une nécessité P0 imprévue doit être démontrée et isolée.

## Synthèse des preuves

### Points conformes

- La production répond, le manifeste est installable et la session anonyme
  retourne `user: null`.
- `/admin` et `/program` redirigent un visiteur anonyme vers `/login`.
- La page de connexion tient en 390 px et 1440 px sans débordement horizontal.
- Les cookies de session sont `HttpOnly`, `SameSite=Lax` et `Secure` en
  production.
- Les réponses de quiz et mini-évaluations ne révèlent pas les corrections avant
  soumission.
- Les accès curriculum, leçons, notes, exercices et révisions appliquent
  généralement les filtres de propriétaire ou d’utilisateur attendus.
- Le schéma et les migrations sont cohérents par inspection ; les hiérarchies et
  index principaux sont présents.
- `168` tests Vitest passent. Couverture globale observée : 75,11 % des
  instructions et 63,86 % des branches.
- Le parcours E2E critique existe et passe avec une API simulée et Chromium
  desktop.
- Le contrôle de déploiement public passe sur l’URL de production.

### Risques confirmés

| Priorité | Preuve | Impact |
| --- | --- | --- |
| P0 | Le service worker met en cache pendant 30 jours les réponses `/api/lessons/*`, y compris `preview=true`, avec une clé d’URL non liée à l’utilisateur. | Un brouillon ou contenu privé peut survivre à la déconnexion et être servi à une autre session. |
| P0 | La revue d’une soumission d’évaluation d’étape charge la soumission par identifiant après un simple contrôle du rôle `ADMIN`. | Un administrateur peut agir hors du périmètre de ses programmes si l’identifiant est connu. |
| P0 | Le calcul réel de progression de leçon ne prend en compte que tâches et ressources, alors que le produit prévoit aussi quiz et exercices. | Une leçon peut être validée sans les contrôles pédagogiques attendus ; les pourcentages sont faux. |
| P1 | Les mutations de progression, publication et soumission effectuent plusieurs écritures sans transaction globale ni contrôle de version. | États dérivés partiels, courses et écrasements concurrents. |
| P1 | Le rate limit de connexion réside dans une `Map` mémoire d’une Function serverless. | Contournement par changement d’instance et protection inégale. |
| P1 | Chaque requête authentifiée met à jour la session. | Écriture PostgreSQL systématique, latence et coût inutiles. |
| P1 | L’admin affiche toute la hiérarchie imbriquée et publie sans aperçu ni confirmation. | Navigation mobile difficile et mutations risquées. |
| P1 | Le mode hors ligne informe, mais les mutations ne sont ni désactivées ni mises en file explicitement. | Attente infinie ou résultat ambigu hors connexion. |
| P1 | Le seul E2E utilise une API simulée, Chromium desktop et ne couvre pas les Functions réelles. | Régressions d’intégration et iOS non détectées. |
| P2 | Notes sans suppression, pagination ni contrôle de concurrence ; listes curriculum/admin chargées en bloc. | Dette UX, pertes en multi-onglets et dégradation avec la croissance. |

## Ordre de livraison

Les tickets P0 constituent le jalon « intégrité et confidentialité ». Le reste
de la V2 constitue le jalon « polish du parcours ». Aucune capacité V3 ne doit
retarder ces deux jalons.

## V2-001 — Supprimer le cache privé du service worker

**Priorité : P0. Dépendances : aucune.**

### Périmètre

- Retirer toutes les réponses API authentifiées du cache runtime partagé.
- Purger explicitement `learnx-pedagogy-v1` lors de l’activation du nouveau
  service worker.
- Ajouter des en-têtes `Cache-Control: private, no-store` aux réponses privées et
  de prévisualisation.
- Conserver uniquement l’app shell et les actifs publics versionnés hors ligne.

### Hors périmètre

- Synchronisation hors ligne des mutations.
- Cache chiffré ou téléchargement pédagogique par utilisateur.

### Critères d’acceptation

- Après déconnexion, aucune réponse de leçon, brouillon, note ou évaluation ne
  reste dans CacheStorage.
- Changer de compte ou passer hors ligne ne restitue jamais les données du compte
  précédent.
- Le shell reste installable et une page hors ligne neutre est disponible.

### Tests et risques

- Tests service worker, déconnexion/changement de session et inspection du cache
  dans Chromium et Safari iOS.
- Risque : régression de consultation hors ligne ; communiquer clairement la
  nouvelle limite jusqu’au ticket V2-011.

## V2-002 — Borner la revue d’évaluation au propriétaire

**Priorité : P0. Dépendances : aucune.**

### Périmètre

- Charger et modifier une soumission uniquement si son étape appartient à un
  programme du propriétaire administrateur authentifié.
- Porter le prédicat d’autorisation dans la requête d’écriture, pas seulement
  dans un contrôle préalable.
- Normaliser les réponses 403/404 sans divulguer l’existence d’un identifiant.

### Hors périmètre

- Rôle de super-administrateur global.
- Portail de correcteur externe.

### Critères d’acceptation

- Le propriétaire peut relire ses soumissions.
- Un autre admin, un apprenant et un visiteur ne peuvent ni lire ni modifier la
  soumission, même avec son UUID.

### Tests et risques

- Tests d’autorisation croisée avec deux propriétaires, non-admin et anonyme.
- Risque : les données historiques sans propriétaire cohérent devront être
  signalées sans assouplir le contrôle.

## V2-003 — Rétablir une progression pédagogique exacte et atomique

**Priorité : P0. Dépendances : aucune.**

### Périmètre

- Implémenter côté serveur les catégories prévues : tâches 40 %, quiz 30 %,
  exercices 20 %, ressources obligatoires 10 %, avec redistribution des
  catégories absentes.
- Définir explicitement le lien entre mini-évaluations de notion, quiz de leçon,
  exercices et complétion.
- Recalculer leçon, module, étape et timeline dans une transaction cohérente.
- Rendre les écritures répétées idempotentes et sûres en concurrence.
- Réparer les états existants par une commande de recalcul contrôlée.

### Hors périmètre

- Recommandation adaptative ou répétition espacée avancée.
- Changement de la hiérarchie du curriculum.

### Critères d’acceptation

- Une leçon ne peut être terminée si une notion obligatoire n’est pas maîtrisée
  ou si un élément pédagogique requis manque.
- Le pourcentage réel correspond à la formule documentée pour toutes les
  combinaisons de catégories présentes ou absentes.
- Deux soumissions concurrentes ne régressent pas la maîtrise ni la progression.
- Quiz et exercices déclenchent immédiatement le recalcul côté serveur.

### Tests et risques

- Tests purs de matrice de poids, tests API réels et tests de concurrence.
- Couverture du module critique `src/server/api/progress/app.ts` portée au moins à
  90 % des branches.
- Risque produit à trancher : un exercice est-il complété à la soumission ou
  seulement après validation ? Voir « Choix restants ».

## V2-004 — Couvrir le backend réel par des tests d’intégration

**Priorité : P0. Dépendances : V2-001 à V2-003.**

### Périmètre

- Exécuter le parcours critique contre les Functions et une base Neon isolée ou
  éphémère, sans mock de contrat HTTP.
- Couvrir inscription/connexion, curriculum, leçon, évaluations, exercices,
  notes, révisions, progression et autorisations multi-utilisateurs.
- Ajouter un projet Playwright mobile et un contrôle de déploiement authentifié
  avec compte de test dédié et secret CI.
- Exécuter ces contrôles dans un environnement reproductible utilisant les vraies
  Functions et une base isolée.

### Hors périmètre

- Tests destructifs sur la base de production.

### Critères d’acceptation

- Les mocks frontend restent unitaires, mais le pipeline échoue si API, Prisma et
  UI divergent.
- Les données de test sont isolées, réinitialisables et ne contiennent aucun
  secret dans Git.

### Tests et risques

- Chromium desktop/mobile et WebKit mobile ; migration + seed avant scénario.
- Risque de coût et de flakiness Neon : une branche par exécution avec nettoyage
  garanti.

## V2-005 — Publication en cascade transactionnelle

**Priorité : P1. Dépendances : V2-002, V2-003.**

### Périmètre

- Ajouter un aperçu en lecture seule de l’effet d’une publication ou
  dépublication au niveau programme, étape et module.
- Afficher éléments concernés, préconditions manquantes et avertissements avant
  confirmation.
- Appliquer la cascade dans une transaction atomique, idempotente et contrôlée
  par le propriétaire ; aucune mutation partielle en cas d’échec.
- Respecter uniquement les gates pédagogiques : notions obligatoires évaluées,
  évaluation finale d’étape et cohérence de la hiérarchie.
- Ne jamais consulter une revue scientifique comme condition de publication.

### Hors périmètre

- Validation scientifique et signature externe.
- Publication publique multi-tenant au-delà du modèle propriétaire existant.

### Critères d’acceptation

- L’aperçu et l’exécution portent le même identifiant de plan ou version.
- Une confirmation obsolète est rejetée proprement.
- Répéter la même commande donne le même état.
- Un échec restaure tous les niveaux.
- La dépublication expose clairement son impact et n’efface aucune progression.

### Tests et risques

- Autorisation croisée, dry-run, concurrence, rollback forcé et idempotence.
- Risque : une très grande hiérarchie nécessite une limite et une stratégie de
  lot sans perdre l’atomicité métier.

## V2-006 — Navigation admin progressive

**Priorité : P1. Dépendances : V2-005.**

### Périmètre

- Remplacer l’arbre complet par une navigation progressive
  programme → étape → module → leçon.
- Utiliser panneaux ou tiroirs accessibles pour les détails, préconditions et
  actions de publication.
- Charger les enfants à la demande et conserver fil d’Ariane, retour et contexte.
- Corriger les positions valides égales à zéro ou aligner clairement la règle à
  une numérotation commençant à un.

### Hors périmètre

- Éditeur pédagogique complet riche.

### Critères d’acceptation

- L’admin est utilisable à 390 px comme au desktop, sans arbre interminable.
- Les actions dangereuses ont confirmation, état occupé et résultat annoncé.
- La navigation clavier, le focus des tiroirs et leur fermeture sont corrects.

### Tests et risques

- Tests composants, navigation profonde, responsive et accessibilité.
- Risque : préserver l’URL du niveau actif pour retour/rechargement.

## V2-007 — Parcours d’apprentissage centré sur la leçon

**Priorité : P1. Dépendances : V2-003.**

La spécification détaillée est `LEARNING_FLOW_SPEC.md`.

### Périmètre

- Faire de la leçon le contexte permanent des contenus, ressources, tâches,
  exercices, mini-évaluations, quiz et notes.
- Depuis Aujourd’hui, ouvrir l’activité exacte recommandée et mémoriser le dernier
  emplacement significatif.
- Depuis le curriculum, permettre d’ouvrir une leçon visible en deux actions
  maximum.
- Transformer le module en séquence de cartes-leçons résumant durée, progression,
  état et activités.
- Composer une séquence pédagogique inter-types au lieu d’afficher toutes les
  collections techniques les unes après les autres.
- Fournir une seule action principale « Continuer », déterminée par l’état
  serveur et l’ordre pédagogique.
- Conserver les routes profondes quiz, mini-évaluation et exercice avec en-tête,
  fil d’Ariane, sommaire et retour dans le contexte de la leçon.
- Dériver une séquence déterministe par phases à partir des données et positions
  existantes, sans migration.

### Hors périmètre

- Refonte complète des tokens et de l’identité visuelle.
- Modification de la formule de progression.
- Recommandation adaptative par IA.
- Ordre éditorial arbitraire entre types et toute migration associée.
- Instrumentation analytics produit persistée.

### Critères d’acceptation

- « Continuer » depuis Aujourd’hui ou la leçon ouvre exactement la prochaine
  activité pertinente.
- Ressources et mises en pratique apparaissent au moment pédagogique utile, tout
  en restant accessibles depuis un sommaire secondaire.
- Brouillon, verrouillage, complétion et hors ligne ont des états explicites et
  ne contournent aucune autorisation.
- Mobile reste linéaire et focalisé ; desktop peut afficher un sommaire latéral.
- Le retour, le rechargement et un lien profond restaurent le contexte de leçon.

### Tests et risques

- Tests unitaires de l’ordre et de la prochaine activité ; tests d’intégration du
  parcours complet et de reprise exacte.
- Playwright sur mobile, tablette, desktop et WebKit ; axe, clavier et focus.
- Risque assumé : la séquence V2 par phases est moins fine qu’un ordre éditorial
  explicite, reporté en V3.

## V2-008 — Refonte UI responsive et système de composants

**Priorité : P1. Dépendances : V2-006, V2-007.**

### Périmètre

- Définir tokens, typographie, espacements, surfaces, états et thèmes accessibles.
- Créer des composants partagés pour cartes, badges, boutons, formulaires,
  feedback, skeletons, erreurs et états vides.
- Exploiter l’espace desktop au lieu de conserver une unique colonne de largeur
  téléphone, tout en gardant le mobile prioritaire.
- Revoir la hiérarchie des pages Aujourd’hui, curriculum, leçon, quiz, exercice,
  notes, révisions, profil et admin.
- Rendre les contenus pédagogiques longs et Markdown avec un sous-ensemble sûr :
  titres, paragraphes, listes ordonnées/non ordonnées, emphase et liens.
- Structurer les évaluations finales en sections distinctes objectif, consignes,
  cas et grille, avec un rythme de lecture adapté au mobile.
- Garantir que le contenu long utilise le scroll principal, sans scroll imbriqué,
  et reste entièrement au-dessus de la navigation fixe et de la safe area.

### Hors périmètre

- Gamification, réseau social et personnalisation de marque par programme.

### Critères d’acceptation

- Maquettes et états documentés avant migration page par page.
- Aucun débordement de 320 px à grand écran ; contraste AA et focus visibles.
- Les états chargement, vide, erreur, brouillon et hors ligne sont distincts.
- Aucun jeton Markdown brut ni HTML non sûr n’est rendu ; la numérotation est une
  vraie liste sémantique.
- Aucun texte n’est masqué à 320/390 px, avec tailles système iOS, zoom 200 % et
  VoiceOver ; les liens et sources restent accessibles.

### Tests et risques

- Régressions visuelles multi-viewport, axe, clavier et préférences de mouvement.
- Tests de rendu Markdown, XSS, contenus très longs, 320/390 px, zoom et padding
  navigation + safe area.
- Risque de chantier massif : livrer par verticales sans mélanger la logique
  métier.

## V2-009 — Clarifier liens et actions

**Priorité : P1. Dépendances : V2-008.**

### Périmètre

- Remplacer les liens soulignés utilisés comme appels à l’action par des boutons
  ou composants de navigation explicites.
- Réserver `<button>` aux mutations et `<a>`/routeur aux navigations.
- Harmoniser libellés, états désactivés, chargement et annonces accessibles.

### Hors périmètre

- Changement des destinations ou règles métier.

### Critères d’acceptation

- Aucun élément visuellement présenté comme action ne repose sur un lien ambigu.
- Les mutations sont impossibles par simple navigation GET.
- Les commandes restent utilisables clavier et lecteur d’écran.

### Tests et risques

- Tests sémantiques et audit automatisé des rôles.
- Risque : conserver les liens éditoriaux dans les contenus et sources.

## V2-010 — Refonte de la navigation principale

**Priorité : P1. Dépendances : V2-008, V2-009.**

### Périmètre

- Remplacer la barre actuelle par cinq destinations avec icône et libellé court :
  `Accueil`, `Parcours`, `Réviser`, `Notes`, `Profil`.
- Utiliser un texte lisible de 13–14 px, une barre plus confortable et un état
  actif qui ne repose pas sur un simple soulignement.
- Respecter safe areas, zones tactiles, 320/390 px et tailles système iOS.
- Adapter la navigation au desktop sans dupliquer ni perdre le contexte courant.

### Hors périmètre

- Nouvelles destinations métier ou personnalisation de la navigation.

### Critères d’acceptation

- Les cinq destinations restent visibles, distinctes et atteignables au clavier
  comme au toucher.
- L’état actif combine forme/couleur et `aria-current`, sans dépendre uniquement
  de la couleur ou du soulignement.
- VoiceOver annonce icône, libellé et page active sans répétition parasite.
- Aucun libellé n’est tronqué ou masqué à 320/390 px et la safe area iPhone est
  respectée.
- La variante desktop conserve les mêmes destinations et une hiérarchie claire.

### Tests et risques

- Tests composants, VoiceOver, clavier, 320/390 px, zoom 200 %, tailles système
  iOS et desktop.
- Risque : sélectionner une famille d’icônes légère et accessible sans gonfler le
  bundle.

## V2-011 — Politique hors ligne explicite et sûre

**Priorité : P1. Dépendances : V2-001, V2-003.**

### Périmètre

- Centraliser l’état réseau et désactiver les mutations non supportées hors ligne
  avec un message actionnable.
- Appliquer pour la V2 un mode privé en ligne uniquement : aucun téléchargement
  privé ni file de mutations.
- Conserver la destination et proposer une nouvelle tentative après reconnexion,
  sans jamais simuler une réussite.

### Hors périmètre

- Synchronisation collaborative temps réel.
- Téléchargement privé par compte et file de mutations offline.

### Critères d’acceptation

- Notes, quiz, exercices, progression et admin ne restent jamais en chargement
  indéfini hors connexion.
- Déconnexion purge toute donnée locale privée.
- Reconnexion restaure la destination et permet de relancer explicitement
  l’action.

### Tests et risques

- Tests offline/reconnect/account-switch sur iOS et Chromium.
- Risque sécurité élevé si le stockage privé local n’est pas cloisonné.

## V2-012 — Accessibilité et matrice mobile

**Priorité : P1. Dépendances : V2-007 à V2-011.**

### Périmètre

- Ajouter axe automatisé, parcours clavier et tests de focus sur les vues clés.
- Couvrir Chromium mobile, WebKit/iOS et desktop dans Playwright.
- Tester zoom 200 %, texte agrandi, réduction des animations et lecteurs d’écran
  sur les dialogues/tiroirs.

### Hors périmètre

- Certification réglementaire externe.

### Critères d’acceptation

- Aucun défaut axe sérieux/critique sur le parcours principal.
- Navigation et mutations restent réalisables sans pointeur.
- Les erreurs et changements d’état sont annoncés.

### Tests et risques

- Suite axe + checklist manuelle VoiceOver.
- Risque : faux sentiment de conformité si l’automatisation remplace la revue
  humaine.

## Choix produit restant à arbitrer

1. **Progression des exercices** — recommandation : compter l’exercice à la
   soumission pour le parcours personnel, tout en affichant séparément une
   éventuelle validation humaine.
2. **Mini-évaluations et quiz** — recommander que toute notion obligatoire soit
   maîtrisée et que le quiz de synthèse requis atteigne son seuil ; éviter de
   compter deux fois le même objectif dans le pourcentage.
3. **Hors ligne privé** — recommandation immédiate : en ligne uniquement pour les
   données privées, puis téléchargement explicite par compte si le besoin est
   confirmé.
4. **Dépublication en cascade** — recommandation : cascade atomique explicite
   après aperçu, sans effacer les drapeaux enfants ni la progression si le parent
   seul masque temporairement la branche ; proposer une option de cascade totale.
5. **Direction visuelle** — valider une maquette et les priorités desktop avant la
   migration de toutes les pages.

## Portes de sortie V2

- Aucun P0 ouvert.
- Aucun cache privé partagé entre utilisateurs.
- Autorisations croisées testées sur toutes les mutations sensibles.
- Progression conforme aux règles produit et recalculable.
- Publication transactionnelle et prévisualisée ; aucune revue scientifique
  n’est requise.
- Parcours critique réel testé sur desktop et mobile.
- Parcours leçon, admin, responsive, actions, accessibilité et offline vérifiés
  sur la production.
- Aucune capacité listée dans `V3_CANDIDATES.md` n’a été commencée par effet de
  bord.
