import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { createAccessInvitationDelivery } from '../_lib/access-invitation.js';
import { createPrismaAccountAdministrationService } from './account-administration-service.js';
import { createPrismaAccessRequestReviewService } from './access-request-review-service.js';
import type {
  AdminAppOptions,
  AdminDependencies,
  AdminPrismaFactory,
} from './app-contracts.js';
import { createCurriculumEditService } from './curriculum-edit-service.js';
import { createPrismaAdminRepository } from './curriculum-edit-repository.js';
import { createPrismaAdminNavigationService } from './navigation-service.js';
import { createPrismaPublicationService } from './publication-service.js';
import { createPrismaProgramVisibilityService } from './program-visibility-service.js';
import { createPrismaTranslationWorkflowService } from './translation-workflow-service.js';

async function getPrisma() {
  const { prisma } = await import('../../prisma.js');
  return prisma;
}

function lazyPrismaDependency<T>(
  override: T | undefined,
  factory: AdminPrismaFactory<T>,
) {
  let dependency: T | undefined;
  return async () => {
    if (override) return override;
    dependency ??= factory(await getPrisma());
    return dependency;
  };
}

function createCurriculumDependency(options: AdminAppOptions) {
  let dependency = options.curriculumEditService;
  return async () => {
    if (dependency) return dependency;
    const repository =
      options.repository ?? createPrismaAdminRepository(await getPrisma());
    dependency = createCurriculumEditService(repository);
    return dependency;
  };
}

function createReviewService(client: PrismaClient) {
  return createPrismaAccessRequestReviewService(client, {
    delivery: createAccessInvitationDelivery(),
  });
}

export function createAdminDependencies(
  options: AdminAppOptions,
): AdminDependencies {
  return {
    accountAdministration: lazyPrismaDependency(
      options.accountAdministrationService,
      createPrismaAccountAdministrationService,
    ),
    accessRequestReview: lazyPrismaDependency(
      options.accessRequestReviewService,
      createReviewService,
    ),
    curriculumEdit: createCurriculumDependency(options),
    navigation: lazyPrismaDependency(
      options.navigationService,
      createPrismaAdminNavigationService,
    ),
    publication: lazyPrismaDependency(
      options.publicationService,
      createPrismaPublicationService,
    ),
    programVisibility: lazyPrismaDependency(
      options.programVisibilityService,
      createPrismaProgramVisibilityService,
    ),
    translationWorkflow: lazyPrismaDependency(
      options.translationWorkflowService,
      createPrismaTranslationWorkflowService,
    ),
  };
}
