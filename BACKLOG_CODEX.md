# Backlog Codex

## Règle

Codex ne doit traiter qu’un ticket à la fois.

Chaque livraison comprend :

- plan ;
- modifications ;
- fichiers ;
- migrations ;
- tests ;
- commandes exécutées ;
- résultats ;
- limites.

---

## TICKET-001 — Initialisation Preact

Créer une application Preact avec Vite et TypeScript strict.

Critères :

- Preact fonctionne ;
- Tailwind fonctionne ;
- ESLint et Prettier configurés ;
- Vitest configuré ;
- Preact Testing Library configurée ;
- Playwright configuré ;
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` passent ;
- page minimale ;
- aucun backend encore.

## TICKET-002 — Architecture frontend

Créer :

- dossiers cibles ;
- router ;
- layout mobile ;
- navigation basse ;
- pages placeholder ;
- gestion 404.

## TICKET-003 — Design system minimal

Créer :

- Button
- Card
- ProgressBar
- Badge
- Checkbox
- TextField
- Textarea
- Spinner
- EmptyState
- ErrorState
- OfflineBanner

## TICKET-004 — PostgreSQL et Prisma

Configurer :

- Neon PostgreSQL ;
- Prisma ORM ;
- `prisma/schema.prisma` ;
- Prisma Client ;
- migrations ;
- connexion serveur ;
- schéma `User` et `Session` ;
- commandes `prisma:generate`, `prisma:migrate` et `prisma:seed` ;
- test de connexion.

## TICKET-005 — Authentification serveur

Implémenter :

- register ;
- login ;
- logout ;
- session ;
- cookie sécurisé ;
- hash argon2id ;
- middleware helper `requireUser`.

## TICKET-006 — Protection des routes frontend

- session query ;
- redirect login ;
- état loading ;
- déconnexion ;
- persistance après refresh.

## TICKET-007 — Schéma des programmes

Ajouter migrations pour :

- programs ;
- stages ;
- modules ;
- lessons ;
- content_blocks ;
- resources ;
- tasks.

## TICKET-008 — Seeder le programme exemple

Importer `seed/sample-program.json`.

Le seed doit être idempotent.

## TICKET-009 — API parcours

Implémenter :

- liste des programmes et programme sélectionné ;
- étape ;
- module ;
- leçon.

Ne renvoyer que le contenu publié.

## TICKET-010 — UI Parcours

Créer :

- page Parcours ;
- page Semestre ;
- page Module ;
- progression placeholder tant que le suivi n’existe pas.

## TICKET-011 — UI Leçon

Afficher :

- objectifs ;
- contenu ;
- ressources ;
- tâches ;
- quiz/exercice placeholders.

## TICKET-012 — Progression et tâches

Créer :

- lesson_progress ;
- task_completions ;
- resource_progress ;
- endpoints ;
- mutations ;
- calcul de progression testé.


## TICKET-013 — Planification et suivi temporel

Créer :

- durée indicative des programmes et étapes ;
- démarrage manuel ;
- démarrage automatique à la première activité ;
- date de fin cible ;
- modification manuelle de la date cible ;
- progression attendue ;
- écart réel/attendu ;
- statut temporel ;
- tests unitaires des calculs.

Critères :

- une étape de 21 jours démarrée le 2 août obtient une date cible correcte ;
- le calcul tient compte du temps écoulé ;
- les valeurs sont bornées entre 0 et 100 ;
- un élément terminé reçoit un statut final ;
- les dates sont stockées en UTC.


## TICKET-015 — Modèle de notions

Créer :

- `concepts` ;
- relations avec les leçons et ressources ;
- progression par notion ;
- états de maîtrise ;
- API de lecture ;
- tests.

Critères :

- chaque notion appartient à une leçon ;
- une notion obligatoire doit avoir une activité de validation ;
- consulter une ressource ne valide pas la notion.

## TICKET-016 — Mini-évaluations par notion

Créer :

- mini-quiz ;
- vrai/faux ;
- choix unique ;
- choix multiples ;
- réponse courte ;
- historique des tentatives ;
- seuil de validation ;
- génération de révisions en cas d’échec.

## TICKET-017 — Évaluation finale d’étape

Créer :

- `stage_assessments` ;
- projet, étude de cas, écrit, pratique, oral ou examen ;
- brouillon ;
- soumission ;
- validation ;
- demande de révision ;
- critères de réussite.

Une étape publiée doit posséder au moins une évaluation finale.

## TICKET-018 — Validation d’étape

Implémenter :

- calcul des notions obligatoires validées ;
- vérification des tâches obligatoires ;
- vérification de l’évaluation finale ;
- liste des prérequis manquants ;
- statut final de l’étape ;
- tests unitaires.

## TICKET-019 — Écran Aujourd’hui

Créer le moteur de recommandation et l’écran associé.

Priorité définie dans le PRD.

## TICKET-019 — Quiz : schéma et API

Créer :

- quizzes ;
- questions ;
- options ;
- attempts ;
- calcul sécurisé côté serveur.

## TICKET-020 — Quiz : interface

Créer le parcours complet de quiz.

## TICKET-021 — Exercices

Créer :

- schema ;
- API ;
- éditeur Markdown ;
- sauvegarde brouillon ;
- soumission.

## TICKET-022 — Notes

Créer :

- liste ;
- recherche ;
- édition ;
- autosave ;
- notes liées ou non à une leçon.

## TICKET-023 — Révisions

Créer :

- review_items ;
- génération après quiz insuffisant ;
- marquage manuel ;
- page Révisions.

## TICKET-024 — PWA

Configurer :

- `vite-plugin-pwa` ;
- manifest ;
- icônes ;
- service worker ;
- installation ;
- bannière offline ;
- stratégie de cache.

## TICKET-025 — Administration minimale

Créer une zone admin permettant :

- voir modules et leçons ;
- publier/dépublier ;
- modifier titre, résumé et ordre ;
- accès réservé au rôle admin.

## TICKET-026 — Accessibilité

Audit et corrections :

- clavier ;
- focus ;
- labels ;
- contraste ;
- lecteurs d’écran ;
- safe areas.

## TICKET-027 — E2E critique

Scénario :

1. inscription ;
2. connexion ;
3. ouverture du parcours ;
4. démarrage d’une leçon ;
5. tâche cochée ;
6. quiz soumis ;
7. progression visible ;
8. reconnexion ;
9. état préservé.

## TICKET-028 — Déploiement Vercel

Configurer :

- projet Vercel ;
- build Vite ;
- Functions ;
- variables ;
- PostgreSQL ;
- migrations production ;
- vérification PWA sur iPhone.
