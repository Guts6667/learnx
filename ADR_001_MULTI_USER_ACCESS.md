# ADR-001 — Cycle d'accès et architecture multi-utilisateur

## Statut

- Décision : **acceptée pour le cadrage V3**
- Date : 5 août 2026
- Ticket : `V3-001`
- Baseline auditée : `da52922` sur `dev`, V2 Production `ba3c352`
- Portée : architecture et stratégie de migration uniquement

Cette décision n'ajoute aucune table, migration, route ou interface. Les
tickets V3-002 à V3-015 doivent l'implémenter par changements autonomes et
revalider les hypothèses avant chaque migration.

## 1. Contexte

LearnX V2 est une application privée dont le modèle a été préparé pour plusieurs
utilisateurs, mais dont l'accès au contenu repose encore essentiellement sur la
propriété : un programme appartient à un utilisateur et les requêtes exigent
souvent `Program.ownerId = currentUser.id`.

V3 doit permettre :

- une demande d'accès publique sans mot de passe ;
- la vérification de l'adresse e-mail ;
- une décision administrative avec attribution de rôle ;
- une invitation temporaire à usage unique ;
- la création du mot de passe et du compte seulement après acceptation ;
- la suspension et la révocation des sessions ;
- le partage des programmes publiés par enrollment ;
- l'isolation stricte des données d'apprentissage personnelles.

Le compte administrateur, le programme de psychologie, les contenus et toutes
les données V2 doivent être conservés.

## 2. État actuel prouvé

### 2.1 Schéma et migrations

La baseline contient 35 modèles Prisma et 16 migrations applicatives :

- `Role` ne contient que `USER` et `ADMIN` ;
- `User.passwordHash` est obligatoire ;
- `Session` est liée à `userId`, avec token haché et expiration ;
- `Program.ownerId` est obligatoire ;
- `(ownerId, slug)` est unique ;
- aucun `ProgramEnrollment`, cycle de demande, invitation, statut de compte,
  visibilité publique ou version de programme n'existe ;
- `ProgramProgress`, `StageProgress`, `LessonProgress`, `TaskCompletion`,
  `ResourceProgress`, `ModuleRun`, `QuizAttempt`, `ConceptAssessmentAttempt`,
  `ExerciseSubmission`, `StageAssessmentSubmission`, `Note` et `ReviewItem`
  possèdent déjà un `userId`.

La migration V2 finale ajoute un rate limit partagé pour le login. Elle stocke
une clé hachée et non l'e-mail ou l'adresse IP en clair.

### 2.2 Authentification

- `POST /api/auth/register` est désactivé par défaut en production.
- Hors production, cette route crée directement `User`, `Session` et cookie.
- `POST /api/auth/login` applique un rate limit partagé, puis crée une session.
- `requireUser` authentifie une session, mais aucun statut `ACTIVE/SUSPENDED`
  n'existe encore à contrôler.
- `POST /api/auth/logout` supprime la session courante ; aucune révocation
  globale de toutes les sessions d'un compte n'est disponible.

### 2.3 Contenus et données personnelles

Le rapport V2 a vérifié en Production :

- 1 programme ;
- 13 étapes ;
- 22 modules ;
- 70 leçons ;
- 403 blocs ;
- 400 ressources ;
- 210 notions/évaluations ;
- 1 050 questions ;
- 13 évaluations finales.

Les empreintes des progressions, notes, reprises, tentatives, soumissions et
révisions ont été conservées lors du seed V2. Ces décomptes sont une baseline
documentaire ; chaque migration V3 doit les rafraîchir par lecture seule juste
avant exécution.

### 2.4 Environnements

- `dev` déclenche `Integration` sur une branche Neon éphémère, migrée puis
  supprimée par le workflow.
- `build:vercel` exécute `prisma migrate deploy` avant le build.
- L'isolation de la base Vercel Preview/Staging n'est pas encore prouvée ; aucune
  migration V3 ne doit y être déployée avant confirmation d'une branche Neon
  dédiée.
- Le seed n'est pas exécuté automatiquement par Vercel.

## 3. Inventaire des routes V2

La colonne « politique cible » décrit la famille d'autorisation que V3-012 doit
centraliser ; elle ne change pas le comportement dans cet ADR.

| Route | Contrôle V2 | Politique cible V3 |
| --- | --- | --- |
| `POST /api/auth/register` | public hors Production, création immédiate | supprimée/remplacée par demande d'accès |
| `POST /api/auth/login` | public, rate limit, identifiants | compte `ACTIVE`, refus uniforme sinon |
| `POST /api/auth/logout` | session facultative | session courante du compte actif/suspendu |
| `GET /api/auth/session` | cookie de session | statut serveur contrôlé, réponse privée |
| `GET /api/admin/programs` | `ADMIN` + programmes possédés | capacité admin + relation éditoriale |
| `GET /api/admin/programs/:programId` | `ADMIN` + propriétaire | capacité admin + relation éditoriale |
| `GET /api/admin/stages/:stageId` | `ADMIN` + propriétaire du programme | capacité admin + relation éditoriale |
| `GET /api/admin/modules/:moduleId` | `ADMIN` + propriétaire du programme | capacité admin + relation éditoriale |
| `GET /api/admin/lessons/:lessonId` | `ADMIN` + propriétaire du programme | capacité admin + relation éditoriale |
| `POST /api/admin/publication/preview` | `ADMIN` + propriétaire | capacité publication + relation éditoriale |
| `POST /api/admin/publication/apply` | `ADMIN` + propriétaire, transaction | capacité publication + relation éditoriale |
| `PATCH /api/admin/modules/:moduleId` | `ADMIN` + propriétaire | capacité édition + relation éditoriale |
| `PATCH /api/admin/lessons/:lessonId` | `ADMIN` + propriétaire | capacité édition + relation éditoriale |
| `GET /api/programs` | utilisateur + `ownerId` | enrollments personnels + preview propriétaire |
| `GET /api/programs/:programSlug` | utilisateur + `ownerId` | enrollment publié ou preview propriétaire |
| `GET /api/programs/:programSlug/stages/:stageSlug` | utilisateur + `ownerId` | enrollment publié ou preview propriétaire |
| `GET /api/modules/:moduleSlug` | utilisateur + `ownerId` | enrollment publié ou preview propriétaire |
| `GET /api/lessons/:lessonSlug` | utilisateur + `ownerId` | enrollment publié ou preview propriétaire |
| `POST /api/programs/:programId/start` | actif + propriétaire | compte actif + enrollment |
| `PATCH /api/programs/:programId/schedule` | progression personnelle + propriétaire | compte actif + enrollment + progression personnelle |
| `POST /api/stages/:stageId/start` | publié + propriétaire | compte actif + enrollment + contenu publié |
| `PATCH /api/stages/:stageId/schedule` | progression personnelle + propriétaire | compte actif + enrollment |
| `GET /api/lessons/:lessonId/progress` | utilisateur + propriétaire | enrollment + `userId` courant |
| `POST /api/lessons/:lessonId/start` | utilisateur + propriétaire | enrollment + `userId` courant |
| `POST /api/lessons/:lessonId/complete` | préconditions + propriétaire | enrollment + préconditions serveur + `userId` |
| `PATCH /api/tasks/:taskId` | propriétaire + complétion personnelle | enrollment + activité autorisée + `userId` |
| `PATCH /api/resources/:resourceId/progress` | propriétaire + progrès personnel | enrollment + ressource autorisée + `userId` |
| `GET /api/concepts/:conceptId` | publié/preview propriétaire | enrollment publié ou preview propriétaire |
| `GET /api/concepts/:conceptId/progress` | propriétaire + `userId` | enrollment + progression personnelle |
| `GET /api/concept-assessments/:assessmentId` | publié/preview propriétaire | enrollment publié ou preview propriétaire |
| `GET /api/concept-assessments/:assessmentId/attempts` | propriétaire + `userId` | enrollment + tentatives personnelles |
| `POST /api/concept-assessments/:assessmentId/attempts` | propriétaire + `userId` | enrollment + module run + transaction personnelle |
| `GET /api/quizzes/:quizId` | publié + propriétaire | enrollment + contenu publié |
| `GET /api/quizzes/:quizId/attempts` | propriétaire + `userId` | enrollment + tentatives personnelles |
| `POST /api/quizzes/:quizId/attempts` | propriétaire + `userId` | enrollment + module run + transaction personnelle |
| `GET /api/exercises/:exerciseId` | publié + propriétaire | enrollment + contenu publié |
| `POST /api/exercises/:exerciseId/submissions` | propriétaire + `userId` | enrollment + soumission personnelle |
| `PATCH /api/exercise-submissions/:submissionId` | soumission possédée | `userId` de la soumission + enrollment valide |
| `POST /api/exercise-submissions/:submissionId/submit` | soumission possédée | `userId` de la soumission + enrollment valide |
| `GET /api/modules/:moduleId/restart-preview` | module possédé + `userId` | enrollment + module run personnel |
| `POST /api/modules/:moduleId/restart` | module possédé + transaction | enrollment + transaction/idempotence personnelle |
| `GET /api/stages/:stageId/assessment` | publié/preview propriétaire | enrollment publié ou preview propriétaire |
| `POST /api/stage-assessments/:assessmentId/submissions` | publié + propriétaire | enrollment + soumission personnelle |
| `PATCH /api/stage-assessment-submissions/:submissionId` | propriétaire pour sauvegarde ; `ADMIN` propriétaire pour revue | auteur pour sauvegarde ; capacité revue + relation éditoriale pour décision |
| `POST /api/stage-assessment-submissions/:submissionId/submit` | soumission possédée | `userId` de la soumission + enrollment valide |
| `GET /api/notes` | `userId` | données strictement personnelles |
| `POST /api/notes` | `userId` + leçon possédée si liée | données personnelles + enrollment de la leçon |
| `GET /api/notes/:noteId` | note possédée | `userId` strict |
| `PATCH /api/notes/:noteId` | note possédée | `userId` strict |
| `DELETE /api/notes/:noteId` | note possédée | `userId` strict |
| `GET /api/reviews` | `userId` + programme possédé | `userId` + enrollment |
| `PATCH /api/reviews/:reviewId` | révision possédée | `userId` strict + enrollment |
| `GET /api/today` | contenus possédés + données personnelles | enrollments + données personnelles |

Les futures routes demande, vérification, invitation, catalogue et enrollments
n'existent pas encore et relèvent de V3-004 à V3-013.

## 4. Options étudiées

### Option A — Porter tout le cycle sur `User`

Créer `User` dès la demande, rendre `passwordHash` nullable et ajouter un enum
comprenant `PENDING_EMAIL`, `PENDING_APPROVAL`, `INVITED`, `ACTIVE`, `REJECTED`
et `SUSPENDED`.

Avantages :

- une seule table et un seul identifiant ;
- relations administratives simples.

Inconvénients :

- un demandeur devient prématurément un compte ;
- `passwordHash` perd son invariant obligatoire ;
- demandes rejetées et comptes actifs partagent rétention et contraintes ;
- risque d'authentifier un état intermédiaire lors d'une route oubliée ;
- unicité e-mail et nouvelle demande deviennent difficiles à faire évoluer ;
- suppression/anonymisation d'un refus peut interagir avec de vraies données.

### Option B — Séparer demande, invitation et compte

Utiliser une demande pour la vérification/revue, une invitation pour le token
one-shot et créer `User` uniquement lors de l'activation. `User` ne porte que
les états authentifiables `ACTIVE` et `SUSPENDED`.

Avantages :

- aucun compte ni mot de passe avant approbation ;
- `passwordHash` reste obligatoire ;
- rétention des refus indépendante des comptes ;
- tokens et transitions peuvent être contraints par table ;
- surface d'authentification limitée à `User` actif ;
- migration V2 additive et backfill simple.

Inconvénients :

- davantage d'entités et de transactions ;
- l'état affiché doit être calculé à partir de plusieurs tables ;
- activation doit relier atomiquement demande, invitation et compte.

## 5. Décision

**L'option B est retenue.**

Le modèle logique cible est :

```text
AccessRequest
  ├── EmailVerification (0..n, un token actif au maximum)
  ├── AccessInvitation (0..n, une invitation active au maximum)
  └── activatedUserId (0..1, après consommation)

User
  ├── accountStatus: ACTIVE | SUSPENDED
  ├── role: USER | CREATOR | ADMIN
  └── Session (0..n)
```

Les noms Prisma définitifs appartiennent à V3-002/003, mais les responsabilités
et contraintes de cet ADR sont obligatoires.

### 5.1 États agrégés exposés au produit

| État produit | Source | Authentifiable |
| --- | --- | ---: |
| `PENDING_EMAIL` | demande non vérifiée | Non |
| `PENDING_APPROVAL` | demande vérifiée sans décision | Non |
| `INVITED` | demande approuvée + invitation active | Non |
| `REJECTED` | demande refusée | Non |
| `ACTIVE` | `User.accountStatus` | Oui |
| `SUSPENDED` | `User.accountStatus` | Non |

La demande peut conserver un état interne terminal `APPROVED` pour l'audit,
mais l'état produit devient immédiatement `INVITED` dans la même transaction.
Une invitation expirée ne recrée pas `PENDING_APPROVAL` : Admin peut émettre une
nouvelle invitation en invalidant l'ancienne.

### 5.2 Transitions

```text
nouvelle demande
  → PENDING_EMAIL
  → vérification one-shot
  → PENDING_APPROVAL
  ├── refus admin → REJECTED
  └── acceptation admin + invitation → INVITED
      → consommation + mot de passe + création User → ACTIVE
          → suspension admin + révocation sessions → SUSPENDED
          → réactivation admin → ACTIVE sans restaurer les sessions
```

Transitions interdites :

- demande ou invitation vers `ACTIVE` sans mot de passe validé ;
- `REJECTED` vers `ACTIVE` sans nouvelle décision explicite ;
- `SUSPENDED` vers session valide sans réactivation ;
- token expiré, consommé ou invalidé vers réussite ;
- plusieurs comptes pour le même e-mail normalisé.

### 5.3 Idempotence et concurrence

- Une seule demande ouverte par e-mail normalisé.
- Un token de vérification et une invitation actifs au maximum par demande.
- Les tokens sont stockés uniquement sous forme de hash et consommés par mise à
  jour conditionnelle dans une transaction.
- Acceptation/refus utilise une précondition de version ou un état attendu.
- Activation crée `User`, consomme l'invitation et clôt la demande dans une
  transaction unique.
- Retry avec la même clé idempotente retourne le résultat existant lorsqu'il est
  sûr, jamais un second compte ou une seconde invitation.

## 6. Rôles et capacités

### 6.1 Rôles

- `USER` : libellé produit « Apprenant ».
- `CREATOR` : attribuable en V3, mêmes capacités d'apprentissage que `USER`,
  aucune surface ou mutation éditoriale avant V5.
- `ADMIN` : administration des accès et fonctions éditoriales existantes selon
  la relation au programme.
- Validateur : identité future réservée conceptuellement, non ajoutée comme rôle
  utilisable en V3.

### 6.2 Politique de capacités

V3-003 doit fournir une politique serveur centralisée et statique par défaut.
Une base de permissions dynamiques n'est pas requise pour V3.

Capacités minimales :

```text
account.request.review
account.invitation.issue
account.role.assign
account.suspend
audit.read
program.catalog.read
program.enroll
learning.read
learning.write.own
program.admin.read
program.admin.edit
program.admin.publish
```

Des noms IA futurs peuvent être réservés dans le type, mais aucun stockage,
quota, secret, SDK ou appel n'est créé.

### 6.3 Invariant relationnel

Une capacité ne suffit pas seule :

- apprentissage : capacité + enrollment + contenu visible/publié ;
- donnée personnelle : capacité + `record.userId = currentUser.id` ;
- édition/publication : capacité + relation éditoriale au programme ;
- administration de compte : capacité admin, cible explicite et audit.

`ADMIN` n'accorde pas implicitement la propriété éditoriale de tous les
programmes. Le programme de psychologie reste possédé par le compte admin
existant. Une éventuelle administration éditoriale globale requerrait une
décision séparée.

## 7. Frontières de données

### 7.1 Contenu partagé

- Programmes et versions publiées ;
- étapes, modules, leçons, blocs, ressources et évaluations publiés ;
- métadonnées de catalogue compatibles avec la visibilité.

Ces données sont lisibles selon visibilité et enrollment. Les brouillons restent
réservés au propriétaire éditorial autorisé.

### 7.2 Données strictement personnelles

- sessions ;
- program/stage/lesson progress ;
- module runs et carryovers ;
- task/resource completions ;
- concept progress et tentatives ;
- quiz attempts ;
- exercise/stage assessment submissions ;
- notes ;
- review items.

Toutes les lectures/mutations incluent `userId` dans la requête ou transaction.
Un enrollment ne donne jamais accès aux données d'un autre apprenant.

### 7.3 Données éditoriales

- propriété du programme ;
- brouillons et versions ;
- publication ;
- audit des mutations.

Propriété, visibilité, publication et validation scientifique restent des axes
indépendants.

### 7.4 Données d'accès

Demandes, preuves de vérification, invitations et décisions administratives ne
sont visibles que par les politiques concernées. Les endpoints publics
répondent de façon non énumérante, y compris pour un e-mail déjà actif, refusé
ou en attente.

## 8. Plan de migration obligatoire

### Phase 0 — Préparer et mesurer

- Confirmer la branche Neon cible pour `staging` et Preview.
- Créer une sauvegarde/branche depuis Production.
- Capturer décomptes et checksums des utilisateurs, sessions, programmes,
  contenus et toutes les tables personnelles.
- Rejouer la migration sur clone avant toute écriture Production.

### Phase 1 — Expand

V3-002 ajoute uniquement des structures compatibles :

- demandes, vérifications et invitations ;
- statut de compte avec valeur par défaut/backfill sûre ;
- colonnes de liaison nullable nécessaires.

V3-003 ajoute ensuite `CREATOR`, capacités centralisées et audit. Les nouvelles
contraintes sont ajoutées après backfill lorsque nécessaire.

### Phase 2 — Backfill

- Tous les `User` existants deviennent `ACTIVE`.
- Le compte admin conserve rôle, hash, sessions et propriété.
- Aucun faux `AccessRequest` n'est créé pour un utilisateur existant.
- V3-011 crée les enrollments nécessaires à partir de propriété et progression,
  sans modifier les enregistrements personnels.

### Phase 3 — Dual-read et vérification

- L'authentification contrôle `accountStatus` tout en conservant le format de
  session V2.
- Les lectures de programme peuvent temporairement accepter l'ancien owner path
  et le nouvel enrollment, avec métriques de divergence.
- Les écritures personnelles restent `userId`-scopées pendant toute la bascule.

### Phase 4 — Switch

- Les nouvelles demandes utilisent uniquement le cycle V3.
- Les routes d'apprentissage exigent enrollment/visibilité via V3-012.
- Le catalogue et Mes programmes utilisent les APIs paginées V3.

### Phase 5 — Contract

- Retirer les anciens chemins seulement après une release stable, checksums
  égaux et absence de divergence.
- Ne supprimer aucune colonne/table pendant le même déploiement que le switch.

## 9. Compatibilité et rollback

### Réversible avant switch

- Documents et décisions ;
- nouvelles tables encore inutilisées ;
- endpoints publics protégés par feature flag ;
- dual-read désactivable.

### Roll-forward obligatoire ou recommandé

- après création de demandes/invitations réelles ;
- après ajout de `CREATOR` si un ancien binaire ne sait pas décoder l'enum ;
- après suspension effective de comptes ;
- après création d'enrollments devenus seule preuve d'accès ;
- après écriture de versions de programme.

Un simple redéploiement V2 pourrait alors ignorer les statuts, refuser un enum
ou revenir à un accès owner-only. Le rollback réaliste devient :

1. arrêter les nouvelles écritures V3 ;
2. privilégier un correctif roll-forward ;
3. si nécessaire, restaurer ensemble la branche Neon pré-déploiement et le code
   compatible, pendant une fenêtre de maintenance ;
4. vérifier comptes, sessions, accès et données personnelles avant réouverture.

Les demandes ou comptes créés après la sauvegarde seraient perdus par une
restauration : ce coût doit être explicitement accepté avant l'opération.

## 10. Invariants de sécurité

1. Aucun `User` avant approbation et activation.
2. Aucun mot de passe ou token en clair dans DB/logs.
3. Un compte non `ACTIVE` ne crée ni n'utilise de session.
4. Suspension révoque toutes les sessions dans une transaction cohérente.
5. Réactivation ne restaure aucune session révoquée.
6. Réponses publiques non énumérantes et rate limit partagé.
7. Rôle/capacité et relation ressource vérifiés côté serveur.
8. Données personnelles toujours filtrées par `userId`.
9. Autorisation portée dans la requête/transaction, pas après lecture large.
10. Toute décision admin sensible produit un audit sans secret.
11. Brouillons jamais exposés par catalogue, deep link ou cache.
12. Publication indépendante de la validation scientifique.

## 11. Décisions réversibles et irréversibles

| Décision | Nature | Justification |
| --- | --- | --- |
| Séparer demandes/invitations de `User` | structurante, encore réversible avant migration | conserve `passwordHash` obligatoire et réduit la surface auth |
| `ACTIVE/SUSPENDED` sur `User` | structurante | seule distinction nécessaire aux comptes authentifiables |
| `USER/CREATOR/ADMIN` | structurante ; compatibilité N-1 à tester | frontière produit validée |
| Capacités statiques centralisées | réversible | évite une table ACL prématurée |
| Enrollment comme preuve d'accès | structurante après switch | nécessaire au contenu partagé |
| Données d'apprentissage par `userId` | invariant irréversible | confidentialité multi-utilisateur |
| Admin non propriétaire global implicite | réversible par futur ADR | principe du moindre privilège |
| Futur Validateur non implémenté | réversible | hors périmètre V3 |

## 12. Décisions différées aux tickets suivants

- Fournisseur e-mail, domaine, région et webhooks : V3-005.
- Durée de rétention/anonymisation des refus : V3-006.
- Intention de rôle saisie par le demandeur ou décision admin seule : V3-006.
- Visibilité `UNLISTED` : V3-009.
- Forme exacte du versionnement : V3-010.
- Désinscription et version suivie : V3-011.
- Placement d'Explorer : V3-014.

Ces choix ne modifient pas la décision centrale de séparer demande, invitation
et compte.

## 13. Validation de V3-001

V3-001 est satisfait lorsque :

- l'inventaire couvre toutes les routes V2 et leurs frontières ;
- la décision entre modèle unique et séparé est explicite et argumentée ;
- machine d'états, rôles, capacités et données privées sont définis ;
- stratégie expand/backfill/dual-read/switch/contract et rollback est documentée ;
- les risques N-1 et environnements sont explicites ;
- aucune migration, API, UI ou seed n'est modifié dans le ticket.
