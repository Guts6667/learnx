import type { PublicationPlan } from './publication-plan.js';
import type {
  PublicationAction,
  PublicationMode,
  PublicationTargetType,
} from './publication-plan.js';

export interface PublicationRequest {
  action: PublicationAction;
  mode: PublicationMode;
  targetId: string;
  targetType: PublicationTargetType;
}

export interface ApplyPublicationRequest extends PublicationRequest {
  planId: string;
}

export interface PublicationService {
  apply(
    ownerId: string,
    request: ApplyPublicationRequest,
  ): Promise<PublicationPlan | null>;
  preview(
    ownerId: string,
    request: PublicationRequest,
  ): Promise<PublicationPlan | null>;
}

export class PublicationPlanBlockedError extends Error {
  public constructor() {
    super('Publication requirements are not satisfied.');
    this.name = 'PublicationPlanBlockedError';
  }
}

export class PublicationPlanStaleError extends Error {
  public constructor() {
    super('The publication preview is no longer current.');
    this.name = 'PublicationPlanStaleError';
  }
}
