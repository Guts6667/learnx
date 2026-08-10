import 'dotenv/config';

import {
  getRetentionPolicy,
  runRetentionCleanup,
  type RetentionRepository,
} from '../src/server/maintenance/retention';
import { prisma } from '../src/server/prisma';

const expiredTokenWhere = (cutoff: Date) => ({
  OR: [
    { consumedAt: { lt: cutoff } },
    { expiresAt: { lt: cutoff } },
    { invalidatedAt: { lt: cutoff } },
  ],
});

const repository: RetentionRepository = {
  countExpiredAccessInvitations(cutoff) {
    return prisma.accessInvitation.count({ where: expiredTokenWhere(cutoff) });
  },
  countExpiredEmailVerifications(cutoff) {
    return prisma.emailVerification.count({ where: expiredTokenWhere(cutoff) });
  },
  countExpiredRateLimits(cutoff) {
    return prisma.loginRateLimit.count({
      where: { windowStartedAt: { lt: cutoff } },
    });
  },
  countExpiredPublicLeads(cutoff) {
    return prisma.publicLead.count({
      where: {
        status: { in: ['PENDING_CONFIRMATION', 'UNSUBSCRIBED', 'DELETED'] },
        updatedAt: { lt: cutoff },
      },
    });
  },
  countExpiredSessions(cutoff) {
    return prisma.session.count({ where: { expiresAt: { lt: cutoff } } });
  },
  async deleteExpiredAccessInvitations(cutoff, limit) {
    const records = await prisma.accessInvitation.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      take: limit,
      where: expiredTokenWhere(cutoff),
    });
    if (records.length === 0) return 0;

    const result = await prisma.accessInvitation.deleteMany({
      where: { id: { in: records.map(({ id }) => id) } },
    });
    return result.count;
  },
  async deleteExpiredEmailVerifications(cutoff, limit) {
    const records = await prisma.emailVerification.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      take: limit,
      where: expiredTokenWhere(cutoff),
    });
    if (records.length === 0) return 0;

    const result = await prisma.emailVerification.deleteMany({
      where: { id: { in: records.map(({ id }) => id) } },
    });
    return result.count;
  },
  async deleteExpiredRateLimits(cutoff, limit) {
    const records = await prisma.loginRateLimit.findMany({
      orderBy: { windowStartedAt: 'asc' },
      select: { keyHash: true },
      take: limit,
      where: { windowStartedAt: { lt: cutoff } },
    });
    if (records.length === 0) return 0;

    const result = await prisma.loginRateLimit.deleteMany({
      where: { keyHash: { in: records.map(({ keyHash }) => keyHash) } },
    });
    return result.count;
  },
  async deleteExpiredPublicLeads(cutoff, limit) {
    const records = await prisma.publicLead.findMany({
      orderBy: { updatedAt: 'asc' },
      select: { id: true },
      take: limit,
      where: {
        status: { in: ['PENDING_CONFIRMATION', 'UNSUBSCRIBED', 'DELETED'] },
        updatedAt: { lt: cutoff },
      },
    });
    if (records.length === 0) return 0;
    const result = await prisma.publicLead.deleteMany({
      where: { id: { in: records.map(({ id }) => id) } },
    });
    return result.count;
  },
  async deleteExpiredSessions(cutoff, limit) {
    const records = await prisma.session.findMany({
      orderBy: { expiresAt: 'asc' },
      select: { id: true },
      take: limit,
      where: { expiresAt: { lt: cutoff } },
    });
    if (records.length === 0) return 0;

    const result = await prisma.session.deleteMany({
      where: { id: { in: records.map(({ id }) => id) } },
    });
    return result.count;
  },
};

async function main() {
  const apply = process.argv.includes('--apply');
  const policy = getRetentionPolicy();
  const result = await runRetentionCleanup(repository, { apply, policy });

  console.info(
    apply ? 'Retention cleanup applied.' : 'Retention cleanup dry run.',
  );
  console.info(JSON.stringify(result, null, 2));
  if (!apply) {
    console.info(
      'No data changed. Add --apply to delete expired technical data.',
    );
  } else if (
    result.sessions.hasMore ||
    result.rateLimits.hasMore ||
    result.emailVerifications.hasMore ||
    result.accessInvitations.hasMore ||
    result.publicLeads.hasMore
  ) {
    console.info(
      'The batch limit was reached; run the command again if intended.',
    );
  }
}

try {
  await main();
} catch (error) {
  console.error('Retention cleanup failed.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
