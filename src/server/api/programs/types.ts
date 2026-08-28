import type { MiddlewareHandler } from 'hono';

import type { PrismaClient } from '../../../../generated/prisma/client.js';
import type { AuthEnvironment } from '../_lib/auth.js';
import type { getStageValidation } from '../_lib/stage-validation.js';
import type {
  getProgramTimeline,
  getStageTimeline,
} from '../_lib/timeline-progress.js';
import type {
  readProgramViewPreference,
  saveProgramViewPreference,
} from './view-preference-repository.js';

export interface CurriculumAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  getClient?: () => Promise<PrismaClient>;
  readProgramTimeline?: typeof getProgramTimeline;
  readStageTimeline?: typeof getStageTimeline;
  readStageValidation?: typeof getStageValidation;
  readProgramViewPreference?: typeof readProgramViewPreference;
  saveProgramViewPreference?: typeof saveProgramViewPreference;
}
