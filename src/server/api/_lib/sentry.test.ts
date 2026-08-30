import type { UnexpectedErrorEvent } from './error-reporting';
import { captureUnexpectedError, internals, scrubRequestData } from './sentry';

const { captureException, flush, init } = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
  init: vi.fn(),
}));

vi.mock('@sentry/node', () => ({ captureException, flush, init }));

const event: UnexpectedErrorEvent = {
  event: 'api_unexpected_error',
  message: 'boom',
  method: 'POST',
  name: 'Error',
  path: '/api/notes/:id',
  requestId: 'abc',
  stack: 'Error: boom',
};

const DSN = 'https://public@o1.ingest.de.sentry.io/2';

beforeEach(() => {
  internals.reset();
  captureException.mockClear();
  flush.mockClear();
  init.mockClear();
});

describe('scrubRequestData', () => {
  it('retire ce que le SDK attacherait de la requête', () => {
    // `sendDefaultPii: false` withholds cookies, headers and body, but not the
    // URL — and our URLs carry record identifiers.
    expect(
      scrubRequestData({
        message: 'boom',
        request: { url: 'https://learnx.app/api/notes/8f3c-real-id' },
        user: { id: 'user_1' },
      }),
    ).toEqual({ message: 'boom' });
  });
});

describe('captureUnexpectedError', () => {
  it('ne fait rien, et ne charge rien, sans DSN', async () => {
    // The absent DSN is the off switch: no import, no init, no network.
    await expect(
      captureUnexpectedError(new Error('boom'), event, undefined),
    ).resolves.toBe(false);

    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('envoie l’erreur, corrélée par requestId, et vide la file', async () => {
    const error = new Error('boom');

    await expect(captureUnexpectedError(error, event, DSN)).resolves.toBe(true);

    expect(captureException).toHaveBeenCalledWith(error, {
      extra: { requestId: 'abc' },
      tags: { method: 'POST', path: '/api/notes/:id' },
    });
    // A serverless invocation freezes on answering; an unflushed event is lost.
    expect(flush).toHaveBeenCalledWith(2_000);
  });

  it('n’initialise qu’une fois sur plusieurs erreurs', async () => {
    await captureUnexpectedError(new Error('a'), event, DSN);
    await captureUnexpectedError(new Error('b'), event, DSN);

    expect(init).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('n’envoie ni requête ni utilisateur, via beforeSend', async () => {
    await captureUnexpectedError(new Error('boom'), event, DSN);

    const options = init.mock.calls[0][0] as {
      beforeSend: (event: Record<string, unknown>) => unknown;
      sendDefaultPii: boolean;
      tracesSampleRate: number;
    };

    expect(options.sendDefaultPii).toBe(false);
    // Errors only. Tracing is a separate decision with a separate cost.
    expect(options.tracesSampleRate).toBe(0);
    expect(options.beforeSend({ message: 'x', request: { url: 'u' } })).toEqual(
      {
        message: 'x',
      },
    );
  });

  it('ne devient jamais une seconde panne quand le report échoue', async () => {
    // Reporting a failure must not fail the response that was already failing.
    captureException.mockImplementationOnce(() => {
      throw new Error('sentry is down');
    });

    await expect(
      captureUnexpectedError(new Error('boom'), event, DSN),
    ).resolves.toBe(false);
  });
});
