import {
  assertStageCanBePublished,
  assertSubmissionCanBeEdited,
  assertSubmissionCanBeReviewed,
  assertSubmissionCanBeSubmitted,
} from '@/lib/stage-assessments';

describe('stage assessment rules', () => {
  it('blocks a stage without a final assessment from publication', () => {
    expect(() => assertStageCanBePublished({ assessmentCount: 0 })).toThrow(
      'A published stage must have a final assessment.',
    );
    expect(() =>
      assertStageCanBePublished({ assessmentCount: 1 }),
    ).not.toThrow();
  });

  it('only edits drafts and requested revisions', () => {
    expect(() => assertSubmissionCanBeEdited('DRAFT')).not.toThrow();
    expect(() => assertSubmissionCanBeEdited('NEEDS_REVISION')).not.toThrow();
    expect(() => assertSubmissionCanBeEdited('SUBMITTED')).toThrow();
    expect(() => assertSubmissionCanBeEdited('VALIDATED')).toThrow();
  });

  it('requires content before submission', () => {
    expect(() =>
      assertSubmissionCanBeSubmitted({
        attachmentUrl: null,
        contentMarkdown: '  ',
        status: 'DRAFT',
      }),
    ).toThrow('A submission must contain text or an attachment.');
    expect(() =>
      assertSubmissionCanBeSubmitted({
        attachmentUrl: 'https://example.com/work.pdf',
        contentMarkdown: null,
        status: 'DRAFT',
      }),
    ).not.toThrow();
  });

  it('only reviews submitted work', () => {
    expect(() => assertSubmissionCanBeReviewed('SUBMITTED')).not.toThrow();
    expect(() => assertSubmissionCanBeReviewed('DRAFT')).toThrow();
  });
});
