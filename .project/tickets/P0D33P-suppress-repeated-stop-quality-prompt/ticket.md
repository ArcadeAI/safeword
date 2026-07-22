---
id: P0D33P
slug: suppress-repeated-stop-quality-prompt
type: feature
phase: implement
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1089
scope:
  - Detect whether the latest non-done Claude Code response already supplies a complete CONFIDENT or BLOCKED decision brief.
  - Allow a compliant edited-work stop to complete without re-injecting the full quality prompt.
  - Keep the existing full prompt and soft-block behavior for a missing or incomplete decision brief.
  - Prove the pure response assessment and the real stop-hook wiring, then reconcile the dogfood installation from the template source.
out_of_scope:
  - Changing done-phase hard gates, their evidence requirements, or their execution cadence.
  - Changing the Cursor or Codex stop adapters, which have different stop semantics.
  - Adding cross-stop persistent acknowledgement state or weakening the decision-brief contract.
done_when:
  - A non-done Claude Code stop after an edit completes without a quality-prompt continuation when the latest assistant response has a complete CONFIDENT or BLOCKED brief.
  - A missing or incomplete brief still receives the existing quality-review continuation with its full guidance.
  - Focused unit and hook-wiring tests pass, and the dogfood hook is regenerated from the canonical template.
phase_anchors:
  - 'define-behavior: .project/tickets/P0D33P-suppress-repeated-stop-quality-prompt/spec.md'
  - 'scenario-gate: features/suppress-repeated-stop-quality-prompt.feature'
  - 'plan-implementation: .project/tickets/P0D33P-suppress-repeated-stop-quality-prompt/impl-plan.md'
created: 2026-07-22T00:34:33.968Z
last_modified: 2026-07-22T00:50:03.000Z
---

# Suppress repeated stop-quality prompts in a session

**Goal:** Preserve the quality-response contract while avoiding repeated identical stop-hook prompts after it has been acknowledged.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-22T00:34:33.968Z Started: Created ticket P0D33P
- 2026-07-22T00:35:32Z Intake: Revalidated GitHub issue #1089 against the shipped source. The generic non-ticket path still fires the quality prompt on every edited-work stop, and `quality.ts` still describes the prompt as reinjected every stop. The automation request supplies the intake confirmations; no user-only scope question remains.
- 2026-07-22T00:35:32Z Decision: `/figure-it-out` compared session-wide suppression, prompt shortening, and response-shape validation. Chose response-shape validation: it removes repeated prompts only when the current reply is already compliant, while preserving immediate corrective feedback for drift. W3C and NN/g guidance support succinct, contextual instruction; the existing long-session learning shows removing the hook reminder outright would weaken recency.
- 2026-07-22T00:36:20Z Define behavior: Derived response completeness, verdict type, and stop-path scope as dimensions. Saved three AODI scenarios in the feature source and their R/G/R ledger; the feature is ready for the scenario gate.
- 2026-07-22T00:43:54Z Scenario gate: Fresh-context review found missing ordinary-stop state and done-gate-precedence coverage. The amended scenarios now use `stop_hook_active: false` to exercise a later ordinary Stop (rather than the existing immediate-loop bypass), pin JSON/no-output behavior, and preserve the done hard gate. Re-review passed. Review-stamp helper cannot receive a Codex run identity in this execution environment; the independent review and evidence are recorded here instead.
- 2026-07-22T00:50:03Z Plan implementation: Independent fresh-context review passed. The plan limits the recognizer to the non-done Claude quality-soft-block path, proves both verdict families through real hook stdin/stdout, retains existing done-gate characterization coverage, and leaves Cursor/Codex untouched. Architecture review and design-approval gates are disabled in project config, so implementation advances autonomously.
- 2026-07-22T00:51:16Z RED: `bun run test tests/integration/stop-quality-response.test.ts` failed as intended. A complete CONFIDENT brief produced the existing `decision: "block"` quality continuation instead of silent stdout (commit af8c5303d).
- 2026-07-22T00:55:11Z GREEN: Added ordered, non-empty terminal-brief recognition to the canonical quality library and applied it only after done, immediate-loop, typecheck, and disqualification gates. Regenerated the two dogfood hook files from template source; the focused integration test now passes (commit 6f950b16e).
