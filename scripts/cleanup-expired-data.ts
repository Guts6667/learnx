import 'dotenv/config';

import {
  getRetentionPolicy,
  runRetentionCleanup,
  type RetentionRepository,
} from '../src/server/maintenance/retention';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../generated/prisma/client';
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
  countAttachedCorrections(cutoff) {
    return prisma.aiCorrection.count({
      where: { createdAt: { lt: cutoff }, detachedAt: null },
    });
  },
  countExpiredPaymentPayloads(cutoff) {
    return prisma.paymentEvent.count({
      where: { payload: { not: Prisma.DbNull }, receivedAt: { lt: cutoff } },
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
  countExpiredTrialMarkers(cutoff) {
    return prisma.trialAllocationMarker.count({
      where: { lastSeenAt: { lt: cutoff } },
    });
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
  async detachAttachedCorrections(cutoff, limit) {
    // V4.5-168. One transaction per correction rather than one for the batch:
    // a batch that fails halfway would leave some corrections stripped with
    // their words neither kept nor deleted, and there is no way back to tell
    // which. Per row, a failure loses one correction's detachment and the next
    // run picks it up — `detachedAt` is what says it was done.
    const candidates = await prisma.aiCorrection.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        activityType: true,
        attempts: {
          select: { id: true, rawOutput: true, structuredResult: true },
        },
        id: true,
        modelId: true,
        promptSnapshot: true,
        promptVersion: true,
        structuredResult: true,
        submissionSnapshot: true,
        user: { select: { correctionReuseConsent: true } },
      },
      take: limit,
      where: { createdAt: { lt: cutoff }, detachedAt: null },
    });
    if (candidates.length === 0) return 0;

    const { planDetachment } =
      await import('../src/server/corrections/correction-detachment.js');
    const now = new Date();
    let detached = 0;

    for (const candidate of candidates) {
      const plan = planDetachment(
        {
          activityType: candidate.activityType,
          attempts: candidate.attempts,
          id: candidate.id,
          modelId: candidate.modelId,
          promptSnapshot: candidate.promptSnapshot,
          promptVersion: candidate.promptVersion,
          reuseConsent: candidate.user.correctionReuseConsent,
          structuredResult: candidate.structuredResult,
          submissionSnapshot: candidate.submissionSnapshot,
        },
        randomUUID,
        now,
      );

      await prisma.$transaction(async (transaction) => {
        // Written first, inside the same transaction: if anything below fails,
        // the sample goes with it rather than surviving as an orphan nobody
        // can trace back to decide whether it should exist.
        if (plan.sample) {
          await transaction.aiCorrectionResearchSample.create({
            data: {
              activityType: plan.sample.activityType,
              detachedOn: plan.sample.detachedOn,
              evidenceQuotes: plan.sample.evidenceQuotes as never,
              modelId: plan.sample.modelId,
              promptSnapshot: plan.sample.promptSnapshot as never,
              promptVersion: plan.sample.promptVersion,
              pseudonym: plan.sample.pseudonym,
              rawOutputs: plan.sample.rawOutputs as never,
              submissionSnapshot: plan.sample.submissionSnapshot as never,
            },
          });
        }
        // Une écriture par tentative, et non un `updateMany` : chacune porte
        // son propre jugement, donc sa propre valeur à écrire (V4.5-217).
        // Vider `rawOutput` en lot laissait les citations dans
        // `structuredResult`, à côté d'une correction qu'on venait de
        // détacher.
        for (const attempt of plan.attempts) {
          await transaction.aiCorrectionAttempt.update({
            data: {
              rawOutput: Prisma.DbNull,
              structuredResult:
                attempt.structuredResult === null
                  ? Prisma.DbNull
                  : (attempt.structuredResult as never),
            },
            where: { id: attempt.id },
          });
        }
        await transaction.aiCorrection.update({
          data: {
            detachedAt: now,
            promptSnapshot: Prisma.DbNull,
            structuredResult: plan.structuredResult as never,
            submissionSnapshot: Prisma.DbNull,
          },
          where: { id: plan.correctionId },
        });
      });
      detached += 1;
    }

    return detached;
  },
  async purgeExpiredPaymentPayloads(cutoff, limit) {
    // The row stays: event id, type, order, status and timestamps are the
    // accounting trace (`owner-e4-2026-08-30`). Only the provider body goes,
    // and it is the only part carrying `customer_details`.
    const records = await prisma.paymentEvent.findMany({
      orderBy: { receivedAt: 'asc' },
      select: { id: true },
      take: limit,
      where: { payload: { not: Prisma.DbNull }, receivedAt: { lt: cutoff } },
    });
    if (records.length === 0) return 0;

    const result = await prisma.paymentEvent.updateMany({
      data: { payload: Prisma.DbNull },
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
  async deleteExpiredTrialMarkers(cutoff, limit) {
    const records = await prisma.trialAllocationMarker.findMany({
      orderBy: { lastSeenAt: 'asc' },
      select: { keyHash: true },
      take: limit,
      where: { lastSeenAt: { lt: cutoff } },
    });
    if (records.length === 0) return 0;

    const result = await prisma.trialAllocationMarker.deleteMany({
      where: { keyHash: { in: records.map(({ keyHash }) => keyHash) } },
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
