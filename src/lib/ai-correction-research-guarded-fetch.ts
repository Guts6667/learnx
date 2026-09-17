/** Research-only paid transport. Caller holds the shared lock until finish(). */
import { z } from 'zod';
import {
  atomCallReservationUsd,
  type openAtomBudget,
} from './ai-correction-atom-verifier-budget.js';

const money = z.number().finite().nonnegative();
const modelSchema = z.object({
  modelId: z.string().min(1),
  promptUsdPerToken: money.positive(),
  completionUsdPerToken: money.positive(),
  maxOutputTokens: z.number().int().positive(),
});
const providerSchema = z
  .object({
    only: z.array(z.string().min(1)).min(1),
    order: z.array(z.string().min(1)).optional(),
    allow_fallbacks: z.literal(false),
    data_collection: z.literal('deny'),
    require_parameters: z.literal(true),
    max_price: z
      .object({ prompt: money, completion: money })
      .strict()
      .optional(),
  })
  .strict();
// Extra billing paths (tools, plugins, images, audio, multiple generations,
// model fallback and streaming) require their own reviewed reservation model.
const requestSchema = z
  .object({
    model: z.string().min(1),
    messages: z
      .array(
        z
          .object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string(),
          })
          .strict(),
      )
      .min(1),
    max_tokens: z.number().int().positive(),
    provider: providerSchema,
    response_format: z.record(z.string(), z.unknown()).optional(),
    reasoning: z.record(z.string(), z.unknown()).optional(),
    temperature: z.number().finite().optional(),
    top_p: z.number().finite().optional(),
    seed: z.number().int().optional(),
    usage: z.object({ include: z.boolean() }).strict().optional(),
    stream: z.literal(false).optional(),
    n: z.literal(1).optional(),
  })
  .strict();

/** The identical validated price-pinned body for transport and evidence hashes. */
export function applyResearchPriceCeilings(
  source: unknown,
  pricing: z.infer<typeof modelSchema>,
) {
  const parsed = requestSchema.safeParse(source);
  const model = modelSchema.parse(pricing);
  if (!parsed.success) throw new Error('RESEARCH_TRANSPORT_REQUEST_INVALID');
  const body = parsed.data;
  if (body.model !== model.modelId || body.max_tokens > model.maxOutputTokens)
    throw new Error('RESEARCH_TRANSPORT_MODEL_OR_OUTPUT_LIMIT_REFUSED');
  const reasoningLimit = body.reasoning?.max_tokens;
  if (
    reasoningLimit !== undefined &&
    (typeof reasoningLimit !== 'number' ||
      !Number.isInteger(reasoningLimit) ||
      reasoningLimit < 0 ||
      reasoningLimit > body.max_tokens)
  )
    throw new Error('RESEARCH_TRANSPORT_REASONING_LIMIT_REFUSED');
  const oldPrice = body.provider.max_price;
  return {
    ...body,
    provider: {
      ...body.provider,
      max_price: {
        prompt: Math.min(
          oldPrice?.prompt ?? Infinity,
          model.promptUsdPerToken * 1_000_000,
        ),
        completion: Math.min(
          oldPrice?.completion ?? Infinity,
          model.completionUsdPerToken * 1_000_000,
        ),
      },
    },
  };
}

/**
 * Each POST has one durable intent and one settlement independent of payload
 * validity. A response remains readable by its normal parser. Unknown bills
 * are null; finish() makes even a final-call unknown/overrun visibly terminal.
 * Always await finish() in a finally block, before releasing the shared lock.
 * Supply the original fetcher to readProviderUsage to avoid recursive guards.
 */
export function createGuardedResearchFetch(input: {
  budget: ReturnType<typeof openAtomBudget>;
  models: z.infer<typeof modelSchema>[];
  readProviderUsage: () => Promise<number | null>;
  fetcher: typeof fetch;
}) {
  const models = input.models.map((model) => modelSchema.parse(model));
  if (
    !models.length ||
    new Set(models.map((m) => m.modelId)).size !== models.length
  )
    throw new Error('RESEARCH_TRANSPORT_MODEL_CONFIGURATION_INVALID');
  const pending = new Set<Promise<Response>>();
  let closing = false;
  let stopped: string | null = null;
  const refuse = (reason: string): never => {
    stopped ??= reason;
    throw new Error(reason);
  };
  const assertOpen = () => {
    if (stopped) throw new Error(stopped);
    if (closing) throw new Error('RESEARCH_TRANSPORT_CLOSED');
  };
  const settle = (
    callId: string,
    costUsd: number | null,
    reservedUsd: number,
  ) => {
    try {
      input.budget.settle(callId, costUsd);
    } catch (error) {
      stopped ??=
        'RESEARCH_RECONCILIATION_REQUIRED: settlement persistence failed';
      throw error;
    }
    if (costUsd === null)
      stopped ??= 'RESEARCH_RECONCILIATION_REQUIRED: provider cost unknown';
    else if (costUsd > reservedUsd)
      stopped ??= 'RESEARCH_RESERVATION_EXCEEDED: reconciliation required';
  };
  const dispatch = async (
    resource: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const request = new Request(resource, init);
    const url = new URL(request.url);
    if (url.origin !== 'https://openrouter.ai')
      return refuse('RESEARCH_TRANSPORT_DESTINATION_REFUSED');
    if (
      request.method === 'GET' &&
      ['/api/v1/credits', '/api/v1/key'].includes(url.pathname)
    )
      return input.fetcher(request);
    assertOpen();
    if (
      request.method !== 'POST' ||
      url.pathname !== '/api/v1/chat/completions'
    )
      return refuse('RESEARCH_TRANSPORT_OPERATION_REFUSED');
    let raw: unknown;
    try {
      raw = JSON.parse(await request.text());
    } catch {
      return refuse('RESEARCH_TRANSPORT_REQUEST_INVALID');
    }
    const identity = z.object({ model: z.string() }).safeParse(raw);
    const model = models.find(
      (m) => identity.success && m.modelId === identity.data.model,
    );
    if (!model)
      return refuse('RESEARCH_TRANSPORT_MODEL_OR_OUTPUT_LIMIT_REFUSED');
    let pricedBody: ReturnType<typeof applyResearchPriceCeilings>;
    try {
      pricedBody = applyResearchPriceCeilings(raw, model);
    } catch (error) {
      return refuse(
        error instanceof Error
          ? error.message
          : 'RESEARCH_TRANSPORT_REQUEST_INVALID',
      );
    }
    const body = JSON.stringify(pricedBody);
    const reservedUsd = atomCallReservationUsd({
      prompt: body,
      ...model,
      maxOutputTokens: pricedBody.max_tokens,
    });
    // Rebuild before reserving: a malformed Request is a known non-dispatch.
    const priced = new Request(request, { body, redirect: 'error' });
    priced.headers.delete('content-length');
    const usage = await input.readProviderUsage().catch(() => null);
    assertOpen();
    if (priced.signal.aborted)
      return refuse('RESEARCH_TRANSPORT_ABORTED_BEFORE_DISPATCH');
    let callId: string;
    try {
      callId = input.budget.reserve(reservedUsd, usage);
    } catch (error) {
      stopped ??=
        error instanceof Error ? error.message : 'RESEARCH_RESERVATION_REFUSED';
      throw error;
    }
    let response: Response;
    try {
      response = await input.fetcher(priced);
    } catch (error) {
      settle(callId, null, reservedUsd);
      throw new Error(
        'RESEARCH_RECONCILIATION_REQUIRED: provider transport failed',
        { cause: error },
      );
    }
    let costUsd: number | null = null;
    try {
      const cost = z
        .object({ usage: z.object({ cost: money }) })
        .safeParse(await response.clone().json());
      if (cost.success) costUsd = cost.data.usage.cost;
    } catch {
      // The original response still belongs to the caller. Unreadable usage
      // is unknown spending, not an invented free HTTP/schema failure.
    }
    settle(callId, costUsd, reservedUsd);
    return response;
  };
  const guardedFetch: typeof fetch = (resource, init) => {
    const operation = dispatch(resource, init);
    pending.add(operation);
    void operation
      .finally(() => pending.delete(operation))
      .catch(() => undefined);
    return operation;
  };
  const assertReconciled = () => {
    if (stopped) throw new Error(stopped);
    if (pending.size) throw new Error('RESEARCH_TRANSPORT_CALLS_IN_FLIGHT');
    if (input.budget.totals().unknownCalls)
      throw new Error('RESEARCH_RECONCILIATION_REQUIRED');
  };
  return {
    fetch: guardedFetch,
    assertReconciled,
    async finish(): Promise<void> {
      closing = true;
      await Promise.allSettled([...pending]);
      assertReconciled();
    },
  };
}
