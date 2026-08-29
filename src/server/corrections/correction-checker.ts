import { z } from 'zod';

import { PROMOTED_CHECKER_IDENTITY } from './promoted-identity.js';

/**
 * The independent checker of V4.5-111.
 *
 * It never corrects. It answers one closed question per already-delivered
 * criterion — does this quote support this level — and its answer is the only
 * thing that can lift a criterion to HIGH.
 *
 * Deliberately self-contained rather than routed through the shared provider
 * adapter: the shared body is the promoted correction profile, and adding the
 * restrictive fields the checker needs would change requests for the primary
 * model, which is a re-promotion question (V4.5-115). Keeping the checker's
 * body separate means the primary is untouched by construction, not by
 * convention.
 */

export type CheckerVerdict = 'AGREED' | 'DISAGREED' | 'UNAVAILABLE';

/** Why no usable verdict came back. Recorded, never shown to the learner. */
type CheckerUnavailableReason =
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'ROUTE_MISMATCH'
  | 'TIMEOUT'
  | 'UNKNOWN_CRITERION'
  | 'UNPARSEABLE'
  | 'UNCONFIGURED';

export interface CheckerQuestion {
  criterionKey: string;
  criterionLabel: string;
  levelDescription: string;
  levelLabel: string;
  /** The quotes the correction relied on. The production itself is never sent. */
  quotes: string[];
}

interface CheckerOutcome {
  costUsd: number | null;
  latencyMs: number | null;
  providerRoute: string | null;
  unavailableReason: CheckerUnavailableReason | null;
  verdicts: Record<string, CheckerVerdict>;
}

export interface CorrectionCheckerPort {
  verify(input: { questions: CheckerQuestion[] }): Promise<CheckerOutcome>;
}

const CHECKER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const verdictSchema = z
  .object({
    verdicts: z
      .array(
        z
          .object({
            criterionKey: z.string().trim().min(1),
            supported: z.boolean(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const CHECKER_OUTPUT_JSON_SCHEMA = {
  additionalProperties: false,
  properties: {
    verdicts: {
      items: {
        additionalProperties: false,
        properties: {
          criterionKey: { type: 'string' },
          supported: { type: 'boolean' },
        },
        required: ['criterionKey', 'supported'],
        type: 'object',
      },
      type: 'array',
    },
  },
  required: ['verdicts'],
  type: 'object',
} as const;

/**
 * A system message only, carrying one closed question per criterion.
 *
 * The learner's production is never included — only the quotes the correction
 * already relied on. That keeps what leaves LearnX to the minimum the question
 * needs (ADR §7.2) and makes the recipient register entry a short one.
 */
function buildCheckerMessages(
  questions: CheckerQuestion[],
): Array<{ content: string; role: 'system' }> {
  const lines = [
    'Tu vérifies une correction déjà produite. Tu ne corriges pas.',
    'Pour chaque critère, réponds à une seule question fermée : la citation fournie soutient-elle le niveau retenu ?',
    'Réponds true si la citation soutient le niveau, false sinon.',
    'Tu ne disposes pas de la production complète : ne suppose rien au-delà des citations fournies.',
    '',
    ...questions.flatMap((question) => [
      `<critere key="${question.criterionKey}">`,
      `Critère : ${question.criterionLabel}`,
      `Niveau retenu : ${question.levelLabel} — ${question.levelDescription}`,
      ...(question.quotes.length > 0
        ? question.quotes.map((quote) => `Citation : ${quote}`)
        : ['Citation : aucune']),
      '</critere>',
    ]),
  ];
  return [{ content: lines.join('\n'), role: 'system' }];
}

export function buildCheckerRequestBody(
  questions: CheckerQuestion[],
): Record<string, unknown> {
  const route = [...PROMOTED_CHECKER_IDENTITY.requestProfile.routeProviders];
  return {
    max_tokens: PROMOTED_CHECKER_IDENTITY.requestProfile.totalOutputTokenLimit,
    messages: buildCheckerMessages(questions),
    model: PROMOTED_CHECKER_IDENTITY.modelId,
    provider: {
      allow_fallbacks: false,
      // The checker path is new, so it is bound by no earlier promotion and
      // carries the full restrictive set from the start: pinned to the EU
      // endpoint by owner decision, and refusing any provider that retains
      // the request for training.
      data_collection: 'deny',
      only: route,
      order: route,
      require_parameters: true,
    },
    response_format: {
      json_schema: {
        name: 'learnx_checker_verdicts',
        schema: CHECKER_OUTPUT_JSON_SCHEMA,
        strict: true,
      },
      type: 'json_schema',
    },
    temperature: 0,
  };
}

function allUnavailable(
  questions: CheckerQuestion[],
  reason: CheckerUnavailableReason,
  extra: Partial<CheckerOutcome> = {},
): CheckerOutcome {
  return {
    costUsd: null,
    latencyMs: null,
    providerRoute: null,
    unavailableReason: reason,
    verdicts: Object.fromEntries(
      questions.map((question) => [question.criterionKey, 'UNAVAILABLE']),
    ),
    ...extra,
  };
}

export interface RuntimeCheckerOptions {
  apiKey: string | null;
  appUrl: string;
  fetchImplementation?: typeof fetch;
  now?: () => number;
}

/**
 * Every failure resolves to UNAVAILABLE and never to AGREED. A checker that is
 * down, slow, misrouted or incoherent must cost us the HIGH ceiling, never buy
 * a correction a confidence nobody established. There is no retry: a second
 * call is a second chance to be wrong, not evidence.
 */
export function createRuntimeCorrectionChecker(
  options: RuntimeCheckerOptions,
): CorrectionCheckerPort {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const now = options.now ?? (() => Date.now());

  return {
    async verify({ questions }) {
      if (questions.length === 0) {
        return {
          ...allUnavailable([], 'UNCONFIGURED'),
          unavailableReason: null,
        };
      }
      if (!options.apiKey) return allUnavailable(questions, 'UNCONFIGURED');

      const startedAt = now();
      let response: Response;
      try {
        response = await fetchImplementation(CHECKER_URL, {
          body: JSON.stringify(buildCheckerRequestBody(questions)),
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': options.appUrl,
          },
          method: 'POST',
          signal: AbortSignal.timeout(
            PROMOTED_CHECKER_IDENTITY.requestProfile.timeoutMs,
          ),
        });
      } catch (error) {
        const timedOut =
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError');
        return allUnavailable(
          questions,
          timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        );
      }

      const latencyMs = now() - startedAt;
      if (!response.ok) return allUnavailable(questions, 'HTTP_ERROR');

      let envelope: unknown;
      try {
        envelope = await response.json();
      } catch {
        return allUnavailable(questions, 'UNPARSEABLE');
      }

      const parsedEnvelope = envelopeSchema.safeParse(envelope);
      if (!parsedEnvelope.success) {
        return allUnavailable(questions, 'UNPARSEABLE');
      }

      // The response reports the provider that served it. It does not report
      // which endpoint variant did, so this confirms the provider and not the
      // EU pin: that rests on `only` in the request. Confirming what we can is
      // still worth more than confirming nothing.
      const providerRoute = parsedEnvelope.data.provider ?? null;
      if (
        providerRoute !== null &&
        providerRoute !== PROMOTED_CHECKER_IDENTITY.provider
      ) {
        return allUnavailable(questions, 'ROUTE_MISMATCH', { providerRoute });
      }

      const content = parsedEnvelope.data.choices[0]?.message?.content;
      if (typeof content !== 'string') {
        return allUnavailable(questions, 'UNPARSEABLE', { providerRoute });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(content);
      } catch {
        return allUnavailable(questions, 'UNPARSEABLE', { providerRoute });
      }

      const parsed = verdictSchema.safeParse(payload);
      if (!parsed.success) {
        return allUnavailable(questions, 'UNPARSEABLE', { providerRoute });
      }

      const asked = new Set(questions.map((question) => question.criterionKey));
      if (
        parsed.data.verdicts.some((verdict) => !asked.has(verdict.criterionKey))
      ) {
        // A verdict about a criterion we never asked about means the checker
        // and the correction are not talking about the same thing. Nothing in
        // that response can be trusted, including the parts that look right.
        return allUnavailable(questions, 'UNKNOWN_CRITERION', {
          providerRoute,
        });
      }

      const answered = new Map(
        parsed.data.verdicts.map((verdict) => [
          verdict.criterionKey,
          verdict.supported ? ('AGREED' as const) : ('DISAGREED' as const),
        ]),
      );

      return {
        costUsd: parsedEnvelope.data.usage?.cost ?? null,
        latencyMs,
        providerRoute,
        unavailableReason: null,
        // A criterion the checker skipped is unchecked, not agreed.
        verdicts: Object.fromEntries(
          questions.map((question) => [
            question.criterionKey,
            answered.get(question.criterionKey) ?? 'UNAVAILABLE',
          ]),
        ),
      };
    },
  };
}

const envelopeSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.unknown() }).loose() }))
    .min(1),
  provider: z.string().optional(),
  usage: z.object({ cost: z.number().optional() }).loose().optional(),
});
