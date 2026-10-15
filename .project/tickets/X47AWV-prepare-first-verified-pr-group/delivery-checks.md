# Formal delivery checks

Requested 2026-10-15 after d1067a791; existing Draft PR #5881 remains the delivery
boundary. No promotion, merge, release, deployment, new approval policy or
unchanged paid qualification is authorized.

- [x] Execute formal verify and diff-scoped audit; retain the nonzero verifier result.
- [x] Resolve the refactor scout ledger, one protected change per commit.
- [x] Independent quality review; fix errors and warranted suggestions.
- [x] Prepare final local evidence and existing Draft PR handoff; the PR's
  current-head readiness block owns the subsequent CI result. See verify.md.

Audit base: d5885e58771cd87f8108196ce67986f7725a1974. The packaged skill's executable
blocks run verbatim with repository-pinned tools. Full verification owns the
only local Vitest process; scouts are read-only.

## Initial observations

- Architecture reports an orphan for delivery-compatibility-rubric.ts, but the
  generator imports it. This is a tooling coverage warning, not dead code.
- The initial resolver invocation put --ticket before its argument separator.
  Passing it after `--` resolves X47AWV. The generic principle-check block reports
  conflicting branch tickets; explicit inspection finds no impl-plan.md or
  declared principle trace on this delivery task. Its intake scaffold is preserved.

## Audit and refactor ledger

- [x] E004: update README and the workflow/configuration/skill-reference docs for the two planning
  phases and the existing headless gate. No new behavior or policy.
- [x] R1: reuse reviewTargetsPath in plan-approval.ts; remove duplicate reviewsPlan.
  Protect with the public CLI approval/recovery file, including both human settings.
- [x] R2: share the repeated eight-row repair proof descriptor in the acceptance
  adapter. Protect with the existing deterministic Cucumber replay and provenance tests.
- [x] T1: require successful hook completion before asserting quiet output in
  post-tool-review.test.ts; retain child error, signal and output in diagnostics.
  The extracted actual helper accepts a controlled terminated child with empty
  stdout before correction. This is a proof weakness, not the timeout root cause.
- No change warranted: separate native/project guide roots enforce containment;
  shared record-validation utilities and large packet extraction add coupling;
  removing duplicate matrix parameters would churn historical test names.

Audit test coverage: static suspicious-pattern scan of all 122 changed test paths;
risk-based manual review of approval, recovery, journey, ledger, guide, upstream
context, adapter and provenance tests. This is not a full semantic review of all
122 files. The supplemental failure review found T1 above. Existing timers synchronize
explicit barriers or test process lifetime; no new arbitrary approval sleeps found.

Agent-config/document reference checks covered 22 changed canonical/config files
and 32 concrete installed paths; none were missing. No added runtime dependency
or changed architecture inventory contradiction was found. The generated map's
unintrospected checker package limits structural coverage. Repository-wide Knip,
clone totals and dependency upgrade discovery are intentionally outside this diff audit.

The documentation correction builds successfully with the website's Astro build
(9 pages). Saved diagrams include both planning gates. Source/final preservation:
PLAN_IMPLEMENTATION.md says a successful approval or `not required` result sets
`phase: plan-execution`; configuration now says the reviewed Implementation Plan
can "advance to Execution Planning without a human checkpoint" when the gate is
off. Its source says an enabled headless gate "leaves the ticket in Implementation
Planning"; the final docs say it "keeps the ticket in Implementation Planning" and
records a pending ledger receipt. Build order and concrete proof moved to the
Execution Plan in both diagrams, prose and artifact inventory. No CLI output or
human authority beyond the existing contract is promised.

## Verification observations

The prescribed verifier discovers the root and package commands separately.
Its first CLI pass failed 15 tests across four files (11,065 passed, 14 skipped):
pr-readiness-install (6), plugin-resource-contract (2), missing-plan-contract (1),
and post-tool-review (6). These show deadline/status failures; their common root
cause is unresolved. The second full CLI pass passed 11,080 tests with 14 skips.
The first acceptance pass passed 596 scenarios / 11,118 steps, followed by all
50 proof-provenance tests. Later passes do not erase the earlier failure.

T1's separate root cause is established: run() parses empty stdout even when
spawnSync returns status null. Tests that check only absent context can pass for
a terminated hook. Extracting the actual helper and injecting a controlled
terminated-child result reproduced that false pass. This demonstrates a proof
weakness; it does not explain the full-suite deadlines. A copied native bundle's
ticket-new and offline-install probe completed successfully, which likewise
does not diagnose the failing hook or nested Cucumber paths. No timeout increase,
silent retry, pool change or paid qualification is part of the correction.

Walked the Technical Builder's documented headless flow from a reviewed approach
through pending human approval to Execution Planning; worst step = waiting for
the human decision, with no new steps versus the existing CLI contract. The
rendered documentation preserves that ending. This is an agent reader walk,
not human usability evidence. The parent's complete feature journey remains
unreachable as a certified epic demo because unfinished children and deferred
host proof remain outside this landing group.
