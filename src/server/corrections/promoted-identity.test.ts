import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DEFAULT_CHECKER_INSTRUCTIONS } from './correction-checker';
import {
  PROMOTED_CHECKER_IDENTITY,
  PROMOTED_CORRECTION_IDENTITY,
} from './promoted-identity';
import { RUNTIME_CORRECTION_PROMPT_VERSION } from './runtime-correction-prompt';

describe('épinglage des versions de prompt (V4.5-207)', () => {
  it('le prompt envoyé porte la version que l’identité promue déclare', () => {
    // Nothing connected these two before. A drift is silent: the runtime would
    // send one version while the identity claims another, and
    // `correction-orchestration.ts` filters cached quotes on the identity's
    // value — so the effect would be quotes quietly ceasing to match, not an
    // error. Changing one without the other now fails here instead.
    expect(RUNTIME_CORRECTION_PROMPT_VERSION).toBe(
      PROMOTED_CORRECTION_IDENTITY.promptVersion,
    );
  });

  it('ne confond pas la version de prompt avec celle du profil de requête', () => {
    // They read the same string today and version different things: what the
    // request says, and how it is routed and bounded. A reader who assumes they
    // move together will move the wrong one.
    expect(PROMOTED_CORRECTION_IDENTITY.promptVersion).not.toBe(
      PROMOTED_CORRECTION_IDENTITY.requestProtocolVersion,
    );
    expect(PROMOTED_CORRECTION_IDENTITY.requestProfile.version).toBeTypeOf(
      'string',
    );
  });

  it('le vérificateur déclare aussi la version de son prompt', () => {
    // It had none until V4.5-207: measured, trusted, and unattributable.
    expect(PROMOTED_CHECKER_IDENTITY.promptVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  /**
   * The wording each checker prompt version names.
   *
   * A version that does not move when the wording does leaves every verdict
   * misattributed — recorded as produced by a prompt that no longer exists.
   * V4.5-163 made the instructions replaceable so a probe can measure an
   * adversarial variant; the day one wins and is ported in, this is what
   * refuses to let it land silently under the old number.
   *
   * Add an entry, never edit one: the old hashes are the record of what each
   * version actually said.
   */
  const CHECKER_PROMPT_HASHES: Record<string, string> = {
    '1.0.0': 'ef84a3b83fe733cfed0071038a18463ae5f8d9e87e568ad6718dbcdeebe96564',
  };

  it('ne laisse pas changer la consigne sans changer sa version', () => {
    const digest = createHash('sha256')
      .update(DEFAULT_CHECKER_INSTRUCTIONS.join('\n'), 'utf8')
      .digest('hex');

    expect(digest).toBe(
      CHECKER_PROMPT_HASHES[PROMOTED_CHECKER_IDENTITY.promptVersion],
    );
  });
});
