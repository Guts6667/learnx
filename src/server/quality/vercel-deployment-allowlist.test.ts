import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `vercel.json` decides which branches may *create* a deployment at all
 * (V4.5-185). That is a different layer from the deploy marker, which decides
 * whether an already-created deployment *builds* — see
 * `scripts/vercel-ignore-build.sh`. The daily quota counts creations, including
 * the ones the marker rule cancels a second later, so only this layer protects
 * it.
 *
 * These assertions exist because the rule is one character away from being
 * silently inert. Vercel resolves the keys with minimatch, where `*` does not
 * cross a `/`. Every working branch here is named `codex/…`, `feat/…`,
 * `docs/…` or `fix/…`, so under `"*": false` they match no rule at all and fall
 * back to the documented default, which is `true`. The file would read as a
 * block list and deploy precisely the branches it was written to stop.
 * Measured against minimatch 10.2.6 before this was written.
 */

const config: {
  git?: { deploymentEnabled?: Record<string, boolean> | boolean };
} = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));

/** The three branches that are actually served, and so may deploy. */
const SERVED = ['dev', 'main', 'staging'];

describe('vercel.json git.deploymentEnabled', () => {
  const rules = config.git?.deploymentEnabled;

  it('est une table de motifs, pas un booléen', () => {
    // A bare `false` would stop production deploying too.
    expect(typeof rules).toBe('object');
  });

  it('barre tout par défaut avec `**`, qui traverse les `/`', () => {
    expect(rules).toMatchObject({ '**': false });
  });

  it('n\u2019utilise pas `*`, qui ne traverse pas les `/`', () => {
    expect(Object.keys(rules as object)).not.toContain('*');
  });

  it('laisse passer les trois branches servies, et elles seules', () => {
    const allowed = Object.entries(rules as Record<string, boolean>)
      .filter(([, enabled]) => enabled)
      .map(([pattern]) => pattern)
      .sort();

    expect(allowed).toEqual([...SERVED].sort());
  });
});
