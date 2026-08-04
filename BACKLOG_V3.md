# Backlog V3 — LearnX multi-utilisateur

## Statut et autorité

- Version : 1.0.0
- Statut : **plan V3 validé — implémentation ticket par ticket**
- Baseline réauditée : `ba3c352` (`main`, `dev` et `staging` alignées)
- Date : 4 août 2026
- Source de cadrage : décisions produit validées après clôture V2

Ce backlog remplace le brouillon V3 antérieur. Il ordonne la transformation de
LearnX en plateforme multi-utilisateur sans transformer V3 en vague de
fonctionnalités non bornées. Chaque ticket doit être reformulé et recevoir une
validation spécifique avant tout code. Un ticket correspond idéalement à un
commit autonome ; aucune implémentation du ticket suivant n'est anticipée.

`BACKLOG_CODEX.md` et `BACKLOG_V2.md` restent les historiques V1 et V2.

## Cap V3

V3 livre :

- un cycle d'accès vérifié et approuvé par l'administration ;
- des comptes et sessions gouvernés par statuts, rôles et capacités serveur ;
- des programmes publiés partagés, avec inscriptions et données d'apprentissage
  strictement personnelles ;
- un versionnement minimal des contenus publiés ;
- un parcours pédagogique conforme à une spécification consolidée validée ;
- une fondation bilingue français/anglais et un pilote limité ;
- une passe finale de sécurité, dette, performance et validation réelle.

V3 ne livre ni paiement, marketplace, organisation, réseau social, IA,
validation scientifique persistée, portail Créateur, ni traduction anglaise
complète. La publication pédagogique ne requiert jamais une revue scientifique.

## Invariants

1. PostgreSQL reste la source de vérité ; le frontend ne fait jamais autorité
   pour l'accès, le rôle, la visibilité, la publication ou la progression.
2. La hiérarchie reste `Program > Stage > Module > Lesson` ; aucun
   `AcademicYear` ou `Semester` n'est introduit.
3. Approbation, statuts, rôles, capacités et visibilité sont contrôlés côté
   serveur sur chaque requête.
4. `ADMIN` conserve l'administration existante. Un rôle Créateur peut être
   attribué mais n'obtient jamais `/admin` ni de mutation éditoriale en V3.
5. Rôle/capacités et futurs quotas IA sont séparés. V3 réserve seulement des
   noms de capacités ; aucun SDK, secret, appel ou compteur IA n'est ajouté.
6. Les programmes publiés sont partagés ; notes, progressions, reprises,
   tentatives, soumissions, révisions et sessions restent isolées par utilisateur.
7. Propriété éditoriale, visibilité, publication, version et inscription sont
   des axes distincts.
8. Les migrations conservent le compte administrateur, le programme de
   psychologie, ses contenus et toutes les données personnelles existantes.
9. La pédagogie est fournie par le responsable pédagogique dans les specs et
   guides validés. Codex n'invente ni ordre, ni placement, ni consigne.
10. Sources et ressources sont déjà distinctes : aucune migration n'est créée
    uniquement pour les séparer.
11. Aucun P0/P1 sécurité connu ne reste ouvert à la clôture V3.

## Preuves de l'état `ba3c352`

- `Role` expose `USER` et `ADMIN` ; `User.passwordHash` est obligatoire.
- `POST /api/auth/register` est désactivé en production et crée encore
  directement un compte/session hors production.
- `Program.ownerId` est obligatoire et le slug est unique par propriétaire.
- Les lectures et mutations filtrent encore largement par `Program.ownerId`.
- Progressions, notes, tentatives, soumissions et révisions sont déjà liées à
  `userId`, mais aucun `ProgramEnrollment` n'existe.
- Il n'existe ni demande d'accès, vérification e-mail, invitation, visibilité
  publique, catalogue partagé, locale utilisateur ni variante linguistique.
- La V2 est clôturée ; sa branche Neon de sauvegarde reste disponible pendant
  la stabilisation.

## Machine d'états de compte cible à confirmer par V3-001

```text
demande créée
    │
    ▼
PENDING_EMAIL ── vérifiée ──► PENDING_APPROVAL
    │                              │
    └── expiration                 ├── refus ──► REJECTED
                                   └── accord ─► INVITED
                                                     │
                                           token consommé + mot de passe
                                                     ▼
                                                   ACTIVE
                                                     │
                                  suspension admin ─► SUSPENDED
                                                     │
                                    réactivation ────┘
```

La décision privilégiée est de séparer demande, invitation et compte afin de ne
pas rendre `passwordHash` artificiellement nullable. `ACTIVE` et `SUSPENDED`
décrivent un `User`; les états antérieurs décrivent des enregistrements dédiés.
V3-001 doit comparer cette option aux alternatives avant migration.

## Matrice rôles/capacités cible

| Capacité serveur | Apprenant | Créateur | Administrateur | Validateur futur |
| --- | ---: | ---: | ---: | ---: |
| Se connecter si compte `ACTIVE` | Oui | Oui | Oui | Non implémenté |
| Explorer les programmes visibles | Oui | Oui | Oui | Non implémenté |
| S'inscrire/se désinscrire | Oui | Oui | Oui | Non implémenté |
| Gérer ses données d'apprentissage | Oui | Oui | Oui | Non implémenté |
| Accéder à `/admin` | Non | Jamais | Oui | Non implémenté |
| Gérer demandes, rôles et suspensions | Non | Non | Oui | Non implémenté |
| Créer/modifier/publier un programme | Non | Refusé en V3 | Administration existante | Non implémenté |
| Signer une validation scientifique | Non | Non | Non | Réservé, hors V3 |
| Utiliser une capacité IA | Réservé | Réservé | Réservé | Hors V3 |

Le serveur vérifie la capacité et la relation à la ressource ; un rôle seul ne
suffit jamais à autoriser une mutation sensible.

## Ordre de livraison

```text
Lot comptes/accès
V3-001 → V3-002 → V3-003 → V3-004 → V3-005 → V3-006 → V3-007 → V3-008

Lot programmes partagés
V3-001 → V3-009 → V3-010 → V3-011 → V3-012 → V3-013 → V3-014 → V3-015

Lot flow pédagogique
V3-016 (gate produit) → V3-017 → V3-018
V3-016 → V3-019 → V3-020 → V3-021 → V3-022

Lot bilingue
V3-023 → V3-024 → V3-025 → V3-026 → V3-027
V3.1-001 reste non bloquant et postérieur à V3

Lot sortie
V3-001…V3-027 → V3-028 → V3-029 → V3-030 → V3-031 → V3-032 → V3-033
```

Les lots peuvent progresser en branches distinctes uniquement lorsque leurs
dépendances sont satisfaites et que chaque ticket garde un diff autonome.

---

## V3-001 — Réaudit post-V2 et ADR multi-utilisateur

**Priorité : P0. Dépendances : V2 clôturée à `ba3c352`.**

### Périmètre

- Réauditer schéma, migrations, routes, sessions, propriété, progression,
  publication, seed, CI et environnements après V2.
- Rédiger un ADR comparant le cycle demande/invitation/compte séparé à un enum
  unique sur `User`, puis arrêter identités, états, transitions, capacités,
  frontières de données et stratégie de migration compatible.
- Cartographier les requêtes actuellement fondées sur `ownerId` et celles déjà
  correctement liées à `userId`.

### Hors périmètre

- Migration Prisma, endpoint, UI, fournisseur e-mail ou création de compte.

### Critères d'acceptation

- ADR accepté avec diagramme d'états, matrice d'accès, invariants, décisions
  réversibles/irréversibles et plan expand/backfill/switch/contract.
- Inventaire route par route et preuve que les données V2 à préserver sont
  identifiées avec décomptes et stratégie de rollback.

### Tests et risques

- Revue croisée docs/schéma/routes/tests et requêtes de lecture seule.
- Risque : figer trop tôt un modèle d'accès ; les décisions ouvertes restent
  explicites et aucune migration n'est glissée dans l'ADR.

### Migration et rollback

- Aucune migration. L'ADR définit les migrations ultérieures et leur rollback.

## V3-002 — Schéma du cycle demande, invitation, compte et suspension

**Priorité : P0. Dépendances : V3-001.**

### Périmètre

- Ajouter les entités/états validés pour demandes, vérifications, invitations et
  comptes suspendus, avec tokens hachés, expirations et contraintes.
- Backfiller tous les comptes existants en `ACTIVE` sans modifier leurs mots de
  passe, sessions, rôles ou données.

### Hors périmètre

- Envoi d'e-mail, endpoints publics, UI admin et changement de rôle.

### Critères d'acceptation

- Contraintes empêchent transitions impossibles, tokens multiples actifs et
  compte authentifiable avant activation.
- Admin et données V2 sont intacts sur clone ; migration et rollback sont
  répétables et documentés.

### Tests et risques

- Tests migration, unicité, expiration, concurrence et compatibilité N-1.
- Risque élevé de verrouillage ; migration additive et index concurrents si
  supportés.

### Migration et rollback

- Migration Prisma autonome, sauvegarde Neon, checksums avant/après et stratégie
  roll-forward prioritaire.

## V3-003 — RBAC, capacités et journal d'audit

**Priorité : P0. Dépendances : V3-001 et V3-002.**

### Périmètre

- Centraliser rôles/capacités serveur et refus par défaut ; réserver Créateur et
  futur Validateur sans leur ouvrir de surface.
- Journaliser décisions administratives sensibles avec acteur, cible, action,
  date et métadonnées minimales sans secret.
- Réserver les noms de capacités IA futures sans quota, stockage d'usage ou appel.

### Hors périmètre

- Permissions configurables par utilisateur, portail Créateur, IA ou validation
  scientifique.

### Critères d'acceptation

- Créateur n'accède jamais à `/admin`; les contrôles directs API échouent aussi.
- Toutes les mutations sensibles utilisent la politique centralisée et créent
  une trace d'audit idempotente appropriée.

### Tests et risques

- Matrice Apprenant/Créateur/Admin, IDOR, refus par défaut, logs sans PII/secrets.
- Risque de divergence rôle/capacité ; une seule source serveur fait autorité.

### Migration et rollback

- Migration additive pour rôle/capacités/audit si l'ADR la retient ; rollback
  conserve les événements d'audit.

## V3-004 — Demande d'accès publique et protections anti-abus

**Priorité : P0. Dépendances : V3-002 et V3-003.**

### Périmètre

- Formulaire sans mot de passe créant une demande `PENDING_EMAIL`.
- Réponses non énumérantes, normalisation e-mail, rate limit partagé, protection
  replay et politique de nouvelle demande.

### Hors périmètre

- Création de `User`, choix du mot de passe, approbation ou envoi fournisseur.

### Critères d'acceptation

- E-mail existant, refusé ou nouveau produit une réponse publique indistinguable.
- Courses/retries ne créent pas de doublon et aucune adresse/IP brute n'est
  persistée dans le rate limit.

### Tests et risques

- API réelle : enumeration, rate limit distribué, IPv4/IPv6, normalisation,
  concurrence et erreurs normalisées.
- Risque de spam/coût ; limites mesurées et configurables.

### Migration et rollback

- Utilise V3-002 ; endpoint désactivable par configuration sans supprimer les
  demandes existantes.

## V3-005 — Vérification e-mail et fournisseur

**Priorité : P0. Dépendances : V3-004 et choix fournisseur.**

### Périmètre

- Adapter un fournisseur d'e-mail derrière une interface testable.
- Émettre un token haché, expirant et one-shot ; faire passer la demande à
  `PENDING_APPROVAL` sans révéler son existence.

### Hors périmètre

- Approbation, invitation d'activation, newsletters et e-mails marketing.

### Critères d'acceptation

- Token consommé/expiré/rejoué échoue de manière sûre ; aucun token clair n'est
  logué ou stocké.
- E-mails, liens, métadonnées et annonces sont testables hors production.

### Tests et risques

- Tests adaptateur, délivrabilité simulée, replay, expiration, double clic et
  redaction logs.
- Risque fournisseur/locale ; contrat indépendant et bascule documentée.

### Migration et rollback

- Pas de migration supplémentaire attendue ; feature flag coupe l'envoi sans
  invalider les demandes.

## V3-006 — Administration des demandes, acceptation, refus et rôle

**Priorité : P0. Dépendances : V3-003 et V3-005.**

### Périmètre

- Liste admin paginée/filtrable des demandes vérifiées.
- Acceptation/refus atomique, motif interne, attribution de rôle et création de
  l'invitation seulement après acceptation.

### Hors périmètre

- Activation, création éditoriale Créateur et suppression définitive des refus.

### Critères d'acceptation

- Seul Admin agit ; double action/concurrence est idempotente et auditée.
- Le demandeur refusé ne peut pas s'authentifier et la réponse publique reste
  non énumérante.

### Tests et risques

- Autorisation, pagination, filtres, course accept/refuse et audit.
- Risque de mauvaise attribution ; aperçu/confirmation et transaction requis.

### Migration et rollback

- Utilise les tables existantes ; annulation d'une invitation non consommée
  sans supprimer la demande auditée.

## V3-007 — Invitation one-shot, mot de passe et activation

**Priorité : P0. Dépendances : V3-006.**

### Périmètre

- Invitation temporaire à usage unique, formulaire de mot de passe après accord,
  hash Argon2id et création atomique du compte `ACTIVE`.
- Invalider les invitations concurrentes et ouvrir une session sécurisée selon
  une décision explicite.

### Hors périmètre

- Reset de mot de passe complet, MFA et connexion sociale.

### Critères d'acceptation

- Aucun compte/mot de passe avant acceptation ; replay ou token expiré échoue.
- Activation conserve rôle attribué, audit et isolation des sessions.

### Tests et risques

- Tokens, politique mot de passe, concurrence, cookies, fixation de session et
  redaction.
- Risque d'activation partielle ; transaction unique.

### Migration et rollback

- Pas de migration au-delà de V3-002/003 ; rollback désactive l'activation et
  révoque les invitations non consommées.

## V3-008 — Suspension, réactivation et révocation des sessions

**Priorité : P0. Dépendances : V3-003 et V3-007.**

### Périmètre

- Suspendre/réactiver un compte et révoquer atomiquement toutes ses sessions.
- Vérifier le statut sur chaque authentification et session existante.

### Hors périmètre

- Suppression de compte, export réglementaire avancé et effacement des données.

### Critères d'acceptation

- Une suspension coupe immédiatement web/API et bloque tout nouveau login.
- Réactivation ne restaure aucune ancienne session et préserve les données.

### Tests et risques

- Multi-session, course requête/suspension, cookies, cache PWA et audit.
- Risque de session résiduelle ; requête d'autorisation liée au statut serveur.

### Migration et rollback

- Migration additive si statut sur `User`; rollback conserve la suspension dans
  un mécanisme compatible ou exige roll-forward.

## V3-009 — Propriété, visibilité et publication séparées

**Priorité : P0. Dépendances : V3-001 et V3-003.**

### Périmètre

- Distinguer propriétaire éditorial, visibilité et statut de publication.
- Définir accès privé/public et règles de brouillon sans lier publication à la
  validation scientifique.

### Hors périmètre

- Enrollment, versionnement, collaboration et marketplace.

### Critères d'acceptation

- Publication pédagogiquement complète possible sans revue scientifique.
- Brouillons restent propriétaire/admin ; contenu public est lisible selon la
  visibilité sans exposer les mutations éditoriales.

### Tests et risques

- Matrice propriétaire/non-propriétaire/anonyme, hiérarchie, cache et IDOR.
- Risque de fuite lors du basculement ; politiques dans les requêtes serveur.

### Migration et rollback

- Migration additive avec backfill conservant le programme psychologie et son
  propriétaire ; anciens comportements disponibles pendant la bascule.

## V3-010 — Versionnement minimal des contenus publiés

**Priorité : P0. Dépendances : V3-009.**

### Périmètre

- Version immuable minimale d'un programme publié et identité stable des objets
  nécessaires à la progression et aux futures corrections.
- Définir brouillon suivant, publication atomique et traçabilité de version.

### Hors périmètre

- Diff visuel complet, collaboration, IA et validation scientifique persistée.

### Critères d'acceptation

- Une publication référence une version reproductible ; une correction ne
  réécrit pas silencieusement l'historique suivi.
- Slugs/deep links existants et données V2 restent valides après backfill.

### Tests et risques

- Snapshot/relecture, publication concurrente, rollback et taille mesurée.
- Risque de modèle surdimensionné ; retenir le minimum démontré par V3-001.

### Migration et rollback

- Expand/backfill avec checksum ; rollback applicatif garde les versions plutôt
  que les supprimer.

## V3-011 — Enrollments et migration des accès existants

**Priorité : P0. Dépendances : V3-009 et V3-010.**

### Périmètre

- Ajouter `ProgramEnrollment` et inscrire les utilisateurs existants aux
  programmes auxquels leur progression donne déjà accès.
- Définir inscription, désinscription et conservation des données personnelles.

### Hors périmètre

- Paiement, cohortes, transfert automatique entre variantes linguistiques.

### Critères d'acceptation

- Contenu partagé, progression/notes/tentatives toujours personnelles.
- Migration conserve propriétaire, admin, accès et progression sans doublon.

### Tests et risques

- Deux utilisateurs/même programme, désinscription/réinscription, concurrence,
  checksums et IDOR.
- Risque d'accès perdu ; backfill vérifié sur clone Production.

### Migration et rollback

- Migration additive, double lecture temporaire et rollback par ancien chemin
  tant qu'aucune donnée uniquement V3 n'est requise.

## V3-012 — Autorisation centralisée de toutes les API

**Priorité : P0. Dépendances : V3-003, V3-009 et V3-011.**

### Périmètre

- Remplacer les filtres `ownerId` dispersés par des politiques partagées tenant
  compte de capacité, propriété, visibilité, publication et enrollment.
- Auditer toutes les lectures/mutations et porter les autorisations dans les
  requêtes ou transactions.

### Hors périmètre

- Nouvelle UI et modification de règles pédagogiques.

### Critères d'acceptation

- Aucun endpoint ne dépend d'un contrôle frontend ou d'un chargement suivi d'un
  contrôle tardif vulnérable aux courses.
- Deux utilisateurs ne peuvent jamais lire/muter leurs données privées croisées.

### Tests et risques

- Matrice exhaustive routes, IDOR, brouillons/public, admin/créateur et courses.
- Risque de régression large ; migration route par route avec contrats communs.

### Migration et rollback

- Aucune migration attendue ; feature flag de lecture uniquement si nécessaire,
  sans relâcher l'autorisation.

## V3-013 — API Catalogue et Mes programmes paginée

**Priorité : P1. Dépendances : V3-010 à V3-012.**

### Périmètre

- APIs paginées/recherchables du catalogue visible et des enrollments personnels.
- Filtres langue/statut prévus sans exposer brouillons ni données personnelles.

### Hors périmètre

- Recommandations personnalisées, ranking IA et UI.

### Critères d'acceptation

- Pagination stable, bornée et indexée ; recherche normalisée et réponses typées.
- Catalogue partagé sans progression d'autrui ; Mes programmes reflète les
  enrollments du compte courant.

### Tests et risques

- Pagination/cursor, filtres, recherche, autorisation, volumes et plans SQL.
- Risque N+1 ; mesurer avant optimisation.

### Migration et rollback

- Index autonome si mesure le justifie ; endpoint désactivable sans perte.

## V3-014 — Interface Explorer et Mes programmes

**Priorité : P1. Dépendances : V3-013.**

### Périmètre

- Explorer les programmes visibles, consulter langue/statut, s'inscrire et
  retrouver Mes programmes.
- États vides, chargement, erreur, mobile, clavier et hors ligne explicites.

### Hors périmètre

- Création de programme, marketplace et recommandations.

### Critères d'acceptation

- Inscription/désinscription confirmée par serveur et navigation compréhensible.
- Aucun brouillon ou donnée privée n'est rendu via contournement d'URL.

### Tests et risques

- Composants/E2E 320/390/desktop/WebKit, axe, clavier, erreurs et concurrence.
- Risque de navigation surchargée ; décision produit explicite avant placement.

### Migration et rollback

- Aucune migration ; rollback masque les nouvelles entrées sans supprimer les
  enrollments.

## V3-015 — Rôle Créateur attribuable, création refusée jusqu'à V5

**Priorité : P0. Dépendances : V3-003, V3-006 et V3-012.**

### Périmètre

- Permettre à Admin d'attribuer Créateur et rendre sa frontière observable.
- Garantir refus par défaut de `/admin` et de toutes mutations éditoriales.

### Hors périmètre

- Espace Créateur, création, édition, prévisualisation ou publication par ce rôle.

### Critères d'acceptation

- Créateur utilise les fonctions Apprenant mais aucune surface/mutation d'auteur.
- Les capacités futures sont réservées sans route, bouton ni contournement API.

### Tests et risques

- Navigation, appels directs, élévation de privilège, cache de session et audit.
- Risque de confusion produit ; libellé et refus expliqués à l'administration.

### Migration et rollback

- Utilise V3-003 ; rétrograder le rôle ne supprime aucune donnée personnelle.

## V3-016 — Spécification consolidée du flow pédagogique

**Priorité : P0 produit. Dépendances : validation du responsable pédagogique.**

### Périmètre

- Finaliser `LEARNING_FLOW_V3_SPEC.md` comme source d'autorité sur orientation,
  timeline, séquence authorée, ressources, sources, notes, navigation, reprise,
  progression, mobile et accessibilité.
- Résoudre chaque décision ouverte sans inventer de placement de contenu.

### Hors périmètre

- Code, Prisma, API, seed ou réorganisation du programme.

### Critères d'acceptation

- Spec approuvée explicitement, exemples et états complets, responsabilités
  produit/éditorial/technique séparées.
- Chaque ticket V3-017 à V3-022 peut en dériver des critères non ambigus.

### Tests et risques

- Revue croisée avec guides pédagogiques, UX, accessibilité, modèle V2 et URLs.
- Risque de coder une supposition ; la spec non approuvée bloque V3-017 à 022.

### Migration et rollback

- Aucune migration ; document gate uniquement.

## V3-017 — Séquence globale inter-types et backfill V2

**Priorité : P0. Dépendances : V3-010 et V3-016 approuvé.**

### Périmètre

- Modéliser l'ordre global explicitement authoré de `CONTENT`, `RESOURCE`,
  `TASK`, `CONCEPT_ASSESSMENT`, `EXERCISE`, `QUIZ`; `COMPLETE` reste terminal.
- Backfiller un ordre reproduisant exactement V2 avant tout réordonnancement.
- Unifier sommaire, Continuer, reprise, progression et recommencement de module.

### Hors périmètre

- Ordre inventé, alternance automatique et réorganisation psychologie.

### Critères d'acceptation

- Références uniques/valides, seed idempotent et parcours V2 inchangé après
  backfill seul.
- Une seule séquence serveur fait autorité dans toutes les routes concernées.

### Tests et risques

- Backfill exact, ordre inter-types, suppressions/ajouts, deep links,
  progression, concurrence et 70 leçons.
- Risque élevé d'identité d'activité ; empreintes et clone Neon obligatoires.

### Migration et rollback

- Migration additive, dual-read puis switch ; rollback V2 seulement avant
  publication d'un nouvel ordre, sinon roll-forward/restauration coordonnée.

## V3-018 — Réorganisation éditoriale du programme psychologie

**Priorité : P1 éditoriale. Dépendances : V3-016 et V3-017.**

### Périmètre

- Faire produire/valider par le responsable pédagogique l'ordre explicite de
  chaque leçon, puis intégrer fidèlement les specs approuvées.
- Auditer cohérence, sources, ressources, évaluations et progression.

### Hors périmètre

- Pédagogie inventée par Codex, publication sans revue ou changement moteur.

### Critères d'acceptation

- Chaque activité possède sa place justifiée dans la spec et aucun doublon.
- Seed/re-seed idempotents ; brouillons restent non publics jusqu'à publication.

### Tests et risques

- Validation JSON/guide, clés, comptes, ordre, sourcing, liens et smoke mobile.
- Risque éditorial ; toute ambiguïté retourne au responsable pédagogique.

### Migration et rollback

- Aucune migration moteur ; rollback par version de contenu précédente.

## V3-019 — Timeline et accordéon Programme compact

**Priorité : P1. Dépendances : V3-014 et V3-016.**

### Périmètre

- Timeline verticale, une étape ouverte ; première visite sur première étape non
  terminée, puis restauration de la dernière étape ouverte par compte/programme.
- Repliée : numéro, titre, durée, progression/statut et chevron, sans nombre
  d'activités. Développée : résumé, modules compacts et CTA.

### Hors périmètre

- Modification de progression ou affichage de toutes les descriptions.

### Critères d'acceptation

- Une seule étape ouverte, état UI séparé de la progression, aucune navigation
  lors du dépliage.
- Utilisable à 320/390 px, texte 200 %, clavier et lecteur d'écran.

### Tests et risques

- Persistance multi-utilisateur, terminé/verrouillé, programme long, axe et
  reduced motion.
- Risque de confusion préférence/progression ; contrats séparés.

### Migration et rollback

- Préférence locale privée ou modèle minimal justifié ; rollback vers liste V2.

## V3-020 — Ressources guidées et sources au point d'usage

**Priorité : P1. Dépendances : V3-016 à V3-018.**

### Périmètre

- Supprimer la liste globale de ressources ; rendre chaque ressource à sa place
  authorée avec verbe, objectif, périmètre, consigne, durée, statut et CTA.
- Ressource facultative non bloquante ; source bibliographique secondaire et
  repliable après le contenu qu'elle soutient.
- Auditer les lectures implicites du programme psychologie.

### Hors périmètre

- Nouveau modèle Sources/Ressources, appariement fragile ou placement inventé.

### Critères d'acceptation

- Aucune duplication ; ressources obligatoires/facultatives et sources ont les
  rôles exacts, liens sûrs et état cohérent.
- Continuer/sommaire/reprise suivent la séquence sans double progression.

### Tests et risques

- Liens externes/retour, indisponibilité, persistance, accessibilité, 320/390,
  sourceKeys et progression.
- Risque d'accès externe ; alternative explicite pour obligatoire inaccessible.

### Migration et rollback

- Réutiliser modèles existants ; éventuels champs de guidage passent par ticket
  migration validé, jamais implicitement.

## V3-021 — Navigation pédagogique non flottante en fin d'activité

**Priorité : P1. Dépendances : V3-016, V3-017 et V3-020.**

### Périmètre

- Ordre normal : activité, ressources/sources, note, Sommaire, puis
  Précédent/Continuer en bas ; aucune navigation pédagogique sticky/fixed.
- Un seul Continuer ; fin explicite `Terminer la leçon` ou `Leçon suivante`.

### Hors périmètre

- Refonte barre globale ou calcul pédagogique frontend.

### Critères d'acceptation

- Aucun recouvrement/safe-area, destinations serveur exactes et historique/focus
  conservés.
- Première/dernière activité et contenus longs restent compréhensibles.

### Tests et risques

- DOM/CSS, unicité CTA, deep links, 320/390, 200 %, clavier, WebKit/VoiceOver.
- Risque de reprise erronée ; tester contre la séquence unique.

### Migration et rollback

- Aucune migration ; rollback de composition uniquement.

## V3-022 — Prise de note identifiable et panneau contextuel

**Priorité : P1. Dépendances : V3-016 et V3-021.**

### Périmètre

- Vrai bouton secondaire `Prendre une note` avec icône, avant la navigation.
- Panneau sans perte de position, liaison annoncée, confirmation et `Voir la note`.

### Hors périmètre

- Partage, collaboration et nouvel éditeur riche.

### Critères d'acceptation

- Ne concurrence jamais Continuer ; cible ≥ 44 px et lien exact à l'activité.
- Autosauvegarde/idempotence existantes préservées, focus restauré.

### Tests et risques

- Mobile/desktop/200 %, clavier, annonce, erreur réseau, doublons.
- Risque de double création ; mutation explicitement idempotente.

### Migration et rollback

- Aucune migration attendue ; réutiliser Note.

## V3-023 — Fondation i18n de l'interface

**Priorité : P1. Dépendances : V3-001.**

### Périmètre

- Catalogue typé `fr`/`en`, fallback français, détection CI des clés manquantes.
- Retirer progressivement les chaînes UI métier codées en dur et localiser
  annonces accessibles.

### Hors périmètre

- Contenus pédagogiques traduits et variante de programme.

### Critères d'acceptation

- Aucun écran migré n'affiche clé brute ; fallback et interpolation sont sûrs.
- Tests fonctionnels/axe passent dans les deux langues avec libellés longs.

### Tests et risques

- Catalogue, pluriels, missing keys, XSS interpolation, 320/390/200 %.
- Risque de migration massive ; avancer par domaines sans mélanger métier.

### Migration et rollback

- Aucune migration ; langue française reste fallback.

## V3-024 — Locale compte, formats, e-mails, métadonnées et routage

**Priorité : P1. Dépendances : V3-002, V3-005 et V3-023.**

### Périmètre

- Préférence `User.locale`, initialisation navigateur à l'inscription et réglage.
- Localiser `document.lang`, dates/nombres, e-mails, PWA/métadonnées et routage.

### Hors périmètre

- Traduction des contenus pédagogiques et déduction de langue depuis l'IP.

### Critères d'acceptation

- Préférence serveur suit le compte entre appareils ; fallback déterministe.
- URLs françaises existantes restent compatibles selon stratégie validée.

### Tests et risques

- SSR non applicable, navigation, formats/timezones, e-mails, PWA et cache.
- Risque de liens cassés ; redirections et deep links inventoriés.

### Migration et rollback

- Colonne additive avec backfill `fr`; rollback conserve la valeur sans l'utiliser.

## V3-025 — Variantes linguistiques de programme et backfill français

**Priorité : P1. Dépendances : V3-009, V3-010, V3-013 et V3-024.**

### Périmètre

- Variantes autonomes reliées par identité canonique, locale et clés
  pédagogiques stables ; cycle éditorial/publication propre.
- Backfiller le programme psychologie existant en variante française.

### Hors périmètre

- Colonnes traduction sur chaque table et transfert automatique de progression.

### Critères d'acceptation

- Catalogue filtrable par langue ; ressources/sources gardent leurs titres réels.
- Backfill sans perte de contenu, URL, publication, enrollment ou progression.

### Tests et risques

- Migration, unicité, versions, catalogue, deep links et isolation progression.
- Risque structurel élevé ; clone Neon et checksums.

### Migration et rollback

- Migration additive ; `fr` canonique, dual-read, roll-forward prioritaire.

## V3-026 — Workflow éditorial bilingue, glossaire et QA

**Priorité : P1. Dépendances : V3-016, V3-023 et V3-025.**

### Périmètre

- Statuts de traduction/revues, glossaire versionné, contrôle culturel/juridique.
- QA liens, ressources, quiz, distracteurs, rubriques, consignes et niveau.

### Hors périmètre

- Traduction automatique publiée et portail de validation scientifique.

### Critères d'acceptation

- Une variante dérive d'une édition précise et ne devient publiable qu'après
  revues humaines requises.
- Écarts structurels et terminologiques sont détectés avant publication.

### Tests et risques

- Validateurs de specs, glossaire, liens, structure et statuts.
- Risque de confusion publication/science ; axes indépendants.

### Migration et rollback

- Métadonnées minimales additives si requises ; rollback remet la variante en
  brouillon sans affecter la française.

## V3-027 — Traduction et publication pilote d'un petit module

**Priorité : P1. Dépendances : V3-025 et V3-026.**

### Périmètre

- Choisir avec le responsable pédagogique un petit module, produire sa variante
  anglaise, la relire et la publier en pilote.
- Mesurer QA, charge, liens, expérience et progression distincte.

### Hors périmètre

- Traduction complète, génération automatique et transfert de progression.

### Critères d'acceptation

- Pilote humainement relu, structure cohérente, catalogue/deep links corrects.
- Aucune régression française et retour arrière vers brouillon possible.

### Tests et risques

- Parcours bilingue complet, quiz/exercices, mobile, axe, liens et publication.
- Risque de retarder V3 ; pilote borné et non gate de la traduction complète.

### Migration et rollback

- Aucune migration nouvelle ; dépublication de la variante pilote.

## V3.1-001 — Traduction anglaise progressive du programme complet

**Priorité : P2. Dépendances : V3 clôturée et pilote V3-027 validé.**

### Périmètre

- Traduire progressivement le programme psychologie par lots éditoriaux revus.

### Hors périmètre

- Gate de sortie V3, traduction automatique non relue et IA produit.

### Critères d'acceptation

- Chaque lot respecte glossaire, QA, sourcing, version et publication autonome.

### Tests et risques

- Même matrice que V3-027 par lot ; risque de dérive structurelle surveillé.

### Migration et rollback

- Aucune migration attendue ; dépublier une variante sans affecter le français.

## V3-028 — Audit sécurité, dette et exploitation

**Priorité : P0. Dépendances : V3-001 à V3-027.**

### Périmètre

- Audit complet auth/e-mail/tokens/sessions/RBAC/IDOR/catalogue/enrollments,
  publication, i18n, cache, XSS, CSRF/CORS, secrets, dépendances et migrations.
- Inventaire dette, code mort, N+1, listes non bornées et exploitation.

### Hors périmètre

- Correction mélangée à l'audit et nouvelle fonctionnalité.

### Critères d'acceptation

- Findings prouvés, sévérité P0/P1/P2, reproduction, propriétaire et destination.
- Aucun succès simulé ; limites d'environnement explicites.

### Tests et risques

- Analyse statique/dynamique, vraie DB isolée, deux utilisateurs et navigateur.
- Risque d'audit superficiel ; matrice route par route.

### Migration et rollback

- Aucune migration ; rapport autonome.

## V3-029 — Remédiation des findings P0/P1

**Priorité : P0. Dépendances : V3-028.**

### Périmètre

- Corriger chaque P0/P1 dans un sous-ticket/commit borné avec régression testée.

### Hors périmètre

- P2 non bloquante et refonte opportuniste.

### Critères d'acceptation

- Aucun P0/P1 ouvert ; preuve de correction et nouvelle matrice complète verte.

### Tests et risques

- Tests ciblés puis lint/typecheck/test/build/E2E/integration.
- Risque inconnu par nature ; chaque finding a plan/rollback propre.

### Migration et rollback

- Toute migration reçoit sauvegarde, clone, compatibilité N-1 et roll-forward.

## V3-030 — Cleanup de la dette prouvée

**Priorité : P1. Dépendances : V3-028 et V3-029.**

### Périmètre

- Retirer code mort/duplications et corriger documentation/tests fragiles prouvés.

### Hors périmètre

- Réécriture architecturale sans mesure et P2 sans impact concret.

### Critères d'acceptation

- Chaque suppression a preuve d'inutilité ; comportement public inchangé.

### Tests et risques

- Couverture avant retrait, diff borné et matrice complète.
- Risque de code implicitement utilisé ; instrumentation/recherche préalable.

### Migration et rollback

- Pas de migration par défaut ; commits réversibles.

## V3-031 — Performance, pagination et observabilité mesurées

**Priorité : P1. Dépendances : V3-013, V3-028 à V3-030.**

### Périmètre

- Mesurer latence, requêtes, payloads et erreurs ; corriger seulement les goulots.
- Généraliser pagination bornée et observabilité sans secrets/PII excessive.

### Hors périmètre

- Optimisation spéculative, analytics produit complet et nouveau fournisseur non
  justifié.

### Critères d'acceptation

- Baseline/objectif/résultat pour chaque optimisation ; alertes exploitables.
- Index et logs ont coût mesuré et politique de rétention.

### Tests et risques

- Plans SQL, volumes réalistes, charge bornée et tests de non-régression.
- Risque d'index/logs coûteux ; mesure avant/après.

### Migration et rollback

- Index/métriques autonomes et désactivables ; rollback documenté.

## V3-032 — Répétition migration clone Neon et validation multi-utilisateur

**Priorité : P0. Dépendances : V3-029 à V3-031.**

### Périmètre

- Rejouer toutes migrations sur clone Production et comparer décomptes/checksums.
- Parcours réel avec demandeur, apprenant, créateur, admin, suspendu et deux
  apprenants sur le même programme.

### Hors périmètre

- Écriture Production et fonctionnalité nouvelle.

### Critères d'acceptation

- Données V2 intactes ; isolation privée et partage de contenu prouvés.
- CI Functions, Chromium/WebKit/mobile, axe et concurrence verts.

### Tests et risques

- Integration réelle, migration/rollback, smoke, cookies/cache et charge bornée.
- Risque maximal migration accès ; critères d'arrêt explicites.

### Migration et rollback

- Clone seulement ; procédure Production, sauvegarde et roll-forward validés.

## V3-033 — Déploiement, smoke, rapport et clôture V3

**Priorité : P0. Dépendances : V3-032 et autorisation explicite.**

### Périmètre

- Intégrer `dev → staging → main`, sauvegarder, migrer, déployer et surveiller.
- Smoke authentifié multi-utilisateur et rapport canonique GO/NO-GO.

### Hors périmètre

- Traduction complète V3.1, V4, IA et changement non audité.

### Critères d'acceptation

- Aucun P0/P1 ; comptes/admin/programme/progressions intacts et parcours cibles
  verts en Production.
- Rollback/roll-forward testé, rapport approuvé et V3 clôturée explicitement.

### Tests et risques

- Matrice complète, monitoring, mobile réel/VoiceOver et vérifications post-merge.
- Risque Production ; fenêtre, responsables et seuils d'arrêt définis.

### Migration et rollback

- Sauvegarde Neon vérifiée. Roll-forward prioritaire ; restauration DB + code
  coordonnée si le schéma n'est pas compatible N-1.

## Décisions ouvertes

1. Modèle exact demande/invitation/compte : décision V3-001.
2. Fournisseur e-mail, domaine, région, délivrabilité, webhook et coût : V3-005.
3. Rétention/anonymisation des demandes refusées et nouvelle demande : V3-001/006.
4. Intention de rôle demandée ou rôle attribué uniquement par Admin : V3-006.
5. Besoin de visibilité `UNLISTED` : V3-009.
6. Version suivie par enrollment et sémantique de désinscription : V3-010/011.
7. Snapshot JSON ou modèle normalisé minimal de version : V3-010.
8. Place d'Explorer dans la navigation : V3-014.
9. Stockage de la préférence d'étape ouverte : V3-019.
10. Stratégie URL/slug multilingue compatible avec les liens français : V3-024/025.
11. Fourniture et validation de `LEARNING_FLOW_V3_SPEC.md` : V3-016.
12. Le futur programme du frère de Rayan reste conditionné à un brief complet,
    au schéma final des specs et au gabarit sourcing/QA ; aucun sujet ni contenu
    n'est inventé par Codex.

## Hors périmètre V3

- Paiements, abonnements, marketplace, rémunération et organisations.
- Social, messagerie, commentaires, partage de notes et recommandations.
- IA, correction/génération automatiques et quotas persistés.
- Surface éditoriale Créateur, reportée à V5.
- Portail/badge complet de validation scientifique.
- Traduction anglaise complète, portée par V3.1-001 et non gate V3.
- Nouveau programme pédagogique sans brief/specs approuvés.

## Porte de sortie V3

- Cycle d'accès complet, non énumérant, audité et résistant au replay.
- Statut compte et révocation appliqués à toutes les sessions/routes.
- RBAC centralisé ; Créateur exclu de `/admin` et de toute mutation éditoriale.
- Propriété, visibilité, publication, version et enrollment séparés.
- Catalogue/Mes programmes paginés ; contenu partagé et données privées isolées.
- Flow pédagogique conforme à la spec V3 approuvée, sans décision implicite.
- Fondation `fr`/`en`, variante française backfillée et petit pilote anglais
  publié ; traduction complète non requise.
- Migrations répétées sur clone, sauvegarde/rollback validés et aucune donnée V2
  perdue.
- Aucun P0/P1 ouvert, aucun appel IA, rapport Production approuvé.
