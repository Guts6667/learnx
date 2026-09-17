import { z } from 'zod';

/** Research contract only. Never imported by the learner runtime. */
export const RECOVERY_RUBRIC = {
  version: 'explanatory-writing-recovery/1.0.0',
  language: 'fr-FR',
  status: 'OWNER_REVIEW_REQUIRED',
  criteria: [
    {
      key: 'source-fidelity',
      label: 'Fidélité au dossier',
      roles: ['claim'],
      requirements: [
        'Les faits déterminants sont rapportés avec leurs valeurs exactes.',
        'Le périmètre et les conditions observées sont conservés.',
        'Aucun fait ni résultat extérieur au dossier n’est présenté comme établi.',
      ],
    },
    {
      key: 'mechanism-link',
      label: 'Lien explicatif',
      roles: ['cause', 'effect', 'link'],
      requirements: [
        'La condition ou action explicative du dossier est identifiée.',
        'Son effet est identifié et relié explicitement à cette condition.',
        'Le lien respecte la portée causale autorisée par le dossier.',
      ],
    },
    {
      key: 'uncertainty-boundary',
      label: 'Limite de la conclusion',
      roles: ['unknown', 'resolution'],
      requirements: [
        'L’inconnue indiquée par le dossier est nommée.',
        'La conclusion ne suppose pas que cette inconnue est résolue.',
        'L’observation nécessaire pour la résoudre est indiquée.',
      ],
    },
  ],
  levels: {
    mastered: 'Les trois exigences sont établies, sans contradiction.',
    partial:
      'Deux exigences établies ; la troisième est explicitement non satisfaite.',
    limited:
      'Une exigence établie ; les deux autres sont explicitement non satisfaites.',
    insufficient:
      'Contradiction explicite, ou aucune exigence satisfaite avec preuve complète.',
  },
  uncertainty:
    'Une preuve introuvable ou une extraction incomplète ne prouve pas une absence : LOW, sans niveau.',
  indicativeScore: null,
} as const;

const criterionKey = z.enum([
  'source-fidelity',
  'mechanism-link',
  'uncertainty-boundary',
]);
const level = z.enum(['mastered', 'partial', 'limited', 'insufficient']);
const sentence = z
  .object({ id: z.string().min(1), text: z.string().min(1) })
  .strict();

const recoveryCaseSchema = z
  .object({
    caseId: z.string().min(1),
    sourceAnswerId: z.string().min(1),
    variant: z.enum(['BASELINE', 'FACT_INVERSION', 'EVIDENCE_DELETION']),
    dossier: z.string().min(1),
    instruction: z.string().min(1),
    sentences: z.array(sentence).min(1),
  })
  .strict()
  .refine(
    (answer) =>
      new Set(answer.sentences.map((row) => row.id)).size ===
      answer.sentences.length,
    'Sentence identifiers must be unique',
  );

export const recoverySourceSchema = z
  .object({
    sourceAnswerId: z.string().min(1),
    provenance: z.string().min(1),
    dossier: z.string().min(1),
    instruction: z.string().min(1),
    sentences: z.array(sentence).min(1),
    mutations: z
      .array(
        z
          .object({
            kind: z.enum(['FACT_INVERSION', 'EVIDENCE_DELETION']),
            targetCriterion: criterionKey,
            description: z.string().min(1),
            sentences: z.array(sentence).min(1),
          })
          .strict(),
      )
      .length(2),
  })
  .strict();

const recoveryPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    rubricVersion: z.literal(RECOVERY_RUBRIC.version),
    provenance: z.enum(['OWNER_SUPPLIED', 'SYNTHETIC_DRAFT']),
    cases: z.array(recoveryCaseSchema).length(90),
    retestCaseIds: z.array(z.string()).length(10),
  })
  .strict();

export const recoveryExtractionSchema = z
  .object({
    criteria: z.array(
      z
        .object({
          criterionKey,
          proposedLevel: level,
          roles: z.record(z.string(), z.array(z.string())),
        })
        .strict(),
    ),
  })
  .strict();

export const recoveryVerificationSchema = z
  .object({
    criteria: z.array(
      z
        .object({
          criterionKey,
          requirements: z
            .array(
              z.enum([
                'SATISFIED',
                'NOT_SATISFIED',
                'CONTRADICTED',
                'UNCERTAIN',
              ]),
            )
            .length(3),
          completeEvidence: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

const referenceRow = z
  .object({
    caseId: z.string(),
    criteria: z
      .array(
        z
          .object({
            criterionKey,
            level: level.nullable(),
            roles: z.record(z.string(), z.array(z.string())),
          })
          .strict(),
      )
      .length(3),
  })
  .strict();

export const recoveryReferenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    rubricVersion: z.literal(RECOVERY_RUBRIC.version),
    packHash: z.string().regex(/^[a-f0-9]{64}$/u),
    reviewer: z.literal('Rayan'),
    reviewedAt: z.string().datetime(),
    rubricApproved: z.literal(true),
    independentSourcesConfirmed: z.literal(true),
    labelsLockedBeforeModelOutputs: z.literal(true),
    labels: z.array(referenceRow),
    retest: z.array(referenceRow).length(10),
  })
  .strict();

export const recoveryLockSchema = z
  .object({
    schemaVersion: z.literal(1),
    packHash: z.string().regex(/^[a-f0-9]{64}$/u),
    referenceHash: z.string().regex(/^[a-f0-9]{64}$/u),
    lockedAt: z.string().datetime(),
    reviewer: z.literal('Rayan'),
    uncertainSourceCriteria: z.array(z.string()),
    status: z.literal('READY_FOR_BUDGETED_MEASUREMENT'),
  })
  .strict();

export type RecoveryLock = z.infer<typeof recoveryLockSchema>;
export type RecoveryCase = z.infer<typeof recoveryCaseSchema>;
export type RecoverySource = z.infer<typeof recoverySourceSchema>;
export type RecoveryPack = z.infer<typeof recoveryPackSchema>;
export type RecoveryExtraction = z.infer<typeof recoveryExtractionSchema>;
export type RecoveryReference = z.infer<typeof recoveryReferenceSchema>;
export type RecoveryCriterionKey =
  (typeof RECOVERY_RUBRIC.criteria)[number]['key'];
export type RecoveryLevel = keyof typeof RECOVERY_RUBRIC.levels;

/** Sentence IDs and whitespace cannot turn copied text into independent evidence. */
function normalizedAnswerText(answer: RecoveryCase): string {
  return answer.sentences
    .map((sentence) => sentence.text)
    .join(' ')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Apply at preparation AND import/lock: an edited pack gets no weaker checks. */
export function validateRecoveryPack(rawPack: unknown): RecoveryPack {
  const pack = recoveryPackSchema.parse(rawPack);
  const caseIds = new Set(pack.cases.map((answer) => answer.caseId));
  const sourceIds = new Set(pack.cases.map((answer) => answer.sourceAnswerId));
  if (caseIds.size !== 90 || sourceIds.size !== 30)
    throw new Error('Expected 90 unique cases from 30 source answers.');
  const originalTexts = new Set<string>();
  for (const sourceId of sourceIds) {
    const group = pack.cases.filter(
      (answer) => answer.sourceAnswerId === sourceId,
    );
    if (
      group.length !== 3 ||
      new Set(group.map((answer) => answer.variant)).size !== 3
    )
      throw new Error(
        'Each source requires its original and two distinct targeted mutations.',
      );
    const original = group.find((answer) => answer.variant === 'BASELINE');
    if (!original) throw new Error('Missing original answer.');
    const text = normalizedAnswerText(original);
    if (originalTexts.has(text))
      throw new Error(
        'Duplicated original answer text is not an independent source.',
      );
    originalTexts.add(text);
    if (
      group.some(
        (answer) =>
          answer.dossier !== original.dossier ||
          answer.instruction !== original.instruction,
      )
    )
      throw new Error(
        'Mutations must preserve their source dossier and instruction.',
      );
    if (new Set(group.map(normalizedAnswerText)).size !== 3)
      throw new Error(
        'Each mutation must change its source answer text and differ from the other mutation.',
      );
  }
  return pack;
}
