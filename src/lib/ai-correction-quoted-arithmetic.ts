/**
 * Arithmetic stated inside an evidence quote, checked by computing it.
 *
 * On 31 August the promoted verifier certified `7 × 6 € + 12 € = 44 €` as
 * "les deux calculs sont corrects", at 0.97 confidence, quoting the line that
 * contradicts itself. The designed probe then showed the shape of the defect:
 * across twenty levels false by construction, every non-arithmetic falsehood
 * was refused — 15 of 15 — and every failure was arithmetic. The verifier
 * discriminates wherever checking means reading, and fails about half the time
 * where checking means computing.
 *
 * So this does not ask a model. It parses the expression the text already
 * wrote down and evaluates it. A calculator cannot be argued out of the answer,
 * costs nothing per correction, and does not vary between runs.
 *
 * Its scope is deliberately narrow: expressions written explicitly, such as
 * `a × b + c = d`. Arithmetic expressed in prose — "trois étapes de 45 minutes,
 * soit 2 heures" — is a language problem, not a parsing one, and is out of
 * scope rather than half-handled. `coverage` reports what was in scope so the
 * measurement is never read as covering more than it does.
 */

/** One computation a quote stated, and whether it holds. */
export type QuotedComputation = {
  /** The evaluated left-hand side. */
  computed: number;
  /** The expression as the text wrote it. */
  expression: string;
  holds: boolean;
  quote: string;
  /** The result the text claimed. */
  stated: number;
};

// Narrow no-break and thin spaces appear throughout the French corpora as digit
// group separators; treating them as ordinary spaces is what makes "7 × 6 €"
// parse at all.
const SPACES = /[\u00A0\u202F\u2009]/g;
const UNITS =
  /(?:€|euros?\b|EUR\b|\$|%|min\b|minutes?\b|heures?\b|litres?\b|kg\b|km\b)/g;
const DIGITS = String.raw`\d[\d ]*(?:[.,]\d+)?`;
const EXPRESSION = new RegExp(
  String.raw`(${DIGITS}(?:\s*[×x*+]\s*${DIGITS})+)\s*=\s*(${DIGITS})`,
  'g',
);

function toNumber(text: string): number | null {
  const cleaned = text.replace(/[^\d.,-]/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Evaluates a flat expression of `+` and `×`, multiplication binding tighter.
 *
 * Deliberately not a general expression parser: the grammar it accepts is the
 * grammar the corpora write. Anything richer belongs in a real parser, and
 * anything it cannot read is reported as out of scope rather than guessed at.
 */
function evaluate(expression: string): number | null {
  const tokens = expression.trim().split(/\s*([×x*+])\s*/);
  const terms: number[] = [];
  let pending: number | null = null;

  for (const [index, token] of tokens.entries()) {
    if (index % 2 === 0) {
      const value = toNumber(token);
      if (value === null) return null;
      pending = pending === null ? value : pending * value;
      continue;
    }
    if (token === '+') {
      if (pending === null) return null;
      terms.push(pending);
      pending = null;
    }
  }
  if (pending !== null) terms.push(pending);
  return terms.length === 0
    ? null
    : terms.reduce((total, term) => total + term, 0);
}

/** Every computation a quote states explicitly, evaluated. */
export function computationsIn(quote: string): QuotedComputation[] {
  const normalised = quote.replace(SPACES, ' ').replace(UNITS, '');
  const found: QuotedComputation[] = [];

  for (const match of normalised.matchAll(EXPRESSION)) {
    const computed = evaluate(match[1] ?? '');
    const stated = toNumber(match[2] ?? '');
    if (computed === null || stated === null) continue;
    found.push({
      computed,
      expression: `${(match[1] ?? '').trim()} = ${(match[2] ?? '').trim()}`,
      // A tolerance, not equality: the corpora round to the cent, and a
      // difference smaller than that is rounding rather than a false claim.
      holds: Math.abs(computed - stated) < 0.005,
      quote,
      stated,
    });
  }
  return found;
}

export type QuotedArithmeticReport = {
  /** Quotes carrying at least one explicit expression. */
  coverage: { quotesInScope: number; quotesTotal: number };
  violations: QuotedComputation[];
};

/**
 * Checks every quote a run's corrections relied on.
 *
 * Reported, never blocking on its own: it sees only what a text wrote as an
 * expression, and a gate whose scope is 0.6 % of quotes must not read as a
 * verdict on the arithmetic of the rest.
 */
export function checkQuotedArithmetic(
  quotes: readonly string[],
): QuotedArithmeticReport {
  const violations: QuotedComputation[] = [];
  let quotesInScope = 0;

  for (const quote of quotes) {
    const computations = computationsIn(quote);
    if (computations.length > 0) quotesInScope += 1;
    violations.push(...computations.filter((item) => !item.holds));
  }

  return {
    coverage: { quotesInScope, quotesTotal: quotes.length },
    violations,
  };
}
