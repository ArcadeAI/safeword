---
id: NGCGF5
slug: prevent-legacy-global-instructions
type: feature
phase: done
phase_anchors:
  - "define-behavior: .project/tickets/NGCGF5-prevent-legacy-global-instructions/spec.md"
  - "scenario-gate: packages/cli/features/prevent-legacy-global-instructions.feature"
  - "plan-implementation: packages/cli/features/prevent-legacy-global-instructions.feature"
  - "implement: .project/tickets/NGCGF5-prevent-legacy-global-instructions/impl-plan.md"
  - "verify: .project/tickets/NGCGF5-prevent-legacy-global-instructions/verify.md"
status: complete
scope:
  - inject a concise current-path authority header into Codex session context
  - detect legacy Safe Word guidance in the active Codex profile AGENTS.md
  - report exact legacy files as recoverably remediable and edited variants as warning-only
out_of_scope:
  - overwrite or delete customer-authored Codex guidance automatically
  - inspect unrelated AGENTS.md files outside the active Codex profile
  - change Codex's native instruction precedence
done_when:
  - Codex receives an unambiguous current Safe Word path contract before the full standing instructions
  - doctor and Codex status identify conflicting legacy profile guidance with a concrete next action
  - exact historical content can be backed up and removed through an explicit remediation path
  - modified profile guidance is preserved and only warned about
created: 2026-08-02T04:20:32.112Z
last_modified: 2026-08-02T04:20:32.112Z
---

# Prevent stale Safe Word guidance from blocking Codex users

**Goal:** Detect and neutralize legacy Safe Word global Codex instructions without overwriting user-owned guidance

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-02T04:20:32.112Z Started: Created ticket NGCGF5
- Figure-it-out: chose runtime authority plus diagnostics and explicit recoverable cleanup; rejected silent deletion of customer-owned guidance.
- Intake: confirmed OpenAI Codex and Safeword CLI surfaces, current `.project/` and `.safeword/guides/` paths, and the Technical Builder job.
- Define behavior: five scenarios cover runtime authority, exact and edited legacy detection, false-positive rejection, and recoverable cleanup.
- Scenario review: tightened both-command coverage, literal current paths, unsafe-cleanup refusal, stale-diagnosis protection, and backup collision safety.
- Scenario gate: fresh-context re-review passed with 0 must-fix and 0 should-strengthen findings.
- Plan gate: fresh-context review passed after move-boundary restoration and concurrent-recreation safety were made explicit.
- Implemented current-path session authority, profile diagnostics, and plan-confirmed move-verify-restore cleanup.
- Dogfood remediation: moved exact legacy global guidance to `/Users/alex/.codex/AGENTS.md.safeword-legacy.bak` and refreshed installed context/version state.
- Verified: full Vitest, Cucumber, typecheck, lint, build, diff-scope architecture, domain-doc, documentation, and test-quality checks passed; audit reported no errors or warnings.
