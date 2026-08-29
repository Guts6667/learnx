import {
  AuditAction,
  Prisma,
  TranslationWorkflowStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  bilingualQaChecksSchema,
  bilingualQaIsComplete,
  type BilingualQaChecks,
} from '../../../shared/bilingual-editorial.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../_lib/audit.js';
import { editorialProgramWhere } from '../_lib/program-access-policy.js';

export const translationWorkflowActions = [
  'CONFIGURE',
  'SUBMIT',
  'APPROVE_LINGUISTIC',
  'APPROVE_PEDAGOGICAL',
  'APPROVE_CULTURAL_LEGAL',
  'VALIDATE_QA',
  'REQUEST_CHANGES',
  'APPROVE',
] as const;

type TranslationWorkflowAction = (typeof translationWorkflowActions)[number];

interface BaseTransitionInput {
  action: TranslationWorkflowAction;
  expectedVersion: number;
}

type TranslationWorkflowTransitionInput = BaseTransitionInput & {
  glossaryVersion?: string;
  qaChecks?: BilingualQaChecks;
  sourceProgramVersionId?: string;
};

interface TranslationWorkflowRecord {
  approvedAt: Date | null;
  approvedByUserId: string | null;
  culturalLegalReviewedAt: Date | null;
  culturalLegalReviewerId: string | null;
  glossaryVersion: string;
  linguisticReviewedAt: Date | null;
  linguisticReviewerId: string | null;
  pedagogicalReviewedAt: Date | null;
  pedagogicalReviewerId: string | null;
  programId: string;
  qaChecks: BilingualQaChecks | Record<string, never>;
  sourceProgramVersionId: string;
  status: TranslationWorkflowStatus;
  updatedAt: Date;
  version: number;
}

type TranslationWorkflowTransitionResult =
  | { kind: 'APPLIED'; workflow: TranslationWorkflowRecord }
  | { kind: 'CONFLICT' }
  | { kind: 'INVALID_SOURCE' }
  | { kind: 'INVALID_TRANSITION' }
  | { kind: 'NOT_FOUND' };

export interface TranslationWorkflowService {
  find(
    programId: string,
    ownerId: string,
  ): Promise<TranslationWorkflowRecord | null>;
  transition(
    actorUserId: string,
    programId: string,
    input: TranslationWorkflowTransitionInput,
  ): Promise<TranslationWorkflowTransitionResult>;
}

const workflowSelect = {
  approvedAt: true,
  approvedByUserId: true,
  culturalLegalReviewedAt: true,
  culturalLegalReviewerId: true,
  glossaryVersion: true,
  linguisticReviewedAt: true,
  linguisticReviewerId: true,
  pedagogicalReviewedAt: true,
  pedagogicalReviewerId: true,
  programId: true,
  qaChecks: true,
  sourceProgramVersionId: true,
  status: true,
  updatedAt: true,
  version: true,
} satisfies Prisma.ProgramTranslationWorkflowSelect;

type StoredWorkflow = Prisma.ProgramTranslationWorkflowGetPayload<{
  select: typeof workflowSelect;
}>;

function mapWorkflow(workflow: StoredWorkflow): TranslationWorkflowRecord {
  const parsedQa = bilingualQaChecksSchema.safeParse(workflow.qaChecks);
  return {
    ...workflow,
    qaChecks: parsedQa.success ? parsedQa.data : {},
  };
}

function isReviewable(workflow: StoredWorkflow): boolean {
  return workflow.status === TranslationWorkflowStatus.IN_REVIEW;
}

function canApprove(workflow: StoredWorkflow): boolean {
  return (
    isReviewable(workflow) &&
    workflow.linguisticReviewedAt !== null &&
    workflow.pedagogicalReviewedAt !== null &&
    workflow.culturalLegalReviewedAt !== null &&
    bilingualQaIsComplete(workflow.qaChecks)
  );
}

function resetReviewData() {
  return {
    approvedAt: null,
    approvedBy: { disconnect: true },
    culturalLegalReviewedAt: null,
    culturalLegalReviewer: { disconnect: true },
    linguisticReviewedAt: null,
    linguisticReviewer: { disconnect: true },
    pedagogicalReviewedAt: null,
    pedagogicalReviewer: { disconnect: true },
    qaChecks: {},
    status: TranslationWorkflowStatus.DRAFT,
  } as const;
}

async function readOwnedProgram(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  programId: string,
) {
  return transaction.program.findFirst({
    where: { id: programId, ...editorialProgramWhere(actorUserId) },
    select: { canonicalProgramKey: true, id: true, locale: true },
  });
}

async function sourceVersionIsValid(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  canonicalProgramKey: string,
  sourceProgramVersionId: string,
): Promise<boolean> {
  const version = await transaction.programVersion.findFirst({
    where: {
      id: sourceProgramVersionId,
      program: {
        canonicalProgramKey,
        locale: 'fr',
        ...editorialProgramWhere(actorUserId),
      },
    },
    select: { id: true },
  });
  return version !== null;
}

function transitionData(
  workflow: StoredWorkflow,
  actorUserId: string,
  input: TranslationWorkflowTransitionInput,
  now: Date,
): Prisma.ProgramTranslationWorkflowUpdateInput | null {
  switch (input.action) {
    case 'SUBMIT':
      return workflow.status === TranslationWorkflowStatus.DRAFT ||
        workflow.status === TranslationWorkflowStatus.CHANGES_REQUESTED
        ? { status: TranslationWorkflowStatus.IN_REVIEW }
        : null;
    case 'APPROVE_LINGUISTIC':
      return isReviewable(workflow)
        ? {
            linguisticReviewedAt: now,
            linguisticReviewer: { connect: { id: actorUserId } },
          }
        : null;
    case 'APPROVE_PEDAGOGICAL':
      return isReviewable(workflow)
        ? {
            pedagogicalReviewedAt: now,
            pedagogicalReviewer: { connect: { id: actorUserId } },
          }
        : null;
    case 'APPROVE_CULTURAL_LEGAL':
      return isReviewable(workflow)
        ? {
            culturalLegalReviewedAt: now,
            culturalLegalReviewer: { connect: { id: actorUserId } },
          }
        : null;
    case 'VALIDATE_QA':
      return isReviewable(workflow) && bilingualQaIsComplete(input.qaChecks)
        ? { qaChecks: input.qaChecks as Prisma.InputJsonValue }
        : null;
    case 'REQUEST_CHANGES':
      return workflow.status === TranslationWorkflowStatus.IN_REVIEW ||
        workflow.status === TranslationWorkflowStatus.APPROVED
        ? {
            ...resetReviewData(),
            status: TranslationWorkflowStatus.CHANGES_REQUESTED,
          }
        : null;
    case 'APPROVE':
      return canApprove(workflow)
        ? {
            approvedAt: now,
            approvedBy: { connect: { id: actorUserId } },
            status: TranslationWorkflowStatus.APPROVED,
          }
        : null;
    case 'CONFIGURE':
      return null;
  }
}

export function createPrismaTranslationWorkflowService(
  client: PrismaClient,
  now: () => Date = () => new Date(),
): TranslationWorkflowService {
  return {
    async find(programId, ownerId) {
      const workflow = await client.programTranslationWorkflow.findFirst({
        where: { programId, program: editorialProgramWhere(ownerId) },
        select: workflowSelect,
      });
      return workflow ? mapWorkflow(workflow) : null;
    },

    async transition(actorUserId, programId, input) {
      return client.$transaction(
        async (transaction) => {
          const program = await readOwnedProgram(
            transaction,
            actorUserId,
            programId,
          );
          if (!program) return { kind: 'NOT_FOUND' as const };
          if (program.locale === 'fr')
            return { kind: 'INVALID_TRANSITION' as const };

          const existing =
            await transaction.programTranslationWorkflow.findUnique({
              where: { programId },
              select: workflowSelect,
            });

          if (input.action === 'CONFIGURE') {
            if (!input.sourceProgramVersionId || !input.glossaryVersion) {
              return { kind: 'INVALID_TRANSITION' as const };
            }
            if (
              existing
                ? existing.version !== input.expectedVersion
                : input.expectedVersion !== 0
            ) {
              return { kind: 'CONFLICT' as const };
            }
            if (
              !(await sourceVersionIsValid(
                transaction,
                actorUserId,
                program.canonicalProgramKey,
                input.sourceProgramVersionId,
              ))
            ) {
              return { kind: 'INVALID_SOURCE' as const };
            }

            const workflow = existing
              ? await transaction.programTranslationWorkflow.update({
                  where: { programId, version: input.expectedVersion },
                  data: {
                    glossaryVersion: input.glossaryVersion,
                    sourceProgramVersion: {
                      connect: { id: input.sourceProgramVersionId },
                    },
                    ...resetReviewData(),
                    version: { increment: 1 },
                  },
                  select: workflowSelect,
                })
              : await transaction.programTranslationWorkflow.create({
                  data: {
                    glossaryVersion: input.glossaryVersion,
                    program: { connect: { id: programId } },
                    sourceProgramVersion: {
                      connect: { id: input.sourceProgramVersionId },
                    },
                  },
                  select: workflowSelect,
                });
            await writeAuditEvent(transaction, {
              action: AuditAction.PROGRAM_TRANSLATION_WORKFLOW_UPDATE,
              actorUserId,
              idempotencyKey: createAuditIdempotencyKey(
                input.action,
                programId,
                { ...input },
              ),
              metadata: {
                action: input.action,
                workflowVersion: workflow.version,
              },
              targetId: programId,
              targetType: 'program_translation_workflow',
            });
            return {
              kind: 'APPLIED' as const,
              workflow: mapWorkflow(workflow),
            };
          }

          if (!existing) return { kind: 'INVALID_TRANSITION' as const };
          if (existing.version !== input.expectedVersion)
            return { kind: 'CONFLICT' as const };
          const data = transitionData(existing, actorUserId, input, now());
          if (!data) return { kind: 'INVALID_TRANSITION' as const };
          const workflow = await transaction.programTranslationWorkflow.update({
            where: { programId, version: input.expectedVersion },
            data: { ...data, version: { increment: 1 } },
            select: workflowSelect,
          });
          await writeAuditEvent(transaction, {
            action: AuditAction.PROGRAM_TRANSLATION_WORKFLOW_UPDATE,
            actorUserId,
            idempotencyKey: createAuditIdempotencyKey(input.action, programId, {
              ...input,
            }),
            metadata: {
              action: input.action,
              workflowVersion: workflow.version,
            },
            targetId: programId,
            targetType: 'program_translation_workflow',
          });
          return { kind: 'APPLIED' as const, workflow: mapWorkflow(workflow) };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },
  };
}
