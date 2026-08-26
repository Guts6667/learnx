import {
  assertExerciseSubmissionCanBeEdited,
  assertExerciseSubmissionCanBeSubmitted,
  MAX_EXERCISE_SUBMISSION_CHARACTERS,
} from '@/lib/exercises';

describe('exercise submission rules', () => {
  it('autorise la modification et la soumission d’un brouillon renseigné', () => {
    expect(() => assertExerciseSubmissionCanBeEdited('DRAFT')).not.toThrow();
    expect(() =>
      assertExerciseSubmissionCanBeSubmitted({
        contentMarkdown: '## Analyse\n\nUne réponse argumentée.',
        status: 'DRAFT',
      }),
    ).not.toThrow();
  });

  it('refuse une soumission vide', () => {
    expect(() =>
      assertExerciseSubmissionCanBeSubmitted({
        contentMarkdown: '   ',
        status: 'DRAFT',
      }),
    ).toThrow('Exercise content is required before submission.');
  });

  it('accepte exactement la borne annoncée et refuse le caractère suivant', () => {
    expect(() =>
      assertExerciseSubmissionCanBeSubmitted({
        contentMarkdown: 'x'.repeat(MAX_EXERCISE_SUBMISSION_CHARACTERS),
        status: 'DRAFT',
      }),
    ).not.toThrow();
    expect(() =>
      assertExerciseSubmissionCanBeSubmitted({
        contentMarkdown: 'x'.repeat(MAX_EXERCISE_SUBMISSION_CHARACTERS + 1),
        status: 'DRAFT',
      }),
    ).toThrow(
      `Exercise content must not exceed ${MAX_EXERCISE_SUBMISSION_CHARACTERS} characters.`,
    );
  });

  it('rend une soumission envoyée immuable', () => {
    expect(() => assertExerciseSubmissionCanBeEdited('SUBMITTED')).toThrow(
      'A submitted exercise can no longer be edited.',
    );
    expect(() =>
      assertExerciseSubmissionCanBeSubmitted({
        contentMarkdown: 'Réponse',
        status: 'SUBMITTED',
      }),
    ).toThrow('A submitted exercise can no longer be edited.');
  });
});
