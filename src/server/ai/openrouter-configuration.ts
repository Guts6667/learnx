import { z } from 'zod';

import {
  AI_MODEL_ROLES,
  AiProviderError,
  type AiModelRole,
} from './structured-provider.js';

export const AI_DEPLOYMENT_ENVIRONMENTS = [
  'development',
  'preview',
  'production',
] as const;

export type AiDeploymentEnvironment =
  (typeof AI_DEPLOYMENT_ENVIRONMENTS)[number];

export interface AiModelAssignment {
  modelId: string;
  provider: string;
}

export interface OpenRouterConfiguration {
  apiKey: string | null;
  appUrl: string;
  assignments: Partial<Record<AiModelRole, AiModelAssignment>>;
  deploymentEnvironment: AiDeploymentEnvironment;
  enabled: boolean;
  killSwitch: boolean;
  maxContextCharacters: number;
  maxOutputTokens: number;
  maxRetryDelayMs: number;
  requestTimeoutMs: number;
}

type EnvironmentValues = Record<string, string | undefined>;

const exactModelIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i)
  .refine(
    (value) => !/(^|[/_-])(auto|latest|free|beta)(?:$|[/_:-])/i.test(value),
    'Dynamic model aliases are forbidden.',
  );

const providerSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9._/-]*$/i);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new AiProviderError('CONFIGURATION_INVALID', false);
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  limits: { max: number; min: number },
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < limits.min ||
    parsed > limits.max
  ) {
    throw new AiProviderError('CONFIGURATION_INVALID', false);
  }
  return parsed;
}

function parseAllowlist(
  value: string | undefined,
  schema: typeof exactModelIdSchema | typeof providerSchema,
): Set<string> {
  if (!value?.trim()) {
    throw new AiProviderError('CONFIGURATION_INVALID', false);
  }
  const parsed = value
    .split(',')
    .map((entry) => schema.safeParse(entry.trim()))
    .map((entry) => {
      if (!entry.success) {
        throw new AiProviderError('CONFIGURATION_INVALID', false);
      }
      return entry.data;
    });
  if (parsed.length !== new Set(parsed).size) {
    throw new AiProviderError('CONFIGURATION_INVALID', false);
  }
  return new Set(parsed);
}

function assignmentVariable(role: AiModelRole, suffix: 'MODEL' | 'PROVIDER') {
  return `LEARNX_AI_${role}_${suffix}`;
}

function parseAssignments(
  values: EnvironmentValues,
): Partial<Record<AiModelRole, AiModelAssignment>> {
  const allowedModels = parseAllowlist(
    values.LEARNX_AI_ALLOWED_MODELS,
    exactModelIdSchema,
  );
  const allowedProviders = parseAllowlist(
    values.LEARNX_AI_ALLOWED_PROVIDERS,
    providerSchema,
  );
  const assignments: Partial<Record<AiModelRole, AiModelAssignment>> = {};

  AI_MODEL_ROLES.forEach((role) => {
    const model = exactModelIdSchema.safeParse(
      values[assignmentVariable(role, 'MODEL')],
    );
    const provider = providerSchema.safeParse(
      values[assignmentVariable(role, 'PROVIDER')],
    );
    if (!model.success || !provider.success) {
      throw new AiProviderError('CONFIGURATION_INVALID', false);
    }
    if (
      !allowedModels.has(model.data) ||
      !allowedProviders.has(provider.data)
    ) {
      throw new AiProviderError('CONFIGURATION_INVALID', false);
    }
    assignments[role] = {
      modelId: model.data,
      provider: provider.data,
    };
  });

  return assignments;
}

export function readOpenRouterConfiguration(input: {
  deploymentEnvironment: AiDeploymentEnvironment;
  values?: EnvironmentValues;
}): OpenRouterConfiguration {
  const values = input.values ?? process.env;
  const enabled = parseBoolean(values.LEARNX_AI_ENABLED, false);
  const killSwitch = parseBoolean(values.LEARNX_AI_KILL_SWITCH, true);
  const operational = enabled && !killSwitch;
  const configuredEnvironment = values.LEARNX_AI_CONFIG_ENVIRONMENT?.trim();

  if (enabled && configuredEnvironment !== input.deploymentEnvironment) {
    throw new AiProviderError('CONFIGURATION_INVALID', false);
  }

  const apiKey = values.OPENROUTER_API_KEY?.trim() || null;
  const configuredAppUrl = values.APP_URL?.trim();
  const appUrl = configuredAppUrl || 'http://localhost:5173';

  if (
    operational &&
    (!apiKey || !configuredAppUrl || !z.url().safeParse(appUrl).success)
  ) {
    throw new AiProviderError('CONFIGURATION_INVALID', false);
  }

  return {
    apiKey,
    appUrl,
    assignments: operational ? parseAssignments(values) : {},
    deploymentEnvironment: input.deploymentEnvironment,
    enabled,
    killSwitch,
    maxContextCharacters: parseInteger(
      values.LEARNX_AI_MAX_CONTEXT_CHARACTERS,
      120_000,
      { min: 1_000, max: 2_000_000 },
    ),
    maxOutputTokens: parseInteger(values.LEARNX_AI_MAX_OUTPUT_TOKENS, 4_096, {
      min: 128,
      max: 65_536,
    }),
    maxRetryDelayMs: parseInteger(values.LEARNX_AI_MAX_RETRY_DELAY_MS, 2_000, {
      min: 0,
      max: 10_000,
    }),
    requestTimeoutMs: parseInteger(
      values.LEARNX_AI_REQUEST_TIMEOUT_MS,
      30_000,
      { min: 1_000, max: 120_000 },
    ),
  };
}
