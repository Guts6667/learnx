import type { SupportedLocale } from '../../../../shared/locale.js';
import type { CatalogRecord, EnrolledRecord } from './query-shapes.js';
import type { CatalogProgramSummary, EnrolledProgramSummary } from './types.js';

export function serializeCatalogProgram(
  record: CatalogRecord,
): CatalogProgramSummary {
  if (!record.publishedVersion) {
    throw new Error('Catalog program has no published version.');
  }
  return {
    canonicalProgramKey: record.canonicalProgramKey,
    description: record.description,
    estimatedDurationDays: record.estimatedDurationDays,
    icon: record.icon,
    id: record.id,
    isEnrolled: record.enrollments.length > 0,
    locale: record.locale as SupportedLocale,
    publishedVersion: {
      checksum: record.publishedVersion.checksum,
      id: record.publishedVersion.id,
      number: record.publishedVersion.version,
      publishedAt: record.publishedVersion.publishedAt.toISOString(),
    },
    slug: record.slug,
    stageCount: record._count.stages,
    title: record.title,
  };
}

export function serializeEnrolledProgram(
  record: EnrolledRecord,
): EnrolledProgramSummary {
  if (!record.program.publishedVersion) {
    throw new Error('Enrolled program has no published version.');
  }
  const progress = record.program.progress[0];
  return {
    enrollment: {
      enrolledAt: record.enrolledAt.toISOString(),
      id: record.id,
      status: record.status,
      updatedAt: record.updatedAt.toISOString(),
      withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
    },
    program: {
      canonicalProgramKey: record.program.canonicalProgramKey,
      description: record.program.description,
      estimatedDurationDays: record.program.estimatedDurationDays,
      icon: record.program.icon,
      id: record.program.id,
      locale: record.program.locale as SupportedLocale,
      publishedVersion: {
        checksum: record.program.publishedVersion.checksum,
        id: record.program.publishedVersion.id,
        number: record.program.publishedVersion.version,
        publishedAt: record.program.publishedVersion.publishedAt.toISOString(),
      },
      slug: record.program.slug,
      title: record.program.title,
    },
    progress: progress
      ? {
          completedAt: progress.completedAt?.toISOString() ?? null,
          lastViewedAt: progress.lastViewedAt.toISOString(),
          percent: progress.percent,
          startedAt: progress.startedAt?.toISOString() ?? null,
          targetEndAt: progress.targetEndAt?.toISOString() ?? null,
        }
      : null,
  };
}
