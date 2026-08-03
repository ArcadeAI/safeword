---
id: 6QEA9Y
slug: generate-compliant-replies-without-rewrites
type: feature
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1753
phase_anchors:
  - "define-behavior: .project/tickets/6QEA9Y-generate-compliant-replies-without-rewrites/spec.md"
  - "scenario-gate: features/generate-compliant-replies-without-rewrites.feature"
  - "plan-implementation: .project/tickets/6QEA9Y-generate-compliant-replies-without-rewrites/impl-plan.md"
  - "implement: .project/tickets/6QEA9Y-generate-compliant-replies-without-rewrites/impl-plan.md"
  - "verify: .project/tickets/6QEA9Y-generate-compliant-replies-without-rewrites/verify.md"
  - "done: .project/tickets/6QEA9Y-generate-compliant-replies-without-rewrites/verify.md"
scope:
  - Export one phase-neutral decision-brief contract from the existing quality vocabulary
  - Deliver the exact contract through every current Claude SessionStart source — startup, resume, clear, compact, and fork — while retaining the compact per-prompt and lead-only TDD cues
  - Deterministically recognize compliant CONFIDENT and BLOCKED terminal briefs from Claude Stop input
  - Parse only top-level rendered paragraphs in a contiguous final Markdown brief with exact ordered labels, ignoring verdict-like text inside quotes, lists, fenced or indented code, HTML blocks or comments, and prose while using a bounded linear-time scan
  - Skip only the redundant soft format-correction continuation for compliant replies while preserving all hard and advisory gates
  - Cover installed template wiring and dogfood parity with real-hook subprocess tests
out_of_scope:
  - Cursor or Codex proactive reply-format parity, tracked by GitHub issue 1547
  - Changing the canonical decision-brief wording beyond resolving its existing CONFIDENT and BLOCKED grammar
  - Semantic grading of whether a structurally compliant decision brief is truthful or high quality
  - Weakening dependency, test, architecture, phase-artifact, or done enforcement
done_when:
  - Claude startup, resume, clear, compact, and fork configured SessionStart groups contain the exact phase-neutral decision-brief contract exactly once without replacing SAFEWORD standing context
  - A compliant CONFIDENT response completes without a format-correction continuation
  - A compliant BLOCKED response completes without requiring a separate Next paragraph
  - A non-compliant response receives one correction and stop_hook_active prevents a rewrite loop
  - Active TDD steps retain only the lead-first cue
  - The compact ordinary-work cue names CONFIDENT with Next and BLOCKED with Need without requiring both terminal labels
  - Hard gates run on every Stop; first-Stop advisory feedback precedes format compliance while the correction loop guard prevents repeated advisory or format continuations
  - Quoted, listed, fenced, indented-code, HTML-contained, incidental, reordered, empty, duplicated, mixed, and trailing verdict-like content cannot produce a false pass
  - Equivalent one-, two-, and four-megabyte adversarial replies prove bounded linear parser work through examined-character counts
  - A separately declared reference-runner benchmark proves the fixed four-megabyte workload completes within the in-process hook budget
  - A live Claude walkthrough proves the visible one-completion outcome or verification records why that runtime proof was unavailable
  - Configured SessionStart and Stop subprocesses prove both behaviors follow one changed canonical contract
  - Setup reconciliation restores installed-hook drift, plugin generation plus the worktree-diff gate rejects a stale committed plugin, and template parity rejects dogfood pair drift
created: 2026-08-03T04:24:36.367Z
last_modified: 2026-08-03T08:18:13.000Z
---

# Generate compliant replies without correction loops

**Goal:** Make the exact final reply contract available before generation so builders receive one compliant response instead of a visible rewrite.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-03T04:24:36.367Z Started: Created ticket 6QEA9Y
- 2026-08-03T04:53:00.000Z Intake complete: user approved the jobs, Rules, scope, exclusions, and observable done state; advanced to define-behavior.
- 2026-08-03T05:42:00.000Z Define behavior complete: user accepted 19 scenario groups across seven Rules after the quality-review loop; advanced to scenario-gate.
- 2026-08-03T06:04:00.000Z Scenario gate complete: independent review-spec passed with zero findings after revisions; review stamp recorded and advanced to plan-implementation.
- 2026-08-03T06:36:00.000Z Implementation plan complete: parse-valid plan independently approved with no must-fix findings; review stamp recorded and advanced to implement.
- 2026-08-03T07:58:00.000Z Implementation complete: 70/70 acceptance scenarios pass, the generated Claude plugin and dogfood mirrors are current, the reference benchmark passed, and the live Claude limitation is recorded; advanced to verify.
- 2026-08-03T08:18:13.000Z Verification complete: independent quality review approved the remediated implementation; 6,489 runnable unit/integration tests and 910 runnable repository acceptance scenarios pass; build, lint, typecheck, dependency, parity, and audit gates pass; the unavailable live Claude runtime is recorded without overstating subprocess evidence; marked done.
