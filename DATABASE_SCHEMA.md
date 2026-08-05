# Modèle de données PostgreSQL — LearnX

Toutes les clés primaires utilisent UUID.

## Utilisateurs et sessions

### users

- id
- email unique
- password_hash
- display_name
- role : user | creator | admin
- account_status : active | suspended
- suspended_at nullable, obligatoire lorsque le compte est suspendu
- created_at
- updated_at

Les comptes V2 existants sont backfillés en `active`. Un compte suspendu reste
un compte existant : la révocation effective de ses sessions et les contrôles
runtime sont livrés séparément par V3-008.

### sessions

- id
- user_id
- token_hash unique
- expires_at
- created_at
- last_used_at

### login_rate_limits

- key_hash, clé primaire SHA-256 de l’adresse client et de l’e-mail normalisé
- failures
- window_started_at
- updated_at

Cette table ne contient ni adresse IP ni e-mail en clair. Elle fournit des
fenêtres de limitation communes à toutes les Functions serverless. Les clés
sont préfixées par domaine avant hachage afin de séparer la connexion des
demandes d'accès publiques.

### access_requests

- id
- email_normalized
- status : pending_email | pending_approval | approved | rejected
- version, strictement positif
- email_verified_at nullable
- reviewed_at nullable
- reviewed_by_user_id nullable
- rejection_reason nullable
- activated_user_id nullable et unique
- created_at
- updated_at

Une seule demande ouverte peut exister par e-mail normalisé. Les transitions
restent explicites : une demande doit être vérifiée avant revue, et une demande
refusée conserve une raison non vide.

### email_verifications

- id
- access_request_id
- token_hash unique
- expires_at
- consumed_at nullable
- invalidated_at nullable
- created_at

Le token brut n'est jamais stocké. Une demande ne peut avoir qu'un token actif
et celui-ci ne peut pas être à la fois consommé et invalidé.

### access_invitations

- id
- access_request_id
- token_hash unique
- assigned_role : user | admin
- expires_at
- consumed_at nullable
- invalidated_at nullable
- invited_by_user_id nullable
- created_at

Une invitation ne peut être créée que pour une demande approuvée. Une seule
invitation active est autorisée par demande ; la création du compte et le choix
du mot de passe restent hors du périmètre de V3-002.

### audit_events

- id
- actor_user_id
- action
- target_type
- target_id
- idempotency_key
- metadata_json, objet JSON technique sans secret ni donnée personnelle
- created_at

Le journal est append-only au niveau applicatif. La clé unique
`(actor_user_id, action, idempotency_key)` rend les retries idempotents. Les
événements conservent l'acteur, la cible et les seuls détails techniques utiles ;
les mots de passe, tokens, e-mails et corps de contenu n'y sont jamais copiés.

Actions réservées : publication, édition de module/leçon, revue d'évaluation,
décisions de demande d'accès, émission d'invitation, attribution de rôle et
suspension/réactivation. V3-003 n'expose aucune API de lecture de ce journal.

## Programmes

### programs

- id
- owner_id
- title
- slug
- description
- status : draft | active | archived
- icon nullable
- position
- estimated_duration_days nullable
- created_at
- updated_at
- unique(owner_id, slug)

### stages

- id
- program_id
- title
- slug
- description
- position
- estimated_minutes nullable
- estimated_duration_days nullable
- is_published
- created_at
- updated_at
- unique(program_id, slug)

### modules

- id
- stage_id
- title
- slug
- description
- position
- estimated_minutes nullable
- is_published
- created_at
- updated_at
- unique(stage_id, slug)

### lessons

- id
- module_id
- title
- slug
- summary
- objectives_json
- prerequisites_json
- estimated_minutes nullable
- position
- is_published
- created_at
- updated_at
- unique(module_id, slug)

### content_blocks

- id
- lesson_id
- type
- content_json
- position

Types :

- rich_text
- objective
- definition
- example
- callout
- quote
- embed
- divider

### resources

- id
- lesson_id
- type
- title
- author nullable
- url nullable
- citation nullable
- description nullable
- is_required
- estimated_minutes nullable
- position

Types :

- book
- book_chapter
- article
- video
- course
- podcast
- website
- document
- tool

### tasks

- id
- lesson_id
- key
- title
- description nullable
- type
- is_required
- weight
- position
- is_canonical

Types :

- reading
- watching
- listening
- reflection
- checklist
- writing
- practice
- project

`unique(lesson_id, key)`. Les types `reading`, `watching`, `listening` et
`checklist` sont les seules activités routées vers `tasks` par le seed.

### task_resources

- task_id
- resource_id
- primary key(task_id, resource_id)

Cette relation explicite les supports nécessaires à une tâche sans transformer
la ressource en étape de progression.

### activity_completion_carryovers

- id
- user_id
- lesson_id
- activity_key
- kind : task ou exercise
- module_run_id
- completed_at
- sources_json
- created_at
- unique(user_id, lesson_id, activity_key, kind, module_run_id)

Cette table conserve une réussite héritée d'un ancien miroir Task/Exercise ou
d'une ressource explicitement liée. La reprise est bornée au `ModuleRun`
courant : recommencer un module n'hérite jamais d'une réussite antérieure.


## Notions

### concepts

- id
- lesson_id
- title
- slug
- description nullable
- position
- is_required
- mastery_threshold
- created_at
- updated_at
- unique(lesson_id, slug)

Une notion représente une unité précise à apprendre et à valider.

### concept_resources

- id
- concept_id
- resource_id
- unique(concept_id, resource_id)

### concept_assessments

- id
- concept_id
- assessment_type
- quiz_id nullable
- exercise_id nullable
- is_required
- position

Types :

- quiz
- short_answer
- practice
- flashcard
- case_question

### concept_progress

- id
- user_id
- concept_id
- status
- best_score nullable
- validated_at nullable
- last_attempt_at nullable
- unique(user_id, concept_id)

États :

- not_started
- learning
- validated
- needs_review

## Évaluations d’étape

### stage_assessments

- id
- stage_id
- title
- description
- type
- instructions
- rubric_json nullable
- passing_score nullable
- is_required
- position

Types :

- project
- case_study
- written_assignment
- practical_exercise
- oral
- simulation
- cumulative_exam

### stage_assessment_submissions

- id
- user_id
- stage_assessment_id
- content_markdown nullable
- attachment_url nullable
- score nullable
- status
- submitted_at nullable
- reviewed_at nullable
- created_at
- updated_at

États :

- draft
- submitted
- validated
- needs_revision

## Progression

### program_progress

- id
- user_id
- program_id
- percent
- started_at nullable
- target_end_at nullable
- completed_at nullable
- temporal_status nullable
- expected_percent
- progress_delta
- last_viewed_at
- unique(user_id, program_id)

### stage_progress

- id
- user_id
- stage_id
- status
- percent
- started_at nullable
- target_end_at nullable
- completed_at nullable
- temporal_status nullable
- expected_percent
- progress_delta
- last_viewed_at nullable
- unique(user_id, stage_id)

### lesson_progress

- id
- user_id
- lesson_id
- status
- percent
- started_at nullable
- completed_at nullable
- last_viewed_at nullable
- unique(user_id, lesson_id)

### task_completions

- id
- user_id
- task_id
- status
- completed_at nullable
- unique(user_id, task_id)

### resource_progress

- id
- user_id
- resource_id
- status
- completed_at nullable
- unique(user_id, resource_id)

## Quiz

### quizzes

- id
- lesson_id
- title
- description nullable
- passing_score
- is_required

### questions

- id
- quiz_id
- type
- prompt
- explanation
- position

### question_options

- id
- question_id
- label
- is_correct
- position

### quiz_attempts

- id
- user_id
- quiz_id
- score
- passed
- answers_json
- submitted_at

## Exercices

### exercises

- id
- lesson_id
- key
- activity_type
- title
- instructions
- rubric_json nullable
- is_required
- position
- is_canonical

`unique(lesson_id, key)`. Les types `writing`, `practice`, `reflection` et
`project` sont routés vers `exercises` par le seed.

### exercise_submissions

- id
- user_id
- exercise_id
- content_markdown
- status
- submitted_at nullable
- updated_at

## Notes

### notes

- id
- user_id
- program_id nullable
- lesson_id nullable
- title
- markdown
- created_at
- updated_at

## Révisions

### review_items

- id
- user_id
- program_id
- lesson_id
- source_type
- source_id nullable
- due_at
- interval_days
- status
- created_at
- completed_at nullable

## Index indispensables

- sessions(token_hash)
- sessions(user_id, expires_at)
- stages(program_id, position)
- modules(stage_id, position)
- lessons(module_id, position)
- tasks(lesson_id, position)
- program_progress(user_id, last_viewed_at)
- lesson_progress(user_id, status)
- review_items(user_id, due_at, status)
- notes(user_id, updated_at)


## Champs temporels calculés

`expected_percent`, `progress_delta` et `temporal_status` peuvent être recalculés à la lecture plutôt que considérés comme source de vérité.

Sources de vérité :

- `started_at`
- `target_end_at`
- `completed_at`
- `percent`
- durée indicative du programme ou de l’étape

Valeurs de statut :

- ahead
- on_track
- behind
- overdue
- completed_early
- completed_on_time
- completed_late


## Règles de validation

Une notion est validée quand :

- son évaluation obligatoire est terminée ;
- son score atteint le seuil configuré ;
- ou son exercice est marqué comme validé.

Une étape est validée quand :

- toutes ses notions obligatoires sont validées ;
- son évaluation finale obligatoire est validée ;
- ses autres conditions obligatoires sont remplies.
