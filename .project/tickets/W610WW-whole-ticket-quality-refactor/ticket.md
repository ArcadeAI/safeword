---
id: W610WW
slug: whole-ticket-quality-refactor
type: feature
phase: done
status: done
created: 2026-06-20T15:47:16.880Z
last_modified: 2026-06-20T15:47:16.880Z
scope:
  - Make the end-of-implement step a whole-ticket pass — `bdd/TDD.md` implement-exit runs `/quality-review` over the ticket's full diff, then `/refactor` the findings, then records the cross-scenario row. `bdd/VERIFY.md` stops owning the step and references it.
  - Gate the pass on loop count ≥2 — in `ledger-validation.ts`, require + validate the cross-scenario row only when the parsed `scenarios.length >= 2`; a single-loop ticket is exempt (no row demanded). Replaces today's "required iff any annotation" rule.
  - Drop the `isFeature` fence (`stop-quality.ts:539`) so a task WITH a `test-definitions.md` reaches the same ledger/cross-scenario validation as a feature; loop count, not ticket type, decides.
  - Prove the review half via the existing skill-invocation log — add the `record-skill-invocation.ts` line to the `/quality-review` skill, and require a current-session `/quality-review` entry at the done gate when loop count ≥2 (extend the existing `/verify`+`/audit` skill-invocation gate, currently feature-only, to multi-loop tasks).
  - Sync all three skill mirrors (`.claude/skills`, `.agents/skills`, `packages/cli/templates/skills`) and both hook copies (`.safeword/hooks`, `packages/cli/templates/hooks`).
  - Tests: unit tests for the ≥2 threshold (0/1/2+ loops) and the task path through `validateLedger`; an integration test proving the done gate blocks a multi-loop task missing the row and passes a single-loop task without it.
out_of_scope:
  - Counting GREEN commits / parsing commit messages as the trigger (rejected — fragile and redundant with the parsed ledger).
  - Synthesizing a `test-definitions.md` for tasks that don't have one (rejected — single-loop/untracked tasks auto-skip; nothing to cross).
  - A new checkbox type or file format (reuse the existing cross-scenario row + skill-invocation log).
  - Changing what `/quality-review` or `/refactor` do internally — this only wires them into the phase.
  - Moving enforcement to the implement→verify transition — the row stays validated at the existing done gate (authored in implement, enforced at done, as today).
done_when:
  - A task or feature with ≥2 RGR loops in `test-definitions.md` is blocked at done until the cross-scenario row carries a SHA or `skip:<reason>` AND `/quality-review` was invoked this session.
  - A ticket with exactly 1 loop requires neither the row nor a `/quality-review` invocation — done proceeds, gate silent.
  - A multi-loop *task* (not just feature) hits the ledger/cross-scenario validation — the `isFeature` fence no longer excludes it.
  - `bdd/TDD.md` owns the `/quality-review` → `/refactor` → record sequence at implement-exit; `bdd/VERIFY.md` references rather than re-specifies it.
  - All three skill mirrors and both hook copies in sync; unit + integration tests green; full suite + lint green.
---

# Whole-ticket quality review + refactor before verify

**Goal:** Make the end of implementation run one whole-ticket `/quality-review` → `/refactor` pass — for both BDD features and multi-loop TDD tasks — gated to fire only when there's more than one RGR loop.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-20T15:47:16.880Z Started: Created ticket W610WW
- 2026-06-20T15:50:00.000Z Complete: intake - Understanding converged (design via /figure-it-out), scope established. 3 JTBDs (DEV1/DEV2/SM1), 6 ACs. Gate on loop count ≥2 from parsed ledger; drop isFeature fence; reuse skill-invocation log + cross-scenario row for proof.
- 2026-06-20T15:54:00.000Z Complete: define-behavior - 10 scenarios across 3 rules; dimensions.md authored. Boundary (1→2 loops) + legacy-exemption regression guard covered.
- 2026-06-20T16:02:00.000Z Complete: scenario-gate - independent fresh-context review found 4 must-fix + 3 should-strengthen (vacuous-against-current-code scenarios, two missing negatives). Revised to 14 scenarios; pinned explicit loop counts; added single-loop-not-blocked-for-review and task-blocked-for-review negatives. impl-plan.md written (test layers + build order). Stamp recorded.
- 2026-06-20T16:24:00.000Z Complete: implement - 14 scenarios green across 3 units (ledger threshold, countRgrLoops + requiredSkillsForDone helpers, done-gate restructure). Whole-ticket /quality-review pass run (logged); independent review 0 must-fix; cross-scenario hardening commit (doc drift + 2 positive-path tests + helper dedup). impl-plan reconciled → implemented. Full regression green, tsc + parity clean.
- 2026-06-20T16:48:00.000Z Rebased onto main twice (caught up through merged #276-279); remapped ledger SHAs each time (Bug 1 — done-gate ledger breaks on rebase). Tagged the feature @wip so the cucumber lane stays green (hook-gate scenarios backed by vitest, per gherkin-lane policy).
- 2026-06-20T16:55:00.000Z Complete: verify - /verify + /audit passed (test 3141, bdd 69, lint clean, audit 0/0), verify.md written. status → done.
- 2026-06-20T17:20:00.000Z Reopened: session-wide /quality-review caught S1 — row and review halves used different triggers, so a legacy unannotated ticket (exempt from the row) was wrongly forced to log /quality-review. Fixed by unifying both halves on a single `wholeTicketPassApplies` predicate (retired countRgrLoops); corrected 2 integration tests that encoded the bug; added unit + integration regression guards (15th scenario). Also fixed S2 (@wip comment accuracy).
- 2026-06-20T17:45:00.000Z Complete: verify (re-run) - /verify + /audit passed (test 3161, bdd 69, lint + parity clean, 15/15 scenarios, 46/46 ledger). verify.md refreshed. status → done.
