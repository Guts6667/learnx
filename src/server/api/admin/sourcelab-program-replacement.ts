import { createHash } from 'node:crypto';

export const SOURCELAB_V1_IDENTITY = {
  canonicalProgramKey: 'ingenieur-logiciel-production-sourcelab',
  slug: 'ingenieur-logiciel-production-sourcelab',
} as const;

export const SOURCELAB_V2_IDENTITY = {
  canonicalProgramKey: 'sourcelab-docker-api-socle-ingestion',
  slug: 'sourcelab-docker-api-socle-ingestion',
} as const;

export const SOURCELAB_REPLACEMENT_MODE = 'HARD_OFF' as const;

type ReplacementProgramStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
type ReplacementProgramVisibility = 'PRIVATE' | 'PUBLIC';

export interface SourceLabPreservationCounts {
  conceptAssessmentAttempts: number;
  conceptProgresses: number;
  exerciseSubmissions: number;
  lessonProgresses: number;
  moduleRuns: number;
  programProgresses: number;
  quizAttempts: number;
  stageAssessmentSubmissions: number;
  stageProgresses: number;
  taskCompletions: number;
}

export interface SourceLabReplacementProgramState {
  activeEnrollmentIds: string[];
  canonicalProgramKey: string;
  id: string;
  publishedVersionId: string | null;
  slug: string;
  status: ReplacementProgramStatus;
  updatedAt: string;
  visibility: ReplacementProgramVisibility;
}

export interface SourceLabV2PublicationState {
  allLessonsPublished: boolean;
  allModulesPublished: boolean;
  allRequiredConceptsAssessed: boolean;
  allStagesHaveFinalAssessment: boolean;
  allStagesPublished: boolean;
  lessonCount: number;
  moduleCount: number;
  requiredConceptCount: number;
  stageCount: number;
}

export interface SourceLabReplacementSnapshot {
  preservation: SourceLabPreservationCounts;
  v1: SourceLabReplacementProgramState | null;
  v2:
    | (SourceLabReplacementProgramState & {
        publication: SourceLabV2PublicationState;
      })
    | null;
}

type SourceLabReplacementBlockerCode =
  | 'PROGRAM_IDENTITIES_COLLIDE'
  | 'V1_IDENTITY_MISMATCH'
  | 'V1_NOT_FOUND'
  | 'V2_DESCENDANTS_NOT_PUBLISHED'
  | 'V2_IDENTITY_MISMATCH'
  | 'V2_NOT_FOUND'
  | 'V2_NOT_OFFICIALLY_PUBLISHED'
  | 'V2_NOT_PRIVATE_BEFORE_CUTOVER'
  | 'V2_STRUCTURE_INCOMPLETE';

interface SourceLabReplacementBlocker {
  code: SourceLabReplacementBlockerCode;
  message: string;
}

interface SourceLabReplacementAction {
  operation: 'UPDATE';
  target: 'V1_ACTIVE_ENROLLMENTS' | 'V1_PROGRAM' | 'V2_PROGRAM';
  summary: string;
}

export interface SourceLabReplacementPlan {
  actions: SourceLabReplacementAction[];
  alreadyApplied: boolean;
  blockers: SourceLabReplacementBlocker[];
  executionEnabled: false;
  mode: typeof SOURCELAB_REPLACEMENT_MODE;
  planId: string;
  preservation: SourceLabPreservationCounts;
  rollback: {
    conditions: string[];
    intendedActions: SourceLabReplacementAction[];
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error('Replacement plan contains a non-serializable value.');
  }
  return serialized;
}

function createPlanId(snapshot: SourceLabReplacementSnapshot): string {
  return createHash('sha256')
    .update(stableStringify({ mode: SOURCELAB_REPLACEMENT_MODE, snapshot }))
    .digest('hex');
}

function isV2StructureComplete(
  publication: SourceLabV2PublicationState,
): boolean {
  return (
    publication.stageCount === 3 &&
    publication.moduleCount === 3 &&
    publication.lessonCount === 7 &&
    publication.requiredConceptCount === 7 &&
    publication.allStagesHaveFinalAssessment &&
    publication.allRequiredConceptsAssessed
  );
}

function areV2DescendantsPublished(
  publication: SourceLabV2PublicationState,
): boolean {
  return (
    publication.allStagesPublished &&
    publication.allModulesPublished &&
    publication.allLessonsPublished
  );
}

export function buildSourceLabReplacementPlan(
  snapshot: SourceLabReplacementSnapshot,
): SourceLabReplacementPlan {
  const blockers: SourceLabReplacementBlocker[] = [];
  const v1 = snapshot.v1;
  const v2 = snapshot.v2;
  const finalState = Boolean(
    v1 &&
    v2 &&
    v1.status === 'ARCHIVED' &&
    v1.visibility === 'PRIVATE' &&
    v1.activeEnrollmentIds.length === 0 &&
    v2.status === 'ACTIVE' &&
    v2.visibility === 'PUBLIC' &&
    v2.publishedVersionId,
  );

  if (!v1) {
    blockers.push({
      code: 'V1_NOT_FOUND',
      message: 'Le programme SourceLab V1 historique est introuvable.',
    });
  }
  if (!v2) {
    blockers.push({
      code: 'V2_NOT_FOUND',
      message: 'Le programme SourceLab V2 distinct est introuvable.',
    });
  }

  if (
    v1 &&
    (v1.slug !== SOURCELAB_V1_IDENTITY.slug ||
      v1.canonicalProgramKey !== SOURCELAB_V1_IDENTITY.canonicalProgramKey)
  ) {
    blockers.push({
      code: 'V1_IDENTITY_MISMATCH',
      message:
        'L’identité runtime V1 ne correspond pas au programme historique.',
    });
  }

  if (v1 && v2 && v1.id === v2.id) {
    blockers.push({
      code: 'PROGRAM_IDENTITIES_COLLIDE',
      message: 'V1 et V2 résolvent vers le même programme.',
    });
  }

  if (
    v2 &&
    (v2.slug !== SOURCELAB_V2_IDENTITY.slug ||
      v2.canonicalProgramKey !== SOURCELAB_V2_IDENTITY.canonicalProgramKey)
  ) {
    blockers.push({
      code: 'V2_IDENTITY_MISMATCH',
      message: 'L’identité runtime V2 ne correspond pas au contrat validé.',
    });
  }

  if (v2) {
    if (!isV2StructureComplete(v2.publication)) {
      blockers.push({
        code: 'V2_STRUCTURE_INCOMPLETE',
        message:
          'V2 doit contenir exactement 3 étapes, 3 modules, 7 leçons et 7 notions obligatoires, avec évaluations finales et notions évaluées.',
      });
    }
    if (!areV2DescendantsPublished(v2.publication)) {
      blockers.push({
        code: 'V2_DESCENDANTS_NOT_PUBLISHED',
        message:
          'Toutes les étapes, tous les modules et toutes les leçons V2 doivent être publiés.',
      });
    }
  }

  if (v2 && !finalState) {
    if (v2.status !== 'ACTIVE' || !v2.publishedVersionId) {
      blockers.push({
        code: 'V2_NOT_OFFICIALLY_PUBLISHED',
        message:
          'V2 doit être publiée par le workflow officiel et posséder une version publiée avant toute bascule.',
      });
    }
    if (v2.visibility !== 'PRIVATE') {
      blockers.push({
        code: 'V2_NOT_PRIVATE_BEFORE_CUTOVER',
        message: 'V2 doit rester privée pendant la préparation de la bascule.',
      });
    }
  }

  const alreadyApplied = finalState && blockers.length === 0;

  const actions: SourceLabReplacementAction[] =
    blockers.length > 0 || alreadyApplied
      ? []
      : [
          {
            operation: 'UPDATE',
            target: 'V1_PROGRAM',
            summary:
              'Archiver et rendre privée V1 sans supprimer sa hiérarchie.',
          },
          {
            operation: 'UPDATE',
            target: 'V1_ACTIVE_ENROLLMENTS',
            summary:
              'Retirer les inscriptions V1 actives en conservant toutes les lignes historiques.',
          },
          {
            operation: 'UPDATE',
            target: 'V2_PROGRAM',
            summary:
              'Rendre publique la V2 déjà publiée officiellement, sans modifier son contenu.',
          },
        ];

  return {
    actions,
    alreadyApplied,
    blockers,
    executionEnabled: false,
    mode: SOURCELAB_REPLACEMENT_MODE,
    planId: createPlanId(snapshot),
    preservation: snapshot.preservation,
    rollback: {
      conditions: [
        'Aucune inscription ni progression V2 ne doit avoir été créée depuis la bascule.',
        'Seules les inscriptions V1 retirées par la bascule peuvent être réactivées.',
        'Les identifiants et compteurs historiques V1 doivent être inchangés.',
      ],
      intendedActions: [
        {
          operation: 'UPDATE',
          target: 'V2_PROGRAM',
          summary: 'Rendre V2 privée sans supprimer sa version publiée.',
        },
        {
          operation: 'UPDATE',
          target: 'V1_PROGRAM',
          summary:
            'Restaurer le statut et la visibilité V1 consignés avant bascule.',
        },
        {
          operation: 'UPDATE',
          target: 'V1_ACTIVE_ENROLLMENTS',
          summary:
            'Réactiver uniquement les inscriptions V1 consignées dans le reçu de bascule.',
        },
      ],
    },
  };
}
