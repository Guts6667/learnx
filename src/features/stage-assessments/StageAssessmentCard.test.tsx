import { render, screen, within } from '@testing-library/preact';

import { StageAssessmentCard } from '@/features/stage-assessments/StageAssessmentCard';

vi.mock('@/features/stage-assessments/queries', () => ({
  useStageAssessmentMutation: () => ({
    createDraft: vi.fn(),
    error: undefined,
    isPending: false,
    save: vi.fn(),
    submit: vi.fn(),
  }),
  useStageAssessmentQuery: () => ({
    data: {
      assessment: {
        description: 'Mobiliser les **notions** de l’étape.',
        id: 'assessment-1',
        instructions:
          '## Consignes\n1. Lire le cas.\n2. Argumenter.\n\n## Cas NovaWork\nLe cas doit être analysé.',
        isRequired: true,
        passingScore: 70,
        position: 1,
        rubric: [
          {
            criterion: 'Exactitude',
            requirements: ['Employer les concepts correctement.'],
            weight: 60,
          },
        ],
        stageId: 'stage-1',
        submission: null,
        title: 'Analyse intégrative',
        type: 'CASE_STUDY',
      },
    },
    error: undefined,
    isPending: false,
  }),
}));

describe('StageAssessmentCard', () => {
  it('structure les contenus longs et la grille sans jeton Markdown brut', () => {
    render(<StageAssessmentCard isStagePublished={false} stageId="stage-1" />);

    expect(
      screen.getByRole('heading', { name: 'Objectif' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Consignes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Cas NovaWork' }),
    ).toBeInTheDocument();
    const instructions = screen
      .getByRole('heading', {
        name: 'Consignes',
      })
      .closest('section');
    expect(instructions).not.toBeNull();
    expect(
      within(instructions as HTMLElement).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(screen.getByText('notions').tagName).toBe('STRONG');
    expect(
      screen.getByRole('heading', { name: 'Grille d’évaluation' }),
    ).toBeInTheDocument();
    expect(screen.getByText('60 %')).toBeInTheDocument();
    expect(screen.queryByText(/## Consignes/)).not.toBeInTheDocument();
  });
});
