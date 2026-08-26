import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type FunctionalParityManifest = {
  releaseSha: string;
  routes: string[];
  version: number;
};

function readManifest(): FunctionalParityManifest {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'quality/v4-1-functional-parity.json'),
      'utf8',
    ),
  ) as FunctionalParityManifest;
}

describe('V4.1 functional parity contract', () => {
  it('preserves every public and authenticated V4 route', () => {
    const manifest = readManifest();
    const routerSource = readFileSync(
      resolve(process.cwd(), 'src/app/routes.tsx'),
      'utf8',
    );

    expect(manifest.releaseSha).toBe(
      'a02ecc3f307af36656fa5cb8a7b62954fdec73e9',
    );
    expect(new Set(manifest.routes).size).toBe(manifest.routes.length);

    for (const route of manifest.routes) {
      expect(routerSource).toContain(`path="${route}"`);
    }
  });
});
