import type { MiddlewareHandler } from 'hono';

import type { PrismaClient } from '../../../../generated/prisma/client.js';
import type { AuthEnvironment } from '../_lib/auth.js';
import type { AccountAdministrationService } from './account-administration-service.js';
import type { AccessRequestReviewService } from './access-request-review-service.js';
import type {
  AdminRepository,
  CurriculumEditService,
} from './curriculum-edit-types.js';
import type { AdminNavigationService } from './navigation-service.js';
import type { PublicationService } from './publication-service.js';
import type { ProgramVisibilityService } from './program-visibility-service.js';
import type { TranslationWorkflowService } from './translation-workflow-service.js';

export interface AdminAppOptions {
  accountAdministrationService?: AccountAdministrationService;
  accessRequestReviewService?: AccessRequestReviewService;
  authentication?: MiddlewareHandler<AuthEnvironment>;
  curriculumEditService?: CurriculumEditService;
  navigationService?: AdminNavigationService;
  publicationService?: PublicationService;
  programVisibilityService?: ProgramVisibilityService;
  repository?: AdminRepository;
  translationWorkflowService?: TranslationWorkflowService;
}

export interface AdminDependencies {
  accountAdministration(): Promise<AccountAdministrationService>;
  accessRequestReview(): Promise<AccessRequestReviewService>;
  curriculumEdit(): Promise<CurriculumEditService>;
  navigation(): Promise<AdminNavigationService>;
  publication(): Promise<PublicationService>;
  programVisibility(): Promise<ProgramVisibilityService>;
  translationWorkflow(): Promise<TranslationWorkflowService>;
}

export type AdminPrismaFactory<T> = (client: PrismaClient) => T;
