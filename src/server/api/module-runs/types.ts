import type { MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';

interface RestartCounts {
  concepts: number;
  exercises: number;
  lessons: number;
  quizzes: number;
  resources: number;
  tasks: number;
}

export interface ModuleRestartPreview {
  currentRunSequence: number;
  firstLesson: { slug: string; title: string } | null;
  moduleId: string;
  moduleTitle: string;
  preserved: {
    conceptAttempts: number;
    exerciseSubmissions: number;
    notes: number;
    quizAttempts: number;
  };
  reset: RestartCounts;
}

export interface ModuleRestartResult extends ModuleRestartPreview {
  idempotent: boolean;
  runId: string;
}

export interface ModuleRestartRepository {
  preview(
    moduleId: string,
    userId: string,
  ): Promise<ModuleRestartPreview | null>;
  restart(
    moduleId: string,
    restartKey: string,
    userId: string,
  ): Promise<ModuleRestartResult | null>;
}

export interface ProgramRestartPreview {
  firstLesson: { slug: string; title: string } | null;
  programId: string;
  programTitle: string;
  preserved: ModuleRestartPreview['preserved'] & {
    stageAssessmentSubmissions: number;
  };
  reset: RestartCounts & { modules: number; stages: number };
}

export interface ProgramRestartResult extends ProgramRestartPreview {
  idempotent: boolean;
  runIds: string[];
}

export interface ProgramRestartRepository {
  preview(
    programId: string,
    userId: string,
  ): Promise<ProgramRestartPreview | null>;
  restart(
    programId: string,
    restartKey: string,
    userId: string,
  ): Promise<ProgramRestartResult | null>;
}

export interface ModuleRunsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  programRepository?: ProgramRestartRepository;
  repository?: ModuleRestartRepository;
}
