import { describe, expect, it } from 'vitest';

import type { CorrectionContract } from '@/lib/ai-correction-contracts';

import { buildRuntimeCorrectionMessages } from './runtime-correction-prompt';

const contract = {
  criteria: [],
} as unknown as CorrectionContract;

describe('runtime correction prompt reconsideration', () => {
  it('keeps the original answer as the only evidence authority', () => {
    const messages = buildRuntimeCorrectionMessages({
      contract,
      exerciseInstructions: 'Justifiez votre choix.',
      reconsideration: {
        argument: 'Le niveau précédent est trop bas selon cette phrase.',
        previousCorrection: { level: 'partial' },
      },
      submissionText: 'Je retiens PICO car la population est définie.',
    });

    expect(messages[0]?.content).toContain(
      'ils ne constituent jamais une preuve',
    );
    expect(messages[0]?.content).toContain(
      'LearnX reconsideration extension 1.0.0.',
    );
    expect(messages[0]?.content).toContain(
      'Évalue de nouveau tous les critères',
    );
    expect(messages[1]?.content).toContain(
      '<learner-response>\nJe retiens PICO car la population est définie.\n</learner-response>',
    );
    expect(messages[1]?.content).toContain(
      '<learner-contestation>\nLe niveau précédent est trop bas selon cette phrase.\n</learner-contestation>',
    );
  });
});
