# Modèle de données PostgreSQL — LearnX

Toutes les clés primaires utilisent UUID.

## Utilisateurs et sessions

### users

- id
- email unique
- password_hash
- display_name
- role : user | admin
- created_at
- updated_at

### sessions

- id
- user_id
- token_hash unique
- expires_at
- created_at
- last_used_at

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
- title
- description nullable
- type
- is_required
- weight
- position

Types :

- reading
- watching
- listening
- reflection
- checklist
- writing
- practice
- project


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
- title
- instructions
- rubric_json nullable
- is_required

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
