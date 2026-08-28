import { createHash } from 'node:crypto';

export type PublicationAction = 'PUBLISH' | 'UNPUBLISH';
export type PublicationMode = 'FULL' | 'PARENT_ONLY';
export type PublicationTargetType = 'MODULE' | 'PROGRAM' | 'STAGE';
type PublicationEntityType = PublicationTargetType | 'LESSON';

interface PublicationEntityBase {
  id: string;
  title: string;
  updatedAt: string;
}

interface PublicationLesson extends PublicationEntityBase {
  isPublished: boolean;
  requiredConcepts: Array<{
    assessmentIds: string[];
    id: string;
    title: string;
  }>;
}

export interface PublicationModule extends PublicationEntityBase {
  isPublished: boolean;
  lessons: PublicationLesson[];
}

export interface PublicationStage extends PublicationEntityBase {
  finalAssessmentIds: string[];
  isPublished: boolean;
  modules: PublicationModule[];
}

export interface PublicationProgram extends PublicationEntityBase {
  stages: PublicationStage[];
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
}

export type PublicationTarget =
  | { entity: PublicationModule; type: 'MODULE' }
  | { entity: PublicationProgram; type: 'PROGRAM' }
  | { entity: PublicationStage; type: 'STAGE' };

interface PublicationChange {
  from: 'ACTIVE' | 'ARCHIVED' | 'DRAFT' | boolean;
  id: string;
  title: string;
  to: 'ACTIVE' | 'DRAFT' | boolean;
  type: PublicationEntityType;
}

interface PublicationBlocker {
  code:
    | 'FINAL_ASSESSMENT_MISSING'
    | 'LESSON_ASSESSMENT_MISSING'
    | 'MODULE_EMPTY'
    | 'PROGRAM_ARCHIVED'
    | 'PROGRAM_EMPTY'
    | 'SCOPE_TOO_LARGE'
    | 'STAGE_EMPTY'
    | 'TRANSLATION_REVIEW_REQUIRED';
  id: string;
  message: string;
  title: string;
  type: PublicationEntityType;
}

export interface PublicationPlan {
  action: PublicationAction;
  blockers: PublicationBlocker[];
  changes: PublicationChange[];
  mode: PublicationMode;
  planId: string;
  target: {
    id: string;
    title: string;
    type: PublicationTargetType;
  };
  warnings: string[];
}

const MAX_PUBLICATION_ENTITIES = 1_000;

function moduleEntities(module: PublicationModule): PublicationChange[] {
  return [
    {
      from: module.isPublished,
      id: module.id,
      title: module.title,
      to: true,
      type: 'MODULE',
    },
    ...module.lessons.map((lesson) => ({
      from: lesson.isPublished,
      id: lesson.id,
      title: lesson.title,
      to: true as const,
      type: 'LESSON' as const,
    })),
  ];
}

function stageEntities(stage: PublicationStage): PublicationChange[] {
  return [
    {
      from: stage.isPublished,
      id: stage.id,
      title: stage.title,
      to: true,
      type: 'STAGE',
    },
    ...stage.modules.flatMap(moduleEntities),
  ];
}

function targetEntities(target: PublicationTarget): PublicationChange[] {
  if (target.type === 'MODULE') return moduleEntities(target.entity);
  if (target.type === 'STAGE') return stageEntities(target.entity);

  return [
    {
      from: target.entity.status,
      id: target.entity.id,
      title: target.entity.title,
      to: 'ACTIVE',
      type: 'PROGRAM',
    },
    ...target.entity.stages.flatMap(stageEntities),
  ];
}

function collectBlockers(target: PublicationTarget): PublicationBlocker[] {
  const blockers: PublicationBlocker[] = [];
  const stages =
    target.type === 'PROGRAM'
      ? target.entity.stages
      : target.type === 'STAGE'
        ? [target.entity]
        : [];
  const modules =
    target.type === 'MODULE'
      ? [target.entity]
      : stages.flatMap((stage) => stage.modules);

  if (target.type === 'PROGRAM') {
    if (target.entity.status === 'ARCHIVED') {
      blockers.push({
        code: 'PROGRAM_ARCHIVED',
        id: target.entity.id,
        message: 'Un programme archivé ne peut pas être publié.',
        title: target.entity.title,
        type: 'PROGRAM',
      });
    }
    if (target.entity.stages.length === 0) {
      blockers.push({
        code: 'PROGRAM_EMPTY',
        id: target.entity.id,
        message: 'Le programme doit contenir au moins une étape.',
        title: target.entity.title,
        type: 'PROGRAM',
      });
    }
  }

  for (const stage of stages) {
    if (stage.finalAssessmentIds.length === 0) {
      blockers.push({
        code: 'FINAL_ASSESSMENT_MISSING',
        id: stage.id,
        message: 'L’étape doit posséder une évaluation finale obligatoire.',
        title: stage.title,
        type: 'STAGE',
      });
    }
    if (stage.modules.length === 0) {
      blockers.push({
        code: 'STAGE_EMPTY',
        id: stage.id,
        message: 'L’étape doit contenir au moins un module.',
        title: stage.title,
        type: 'STAGE',
      });
    }
  }

  for (const module of modules) {
    if (module.lessons.length === 0) {
      blockers.push({
        code: 'MODULE_EMPTY',
        id: module.id,
        message: 'Le module doit contenir au moins une leçon.',
        title: module.title,
        type: 'MODULE',
      });
    }
    for (const lesson of module.lessons) {
      for (const concept of lesson.requiredConcepts) {
        if (concept.assessmentIds.length === 0) {
          blockers.push({
            code: 'LESSON_ASSESSMENT_MISSING',
            id: concept.id,
            message: `La notion obligatoire « ${concept.title} » doit être évaluée.`,
            title: lesson.title,
            type: 'LESSON',
          });
        }
      }
    }
  }

  return blockers;
}

function planHash(
  target: PublicationTarget,
  action: PublicationAction,
  mode: PublicationMode,
  contextVersion = '',
): string {
  return createHash('sha256')
    .update(JSON.stringify({ action, contextVersion, mode, target }))
    .digest('hex');
}

interface PublicationPolicyContext {
  blockers?: PublicationBlocker[];
  version?: string;
}

export function buildPublicationPlan(
  target: PublicationTarget,
  action: PublicationAction,
  requestedMode: PublicationMode,
  policy: PublicationPolicyContext = {},
): PublicationPlan {
  const mode = action === 'PUBLISH' ? 'FULL' : requestedMode;
  const allEntities = targetEntities(target);
  const selectedEntities =
    action === 'UNPUBLISH' && mode === 'PARENT_ONLY'
      ? allEntities.slice(0, 1)
      : allEntities;
  const changes = selectedEntities
    .map((entity) => ({
      ...entity,
      to:
        action === 'PUBLISH'
          ? entity.to
          : entity.type === 'PROGRAM'
            ? ('DRAFT' as const)
            : false,
    }))
    .filter((entity) => entity.from !== entity.to);
  const blockers = action === 'PUBLISH' ? collectBlockers(target) : [];
  if (action === 'PUBLISH' && policy.blockers) {
    blockers.push(...policy.blockers);
  }

  if (allEntities.length > MAX_PUBLICATION_ENTITIES) {
    blockers.push({
      code: 'SCOPE_TOO_LARGE',
      id: target.entity.id,
      message: `La hiérarchie dépasse la limite de ${MAX_PUBLICATION_ENTITIES} éléments.`,
      title: target.entity.title,
      type: target.type,
    });
  }

  return {
    action,
    blockers,
    changes,
    mode,
    planId: planHash(target, action, mode, policy.version),
    target: {
      id: target.entity.id,
      title: target.entity.title,
      type: target.type,
    },
    warnings:
      action === 'UNPUBLISH'
        ? [
            mode === 'FULL'
              ? 'Toute la branche sera dépubliée. Les progressions et soumissions seront conservées.'
              : 'Le parent masquera temporairement sa branche. Les états des descendants seront conservés.',
          ]
        : [],
  };
}
