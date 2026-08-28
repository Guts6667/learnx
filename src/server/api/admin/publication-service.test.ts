import { describe, expect, it, vi } from 'vitest';

import type {
  PublicationRepository,
  PublicationTransactionRepository,
  ResolvedPublicationTarget,
} from './publication-repository.js';
import {
  createPublicationService,
  PublicationPlanStaleError,
} from './publication-service.js';

function resolvedTarget(): ResolvedPublicationTarget {
  return {
    context: { blockers: [], version: 'v1' },
    programId: 'program-1',
    target: {
      entity: {
        id: 'module-1',
        isPublished: false,
        lessons: [
          {
            id: 'lesson-1',
            isPublished: false,
            requiredConcepts: [],
            title: 'Lesson',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
        title: 'Module',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      type: 'MODULE',
    },
  };
}

function repositoryMock() {
  const transactionRepository: PublicationTransactionRepository = {
    applyChanges: vi.fn().mockResolvedValue(undefined),
    createPublishedVersion: vi.fn().mockResolvedValue({
      id: 'version-1',
      version: 1,
    }),
    readTarget: vi.fn().mockResolvedValue(resolvedTarget()),
    writeApplyAudit: vi.fn().mockResolvedValue(undefined),
  };
  const repository: PublicationRepository = {
    readTarget: vi.fn().mockResolvedValue(resolvedTarget()),
    transaction: (operation) => operation(transactionRepository),
  };
  return { repository, transactionRepository };
}

describe('publication service', () => {
  it('previews and applies the same immutable plan inside a transaction', async () => {
    const { repository, transactionRepository } = repositoryMock();
    const service = createPublicationService(repository);
    const request = {
      action: 'PUBLISH' as const,
      mode: 'FULL' as const,
      targetId: 'module-1',
      targetType: 'MODULE' as const,
    };
    const preview = await service.preview('owner-1', request);
    expect(preview).not.toBeNull();
    if (!preview) throw new Error('Expected a publication preview.');

    const applied = await service.apply('owner-1', {
      ...request,
      planId: preview.planId,
    });

    expect(applied?.planId).toBe(preview?.planId);
    expect(transactionRepository.applyChanges).toHaveBeenCalledOnce();
    expect(transactionRepository.writeApplyAudit).toHaveBeenCalledOnce();
  });

  it('rejects a stale plan before persistence', async () => {
    const { repository, transactionRepository } = repositoryMock();
    const service = createPublicationService(repository);

    await expect(
      service.apply('owner-1', {
        action: 'PUBLISH',
        mode: 'FULL',
        planId: 'stale',
        targetId: 'module-1',
        targetType: 'MODULE',
      }),
    ).rejects.toBeInstanceOf(PublicationPlanStaleError);
    expect(transactionRepository.applyChanges).not.toHaveBeenCalled();
  });
});
