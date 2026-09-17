import { describe, expect, it } from 'vitest';

import {
  ADJUDICATION_SEGMENTER_VERSION,
  envelopeFor,
  segmentForAdjudication,
  verifierInputFor,
} from './ai-correction-adjudication-text.ts';

const TEXT =
  'Je recommande le pilote étendu. Le délai médian passe de 18 à 13 heures. ' +
  'Un incident a eu lieu faute de formation. La formation est donc requise.';

describe('segmentForAdjudication', () => {
  it('gives every sentence a positional id and its own hash', () => {
    const segmentation = segmentForAdjudication(TEXT);
    expect(segmentation.segmenterVersion).toBe(ADJUDICATION_SEGMENTER_VERSION);
    expect(segmentation.sentences.map((s) => s.id)).toEqual([
      's0',
      's1',
      's2',
      's3',
    ]);
    expect(new Set(segmentation.sentences.map((s) => s.sha)).size).toBe(4);
  });

  it('is stable: the same text gives the same offsets and hashes', () => {
    expect(segmentForAdjudication(TEXT)).toEqual(segmentForAdjudication(TEXT));
  });
});

describe('envelopeFor', () => {
  const segmentation = segmentForAdjudication(TEXT);

  it('grows a fragment to the whole sentence containing it', () => {
    const envelope = envelopeFor({
      fragment: 'de 18 à 13 heures',
      segmentation,
      text: TEXT,
    });
    expect(envelope?.text).toBe('Le délai médian passe de 18 à 13 heures.');
    expect(envelope?.sentenceIds).toEqual(['s1']);
  });

  it('covers every sentence a straddling fragment touches', () => {
    const envelope = envelopeFor({
      fragment: '13 heures. Un incident',
      segmentation,
      text: TEXT,
    });
    expect(envelope?.sentenceIds).toEqual(['s1', 's2']);
  });

  it('returns null rather than an envelope for absent text', () => {
    expect(
      envelopeFor({ fragment: 'jamais écrit', segmentation, text: TEXT }),
    ).toBeNull();
  });
});

describe('verifierInputFor', () => {
  const segmentation = segmentForAdjudication(TEXT);
  const base = {
    fragment: 'de 18 à 13 heures',
    responseText: TEXT,
    segmentation,
  };

  it('sends the sentence envelope on a local stratum', () => {
    const input = verifierInputFor({ ...base, stratum: 'S1_span_local' });
    expect(input?.kind).toBe('ENVELOPE');
    expect(input?.text).toBe('Le délai médian passe de 18 à 13 heures.');
  });

  it('sends the bound tuple on a multi stratum', () => {
    const input = verifierInputFor({
      ...base,
      roleSentenceIds: ['s0', 's3'],
      stratum: 'S4_multi_local',
    });
    expect(input?.kind).toBe('TUPLE');
    expect(input?.sentenceIds).toEqual(['s0', 's3']);
    expect(input?.text).toBe(
      'Je recommande le pilote étendu. La formation est donc requise.',
    );
  });

  it('refuses a multi stratum with no bound sentences', () => {
    expect(verifierInputFor({ ...base, stratum: 'S4_multi_local' })).toBeNull();
  });

  it('refuses a binding naming a sentence that does not exist', () => {
    expect(
      verifierInputFor({
        ...base,
        roleSentenceIds: ['s0', 's9'],
        stratum: 'S4_multi_local',
      }),
    ).toBeNull();
  });

  it('sends the whole response on S7', () => {
    const input = verifierInputFor({ ...base, stratum: 'S7_full_dossier' });
    expect(input?.kind).toBe('FULL_RESPONSE');
    expect(input?.text).toBe(TEXT);
  });

  it('refuses a segmentation that does not belong to the text', () => {
    expect(
      verifierInputFor({
        ...base,
        responseText: `${TEXT} Une phrase de plus.`,
        stratum: 'S1_span_local',
      }),
    ).toBeNull();
  });

  it('refuses an unknown stratum instead of falling back', () => {
    expect(verifierInputFor({ ...base, stratum: 'S9_inconnu' })).toBeNull();
  });
});
