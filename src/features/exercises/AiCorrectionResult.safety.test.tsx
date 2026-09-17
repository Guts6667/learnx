import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { AiCorrectionResult } from './AiCorrectionResult';
import type { CorrectionHistoryEntry } from './ai-correction';

function entry(
  level: string,
  confidence: 'HIGH' | 'LOW',
): CorrectionHistoryEntry {
  return {
    action: 'RECONSIDERATION',
    createdAt: '2026-09-01T12:00:00Z',
    replay: true,
    settlement: {
      releasedCredits: '0',
      reservedCredits: '12',
      settledCredits: '12',
    },
    correction: {
      id: level,
      status: 'COMPLETED',
      overallConfidence: confidence,
      indicativeScore: 99,
      overallFeedback: 'UNVERIFIED_GLOBAL_ADVICE',
      unsureCriteria: [],
      criteria: [
        {
          confidence,
          evidenceQuotes: ['Verified quote'],
          evidenceStatus: 'FOUND',
          feedback: 'UNVERIFIED_CRITERION_ADVICE',
          key: 'c',
          label: 'Criterion',
          levelKey: level,
          levelLabel: level,
          weight: 100,
        },
      ],
    },
  };
}

it.each([
  ['LOW', 'LOW'],
  ['HIGH', 'LOW'],
  ['LOW', 'HIGH'],
] as const)(
  'never compares withheld levels across %s → %s',
  (previous, current) => {
    render(
      <I18nProvider>
        <AiCorrectionResult
          history={[
            entry('PRIVATE_PREVIOUS_LEVEL', previous),
            entry('PRIVATE_CURRENT_LEVEL', current),
          ]}
          selectedIndex={1}
          reconsiderationArgument=""
          onReconsiderationArgumentChange={() => {}}
          onRequestReconsideration={() => {}}
          onSelectCorrection={() => {}}
        />
      </I18nProvider>,
    );
    expect(
      screen.queryByText(/PRIVATE_PREVIOUS_LEVEL/),
    ).not.toBeInTheDocument();
    if (current === 'LOW') {
      expect(
        screen.queryByText(/PRIVATE_CURRENT_LEVEL/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('UNVERIFIED_GLOBAL_ADVICE'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('UNVERIFIED_CRITERION_ADVICE'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/99/)).not.toBeInTheDocument();
      expect(screen.getByText('Verified quote')).toBeInTheDocument();
    }
  },
);

it.each(['LOW', undefined] as const)(
  'withholds global claims for overall confidence %s despite confident criteria',
  (confidence) => {
    const current = entry('mastered', 'HIGH');
    // Legacy JSON can lack a field required by the current API type.
    const result = {
      ...current,
      correction: { ...current.correction, overallConfidence: confidence },
    } as unknown as CorrectionHistoryEntry;
    render(
      <I18nProvider>
        <AiCorrectionResult
          history={[result]}
          selectedIndex={0}
          reconsiderationArgument=""
          onReconsiderationArgumentChange={() => {}}
          onRequestReconsideration={() => {}}
          onSelectCorrection={() => {}}
        />
      </I18nProvider>,
    );
    expect(
      screen.queryByText('UNVERIFIED_GLOBAL_ADVICE'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/99/)).not.toBeInTheDocument();
  },
);
