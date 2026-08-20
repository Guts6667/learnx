import { fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import type { ExerciseSubmission } from '@/features/exercises/queries';
import { FormativeCorrectionPanel } from './FormativeCorrectionPanel';

const submission: ExerciseSubmission = {
  contentMarkdown: 'Je recommande un go conditionnel limité à un pilote.',
  createdAt: '2026-08-20T10:00:00.000Z',
  exerciseId: '33333333-3333-4333-8333-333333333333',
  id: '22222222-2222-4222-8222-222222222222',
  status: 'SUBMITTED',
  submittedAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
  userId: '11111111-1111-4111-8111-111111111111',
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function correction() {
  return {
    attemptCount: 1,
    certificate: {
      authority: 'LEARNX_SERVER_VALIDATED_CANDIDATES',
      billingEffect: 'NONE',
      certificateVersion: 1,
      feedback: [
        {
          criterionKey: 'decision-position',
          criterionLabel: 'Décision proposée',
          elementKey: 'decision-mode-stated',
          evidenceSpans: [
            {
              end: 57,
              sha256: 'a'.repeat(64),
              spanId: 's0001-aaaaaaaaaaaaaaaa',
              start: 0,
              text: submission.contentMarkdown,
            },
          ],
          kind: 'OBSERVED_STRENGTH',
          message: "L'orientation de décision est identifiable.",
          relation: 'EVIDENCE_FOR_ELEMENT',
        },
      ],
      indicativeScore: null,
      level: null,
      masteryEffect: 'NONE',
      operationFingerprint: 'b'.repeat(64),
      pipelineFingerprint: 'c'.repeat(64),
      progressionEffect: 'NONE',
      protocolFingerprint: 'd'.repeat(64),
      responseSha256: 'e'.repeat(64),
      rubricFingerprint: 'f'.repeat(64),
      state: 'FEEDBACK_READY',
    },
    createdAt: '2026-08-20T10:01:00.000Z',
    id: '44444444-4444-4444-8444-444444444444',
    responseSha256: 'e'.repeat(64),
    responseText: submission.contentMarkdown,
    simulation: {
      acceptedCeilingCredits: null,
      billingEffect: 'NONE',
      mode: 'OFFLINE_SIMULATION',
      reservationStatus: 'SIMULATED',
      settledCredits: null,
    },
    state: 'FEEDBACK_READY',
    submissionId: submission.id,
    updatedAt: '2026-08-20T10:01:00.000Z',
    version: 1,
  };
}

describe('FormativeCorrectionPanel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the surface absent while the server feature flag is off', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            flow: { corrections: [], enabled: false, simulation: null },
          }),
        ),
      ),
    );
    render(
      <AppProviders>
        <FormativeCorrectionPanel submission={submission} />
      </AppProviders>,
    );

    await screen.findByText((_, element) => element?.tagName === 'BODY');
    expect(screen.queryByText('Retour formatif')).not.toBeInTheDocument();
  });

  it('announces the no-debit simulation before confirmation and renders exact response excerpts', async () => {
    const fetchMock = vi.fn((_path: string, options?: RequestInit) => {
      if (!options?.method) {
        return Promise.resolve(
          jsonResponse({
            flow: {
              corrections: [],
              enabled: true,
              simulation: correction().simulation,
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ correction: correction() }));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AppProviders>
        <FormativeCorrectionPanel submission={submission} />
      </AppProviders>,
    );

    expect(await screen.findByText('Simulation hors ligne')).toBeInTheDocument();
    expect(screen.getByText(/Aucun crédit ne sera réservé ni débité/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Demander la correction simulée' }),
    );

    expect(await screen.findByText('Retour prêt')).toBeInTheDocument();
    expect(screen.getByText('Extrait de votre réponse')).toBeInTheDocument();
    expect(screen.getByText(submission.contentMarkdown)).toBeInTheDocument();
    expect(screen.getByText('Aucun crédit débité')).toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Score :/i)).not.toBeInTheDocument();
  });

  it('explains preservation, non-debit and a safe action after a reload error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    render(
      <AppProviders>
        <FormativeCorrectionPanel submission={submission} />
      </AppProviders>,
    );

    expect(await screen.findByText('Retour indisponible')).toBeInTheDocument();
    expect(screen.getByText(/Votre réponse reste conservée/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});
