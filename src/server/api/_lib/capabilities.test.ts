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

  it('reserves AI capability names without granting them to a role', () => {
    expect(CAPABILITIES).toContain('ai.assessment.correct');
    expect(CAPABILITIES).toContain('ai.program.generate');

    for (const role of [Role.USER, Role.CREATOR, Role.ADMIN]) {
      expect(hasCapability(role, 'ai.assessment.correct')).toBe(false);
      expect(hasCapability(role, 'ai.program.generate')).toBe(false);
    }
  });

  it('denies every capability to an unknown future role by default', () => {
    expect(hasCapability('VALIDATOR', 'learning.read')).toBe(false);
    expect(hasCapability('VALIDATOR', 'program.admin.read')).toBe(false);
  });
});
