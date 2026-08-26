import ts from 'typescript';

import { findModuleSpecifiers } from '@/server/quality/import-analysis';

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile(
    'fixture.ts',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
}

describe('V4.1 import graph analysis', () => {
  it('finds static imports, re-exports and import-equals declarations', () => {
    const source = parse(`
      import value from '@/lib/value';
      export { other } from './other';
      import legacy = require('./legacy');
    `);

    expect(findModuleSpecifiers(source).sort()).toEqual([
      './legacy',
      './other',
      '@/lib/value',
    ]);
  });

  it('finds nested dynamic imports and literal require calls', () => {
    const source = parse(`
      async function load() {
        const module = await import('@/server/secret');
        return require('./fallback') ?? module;
      }
    `);

    expect(findModuleSpecifiers(source).sort()).toEqual([
      './fallback',
      '@/server/secret',
    ]);
  });

  it('ignores computed module specifiers that cannot form a static edge', () => {
    const source = parse(`
      const path = './module';
      void import(path);
      void require(path);
    `);

    expect(findModuleSpecifiers(source)).toEqual([]);
  });
});
