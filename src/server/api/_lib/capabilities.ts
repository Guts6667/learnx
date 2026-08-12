import { Role } from '../../../../generated/prisma/client.js';

export const CAPABILITIES = [
  'account.request.review',
  'account.invitation.issue',
  'account.role.assign',
  'account.suspend',
  'audit.read',
  'credit.admin.manage',
  'program.catalog.read',
  'program.enroll',
  'learning.read',
  'learning.write.own',
  'learning.submission.review',
  'program.admin.read',
  'program.admin.edit',
  'program.admin.publish',
  'ai.assessment.correct',
  'ai.program.generate',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const learnerCapabilities = [
  'program.catalog.read',
  'program.enroll',
  'learning.read',
  'learning.write.own',
  'ai.assessment.correct',
] as const satisfies readonly Capability[];

const roleCapabilities = {
  [Role.USER]: learnerCapabilities,
  [Role.CREATOR]: learnerCapabilities,
  [Role.ADMIN]: [
    ...learnerCapabilities,
    'account.request.review',
    'account.invitation.issue',
    'account.role.assign',
    'account.suspend',
    'audit.read',
    'credit.admin.manage',
    'learning.submission.review',
    'program.admin.read',
    'program.admin.edit',
    'program.admin.publish',
  ],
} as const satisfies Record<Role, readonly Capability[]>;

export function hasCapability(
  role: Role | string,
  capability: Capability,
): boolean {
  const capabilities = (
    roleCapabilities as Partial<Record<string, readonly Capability[]>>
  )[role];

  return capabilities?.includes(capability) ?? false;
}
