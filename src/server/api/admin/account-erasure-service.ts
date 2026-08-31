import { stripEvidenceQuotes } from '../../corrections/correction-detachment.js';
import { SYSTEM_ACTOR_ID } from '../../system-actor.js';
import {
  AccountStatus,
  AuditAction,
  Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../_lib/audit.js';

/**
 * Right to erasure by pseudonymisation (RGPD art. 17, audit §4 E1).
 *
 * Pseudonymisation and not anonymisation, deliberately and in every name here.
 * The account row survives because the credit ledger references it and the
 * ledger is never rewritten (ADR_003 §6), so what is destroyed is the direct
 * identity — e-mail, display name, credentials, sessions — while structured
 * rows keep pointing at a user that no longer names anyone.
 *
 * That is enough to make the *structured* record non-identifying. It is not
 * enough for free text the learner wrote, which can name them however clean the
 * account row is — which is why the word here is pseudonymisation and not
 * anonymisation, everywhere, including in what we tell the learner.
 *
 * The owner decided on 29 August 2026 (`owner-erasure-2026-08-29`) to retain
 * that text under the pseudonym: exercise and assessment answers, the
 * correction snapshots, the evidence quotes and the raw model output all
 * survive. Private notes do not — they serve neither accounting nor research,
 * so they are the one kind of learner text with no reason to outlive the
 * account. Each erasure records the policy it ran under, so a later change of
 * policy does not make the older records ambiguous.
 *
 * **Cette rétention est désormais conditionnée au consentement** (V4.5-216).
 * Elle ne l'était pas, et c'était une incohérence entre deux chemins : un
 * apprenant qui avait REFUSÉ la réutilisation voyait ses textes conservés
 * s'il supprimait son compte, alors que la voie du détachement à 180 jours les
 * aurait supprimés. Le chemin le plus explicite — demander soi-même
 * l'effacement — était le moins respectueux du choix exprimé.
 *
 * Sans consentement, les textes sont donc **supprimés** plutôt que conservés
 * sous pseudonyme. Avec, rien ne change. Aucune ligne d'argent n'est touchée
 * dans les deux cas : le grand livre n'est jamais réécrit.
 */

export type AccountErasureResult =
  | { kind: 'ERASED' }
  | { kind: 'ALREADY_ERASED' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'CONFLICT' };

/**
 * The retention policy this service implements, stamped on every erasure so a
 * record made under one policy is never read as though it were made under a
 * later one.
 */
const LEARNER_TEXT_POLICY = {
  DELETED: 'DELETED_NO_REUSE_CONSENT',
  RETAINED: 'RETAINED_UNDER_PSEUDONYM',
} as const;

/** A pseudonym derived from the account id: stable, unique, and meaningless. */
function pseudonym(userId: string): { displayName: string; email: string } {
  return {
    displayName: 'Compte supprimé',
    // The id is already in the row; reusing it introduces nothing new and
    // keeps the unique index satisfied without a second identifier to store.
    email: `deleted+${userId}@accounts.invalid`,
  };
}

/**
 * Les mots de l'apprenant, retirés (V4.5-216).
 *
 * Ce qui part est exactement ce que le détachement à 180 jours retire : sa
 * production, l'instantané de soumission, l'invite qui la transporte, les
 * citations qu'on lui a renvoyées, et la sortie brute du modèle. Ce qui reste
 * est la forme du jugement — niveaux, confiances, coûts, horodatages — et
 * toutes les clés étrangères. Aucune ligne d'argent n'est touchée.
 *
 * Vidé plutôt que supprimé en lignes, pour la même raison qu'au détachement :
 * une correction doit se lire comme une correction qui ne cite rien, pas comme
 * une ligne à laquelle il manque un champ.
 */
async function deleteLearnerText(
  client: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await client.exerciseSubmission.updateMany({
    data: { contentMarkdown: '' },
    where: { userId },
  });
  await client.stageAssessmentSubmission.updateMany({
    data: { contentMarkdown: null },
    where: { userId },
  });
  await client.aiCorrection.updateMany({
    data: { promptSnapshot: Prisma.DbNull, submissionSnapshot: Prisma.DbNull },
    where: { userId },
  });

  // `structuredResult` porte les citations au milieu du jugement : il faut le
  // parcourir, pas l'annuler. Les corrections d'un compte se comptent en
  // dizaines et un effacement est rare, donc une écriture par ligne est le
  // prix acceptable de ne pas détruire la note avec la citation.
  const corrections = await client.aiCorrection.findMany({
    select: { id: true, structuredResult: true },
    where: { structuredResult: { not: Prisma.DbNull }, userId },
  });
  for (const correction of corrections) {
    await client.aiCorrection.update({
      data: {
        structuredResult: stripEvidenceQuotes(
          correction.structuredResult,
        ) as Prisma.InputJsonValue,
      },
      where: { id: correction.id },
    });
  }

  await client.aiCorrectionAttempt.updateMany({
    data: { rawOutput: Prisma.DbNull },
    where: { correction: { userId } },
  });

  // La tentative porte sa propre copie du jugement, citations comprises. Le
  // détachement ne la parcourt pas — il vide seulement `rawOutput` — mais la
  // laisser ici garderait les mots que ce chemin existe pour retirer.
  const attempts = await client.aiCorrectionAttempt.findMany({
    select: { id: true, structuredResult: true },
    where: {
      correction: { userId },
      structuredResult: { not: Prisma.DbNull },
    },
  });
  for (const attempt of attempts) {
    await client.aiCorrectionAttempt.update({
      data: {
        structuredResult: stripEvidenceQuotes(
          attempt.structuredResult,
        ) as Prisma.InputJsonValue,
      },
      where: { id: attempt.id },
    });
  }
}

export function createAccountErasureService(client: PrismaClient) {
  return {
    async erase(input: {
      actorUserId: string;
      expectedUpdatedAt: Date;
      userId: string;
    }): Promise<AccountErasureResult> {
      return client.$transaction(async (transaction) => {
        const existing = await transaction.user.findUnique({
          select: {
            accountStatus: true,
            // Lu au moment de l'effacement, jamais supposé (V4.5-216).
            correctionReuseConsent: true,
            id: true,
            updatedAt: true,
          },
          where: { id: input.userId },
        });
        if (!existing) return { kind: 'NOT_FOUND' } as const;
        // The technical account is not a person and has no right to erasure to
        // exercise. Pseudonymising it would break the audit trail of every
        // refund it ever recorded, for nobody's benefit (V4.5-203).
        if (input.userId === SYSTEM_ACTOR_ID) {
          return { kind: 'NOT_FOUND' } as const;
        }
        // Irreversible, so repeating it is a no-op rather than a second
        // erasure that would overwrite the first audit trail.
        if (existing.accountStatus === AccountStatus.PSEUDONYMISED) {
          return { kind: 'ALREADY_ERASED' } as const;
        }

        const now = new Date();
        const update = await transaction.user.updateMany({
          data: {
            accountStatus: AccountStatus.PSEUDONYMISED,
            // Credentials are replaced by a value no password hashes to, so
            // the account cannot be logged into even if the e-mail were known.
            passwordHash: `erased:${now.toISOString()}`,
            suspendedAt: now,
            ...pseudonym(input.userId),
          },
          where: {
            id: input.userId,
            updatedAt: input.expectedUpdatedAt,
          },
        });
        if (update.count !== 1) return { kind: 'CONFLICT' } as const;

        await transaction.session.deleteMany({
          where: { userId: input.userId },
        });
        // Private notes serve neither accounting nor research. They are the one
        // kind of learner text with no reason to survive under any reading.
        await transaction.note.deleteMany({ where: { userId: input.userId } });

        // The provider's raw event bodies (V4.5-197, `owner-e4-2026-08-30`).
        // Pseudonymising the account does not reach them: they carry
        // `customer_details` — e-mail, name, phone, billing address — as the
        // provider sent it, which is a direct identity this service exists to
        // destroy. Retention purges them at thirty days; erasure cannot wait
        // out that window.
        //
        // Emptied, not deleted. The rows are the accounting trace, and they
        // stay attached to an order whose user no longer names anyone.
        await transaction.paymentEvent.updateMany({
          data: { payload: Prisma.DbNull },
          where: {
            order: { userId: input.userId },
            payload: { not: Prisma.DbNull },
          },
        });
        // Sans consentement, les textes de l'apprenant s'en vont (V4.5-216).
        // Vidés et non supprimés en lignes : les lignes portent des clés
        // étrangères et la forme du jugement, que le détachement conserve
        // aussi. Ce qui part, ce sont les mots — les siens, et ceux qu'on lui
        // a cités.
        if (!existing.correctionReuseConsent) {
          await deleteLearnerText(transaction, input.userId);
        }

        const auditValues = {
          fromStatus: existing.accountStatus,
          learnerTextPolicy: existing.correctionReuseConsent
            ? LEARNER_TEXT_POLICY.RETAINED
            : LEARNER_TEXT_POLICY.DELETED,
          previousUpdatedAt: existing.updatedAt.toISOString(),
        };
        await writeAuditEvent(transaction, {
          action: AuditAction.ACCOUNT_PSEUDONYMISE,
          actorUserId: input.actorUserId,
          idempotencyKey: createAuditIdempotencyKey(
            AuditAction.ACCOUNT_PSEUDONYMISE,
            input.userId,
            auditValues,
          ),
          metadata: auditValues,
          targetId: input.userId,
          targetType: 'user',
        });
        return { kind: 'ERASED' } as const;
      });
    },
  };
}
