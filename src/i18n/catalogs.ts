import {
  englishActivitiesMessages,
  frenchActivitiesMessages,
} from '@/i18n/catalogs/activities';
import {
  englishAdminAccessMessages,
  frenchAdminAccessMessages,
} from '@/i18n/catalogs/admin-access';
import {
  englishAdminCatalogMessages,
  frenchAdminCatalogMessages,
} from '@/i18n/catalogs/admin-catalog';
import {
  englishAdminCreditsMessages,
  frenchAdminCreditsMessages,
} from '@/i18n/catalogs/admin-credits';
import { englishAuthMessages, frenchAuthMessages } from '@/i18n/catalogs/auth';
import { englishCoreMessages, frenchCoreMessages } from '@/i18n/catalogs/core';
import {
  englishCreditPackMessages,
  frenchCreditPackMessages,
} from '@/i18n/catalogs/credit-packs';
import {
  englishCorrectionMessages,
  frenchCorrectionMessages,
} from '@/i18n/catalogs/correction';
import {
  englishCurriculumMessages,
  frenchCurriculumMessages,
} from '@/i18n/catalogs/curriculum';
import {
  englishLandingMessages,
  frenchLandingMessages,
} from '@/i18n/catalogs/landing';
import {
  englishLearningMessages,
  frenchLearningMessages,
} from '@/i18n/catalogs/learning';
import { mergeCatalogFragments } from '@/i18n/catalogs/merge';
import {
  englishProgramsMessages,
  frenchProgramsMessages,
} from '@/i18n/catalogs/programs';
import type { MessageValue } from '@/i18n/catalogs/types';
import {
  englishWorkspaceMessages,
  frenchWorkspaceMessages,
} from '@/i18n/catalogs/workspace';

export const frenchMessages = mergeCatalogFragments(
  frenchCoreMessages,
  frenchLandingMessages,
  frenchAuthMessages,
  frenchProgramsMessages,
  frenchCurriculumMessages,
  frenchLearningMessages,
  frenchActivitiesMessages,
  frenchWorkspaceMessages,
  frenchCorrectionMessages,
  frenchCreditPackMessages,
  frenchAdminAccessMessages,
  frenchAdminCreditsMessages,
  frenchAdminCatalogMessages,
);

export type MessageKey = keyof typeof frenchMessages;
export type { MessageValue } from '@/i18n/catalogs/types';
export type MessageCatalog = Readonly<Record<MessageKey, MessageValue>>;

export const englishMessages = mergeCatalogFragments(
  englishCoreMessages,
  englishLandingMessages,
  englishAuthMessages,
  englishProgramsMessages,
  englishCurriculumMessages,
  englishLearningMessages,
  englishActivitiesMessages,
  englishWorkspaceMessages,
  englishCorrectionMessages,
  englishCreditPackMessages,
  englishAdminAccessMessages,
  englishAdminCreditsMessages,
  englishAdminCatalogMessages,
);

export const messageCatalogs = {
  en: englishMessages,
  fr: frenchMessages,
} as const satisfies Readonly<Record<'en' | 'fr', MessageCatalog>>;
