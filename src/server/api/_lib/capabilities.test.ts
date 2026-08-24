import { Role } from '../../../../generated/prisma/client';

import { CAPABILITIES, hasCapability } from './capabilities';

describe('centralized role capabilities', () => {
  it.each([Role.USER, Role.CREATOR])(
    'grants only learner capabilities to %s',
    (role) => {
      expect(hasCapability(role, 'learning.read')).toBe(true);
      expect(hasCapability(role, 'learning.write.own')).toBe(true);
      expect(hasCapability(role, 'program.admin.read')).toBe(false);
      expect(hasCapability(role, 'program.admin.edit')).toBe(false);
      expect(hasCapability(role, 'program.admin.publish')).toBe(false);
      expect(hasCapability(role, 'account.role.assign')).toBe(false);
    },
  );

  it('grants current administrative capabilities to ADMIN', () => {
    expect(hasCapability(Role.ADMIN, 'program.admin.read')).toBe(true);
    expect(hasCapability(Role.ADMIN, 'program.admin.edit')).toBe(true);
    expect(hasCapability(Role.ADMIN, 'program.admin.publish')).toBe(true);
    expect(hasCapability(Role.ADMIN, 'learning.submission.review')).toBe(true);
  });

  it('grants AI correction to learners (V4-009/010) and reserves generation for V5', () => {
    expect(CAPABILITIES).toContain('ai.assessment.correct');
    expect(CAPABILITIES).toContain('ai.program.generate');

    // V4-009/010 : la correction assistée est une capacité apprenante.
    expect(hasCapability(Role.USER, 'ai.assessment.correct')).toBe(true);
    expect(hasCapability(Role.CREATOR, 'ai.assessment.correct')).toBe(true);
    expect(hasCapability(Role.ADMIN, 'ai.assessment.correct')).toBe(true);

    // La génération de parcours reste réservée à V5.
    for (const role of [Role.USER, Role.CREATOR, Role.ADMIN]) {
      expect(hasCapability(role, 'ai.program.generate')).toBe(false);
    }
  });

  it('denies every capability to an unknown future role by default', () => {
    expect(hasCapability('VALIDATOR', 'learning.read')).toBe(false);
    expect(hasCapability('VALIDATOR', 'program.admin.read')).toBe(false);
  });
});
