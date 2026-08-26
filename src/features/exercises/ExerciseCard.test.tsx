import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { ExerciseCard } from '@/features/exercises/ExerciseCard';

const exerciseId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const submissionId = '97476e0e-2103-40c0-8185-f7601a8d2fd2';
const exercise = {
  aiCorrectionEligible: false,
  id: exerciseId,
  instructions: 'Rédigez une analyse structurée en Markdown.',
  isRequired: true,
  key: 'analyse-appliquee',
  position: 1,
  rubric: null,
  title: 'Analyse appliquée',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function submission(contentMarkdown: string, status: 'DRAFT' | 'SUBMITTED') {
  return {
    contentMarkdown,
    createdAt: '2026-08-03T08:00:00.000Z',
    exerciseId,
    id: submissionId,
    status,
    submittedAt: status === 'SUBMITTED' ? '2026-08-03T09:00:00.000Z' : null,
    updatedAt: '2026-08-03T09:00:00.000Z',
    userId: '7c777cf7-8f6b-421c-88f4-d17c8d530e93',
  };
}

function exerciseResponse(
  currentSubmission: ReturnType<typeof submission> | null,
) {
  return {
    exercise: {
      ...exercise,
      lessonId: '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8',
      submission: currentSubmission,
    },
  };
}

describe('ExerciseCard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('crée, sauvegarde puis soumet un brouillon Markdown', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === `/api/exercises/${exerciseId}`) {
        return Promise.resolve(jsonResponse(exerciseResponse(null)));
      }
      if (path === `/api/exercises/${exerciseId}/submissions`) {
        return Promise.resolve(
          jsonResponse({ submission: submission('', 'DRAFT') }, 201),
        );
      }
      if (path.endsWith('/submit')) {
        return Promise.resolve(
          jsonResponse({
            submission: submission('## Analyse\n\nRéponse.', 'SUBMITTED'),
          }),
        );
      }

      expect(init).toMatchObject({ method: 'PATCH' });
      return Promise.resolve(
        jsonResponse({
          submission: submission('## Analyse\n\nRéponse.', 'DRAFT'),
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ExerciseCard exercise={exercise} isLessonPublished />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Commencer l’exercice' }),
    );
    const editor = await screen.findByLabelText('Votre réponse en Markdown');
    fireEvent.input(editor, {
      target: { value: '## Analyse\n\nRéponse.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/exercise-submissions/${submissionId}`,
        expect.objectContaining({
          body: JSON.stringify({
            contentMarkdown: '## Analyse\n\nRéponse.',
          }),
          method: 'PATCH',
        }),
      ),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Soumettre l’exercice' }),
    );
    expect(await screen.findByText('Soumis')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/exercise-submissions/${submissionId}/submit`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('restaure un brouillon enregistré après chargement', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            exerciseResponse(submission('# Brouillon restauré', 'DRAFT')),
          ),
        ),
      ),
    );

    render(
      <AppProviders>
        <ExerciseCard exercise={exercise} isLessonPublished />
      </AppProviders>,
    );

    expect(
      await screen.findByDisplayValue('# Brouillon restauré'),
    ).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
  });

  it('annonce la limite de correction et bloque un ancien brouillon trop long', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            exerciseResponse(submission('x'.repeat(1_501), 'DRAFT')),
          ),
        ),
      ),
    );

    render(
      <AppProviders>
        <ExerciseCard exercise={exercise} isLessonPublished />
      </AppProviders>,
    );

    const editor = await screen.findByLabelText('Votre réponse en Markdown');
    expect(editor).toHaveAttribute('maxlength', '1500');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '1 501 / 1 500 caractères',
    );
    expect(
      screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Soumettre l’exercice' }),
    ).toBeDisabled();
  });

  it('autorise une réponse exactement à la limite sans masquer le compteur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            exerciseResponse(submission('x'.repeat(1_500), 'DRAFT')),
          ),
        ),
      ),
    );

    render(
      <AppProviders>
        <ExerciseCard exercise={exercise} isLessonPublished />
      </AppProviders>,
    );

    const editor = await screen.findByLabelText('Votre réponse en Markdown');
    expect(editor).toHaveAttribute('maxlength', '1500');
    expect(screen.getByText(/1 500 \/ 1 500 caractères/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Soumettre l’exercice' }),
    ).toBeEnabled();
  });

  it('propose la correction assistée uniquement sur une production éligible soumise', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            exercise: {
              ...exerciseResponse(submission('Réponse finale', 'SUBMITTED'))
                .exercise,
              aiCorrectionEligible: true,
            },
          }),
        ),
      ),
    );

    render(
      <AppProviders>
        <ExerciseCard exercise={exercise} isLessonPublished />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('button', { name: 'Corriger' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Correction assistée par IA')).toBeInTheDocument();
  });

  it('maintient une leçon brouillon en lecture seule sans appel API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ExerciseCard exercise={exercise} isLessonPublished={false} />
      </AppProviders>,
    );

    expect(
      screen.getByText(/Prévisualisation en lecture seule/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
