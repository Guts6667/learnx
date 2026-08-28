import type { Prisma } from '../../../../../generated/prisma/client.js';
import { ProgramEnrollmentStatus } from '../../../../../generated/prisma/client.js';

export const catalogSelect = {
  _count: { select: { stages: { where: { isPublished: true } } } },
  description: true,
  canonicalProgramKey: true,
  enrollments: {
    select: { id: true },
    take: 1,
    where: { status: ProgramEnrollmentStatus.ACTIVE },
  },
  estimatedDurationDays: true,
  icon: true,
  id: true,
  locale: true,
  position: true,
  publishedVersion: {
    select: {
      checksum: true,
      id: true,
      publishedAt: true,
      version: true,
    },
  },
  slug: true,
  title: true,
} satisfies Prisma.ProgramSelect;

export type CatalogRecord = Prisma.ProgramGetPayload<{
  select: typeof catalogSelect;
}>;

export const enrolledSelect = {
  enrolledAt: true,
  id: true,
  program: {
    select: {
      description: true,
      canonicalProgramKey: true,
      estimatedDurationDays: true,
      icon: true,
      id: true,
      locale: true,
      progress: {
        select: {
          completedAt: true,
          lastViewedAt: true,
          percent: true,
          startedAt: true,
          targetEndAt: true,
        },
        take: 1,
      },
      publishedVersion: {
        select: {
          checksum: true,
          id: true,
          publishedAt: true,
          version: true,
        },
      },
      slug: true,
      title: true,
    },
  },
  status: true,
  updatedAt: true,
  withdrawnAt: true,
} satisfies Prisma.ProgramEnrollmentSelect;

export type EnrolledRecord = Prisma.ProgramEnrollmentGetPayload<{
  select: typeof enrolledSelect;
}>;
