import { describe, expect, it, vi } from 'vitest';

import {
  describeUnexpectedError,
  normalizeLoggedPath,
  reportUnexpectedError,
} from './error-reporting';

const context = {
  method: 'POST',
  path: '/api/exercises/:id/attempts',
  requestId: '8f1d2c3b-4a5e-4b6c-8d7e-9f0a1b2c3d4e',
};

describe('unexpected error reporting', () => {
  it('records the name, message and stack of a real error', () => {
    const error = new TypeError('cannot read properties of undefined');

    const event = describeUnexpectedError(error, context);

    expect(event).toMatchObject({
      event: 'api_unexpected_error',
      message: 'cannot read properties of undefined',
      name: 'TypeError',
      requestId: context.requestId,
    });
    expect(event.stack).toContain('TypeError');
  });

  it('survives something thrown that is not an Error', () => {
    const event = describeUnexpectedError('a string', context);

    expect(event).toMatchObject({ message: 'a string', name: 'string' });
    expect(event.stack).toBeNull();
  });

  it('collapses record identifiers out of the logged path', () => {
    expect(
      normalizeLoggedPath(
        'https://learn-x.app/api/notes/8f1d2c3b-4a5e-4b6c-8d7e-9f0a1b2c3d4e',
      ),
    ).toBe('/api/notes/:id');
  });

  it('writes the request identifier so a report leads to the failure', () => {
    const write = vi.fn();

    reportUnexpectedError(new Error('boom'), context, write);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0].requestId).toBe(context.requestId);
  });

  // The whole point of the shape: an error report is where "just a bit of
  // context" turns into a password in a log.
  it('carries nothing from the request beyond method and normalised path', () => {
    const event = describeUnexpectedError(new Error('boom'), context);

    expect(Object.keys(event).sort()).toEqual([
      'event',
      'message',
      'method',
      'name',
      'path',
      'requestId',
      'stack',
    ]);
  });
});
