import {
  importBoundaryFailures,
  type ImportBoundaryConfiguration,
} from '@/lib/v4-1-import-boundaries';

const configuration: ImportBoundaryConfiguration = {
  rules: [
    {
      disallow: '^src/server/',
      from: '^src/features/',
      message: 'Features cannot import server code.',
    },
  ],
  schemaVersion: 1,
};

describe('V4.1 import boundaries', () => {
  it('allows imports that stay outside the forbidden boundary', () => {
    expect(
      importBoundaryFailures(configuration, [
        { from: 'src/features/auth/session.ts', to: 'src/lib/session.ts' },
      ]),
    ).toEqual([]);
  });

  it('reports a forbidden project edge with its policy message', () => {
    expect(
      importBoundaryFailures(configuration, [
        {
          from: 'src/features/auth/session.ts',
          to: 'src/server/api/_lib/session.ts',
        },
      ]),
    ).toEqual([
      'src/features/auth/session.ts -> src/server/api/_lib/session.ts: Features cannot import server code.',
    ]);
  });

  it('fails closed on an invalid rule', () => {
    expect(
      importBoundaryFailures(
        {
          rules: [{ disallow: '[', from: '^src/', message: 'Broken rule.' }],
          schemaVersion: 1,
        },
        [],
      ),
    ).toEqual(['Invalid import-boundary rule: Broken rule.']);
  });
});
