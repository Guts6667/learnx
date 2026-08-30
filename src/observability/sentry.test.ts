import { internals, reportReactError, startErrorReporting } from './sentry';

const DSN = 'https://public@o1.ingest.de.sentry.io/2';

beforeEach(() => {
  internals.reset();
});

describe('startErrorReporting', () => {
  it('ne s’installe pas et ne charge rien sans DSN', () => {
    // The absent DSN is the off switch, and it is what development uses.
    startErrorReporting(undefined);

    window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));

    expect(internals.buffered).toHaveLength(0);
  });

  it('retient une erreur survenue avant l’arrivée du SDK', () => {
    // The whole point of loading late: the startup window is still covered.
    startErrorReporting(DSN);

    const error = new Error('boom');
    window.dispatchEvent(new ErrorEvent('error', { error }));

    expect(internals.buffered).toEqual([
      { componentStack: undefined, error, source: 'window.error' },
    ]);
  });

  it('retient aussi une promesse rejetée', () => {
    startErrorReporting(DSN);

    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: 'nope' }),
    );

    expect(internals.buffered).toEqual([
      {
        componentStack: undefined,
        error: 'nope',
        source: 'unhandledrejection',
      },
    ]);
  });

  it('borne la file, en gardant les premières erreurs', () => {
    // Dropping the oldest would lose the first failure, which is usually the
    // one that explains the rest.
    startErrorReporting(DSN);

    for (let index = 0; index < 25; index += 1) {
      window.dispatchEvent(
        new ErrorEvent('error', { error: new Error(`boom ${index}`) }),
      );
    }

    expect(internals.buffered).toHaveLength(20);
    expect((internals.buffered[0].error as Error).message).toBe('boom 0');
  });

  it('n’installe qu’une fois', () => {
    startErrorReporting(DSN);
    startErrorReporting(DSN);

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('boom') }));

    // Two registrations would record the same failure twice.
    expect(internals.buffered).toHaveLength(1);
  });
});

describe('reportReactError', () => {
  it('garde la pile de composants que React fournit', () => {
    startErrorReporting(DSN);

    const error = new Error('render failed');
    reportReactError(error, { componentStack: '\n    at LessonPage' });

    expect(internals.buffered).toEqual([
      {
        componentStack: '\n    at LessonPage',
        error,
        source: 'react',
      },
    ]);
  });
});
