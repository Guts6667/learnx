import { AiProviderError } from '../ai/structured-provider';
import { resolveCorrectionTransportMode } from './correction-transport-mode';

describe('resolveCorrectionTransportMode', () => {
  it('choisit le transport réel quand la variable est absente', () => {
    expect(resolveCorrectionTransportMode({})).toBe('REAL');
  });

  it.each([['real'], ['FAKE'], ['fake '], ['1'], ['true']])(
    'ne retient le faux transport que sur la valeur exacte « fake » (%s)',
    (value) => {
      // Anything but the exact token means the real transport. A typo must
      // never be the thing that decides whether learners get real corrections.
      expect(
        resolveCorrectionTransportMode({ LEARNX_AI_TRANSPORT: value }),
      ).toBe(value.trim() === 'fake' ? 'FAKE' : 'REAL');
    },
  );

  it('accepte le faux transport hors production', () => {
    expect(
      resolveCorrectionTransportMode({
        LEARNX_AI_CONFIG_ENVIRONMENT: 'preview',
        LEARNX_AI_TRANSPORT: 'fake',
        NODE_ENV: 'test',
      }),
    ).toBe('FAKE');
  });

  it('refuse au démarrage quand la configuration IA est celle de production', () => {
    // A preview build carrying the production AI configuration is production
    // for the provider, the credits and the learner data.
    expect(() =>
      resolveCorrectionTransportMode({
        LEARNX_AI_CONFIG_ENVIRONMENT: 'production',
        LEARNX_AI_TRANSPORT: 'fake',
        NODE_ENV: 'development',
      }),
    ).toThrow(AiProviderError);
  });

  it('refuse au démarrage quand le processus tourne en production', () => {
    expect(() =>
      resolveCorrectionTransportMode({
        LEARNX_AI_CONFIG_ENVIRONMENT: 'preview',
        LEARNX_AI_TRANSPORT: 'fake',
        NODE_ENV: 'production',
      }),
    ).toThrow(AiProviderError);
  });
});
