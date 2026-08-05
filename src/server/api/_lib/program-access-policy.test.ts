import { describe, expect, it } from 'vitest';

import {
  ProgramEnrollmentStatus,
  ProgramStatus,
  ProgramVisibility,
} from '../../../../generated/prisma/client.js';
import {
  editorialProgramWhere,
  learningOrPreviewProgramWhere,
  learningProgramWhere,
  personalRecordWhere,
  previewProgramWhere,
} from './program-access-policy.js';

const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';

describe('program access policy', () => {
  it('autorise uniquement le propriétaire historique ou un enrollment actif public', () => {
    expect(learningProgramWhere(userId)).toEqual({
      OR: [
        { ownerId: userId },
        {
          enrollments: {
            some: { status: ProgramEnrollmentStatus.ACTIVE, userId },
          },
          visibility: ProgramVisibility.PUBLIC,
        },
      ],
      status: ProgramStatus.ACTIVE,
    });
  });

  it('réserve la prévisualisation au propriétaire actif ou brouillon', () => {
    expect(previewProgramWhere(userId)).toEqual({
      ownerId: userId,
      status: { in: [ProgramStatus.ACTIVE, ProgramStatus.DRAFT] },
    });
  });

  it('sépare relation éditoriale et propriété des données personnelles', () => {
    expect(editorialProgramWhere(userId)).toEqual({ ownerId: userId });
    expect(personalRecordWhere(userId)).toEqual({ userId });
  });

  it('n’ajoute le chemin brouillon propriétaire que pour une lecture de preview', () => {
    expect(learningOrPreviewProgramWhere(userId, false)).toEqual(
      learningProgramWhere(userId),
    );
    expect(learningOrPreviewProgramWhere(userId, true)).toEqual({
      OR: [learningProgramWhere(userId), previewProgramWhere(userId)],
    });
  });
});
