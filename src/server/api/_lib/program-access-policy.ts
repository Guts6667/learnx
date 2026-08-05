import {
  Prisma,
  ProgramEnrollmentStatus,
  ProgramStatus,
  ProgramVisibility,
} from '../../../../generated/prisma/client.js';

export function learningProgramWhere(userId: string): Prisma.ProgramWhereInput {
  return {
    status: ProgramStatus.ACTIVE,
    OR: [
      { ownerId: userId },
      {
        enrollments: {
          some: { status: ProgramEnrollmentStatus.ACTIVE, userId },
        },
        visibility: ProgramVisibility.PUBLIC,
      },
    ],
  };
}

export function previewProgramWhere(userId: string): Prisma.ProgramWhereInput {
  return {
    ownerId: userId,
    status: { in: [ProgramStatus.ACTIVE, ProgramStatus.DRAFT] },
  };
}

export function learningOrPreviewProgramWhere(
  userId: string,
  includeOwnerPreview: boolean,
): Prisma.ProgramWhereInput {
  const learning = learningProgramWhere(userId);
  return includeOwnerPreview
    ? { OR: [learning, previewProgramWhere(userId)] }
    : learning;
}

export function editorialProgramWhere(
  ownerId: string,
): Prisma.ProgramWhereInput {
  return { ownerId };
}

export function personalRecordWhere(userId: string): { userId: string } {
  return { userId };
}
