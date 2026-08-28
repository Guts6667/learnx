import type { ProgramEnrollmentStatus } from '../../../../../generated/prisma/client.js';
import type { SupportedLocale } from '../../../../shared/locale.js';

interface ProgramDirectoryPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CatalogProgramSummary {
  canonicalProgramKey: string;
  description: string;
  estimatedDurationDays: number | null;
  icon: string | null;
  id: string;
  isEnrolled: boolean;
  locale: SupportedLocale;
  publishedVersion: {
    checksum: string;
    id: string;
    number: number;
    publishedAt: string;
  };
  slug: string;
  stageCount: number;
  title: string;
}

export interface EnrolledProgramSummary {
  enrollment: {
    enrolledAt: string;
    id: string;
    status: ProgramEnrollmentStatus;
    updatedAt: string;
    withdrawnAt: string | null;
  };
  program: {
    canonicalProgramKey: string;
    description: string;
    estimatedDurationDays: number | null;
    icon: string | null;
    id: string;
    locale: SupportedLocale;
    publishedVersion: {
      checksum: string;
      id: string;
      number: number;
      publishedAt: string;
    };
    slug: string;
    title: string;
  };
  progress: {
    completedAt: string | null;
    lastViewedAt: string;
    percent: number;
    startedAt: string | null;
    targetEndAt: string | null;
  } | null;
}

export interface CatalogDirectoryInput {
  cursor?: string;
  pageSize: number;
  locale: SupportedLocale;
  search?: string;
  userId: string;
}

export interface EnrolledDirectoryInput {
  cursor?: string;
  pageSize: number;
  search?: string;
  status: ProgramEnrollmentStatus;
  userId: string;
}

export interface ProgramDirectoryService {
  listCatalog(
    input: CatalogDirectoryInput,
  ): Promise<ProgramDirectoryPage<CatalogProgramSummary>>;
  listEnrolled(
    input: EnrolledDirectoryInput,
  ): Promise<ProgramDirectoryPage<EnrolledProgramSummary>>;
}
