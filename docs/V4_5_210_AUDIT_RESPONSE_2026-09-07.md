# V4.5-210 — answers to the audit questions, 7 September 2026

Written by AI Research on the owner's request, from the repository as it
stands on branch `ai-research/preserve-artifacts` at `82883c5f`. Every
figure below is traceable to a sealed file or a committed report; where a
question asks for something that has not been measured, the answer says so.

## 1. Exact current state

**Authoritative branch and commit.** `ai-research/preserve-artifacts`, head
`82883c5f`, pushed 6 September. It contains `origin/main` up to PR #108
(Head of Development merged it on 5 September and resolved
`src/server/api/app.ts`). Nothing from V4.5-210 is merged into `main`; the
branch is the research record, not a release candidate.

**Results the audit may have missed** (all dated 5–6 September):

| result | file | what it says |
|---|---|---|
| owner's pass 1, 106 cards | `adjudication-pass1.owner.2026-09-05.json` | 65 yes / 29 no / 12 abstain; only 4 of 37 primary pairs discriminated; 20 of 37 damaged copies answered "yes" |
| owner's pass 2, 45 pairs, forced choice | `adjudication-pass2.owner.2026-09-05.json` | original chosen in **30 of 37** primary pairs (3 damaged, 4 ties); threshold 27 pre-declared; the deck holds |
| paste pack, 24 model runs on batch 1 | `paste-pack.v1/answers/` | exploratory; majority accepts damaged copies on 3 of 5 |
| test–retest slice R-01 | `adjudication-retest.v1.json` | drawn; the owner is doing it today; **no result yet** |
| second rater slice P-01 | `adjudication-pair-slices.v1.json` | drawn (7 unlabelled + 8 labelled pairs); **no rater yet** |
| verifier experiment | — | **not run**; 0.00 USD spent in this phase |

**Unmerged or unfixed.** On the branch, not in `main`: all of the above, the
flaky-poll test fix (`d805750e`), `createCheckoutRoute()` and the
session-less webhook test (per Head of Development's merge note). Known and
not fixed anywhere: shortened controls carrying a "every … in the copy" atom
are no longer positives (card 10, 24 of 24 runs and the owner say "no");
a 0.62 USD gap between the journal and the ledgers. Four runtime/benchmark
discrepancies are examined in §6; three of them are not fixed.

## 2. Why "preferred" became "sufficient / insufficient"

It should not have, without saying so. The forced-choice pass produces a
**relative** label: the original answers the question better than the
damaged member. Two things support reading that as "original establishes,
damaged does not", and neither is a proof:

- the construction of the deck: the damaged member's highlighted sentence is
  the exact fragment a grader cited when wrongly awarding the top level, and
  the establishing sentence was deleted or inverted upstream;
- pass 2 shows a blind human perceives that construction's direction in 30
  of 37 pairs, against 18–19 expected by chance.

What the data also shows: both members *can* satisfy the requirement for a
reader (pass 1 said "yes" to both in 19 primary pairs; pass 2 gave 2 "both
equally"), and neither can (2 "neither", with reasons that point at the
original: "nothing in the dossier gives a six-month horizon"). So the pair
label is sound as a **ranking**, not as two absolute verdicts.

Consequence, to be pre-registered before any verifier call: the primary
verifier metric becomes **pairwise** (does the model rank the original
above its damaged twin, each member judged blind and separately), and the
two absolute rates already declared (≥ 86 % hard-negative rejection, ≥ 90 %
true-evidence acceptance) are reported as secondary, once against the pair
labels and once against the owner's pass-1 absolute labels. Pass 1 taught
that an absolute "is this enough?" threshold is unstable even for a careful
human; a verifier will be measured on the question the gold can answer.

## 3. Which recorded failures survive an independent review

The review base holds 18 failures. Two are deterministic (a criterion absent
from the output; a top level with no citation at all) and are caught by rules
(`deterministicallyCatchable` in `atom-pair-manifest.v2.json`), not by a
verifier. The 16 others (14 sentence deletions, 2 fact inversions) yield the
45 pairs. After pass 2, linked failure by failure:

| status | failures | pairs | detail |
|---|---|---|---|
| **confirmed** (original recognised in every pair) | 10 | 26 | source-fact-use, context-fidelity (second case), reflection-link (first case), decision-position, fact-fidelity (deletion), fact-fidelity (inversion), arbitration-choice, mechanism-link, source-fidelity (deletion), event-sequence-grounding |
| **mixed** (one or more pairs contested) | 5 | 17 | context-fidelity first case (1 damaged chosen: "both conform, B explicitly"); context-fidelity second deletion (1 "neither": the *original* asserts a horizon the dossier does not give); practice-evidence (1 damaged chosen, no reason); reflection-link second case (1 "both"); residual-risk-surfacing (3 of 6 contested: "the risk is not well defined") |
| **contested** (no pair confirmed) | 1 | 2 | source-fidelity fact inversion, non-primary: both "neither", the reviewer finds errors in the original too ("a figure is wrong", "probably should be non-negotiable") |

Reading: ten failures are clearly incorrect judgments by the grader, and the
unmet requirement is the pair's atom (listed per pair in
`adjudication-pairs.v1.json` → `atomId`, text in the deck's `atom`, e.g.
dp.a1 "a position is explicitly stated", ff.a4 "EVERY datum supports THIS
choice"). Residual-risk-surfacing is the family where the *requirement* is
ambiguous ("what counts as a risk") rather than the judgment. The two
"neither" cases and the context-fidelity "neither" are candidate **faulty
expectations**: the original may not satisfy the atom either, so the
mutation did not create a positive/negative pair. These 7 pairs go to the
second rater and a third reading before any of them is used.

## 4. Did the protocol change leave unfinished work?

Yes, and it is visible in the export: 39 cards carry roles at
`PENDING_PASS2`. The forced-choice pass replaced the planned evidence-binding
task for now; it did not perform it.

What that costs the verifier experiment: nothing for the call itself. The
plan's input is one atom and one span; the span is the deck's
`candidateSpan` (the highlighted sentence), and the verifier never sees a
role binding. What binding would have added is a check that the human's
evidence and the deck's candidate coincide. The pass-1 export gives that
check for free on multi-sentence cards answered "yes": the deck's candidate
sentence is among the sentences the owner clicked on 16 of 19 positives and
5 of 5 controls; on 3 positives it is not. Those 3 spans are reviewed before
the run. Two-role atoms (39 cards) still need binding for the *architecture*
(evidence-role validation), not for the feasibility measurement; if the
measurement passes, a pass 2b binds roles on the 30 labelled pairs only.

## 5. What justifies the HIGH label today

By code (`ai-correction-confidence.ts`): a criterion is HIGH only if its
citation is deterministically verified, no hard-constraint mismatch is read
in the feedback, the independent checker returned AGREED (UNAVAILABLE gives
MEDIUM, DISAGREED gives LOW), and the level is an extreme (floor or
mastered). The V4 circularity, an unchecked criterion counted as AGREED, is
removed in the server path (`correction-checker.ts` resolves every
unreached criterion to UNAVAILABLE, with a test) and the benchmark computes
a false-agree rate precisely to catch it.

Does HIGH predict correctness? **No evidence that it does.** Latest paid run
(1 September, 15:38): `checkerAgreementAtHigh` 161 / 161, and
`checkerFalseAgreeRate` **10 / 14**: the checker agreed with 71 % of the
criteria that are false by construction (a deletion or inversion mutant that
did not move them). The checker leg of HIGH therefore carries little
discriminating information, and the benchmark's HIGH is more permissive
still (§6c). No candidate checker has demonstrated useful discrimination on
independently validated cases: that is the experiment still to run, and it
is the only thing that would change this answer.

## 6. Runtime / benchmark discrepancies

| claim | verified in code | intentional? | status |
|---|---|---|---|
| individual criteria escape the family confidence ceiling | yes: `deriveCorrectionConfidence` caps the correction-wide label at MEDIUM for non-validated families; `deriveCriterionConfidence` has no such cap, so a per-criterion HIGH is stored and exported in any family | not documented as a choice; the UI only uses criterion confidence to split LOW from the rest | unintended by omission; trivial fix in Head of Development's file; flagged |
| general feedback survives criterion withholding | yes: `buildCorrectionOutcome` returns `overallFeedback` unchanged on `COMPLETED_PARTIAL`, and the result view renders it when present | unknown | flagged, not fixed |
| benchmark forces `hardConstraintMismatch: false` | yes, `ai-correction-regression-run.ts`, with a comment: the signal is a server-side reading of the feedback and cannot be decided from a benchmark attempt | intentional | consequence not stated in reports: benchmark confidence is an upper bound of runtime confidence; to add to the report caveats |
| STABLE allows a one-step change | partly: the mutant builder emits `othersExpectation: 'STABLE'`, but no metric or gate in `src/` or `scripts/` consumes it (only tests reference it); separately, the stability metric counts flips of **two steps or more** (`repetitionTwoStepFlipsAtHigh`), so one-step changes are tolerated there by design, chosen after the ±2 noise-floor finding | STABLE non-enforcement looks like unfinished wiring; the two-step tolerance is a documented choice | flagged to Head of Development |

## 7. What is materially different from the earlier evidence-assist attempt

The earlier checker sees a whole criterion, its level and all its quotes, and
answers a fuzzy "does this support the level?". Measured: its refusal rate
was *lower* on wrong criteria (15.4 %) than elsewhere (29.7 %), and it
agrees with 71 % of false-by-construction criteria. The atomic verifier sees
one atom and one sentence, blind to level, grade and rationale, and code
applies the cap. It removes the level leakage and the fuzzy question.

Reusable as is: the sentence segmenter (`fr/segmentSentences@1`), the
deterministic evidence guards (`checkEvidenceGuards`, wired into the
regression run), the sealed deck / key / pairs / questions, the canonical
hashing recipe, the paste-pack prompt, the merge and agreement scripts.

The unresolved assumption that could repeat the cycle: **that "establishes"
has an absolute boundary a judge can apply to one sentence in isolation.**
Pass 1 shows a careful human does not hold that boundary stably (20 of 37
damaged copies accepted), while the same human ranks pairs reliably. A
verifier asked the absolute question may inherit the same generosity; the
paste-pack majority did (3 of 5 damaged copies accepted). Two consequences:
the feasibility measurement is pairwise first (§2), and if the component
only discriminates relatively, the architecture must use comparative or
calibrated verification rather than a bare absolute verdict. A second
assumption, that one sentence carries one atom, is already known to fail on
two-role atoms (39 cards); single-sentence verification cannot bind roles.

## 8. The smallest next experiment that changes the decision

**Hypothesis.** At least one of four candidate models, asked the narrow
blind question on one sentence, ranks the original above its damaged twin
on the 30 labelled primary pairs, stably across repetitions.

**Reference evidence required first, cost 0.** Test–retest of the owner on
10 cards (today, ~20 min); a second rater on 15 pairs (~15 min); a third
reading of the 7 unlabelled pairs (~15 min, both raters). If the second
rater disagrees with the pair label on more than 2 of the 8 labelled pairs
in the slice, the gold is not ready and the run does not start.

**Design.** 60 cards (30 pairs), 4 models (Mistral medium as the production
baseline, Haiku 4.5, Kimi K3, Sonnet 4.6), 3 repetitions, direct API calls,
blind, separate, shuffled; verdict schema `direct | partial | unsupported |
contradicted | ambiguous`. Primary metric: per pair, majority-of-3 score of
the original strictly above the damaged member. Secondary: the two absolute
rates against pair labels and against pass-1 labels, always reported
together. Budget cap 3 USD, expected about 1 USD.

**Proceed** if a model reaches ≥ 27 / 30 pairwise (same one-sided binomial
logic as pass 2, p < 0.01), flips on ≤ 2 pairs across repetitions, *and*
clears both absolute floors: build the architecture with that model.
**Narrow** if a model reaches ≥ 27 / 30 pairwise but misses an absolute
floor: the component discriminates relatively, not absolutely; the
architecture is redesigned around comparative or calibrated verification
before anything else is built. **Stop this approach** if no model reaches
24 / 30 pairwise, or if every model flips on more than 5 pairs across
repetitions: the route is closed for the price of the run, and the report
says so.

These amendments (pairwise primary metric, second-rater gate) are written
here before the first call, and will be copied into the pre-registration
before the run.
