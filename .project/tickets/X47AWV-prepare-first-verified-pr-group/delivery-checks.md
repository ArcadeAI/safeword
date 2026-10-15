# Formal delivery checks

Requested 2026-10-15 after d1067a791; existing Draft PR #5881 remains the delivery
boundary. No promotion, merge, release, deployment, new approval policy or
unchanged paid qualification is authorized.

- [ ] Formal verify and diff-scoped audit from origin/main (in progress).
- [ ] Resolve the refactor scout ledger, one protected change per commit.
- [ ] Independent quality review; fix errors and warranted suggestions.
- [ ] Final verification, update the existing PR, and obtain green exact-head CI.

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
- [ ] R1: reuse reviewTargetsPath in plan-approval.ts; remove duplicate reviewsPlan.
  Protect with the public CLI approval/recovery file, including both human settings.
- [ ] R2: share the repeated eight-row repair proof descriptor in the acceptance
  adapter. Protect with the existing deterministic Cucumber replay and provenance tests.
- No change warranted: separate native/project guide roots enforce containment;
  shared record-validation utilities and large packet extraction add coupling;
  removing duplicate matrix parameters would churn historical test names.

Audit test coverage: static suspicious-pattern scan of all 122 changed test paths;
risk-based manual review of approval, recovery, journey, ledger, guide, upstream
context, adapter and provenance tests. This is not a full semantic review of all
122 files. No new blocking test-quality issue found. Existing timers synchronize
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
