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

### Décisions invariantes

- LearnX reste générique : `Program > Stage > Module > Lesson`, sans année ni
  semestre et sans psychologie codée en dur.
- La publication personnelle et la validation scientifique sont indépendantes.
- Un contenu pédagogiquement complet peut être publié sans revue scientifique.
- Publier ne signifie jamais « validé scientifiquement ».
- La validation scientifique est optionnelle, historisée et périmée lorsque le
  contenu revu change.
- Les calculs de progression, de maîtrise et de validation restent côté serveur.
- Un ticket correspond idéalement à un commit, avec migration isolée si besoin.

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

Les tickets P0 constituent le jalon « intégrité et confidentialité ». Aucun
chantier de refonte ou de validation scientifique ne doit les retarder.

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
  nouvelle limite jusqu’au ticket V2-009.

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

## V2-007 — Refonte UI responsive et système de composants

**Priorité : P1. Dépendances : V2-006 pour l’admin, parallélisable ailleurs.**

### Périmètre

- Définir tokens, typographie, espacements, surfaces, états et thèmes accessibles.
- Créer des composants partagés pour cartes, badges, boutons, formulaires,
  feedback, skeletons, erreurs et états vides.
- Exploiter l’espace desktop au lieu de conserver une unique colonne de largeur
  téléphone, tout en gardant le mobile prioritaire.
- Revoir la hiérarchie des pages Aujourd’hui, curriculum, leçon, quiz, exercice,
  notes, révisions, profil et admin.

### Hors périmètre

- Gamification, réseau social et personnalisation de marque par programme.

### Critères d’acceptation

- Maquettes et états documentés avant migration page par page.
- Aucun débordement de 320 px à grand écran ; contraste AA et focus visibles.
- Les états chargement, vide, erreur, brouillon et hors ligne sont distincts.

### Tests et risques

- Régressions visuelles multi-viewport, axe, clavier et préférences de mouvement.
- Risque de chantier massif : livrer par verticales sans mélanger la logique
  métier.

## V2-008 — Clarifier liens et actions

**Priorité : P1. Dépendances : V2-007.**

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

## V2-009 — Politique hors ligne explicite et sûre

**Priorité : P1. Dépendances : V2-001, V2-003.**

### Périmètre

- Centraliser l’état réseau et désactiver les mutations non supportées hors ligne
  avec un message actionnable.
- Choisir et implémenter soit un mode lecture téléchargé, isolé par utilisateur,
  soit un mode privé en ligne uniquement.
- Si une file de mutations est retenue, afficher les éléments en attente,
  conflits et échecs sans jamais simuler une réussite.

### Hors périmètre

- Synchronisation collaborative temps réel.

### Critères d’acceptation

- Notes, quiz, exercices, progression et admin ne restent jamais en chargement
  indéfini hors connexion.
- Déconnexion purge toute donnée locale privée.
- Reconnexion résout les conflits selon une règle documentée.

### Tests et risques

- Tests offline/reconnect/account-switch sur iOS et Chromium.
- Risque sécurité élevé si le stockage privé local n’est pas cloisonné.

## V2-010 — Maîtriser les écritures concurrentes

**Priorité : P1. Dépendances : V2-003.**

### Périmètre

- Ajouter versionnement optimiste ou prédicats d’état aux notes, exercices et
  soumissions finales.
- Rendre atomiques les transitions `DRAFT → SUBMITTED → REVIEWED`.
- Prévenir double soumission, écrasement multi-onglets et régression d’état.

### Hors périmètre

- Édition collaborative en temps réel.

### Critères d’acceptation

- Une écriture obsolète retourne un conflit explicite avec option de recharge.
- Un contenu soumis ne redevient pas brouillon par une sauvegarde concurrente.
- Les tentatives restent historisées.

### Tests et risques

- Tests avec promesses concurrentes et transactions réelles.
- Risque de migration : isoler les colonnes de version dans un commit dédié.

## V2-011 — Durcir authentification et en-têtes HTTP

**Priorité : P1. Dépendances : V2-002.**

### Périmètre

- Remplacer le rate limit mémoire par un mécanisme distribué/persisté compatible
  serverless, couvrant connexion et inscription.
- Limiter l’écriture `lastUsedAt` à un intervalle raisonnable et nettoyer les
  sessions expirées.
- Ajouter CSP, anti-framing, Referrer-Policy et Permissions-Policy adaptés.
- Journaliser les événements de sécurité sans mot de passe, token ni donnée
  sensible.

### Hors périmètre

- OAuth, SSO et MFA.

### Critères d’acceptation

- La limite s’applique entre instances et fournit une réponse/réinitialisation
  prévisible.
- Les pages et PWA fonctionnent sous la CSP sans `unsafe-eval` en production.
- Une session active ne provoque pas une écriture DB à chaque requête.

### Tests et risques

- Tests multi-instance simulés, headers et régression auth.
- Risque : choisir une dépendance durable sans surcoût disproportionné.

## V2-012 — Validation scientifique optionnelle

**Priorité : P1. Dépendances : V2-005, V2-007.**

La spécification détaillée est `SCIENTIFIC_REVIEW_SPEC.md`.

### Périmètre

- Persister un historique par leçon : décision, identité consentie, qualifications,
  organisation, date, périmètre, note, preuve et empreinte de contenu.
- Calculer les états `non réalisée`, `active`, `à renouveler` et `retirée` sans
  modifier `isPublished`.
- Afficher détail accessible sur la leçon et agrégation des leçons publiées au
  niveau module.
- Autoriser uniquement le propriétaire admin à enregistrer ou retirer une preuve.

### Hors périmètre

- Accréditation juridique, paiement, score IA et portail de signature externe.

### Critères d’acceptation

- Une leçon sans revue reste publiable si elle est pédagogiquement complète.
- Seule une validation active portant sur l’empreinte courante affiche la pastille
  « Validé scientifiquement ».
- Toute modification couverte rend la validation périmée automatiquement.
- L’identité privée du réviseur n’est jamais exposée sans consentement.

### Tests et risques

- Autorisation, historique, retrait, empreinte, agrégation et accessibilité.
- Risque légal : la pastille ne doit pas suggérer une accréditation de LearnX.

## V2-013 — Accessibilité et matrice mobile

**Priorité : P1. Dépendances : V2-007, V2-008.**

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

## V2-014 — Environnement local et CI reproductibles

**Priorité : P1. Dépendances : V2-004.**

### Périmètre

- Fournir une commande de développement unique démarrant Vite et les Functions,
  avec URL réseau documentée pour téléphone.
- Exécuter lint, typecheck, tests, build, migrations et E2E réel en CI.
- Vérifier le déploiement, le manifeste, les redirections et une transaction
  authentifiée non destructive.
- Documenter la gestion des branches Neon et secrets Vercel.

### Hors périmètre

- Déploiement automatique du seed éditorial en production.

### Critères d’acceptation

- `pnpm dev` ne produit plus d’API 404 ni de chargement infini.
- Une contribution neuve peut installer, migrer, seeder et tester avec la
  documentation seule.
- La CI bloque toute migration absente ou build non reproductible.

### Tests et risques

- Smoke local, CI et production ; aucune base partagée entre runs.
- Risque : différences de routage entre Vite et Vercel à conserver dans les
  scénarios.

## V2-015 — Pagination, chargement progressif et observabilité

**Priorité : P2. Dépendances : V2-006, V2-014.**

### Périmètre

- Paginer notes, révisions, historiques et grandes collections admin.
- Charger le curriculum par niveau lorsque le volume le justifie.
- Mesurer latence API, erreurs normalisées, requêtes lentes et poids des payloads
  sans journaliser de données sensibles.
- Ajouter une limite et un état d’erreur explicite à toute requête UI.

### Hors périmètre

- Entrepôt analytique produit.

### Critères d’acceptation

- Aucun écran ne charge une collection non bornée.
- Les erreurs corrélées sont diagnosticables et les budgets de performance sont
  documentés.

### Tests et risques

- Tests pagination, erreurs, grands volumes et budgets Lighthouse/API.
- Risque de changement de contrat : versionner les curseurs et garder les réponses
  typées.

## V2-016 — Cycle de vie du compte et des notes

**Priorité : P2. Dépendances : V2-010, V2-011.**

### Périmètre

- Ajouter suppression/restauration de note, pagination et indication de conflit.
- Permettre changement de mot de passe, révocation des autres sessions et
  suppression/export du compte selon la politique retenue.
- Clarifier inscription ouverte ou sur invitation.

### Hors périmètre

- Gestion d’organisation ou facturation.

### Critères d’acceptation

- Les opérations sensibles demandent réauthentification et confirmation.
- Suppression et export n’exposent jamais les données d’un autre utilisateur.
- La politique d’inscription est appliquée côté serveur.

### Tests et risques

- Autorisation, réauthentification, révocation et récupération.
- Risque RGPD : définir rétention, sauvegardes et suppression irréversible avant
  mise en œuvre.

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
5. **Inscription** — choisir entre libre, liste d’invitation ou création admin.
6. **Validation scientifique** — fixer la durée éventuelle d’expiration ;
   l’empreinte de contenu reste dans tous les cas la cause automatique de
   péremption.
7. **Identité du réviseur** — préciser le texte de consentement et la visibilité
   publique de la preuve.
8. **Direction visuelle** — valider une maquette et les priorités desktop avant la
   migration de toutes les pages.

## Portes de sortie V2

- Aucun P0 ouvert.
- Aucun cache privé partagé entre utilisateurs.
- Autorisations croisées testées sur toutes les mutations sensibles.
- Progression conforme aux règles produit et recalculable.
- Publication transactionnelle, prévisualisée et indépendante de la validation
  scientifique.
- Parcours critique réel testé sur desktop et mobile.
- Accessibilité, offline, erreurs et performance vérifiés sur la production.
