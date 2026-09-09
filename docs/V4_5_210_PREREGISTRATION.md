# Find the one method: can a narrow verifier tell "establishes" from "sits near"?

## Context

Four prompt versions failed. Two other models failed — Kimi twice as badly as
Sonnet, GPT-5.6 unable to quote verbatim at all. The defect belongs to the task,
not the model.

The reviewer's answer is an architecture: models locate meaning, **code** decides
what that meaning earns. Rubrics compile to atomic requirements, the extractor
returns sentence IDs rather than generated quotes, a verifier judges one atom
against one span, and a deterministic engine applies the cap. The model cannot
override it.

That design rests on **one untested assumption**: that a narrow, blinded verifier
can reliably tell evidence that *establishes* a requirement from evidence that
merely *sits near* it.

Everything else is engineering that works if and only if that holds. So that is
what this plan tests, and it is all this plan tests.

## The one goal

**Establish whether any available model, asked a narrow blinded question, can
separate sufficient from insufficient evidence on our real failures — and if so,
which one.**

That is "the one method". Not the architecture: the component the architecture
cannot work without.

Both outcomes are decisive. It discriminates → the architecture is worth
building, and we know which model to put where. It does not → the route is closed
before we spend weeks on it.

## Why this is answerable now, cheaply

We already own the hardest possible test material. Measured today:

| | |
|---|---|
| distinct real failures across four runs | **18** |
| that fooled **three or more** independent models | **6** |
| with the chosen span retrievable | **28 / 28** |

These are not fabricated cases. Each is a span that **actually fooled a frontier
model into awarding top marks**. Our previous probe failed precisely because its
negatives were obvious — all three checker prompts passed every substitution case
while the live checker missed 7 of 7 real ones. This set cannot have that flaw.

## Method

Same three rules that have worked all week: one variable, evidence over
invention, cheapest test first.

### The question put to the verifier

One atomic requirement, one span, nothing else:

```json
{ "requirement": "an option or action is explicitly selected",
  "span": "La remise de 18 % rend toute autre option irrationnelle." }
→ { "verdict": "direct | partial | unsupported | contradicted | ambiguous" }
```

**Blinding is the point.** The verifier must not see the level under
consideration, the grade, the grader's rationale, or any other criterion. Our
current checker sees the whole criterion and all its quotes and is asked a fuzzy
"does this support the level?" — and its verdict does not track correctness
(15.4 % refusal on wrong criteria against 29.7 % elsewhere). A narrow question is
the change being tested, not just a smaller prompt.

### The sentinel set — balanced by construction

Built from measured artefacts, four kinds, so that a verifier which rejects
everything scores zero rather than perfect:

1. **Hard negatives** — the span the grader cited when it wrongly awarded top.
   The 28 above.
2. **True positives** — the same atom's genuine supporting span, taken from the
   *undamaged* original.
3. **Weakened / negated** — spans stating a narrower or opposite version.
4. **Irrelevant controls** — spans from an unrelated criterion, to catch
   over-rejection.

Roughly 50–60 cases. Files: new
`benchmarks/ai-correction/regression/atom-sentinel.v1.json` (append-only, new
file), built by a script reading the four result directories.

### The two metrics, and where the thresholds come from

Not invented — derived from the reviewer's operational targets.

| metric | floor | why that number |
|---|---|---|
| `hard_negative_rejection` | **≥ 86 %**, target 90 % | latent false tops are 11.1 %; to land under the 1.6 % visible target the verifier must catch ~86 % of them |
| `true_evidence_acceptance` | **≥ 90 %** | rejecting 10 % of genuine evidence still leaves coverage well above the 65 % floor; at 60 % acceptance coverage collapses |

**Either metric alone is trivially gamed.** A verifier that always says
"unsupported" scores 100 % on the first and 0 % on the second. Both are reported
together or neither is reported.

### Statistical discipline

- **3 repetitions per case per model.** The ±2 noise floor measured this week was
  found by comparing two runs that both read 7/63; single runs at this scale
  cannot be trusted.
- **Aggregate by original authored answer**, not by criterion. Our 104 direction
  mutants come from **50 originals**, so the effective independent n is 50, not
  104 — which is itself the likely source of the noise floor.
- **Thresholds predeclared above**, before the first call.

## Execution

### Step 1 — atomise the failing criteria ($0, needs your approval not your labour)

I draft atomic requirements for the criteria in the 18 failures, in the
reviewer's shape:

```json
{ "criterion": "decision-position",
  "top": { "requires_all": ["an option or action is explicitly selected",
                            "the selected option is identifiable"],
           "missing_requirement_cap": "middle" } }
```

You review and correct. This is the one place your judgement is required, and it
is bounded — a handful of criteria, drafted for you rather than by you.

### Step 2 — build the sentinel set ($0)

A script assembling the four case kinds from the four result directories. Every
case carries provenance: which run, which mutant, which model was fooled.

### Step 3 — measure ($3 cap, expect ~$1)

Four verifier candidates against the sentinel set, 3 repetitions each. Direct API
calls, not through the runner — this measures a component, not a system, and the
runner would drag in grading we do not need.

Candidates: `mistral-medium-3-5` (today's checker, the baseline to beat),
`claude-haiku-4.5` (cheap), `kimi-k3` (best extractor observed today),
`claude-sonnet-4.6` (strongest available). The reviewer is right that the
verifier should be chosen independently of the grader — so Sonnet is a candidate
here, not a default.

### Step 4 — read it ($0)

Report both metrics per model, with per-repetition spread. Then one of:

- **A model clears both floors, stably** → the method exists. Name it, and the
  architecture becomes worth building. Next plan.
- **None does** → the method does not exist at this layer. Report and stop; the
  reviewer's design cannot be built on a component that does not discriminate.
- **Unstable across repetitions** → say the sample is too small to choose, and do
  not pick a winner from noise.

## KPIs

| KPI | Target |
|---|---|
| `hard_negative_rejection` | ≥ 86 %, target 90 % |
| `true_evidence_acceptance` | ≥ 90 % |
| cost to a verdict | ≤ $3 |
| repetitions before believing a difference | 3 |
| runtime touched | **none** |

## OKRs

**Objective — know whether the reviewer's architecture has a foundation, before
building on it.**

- **KR1** the sentinel set is built entirely from measured failures, no fabricated cases
- **KR2** a verdict on the method for ≤ $3
- **KR3** both metrics reported together, always
- **KR4** if the answer is no, we say so and stop

KR4 is the point. Killing this route for $3 is a better outcome than building it
for weeks and discovering the same thing.

## What this plan does not do

- Does not build the architecture, the extractor, or the scoring engine
- Does not touch `runtime-correction-prompt.ts` or any promoted identity
- Does not expand the corpus — the reviewer is right that ~188–297 independent
  cases are needed for a 95 % bound under 1.6 %, and we have 50 originals
  carrying direction mutants against 144 authored. That is a separate decision
  with a real authoring cost, and it gates the *statistical* claim, not this
  *feasibility* one
- Does not settle sentence-level vs sub-sentence spans. Our sentences run to
  **347 characters** (median 156), so one sentence can carry several atoms. This
  experiment uses the exact spans models chose, which sidesteps it; the question
  returns when the extractor is built

## Verification

- Sentinel cases carry provenance to their source run and mutant, so any case can
  be traced back and disputed
- The balance check runs before the measurement: a set where "always unsupported"
  scores well is a broken set, and the script asserts it cannot
- Probes are verifier-only — no grading, no learner text scored, no runtime path
- Repetition spread reported, never averaged away

## What stops this plan

- Step 1 shows the criteria cannot be atomised without ambiguity → that is itself
  the answer, and it is free
- No model clears both floors → report and stop
- A model clears the rejection floor by rejecting nearly everything → caught by
  the acceptance floor, which is why both are mandatory

## Amendments, 8 September 2026 — written before the first call

Declared in `docs/V4_5_210_AUDIT_RESPONSE_2026-09-07.md` §2 and §8, and
copied here as the plan of record. Nothing above is deleted; where the two
disagree, this section wins. Implemented in
`src/lib/ai-correction-atom-verifier.ts` (`THRESHOLDS`, `VERDICT_RANK`) and
`scripts/run-atom-verifier.ts`; the dry run of 8 September wrote
`benchmarks/ai-correction/regression/atom-verifier/plan.v1/` with every
prompt, the scoring key and the estimate. 0.00 USD spent.

**Gold.** The sentinel set of the original plan is replaced by the deck's
30 labelled primary pairs: the pairs where the owner's blind forced choice
(pass 2, 5 September) fell on the original. 60 cards. The 7 contested
primary pairs and the 16 shortened controls are out. The gold is a
**ranking** (original above damaged), not two absolute verdicts.

**Primary metric — pairwise.** Each card is judged alone, blind, three
times, in a seeded order that differs per model and per repetition. Per
card, the majority of the three verdicts (two identical out of three;
otherwise undecided). Per pair, the original wins when its majority verdict
ranks strictly above the damaged member's on the declared scale
`direct 3 > partial 2 > ambiguous 1 > unsupported 0 > contradicted −1`.
A pair whose outcome differs between repetitions counts as **unstable**.

**Secondary metrics — absolute, always reported together.** Hard-negative
rejection: share of damaged cards whose majority verdict is `partial`,
`unsupported` or `contradicted` (floor 86 %). True-evidence acceptance:
share of originals whose majority verdict is `direct` (floor 90 %).
Abstentions (`ambiguous`) are counted apart in both. A third column
compares each majority verdict to the owner's pass-1 absolute verdict on the
same card.

**Readings, per model.**

| reading | condition |
|---|---|
| proceed | ≥ 27 / 30 pairs won, ≤ 2 unstable, both absolute floors met |
| narrow | ≥ 27 / 30 pairs won, ≤ 2 unstable, an absolute floor missed: the component discriminates relatively, not absolutely; the architecture is redesigned around comparative or calibrated verification before anything else |
| stop | < 24 / 30 pairs won, or > 5 unstable |
| indeterminate | anything else: the sample cannot choose |

The tail probability of the wins among decided pairs is reported next to the
count (one-sided binomial at 1/2), as in pass 2.

**Second rater.** Not a gate on the paid run any more: the retest of
7 September (7 / 10 identical, changes toward the key) and the deck's
construction support the 30 pairs on their own, and the run is repeatable
for cents. The second rater's 15 pairs (slice P-01) become a **post-hoc
check**: if she disagrees with the pair label on more than 2 of the
8 labelled pairs in her slice, the contested pairs are removed from the
gold and the run is re-read on the remaining pairs; the report says
"single rater, second reading pending" until then. The gold can shrink,
never grow.

**Candidates, budget, guards.** `mistralai/mistral-medium-3-5` (baseline),
`anthropic/claude-haiku-4.5`, `moonshotai/kimi-k3`,
`anthropic/claude-sonnet-4.6`; 720 calls; temperature 0; strict JSON
schema; `data_collection: deny`, no fallbacks. Estimate ≈ 1.65 USD
(Mistral from the sealed pricing file, the others read from openrouter.ai
on 8 September and replaced by `usage.cost` at run time). Cap 3 USD,
enforced before every call; a stopped run is reported as incomplete and
never read against the thresholds. The run starts only on the owner's word
(`--run --confirm=mesure`).
