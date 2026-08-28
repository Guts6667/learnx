import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { StageAssessmentCard } from '@/features/stage-assessments/StageAssessmentCard';
import type {
  StageAssessmentDetail,
  StageAssessmentStatus,
  StageAssessmentSubmission,
} from '@/features/stage-assessments/queries';

const { mutationState, queryState } = vi.hoisted(() => ({
  mutationState: {
    createDraft: vi.fn(),
    error: undefined as unknown,
    isPending: false,
    save: vi.fn(),
    submit: vi.fn(),
  },
  queryState: {
    data: undefined as unknown,
    error: undefined as unknown,
    isPending: false,
    reload: vi.fn(),
  },
}));

vi.mock('@/features/stage-assessments/queries', () => ({
  useStageAssessmentMutation: () => mutationState,
  useStageAssessmentQuery: () => queryState,
}));

const assessment: StageAssessmentDetail = {
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
};

function makeSubmission(
  status: StageAssessmentStatus,
  overrides: Partial<StageAssessmentSubmission> = {},
): StageAssessmentSubmission {
  return {
    attachmentUrl: null,
    contentMarkdown: null,
    id: `submission-${status.toLowerCase()}`,
    reviewFeedback: null,
    reviewedAt: null,
    score: null,
    status,
    submittedAt: null,
    updatedAt: '2026-08-28T00:00:00.000Z',
    ...overrides,
  };
}

function setAssessment(overrides: Partial<StageAssessmentDetail> = {}) {
  queryState.data = { assessment: { ...assessment, ...overrides } };
}

describe('StageAssessmentCard', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    queryState.data = undefined;
    queryState.error = undefined;
    queryState.isPending = false;
    mutationState.error = undefined;
    mutationState.isPending = false;
    mutationState.createDraft.mockResolvedValue(undefined);
    mutationState.save.mockResolvedValue(undefined);
    mutationState.submit.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it('structure les contenus longs et la grille sans jeton Markdown brut', () => {
    setAssessment();
    render(<StageAssessmentCard isStagePublished={false} stageId="stage-1" />);

    expect(screen.getByRole('heading', { name: 'Objectif' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Consignes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cas NovaWork' })).toBeInTheDocument();
    const instructions = screen
      .getByRole('heading', { name: 'Consignes' })
      .closest('section');
    expect(instructions).not.toBeNull();
    expect(within(instructions as HTMLElement).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('notions').tagName).toBe('STRONG');
    expect(screen.getByRole('heading', { name: 'Grille d’évaluation' })).toBeInTheDocument();
    expect(screen.getByText('60 %')).toBeInTheDocument();
    expect(screen.queryByText(/## Consignes/)).not.toBeInTheDocument();
    expect(screen.getByText('Exactitude').closest('.ui-list-row')).not.toBeNull();
    expect(document.querySelector('.ui-card .ui-card')).toBeNull();
    expect(screen.getByText(/Prévisualisation en lecture seule/)).toBeInTheDocument();
  });

  it('affiche les états de chargement, erreur et absence de données', () => {
    queryState.isPending = true;
    const { rerender } = render(
      <StageAssessmentCard isStagePublished stageId="stage-1" />,
    );
    expect(screen.getByText('Chargement de l’évaluation finale')).toBeVisible();

    queryState.isPending = false;
    queryState.error = new Error('indisponible');
    rerender(<StageAssessmentCard isStagePublished stageId="stage-1" />);
    expect(screen.getByText('L’évaluation finale est indisponible.')).toBeVisible();

    queryState.error = undefined;
    rerender(<StageAssessmentCard isStagePublished stageId="stage-1" />);
    expect(screen.getByText('L’évaluation finale est indisponible.')).toBeVisible();
  });

  it('tolère une grille hétérogène et des métadonnées optionnelles', () => {
    setAssessment({
      description: null,
      instructions:
        'Introduction sans titre.\r\n\r\n# Première partie\rTexte utile.',
      passingScore: null,
      rubric: [
        null,
        [],
        {},
        { criterion: 42 },
        { criterion: 'Sans exigences', requirements: 'invalide', weight: 'x' },
        {
          criterion: 'Exigences filtrées',
          requirements: ['Conserver', 4, null],
          weight: 25,
        },
      ],
      type: 'CUSTOM_FORMAT',
    });
    render(<StageAssessmentCard isStagePublished stageId="stage-1" />);

    expect(screen.getByText('Type : CUSTOM_FORMAT')).toBeVisible();
    expect(screen.queryByText(/Score de réussite/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Objectif' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Consignes' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Première partie' })).toBeVisible();
    expect(screen.getByText('Sans exigences')).toBeVisible();
    expect(screen.getByText('Exigences filtrées')).toBeVisible();
    expect(screen.getByText('Conserver')).toBeVisible();
    expect(screen.queryByText('4')).not.toBeInTheDocument();
    expect(screen.getByText('25 %')).toBeVisible();
  });

  it('masque les sections et la grille lorsqu’elles sont absentes', () => {
    setAssessment({ description: null, instructions: null, rubric: 'invalid' });
    render(<StageAssessmentCard isStagePublished stageId="stage-1" />);

    expect(screen.queryByRole('heading', { name: 'Objectif' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Grille d’évaluation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Commencer l’évaluation' })).toBeVisible();
  });

  it('crée un brouillon depuis une évaluation publiée', () => {
    setAssessment();
    render(<StageAssessmentCard isStagePublished stageId="stage-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Commencer l’évaluation' }));
    expect(mutationState.createDraft).toHaveBeenCalledOnce();
  });

  it('normalise les champs du brouillon avant sauvegarde et soumission', async () => {
    setAssessment({
      submission: makeSubmission('DRAFT', {
        attachmentUrl: ' https://example.com/preuve ',
        contentMarkdown: ' Réponse initiale ',
        reviewFeedback: 'Précisez la justification.',
      }),
    });
    mutationState.error = new Error('échec');
    render(<StageAssessmentCard isStagePublished stageId="stage-1" />);

    expect(screen.getByText('Retour : Précisez la justification.')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'L’action n’a pas pu être enregistrée.',
    );

    fireEvent.input(screen.getByLabelText('Votre réponse'), {
      target: { value: '   ' },
    });
    fireEvent.input(screen.getByLabelText('Lien vers une pièce jointe'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(mutationState.save).toHaveBeenLastCalledWith('submission-draft', {
      attachmentUrl: null,
      contentMarkdown: null,
    });

    fireEvent.input(screen.getByLabelText('Votre réponse'), {
      target: { value: '  Une réponse complète  ' },
    });
    fireEvent.input(screen.getByLabelText('Lien vers une pièce jointe'), {
      target: { value: '  https://example.com/finale  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre' }));

    await waitFor(() =>
      expect(mutationState.submit).toHaveBeenCalledWith('submission-draft'),
    );
    expect(mutationState.save).toHaveBeenLastCalledWith('submission-draft', {
      attachmentUrl: 'https://example.com/finale',
      contentMarkdown: 'Une réponse complète',
    });
  });

  it('permet de reprendre une soumission à réviser', () => {
    setAssessment({ submission: makeSubmission('NEEDS_REVISION') });
    render(<StageAssessmentCard isStagePublished stageId="stage-1" />);

    expect(screen.getByText('À réviser')).toBeVisible();
    expect(screen.getByLabelText('Votre réponse')).toBeEnabled();
  });

  it('affiche une soumission en attente sans formulaire éditable', () => {
    setAssessment({ submission: makeSubmission('SUBMITTED') });
    render(<StageAssessmentCard isStagePublished stageId="stage-1" />);

    expect(
      screen.getByText('Votre travail a été envoyé et attend une validation.'),
    ).toBeVisible();
    expect(screen.queryByLabelText('Votre réponse')).toBeNull();
  });

  it.each([
    { expected: 'Résultat : Validée', score: null },
    { expected: 'Résultat : 84 %', score: 84 },
  ])('affiche le résultat validé: $expected', ({ expected, score }) => {
    setAssessment({ submission: makeSubmission('VALIDATED', { score }) });
    render(<StageAssessmentCard isStagePublished stageId="stage-1" />);

    expect(screen.getByText(expected)).toBeVisible();
  });
});
