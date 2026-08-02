import {
  assertExerciseSubmissionCanBeEdited,
  assertExerciseSubmissionCanBeSubmitted,
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
