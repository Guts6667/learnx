import { createHash } from 'node:crypto';

/**
 * Dev-server port for a Playwright suite, derived from the checkout it runs in.
 *
 * Every suite used to bind a fixed port and set `reuseExistingServer: !CI`. With
 * several worktrees on one machine, a `pnpm dev` left running in another
 * checkout answered on that port first, so a run silently tested a different
 * build than the one under review — green or red for reasons no diff explains.
 * Deriving the port from the working directory gives each checkout its own, so a
 * stale server elsewhere is simply not listening where this run looks.
 *
 * Reuse inside one checkout is deliberately kept: it is the fast inner loop, and
 * a server started from this working directory serves this working directory.
 *
 * CI is unaffected. There is one checkout per runner, the fixed port is the
 * contract the workflows document, and `CI` short-circuits before any hashing.
 */

/** Band width. Collision across two checkouts is one draw in this many. */
const BAND_SPAN = 900;

export function devServerPort(ciPort: number, bandStart: number): number {
  if (process.env.CI) return ciPort;

  // Escape hatch for a fixed port: debugging a proxy, or attaching a browser.
  const override = Number(process.env.LEARNX_PLAYWRIGHT_PORT);
  if (Number.isInteger(override) && override >= 1024 && override <= 65535) {
    return override;
  }

  const digest = createHash('sha256').update(process.cwd()).digest();
  return bandStart + (digest.readUInt16BE(0) % BAND_SPAN);
}
