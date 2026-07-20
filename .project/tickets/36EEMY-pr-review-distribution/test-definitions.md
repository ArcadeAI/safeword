# Test Definitions: pr-review-distribution — the runner

Feature source: `features/pr-review-distribution.feature` — **binding verified**
(`findFeatureSourcePath` resolves 36EEMY to this file, 2026-07-19).

Split from `autonomous-pr-review.feature` (the parent epic's slug, which never
bound to this ticket and left every entry unenforced). Five judgment-bound Rules
— R19, R20, TB2.R1, TB2.R3 — moved to that file as an eval holding pen and are
owed to CWGYH0; they are listed under "Not in this ledger" below.

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.

**24 scenarios / 15 Rules.** Ordered by feature-file lineage (for coverage
traceability), annotated with the build slice from `impl-plan.md` — implement in
**slice order**, not file order, so the load-bearing trust split fails first
while it is still cheap to change.

Membership rule: a scenario is here only if it can **fail for a runner reason**.
With the vendor faked at the `spawn` seam, a scenario whose Given describes code
shape and whose Then asserts the model's judgment asserts its own stub — so it
belongs to the eval, not to this ledger.

Determinism note: the vendor is faked at the injected `spawn` seam
(`RunExtractionDeps` / `RunCodexExtractionDeps` in `hooks/lib/retro-extract.ts`)
and GitHub / arcade MCP are stubbed. Every scenario whose `Given` fixes a model
judgment tests the runner's **handling** of that judgment, never a live model's
opinion. Judgment *quality* is CWGYH0's eval, not this ledger.

Slices: **1** fork-safe two-stage · **2** trigger/green-gate · **3** headless
invoke+parse · **4** verdict surfaces+silence · **5** intent/subtraction/cap ·
**6** cross-vendor+adversarial · **7** execution gates · **8** distribution+kill
switch · **9** judgment surfacing.

---

## Rule: autonomous-pr-review.TB1.R12 — a finding that reproduces on the base branch is not this PR's feedback

_Slice 7 (base-repro runs in the checkout; degrades on forks per SM1.R3)._

### Scenario: autonomous-pr-review.TB1.R12.a_latent_finding_is_dropped_while_the_change_caused_one_posts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: autonomous-pr-review.TB1.R12.change_caused_finding_is_posted_inline

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: autonomous-pr-review.TB1.R12.the_same_defect_verdicts_differently_by_whether_the_pr_caused_it

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R13 — a suggested fix is not posted unless it has been run against the tests it could break

_Slice 7 (execution gate; the fork path is proven by slice 1's degrade scenario)._

### Scenario: autonomous-pr-review.TB1.R13.a_fix_that_breaks_a_shipped_test_is_withheld

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: autonomous-pr-review.TB1.R13.a_verified_fix_is_posted_with_the_finding

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R1 — a concern the project's own tooling already reports is never surfaced

_Slice 5 (`subtractCoverage()` — subtract on coverage, never on mere mention)._

### Scenario Outline: autonomous-pr-review.TB1.R1.a_concern_is_dropped_only_when_the_tooling_actually_covered_it

- [x] RED b758de69b
- [x] GREEN ef3fb6b74
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R2 — a pull request with nothing worth saying receives no comment at all

_Slice 4 (`postVerdict()` — empty findings ⇒ 0 comments, still a `reviewed` receipt)._

### Scenario Outline: autonomous-pr-review.TB1.R2.silence_only_when_there_is_nothing_to_say

- [x] RED skip: emerged green — slice 1a's postVerdict already posted one comment
      per finding and none for an empty set, so this Rule had no failing state to
      capture. Its discriminating positive (one finding ⇒ exactly one comment) is
      asserted alongside, so the row is not vacuous.
- [x] GREEN 99576ac60
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R9 — every review records a verdict; a clean PR is marked reviewed, never left as bare silence

_Slice 4 (comment vs NON-required neutral check-run receipt; never an approval)._

### Scenario Outline: autonomous-pr-review.TB1.R9.a_clean_pr_is_marked_reviewed_and_a_flagged_one_needs_a_human

- [x] RED e5b939cac
- [x] GREEN 99576ac60
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R6 — the reviewer uses whatever declared intent the project exposes

_Slice 5 (`resolveIntent()` — linkback body ⇒ 0 tracker calls; bare linkback ⇒ exactly 1 brokered arcade MCP call as the PR author)._

### Scenario Outline: autonomous-pr-review.TB1.R6.intent_falls_through_to_a_brokered_read_when_the_linkback_is_bare

- [x] RED 0147fd4c5
- [x] GREEN 9264f83a2
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R7 — a finding never claims more certainty than the intent source it rests on supports

_Slice 5 (`boundCompletenessSeverity()` — PR-cross-reference count caps completeness; **unit** + integration)._

### Scenario Outline: autonomous-pr-review.TB1.R7.completeness_certainty_is_bound_by_ticket_to_pr_cardinality

- [x] RED b758de69b
- [x] GREEN ef3fb6b74
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R11 — the reviewer runs on a different vendor than the agent that wrote the code

_Slice 6 (`selectVendor()` + `crossModelClaim()`; **unit** for the 4-row pairing table, integration for dispatch)._

### Scenario: autonomous-pr-review.TB1.R11.an_undetectable_author_defaults_to_reviewing_with_codex

- [x] RED 7424d6f74
- [x] GREEN 6288c0d68
- [ ] REFACTOR

### Scenario Outline: autonomous-pr-review.TB1.R11.the_cross_vendor_declaration_tracks_the_actual_pairing

- [x] RED 7424d6f74
- [x] GREEN 6288c0d68
- [ ] REFACTOR

### Scenario: autonomous-pr-review.TB1.R11.an_author_from_the_reviewing_vendor_flips_the_reviewer

- [x] RED 7424d6f74
- [x] GREEN 6288c0d68
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R14 — when a finding exists, a second vendor tries to refute it before anyone sees it

_Slice 6 (`runAdversary()` — second spawn only when findings exist; ANNOTATES `contested`, never drops; an erroring adversary leaves the finding posted-but-unchecked)._

### Scenario: autonomous-pr-review.TB1.R14.a_refuted_finding_is_marked_contested_not_dropped

- [x] RED 364b32114
- [x] GREEN ed3641557
- [ ] REFACTOR

### Scenario Outline: autonomous-pr-review.TB1.R14.the_adversary_outcome_sets_the_findings_check_mark

- [x] RED 364b32114
- [x] GREEN ed3641557
- [ ] REFACTOR

### Scenario Outline: autonomous-pr-review.TB1.R14.a_finding_is_adversarially_marked_only_when_a_finding_exists

- [x] RED 364b32114
- [x] GREEN ed3641557
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R8 — the reviewer runs once per ready change whose CI is green, not on every push and never while CI is red

_**Slice 2 — load-bearing #2.** `evaluateTrigger()`: the event is the coarse trigger, the required-check-runs API is the authoritative gate. **Unit** over the 7-row truth table, then integration on the event→API path. The reviewer's own `reviewed` receipt is non-required — assert no self-deadlock._

### Scenario Outline: autonomous-pr-review.TB1.R8.fires_once_on_a_ready_green_pr_and_re_fires_only_on_a_material_re_green

- [x] RED skip: observed failing before implementing (unresolved import), but
      committed together with GREEN rather than as its own step
- [x] GREEN 47ef8c105
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB1.R17 — the reviewer works from a full checkout of the head branch, not the diff alone

_Slice 3 (checkout pinned to the head SHA; loud on mismatch — the substrate R12/R13/R18 require)._

### Scenario: autonomous-pr-review.TB1.R17.a_finding_rests_on_a_file_the_diff_did_not_touch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: autonomous-pr-review.TB2.R2 — a change to a sensitive surface is never marked reviewed on size alone

_Slice 9 (verdict mapping — **kept deliberately**: the rows vary by an injectable
concern-state, and this carries a rule R9 does not — an unresolved QUESTION, even
with zero findings, forbids a `reviewed` receipt)._

### Scenario Outline: autonomous-pr-review.TB2.R2.size_never_buys_a_reviewed_receipt_on_a_sensitive_surface

- [x] RED 2babe6b63
- [x] GREEN 8ed89b006
- [ ] REFACTOR

## Rule: autonomous-pr-review.NTB1.R4 — the review ends in a decision the reader can act on, not just a list of problems

_Slice 9 (review-body assembly: exactly one routing decision, positioned AFTER the findings, never in place of them)._

### Scenario: autonomous-pr-review.NTB1.R4.a_review_with_findings_ends_in_one_actionable_decision

- [x] RED 2babe6b63
- [x] GREEN 8ed89b006
- [ ] REFACTOR

## Rule: autonomous-pr-review.SM1.R3 — the reviewer never executes fork-PR code while holding a credential that can write, comment, or approve

_**Slice 1 — load-bearing #1, build FIRST.** Two-job split: unprivileged secretless read → privileged poster whose capability set structurally excludes approve/merge. The injected-approve scenario is the cheapest kill for a wrong trust model._

### Scenario: autonomous-pr-review.SM1.R3.a_fork_is_reviewed_and_posted_without_running_the_forks_gates

- [x] RED skip: observed failing before implementing (unresolved imports, then a
      genuine assertion failure that corrected the test), but committed together
      with GREEN rather than as its own step
- [x] GREEN cb252d82e
- [ ] REFACTOR

### Scenario: autonomous-pr-review.SM1.R3.the_fix_gate_degrades_on_a_fork_rather_than_running_fork_code

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: autonomous-pr-review.SM1.R3.an_injected_approve_instruction_cannot_produce_an_approval

- [x] RED skip: observed failing before implementing (unresolved imports, then a
      genuine assertion failure that corrected the test), but committed together
      with GREEN rather than as its own step
- [x] GREEN cb252d82e
- [ ] REFACTOR

## Rule: autonomous-pr-review.SM1.R2 — a maintainer can turn the reviewer off without deleting it

_Slice 8 (`resolvePrReviewConfig` — `prReview.enabled`/`post`, default-off, fail-open-to-disabled; the workflow stays installed either way)._

### Scenario Outline: autonomous-pr-review.SM1.R2.the_config_switch_toggles_posting_but_never_uninstalls

- [x] RED 144588231
- [x] GREEN e11586cda
- [ ] REFACTOR

---

## Cross-scenario refactor

One pass over the whole runner once the slices are green — not per-scenario
cleanup, which each REFACTOR row already owns.

- [ ] cross-scenario

---

## Not in this ledger (deliberate)

- **Judgment Rules** (TB1.R3 bar, R4 fix quality, R5 unverifiable-informs, R10
  flood, R15 provocation, R16 design consequence, R18 reinvention, NTB1.R1–R3,
  SM1.R1) carry no `.feature` scenario — you cannot Gherkin a prompt. They are
  G5337S's prose, proven by **CWGYH0's eval** against a bar recorded before
  triage. Adding vacuous scenarios for them would be the eval-gaming failure the
  epic already rejected.
- **Five Rules that DID have scenarios but could not fail for a runner reason**
  — R19 (work type), R20 (test coverage), TB2.R1 (depth), TB2.R3 (author request,
  2 scenarios). Their Givens describe code shape; their Thens assert the model's
  judgment about it. Under a faked `spawn` they assert the fixture. Moved verbatim
  to `features/autonomous-pr-review.feature` (`@eval-bound`) and written into
  CWGYH0's `done_when` so the holding pen cannot quietly become a graveyard. This
  applies the same standard as the bullet above — previously it was applied
  inconsistently.
- **Distribution mechanics** beyond SM1.R2 (the schema `ownedFiles` entry, the
  template↔dogfood parity pair, and the net-new `.github/workflows/` shared-dir
  overwrite path) are proven by the **release/parity lane** (`test:release`),
  not by a Gherkin scenario — matching how every other ownedFiles surface is
  gated. Tracked in impl-plan slice 8; the parity pair is first-of-its-kind
  here and needs its own release assertion.
