import { z } from 'zod';

import {
  parseVerifierAnswer,
  VERIFIER_JSON_SCHEMA,
  VERIFIER_SYSTEM_PROMPT,
  type PriceUsdPerToken,
} from './ai-correction-atom-verifier.js';

export const ATOM_REQUEST_PROFILE = {
  version: '2.0.0',
  maxOutputTokens: 400,
  reasoning: { enabled: false },
  temperature: 0,
  timeoutMs: 60_000,
} as const;

export type AtomCandidate = {
  id: string;
  modelId: string;
  price: PriceUsdPerToken;
  priceSource: string;
  route: { slug: string; provider: string } | null;
};

const costSchema = z.number().finite().nonnegative();
const envelopeSchema = z.object({
  id: z.string().optional(),
  model: z.string(),
  provider: z.string(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string(),
        message: z.object({ content: z.string().nullable() }),
      }),
    )
    .min(1),
  usage: z.object({
    cost: costSchema,
    completion_tokens_details: z.object({
      reasoning_tokens: z.number().int().nonnegative(),
    }),
  }),
});

export type AtomTransportResult = {
  content: string | null;
  costUsd: number | null;
  errorCode: string | null;
  generationId: string | null;
  providerRoute: string | null;
};

export function atomRequestBody(candidate: AtomCandidate, userMessage: string) {
  if (!candidate.route) throw new Error('ATOM_PROFILE_UNVERIFIED');
  return {
    model: candidate.modelId,
    messages: [
      { role: 'system', content: VERIFIER_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: ATOM_REQUEST_PROFILE.maxOutputTokens,
    reasoning: ATOM_REQUEST_PROFILE.reasoning,
    temperature: ATOM_REQUEST_PROFILE.temperature,
    provider: {
      only: [candidate.route.slug],
      allow_fallbacks: false,
      data_collection: 'deny',
      require_parameters: true,
      // OpenRouter provider routing prices are USD per million tokens.
      max_price: {
        prompt: candidate.price.prompt * 1_000_000,
        completion: candidate.price.completion * 1_000_000,
      },
    },
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'learnx_atom_verdict',
        strict: true,
        schema: VERIFIER_JSON_SCHEMA,
      },
    },
    usage: { include: true },
  };
}

/** A malformed/unsupported response is never a semantic failure or a free call. */
export async function callAtomModel(input: {
  apiKey: string;
  candidate: AtomCandidate;
  userMessage: string;
  fetcher?: typeof fetch;
}): Promise<AtomTransportResult> {
  const empty = {
    content: null,
    costUsd: null,
    generationId: null,
    providerRoute: null,
  };
  const body = atomRequestBody(input.candidate, input.userMessage);
  try {
    const response = await (input.fetcher ?? fetch)(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://learn-x.app',
          'X-Title': 'LearnX atom verifier recovery',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ATOM_REQUEST_PROFILE.timeoutMs),
      },
    );
    const raw: unknown = await response.json();
    const cost = z
      .object({ usage: z.object({ cost: costSchema }) })
      .safeParse(raw);
    const costUsd = cost.success ? cost.data.usage.cost : null;
    if (!response.ok)
      return { ...empty, costUsd, errorCode: `HTTP_${response.status}` };
    const parsed = envelopeSchema.safeParse(raw);
    if (!parsed.success)
      return { ...empty, costUsd, errorCode: 'PROVIDER_ENVELOPE_INVALID' };
    const p = parsed.data;
    const choice = p.choices[0];
    let errorCode: string | null = null;
    if (
      p.model !== input.candidate.modelId ||
      p.provider !== input.candidate.route?.provider
    )
      errorCode = 'PROVIDER_IDENTITY_MISMATCH';
    else if (p.usage.completion_tokens_details.reasoning_tokens !== 0)
      errorCode = 'REASONING_PROFILE_NOT_HONOURED';
    else if (choice.finish_reason !== 'stop')
      errorCode = 'MODEL_OUTPUT_TRUNCATED_OR_UNFINISHED';
    else if (
      !choice.message.content ||
      !parseVerifierAnswer(choice.message.content)
    )
      errorCode = 'MODEL_OUTPUT_SCHEMA_INVALID';
    return {
      content: choice.message.content,
      costUsd,
      errorCode,
      generationId: p.id ?? null,
      providerRoute: p.provider,
    };
  } catch {
    return { ...empty, errorCode: 'PROVIDER_TRANSPORT_UNKNOWN_COST' };
  }
}

export async function readAtomProviderUsage(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<number | null> {
  try {
    const response = await fetcher('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const parsed = z
      .object({ data: z.object({ total_usage: costSchema }) })
      .safeParse(await response.json());
    return parsed.success ? parsed.data.data.total_usage : null;
  } catch {
    return null;
  }
}
