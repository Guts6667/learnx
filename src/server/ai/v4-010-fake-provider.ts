import type {
  EvidenceAssistProviderPort,
  EvidenceAssistProviderRequest,
  EvidenceAssistProviderResponse,
} from './evidence-assist-orchestrator.js';

type SpanFixture = Readonly<{ spanId: string; text: string }>;

const elementSignals: Readonly<Record<string, RegExp>> = Object.freeze({
  'authorized-envelope-stated': /\b(maximum|limite|borne|semaines?|budget|perimetre)\b/iu,
  'critical-condition-owner-stated': /\b(responsable|sponsor|direction|proprietaire)\b/iu,
  'decision-evidence-relation': /\b(parce que|donc|ainsi|en raison de|puisque)\b/iu,
  'decision-mode-stated': /\b(go conditionnel|no-go|exploration supplementaire|je recommande)\b/iu,
  'decision-scope-stated': /\b(uniquement|pilote|deploiement|perimetre|porte sur)\b/iu,
  'prerequisite-condition-stated': /\b(avant|apres|seulement si|a condition que)\b/iu,
  'reconsideration-date-stated': /\b(le \d{1,2} |octobre|novembre|decembre|echeance|reexamin)\b/iu,
  'scenario-evidence-stated': /\b(cout|taux|scenario|donnee|contrainte|constat)\b/iu,
  'stop-criterion-stated': /\b(s'arrete|arreter si|critere d'arret|seuil)\b/iu,
  'uncertainty-stated': /\b(inconnu|incertitude|non verifie|reste a confirmer|hypothese)\b/iu,
});

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[’']/gu, "'")
    .toLowerCase();
}

function readSpans(request: EvidenceAssistProviderRequest): SpanFixture[] {
  const marker = 'RESPONSE_SPANS_JSON=';
  const line = request.messages[1].content
    .split('\n')
    .find((candidate) => candidate.startsWith(marker));
  if (!line) throw new Error('FAKE_PROVIDER_SPANS_MISSING');
  const parsed = JSON.parse(line.slice(marker.length)) as unknown;
  if (!Array.isArray(parsed)) throw new Error('FAKE_PROVIDER_SPANS_INVALID');
  return parsed.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !('spanId' in item) ||
      typeof item.spanId !== 'string' ||
      !('text' in item) ||
      typeof item.text !== 'string'
    ) {
      throw new Error('FAKE_PROVIDER_SPAN_INVALID');
    }
    return { spanId: item.spanId, text: item.text };
  });
}

function deterministicOutput(request: EvidenceAssistProviderRequest): string {
  const spans = readSpans(request);
  const findings = request.candidateElementKeys.map((elementKey) => {
    const signal = elementSignals[elementKey];
    const matches = signal
      ? spans.filter(({ text }) => signal.test(normalize(text))).slice(0, 2)
      : [];
    return matches.length > 0
      ? {
          elementKey,
          relation: 'EVIDENCE_FOR_ELEMENT' as const,
          spanIds: matches.map(({ spanId }) => spanId),
        }
      : {
          elementKey,
          relation: 'ABSTAIN' as const,
          spanIds: [],
        };
  });
  return JSON.stringify({ findings });
}

export class DeterministicV4010FakeProvider
  implements EvidenceAssistProviderPort
{
  public readonly kind = 'OFFLINE_FAKE' as const;
  public readonly requests: EvidenceAssistProviderRequest[] = [];
  private remainingFailures: number;

  public constructor(input: { failFirstAttempts?: number } = {}) {
    this.remainingFailures = input.failFirstAttempts ?? 0;
  }

  public async execute(
    request: EvidenceAssistProviderRequest,
  ): Promise<EvidenceAssistProviderResponse> {
    this.requests.push(request);
    if (this.remainingFailures > 0) {
      this.remainingFailures -= 1;
      throw new Error('SIMULATED_OFFLINE_PROVIDER_FAILURE');
    }
    return { rawModelOutput: deterministicOutput(request) };
  }
}
