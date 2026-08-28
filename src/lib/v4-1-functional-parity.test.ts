import { execFileSync } from 'node:child_process';
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

function extractDeclaredRoutes(routerSource: string): string[] {
  return [
    ...new Set(
      [...routerSource.matchAll(/\bpath="([^"]+)"/g)].map(([, route]) => route),
    ),
  ].sort();
}

function readReleaseRouterSource(releaseSha: string): string {
  return execFileSync('git', ['show', `${releaseSha}:src/app/routes.tsx`], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('V4.1 functional parity contract', () => {
  it('keeps the manifest, V4 release and candidate routes in exact bilateral parity', () => {
    const manifest = readManifest();
    const candidateRouterSource = readFileSync(
      resolve(process.cwd(), 'src/app/routes.tsx'),
      'utf8',
    );

    expect(manifest.releaseSha).toBe(
      'a02ecc3f307af36656fa5cb8a7b62954fdec73e9',
    );
    expect(new Set(manifest.routes).size).toBe(manifest.routes.length);

    const releaseRoutes = extractDeclaredRoutes(
      readReleaseRouterSource(manifest.releaseSha),
    );
    const manifestRoutes = [...manifest.routes].sort();
    const candidateRoutes = extractDeclaredRoutes(candidateRouterSource);

    expect(manifestRoutes).toEqual(releaseRoutes);
    expect(candidateRoutes).toEqual([...releaseRoutes, '*'].sort());
  });
});
