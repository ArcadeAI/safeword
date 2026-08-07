---
id: SH7HCW
slug: keep-safeword-recovery-runnable
type: feature
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1966
phase_anchors:
  - 'define-behavior: .project/tickets/SH7HCW-keep-safeword-recovery-runnable/spec.md'
  - 'scenario-gate: features/safeword-recovery-through-dependency-readiness.feature'
  - 'plan-implementation: .project/tickets/SH7HCW-keep-safeword-recovery-runnable/impl-plan.md'
  - 'implement: .project/tickets/SH7HCW-keep-safeword-recovery-runnable/impl-plan.md'
  - 'verify: .project/tickets/SH7HCW-keep-safeword-recovery-runnable/test-definitions.md'
  - 'done: .project/tickets/SH7HCW-keep-safeword-recovery-runnable/verify.md'
scope:
  - Keep top-level Safeword setup and diagnostic commands reachable through the dependency-readiness PreToolUse hook.
  - Continue blocking dependency-backed package executors while project dependencies are missing or stale.
  - Replace the obsolete dogfood parity recovery command with the supported setup command.
out_of_scope:
  - Claude migration and status reconciliation, owned by the existing migration work.
  - Python monorepo project-root discovery, which needs a separate topology design.
  - Exempting arbitrary `bunx` packages or every Safeword subcommand from dependency readiness.
done_when:
  - `bunx safeword@latest setup`, `status`, `doctor`, and `plan` remain runnable when dependency readiness would block a package executor.
  - Versioned and unversioned Safeword package forms are recognized without allowing similarly named packages.
  - `bunx vitest run` and chained commands that contain it remain guarded.
  - Dogfood parity failures direct maintainers to `bunx safeword setup`, not the removed `install` command.
created: 2026-08-06T00:07:05.713Z
last_modified: 2026-08-07T00:25:47Z
---

# Keep Safeword recovery runnable when dependencies are broken

**Goal:** Let users run Safeword setup and diagnostics even when project dependencies are missing or stale

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-06T00:07:05.713Z Started: Created ticket SH7HCW
- 2026-08-06T00:12:00Z Intake complete: revalidated GitHub #1966 against current main, excluded the separately-owned Claude and Python scopes, and selected a command-aware recovery exemption. Added three rules and three scenario groups; moved to scenario-gate.
- 2026-08-06T00:18:00Z Scenario review: independent cross-agent review approved with one warning. Named the exact obsolete `bunx safeword install` command and added stale-state denial coverage before re-review.
- 2026-08-06T00:24:00Z Scenario re-review exposed an overly broad allowlist risk. Added a bare non-recovery Safeword subcommand as a denial boundary so only the four named recovery commands can bypass readiness.
- 2026-08-06T00:29:00Z Scenario gate complete: final independent cross-agent review approved all three rules with no blocking findings; review provenance stamped. No eligible spike risk. Advanced to plan-implementation.
- 2026-08-06T00:36:00Z Plan review requested changes: shell-composition coverage only pinned `&&`. Returned to scenario-gate and added every supported separator plus background/substitution denial, documented `--bun` tolerance, and clarified tag-or-version matching. Declined `-y` coverage because current Bun help does not support that flag.
- 2026-08-06T00:45:00Z Scenario re-gate complete: independent cross-agent review approved the expanded security boundaries; exact newline command captured and provenance re-stamped. Returned to plan-implementation.
- 2026-08-06T00:53:00Z Plan re-review found the parallel backtick-substitution gap and trailing-token ambiguity. Returned to scenario-gate; added backticks, environment-prefix allowance, and bare-package denial. Plan now tolerates ordinary CLI flags but denies shell execution tokens.
- 2026-08-06T01:00:00Z Final scenario re-gate approved and stamped with no blocking findings. Returned to plan-implementation with the complete command-smuggling matrix fixed.
- 2026-08-06T01:08:00Z Plan review rejected the enumerated shell-token design after identifying process substitution. Returned to scenario-gate and inverted the design: a strict positive recovery shape with all shell-evaluation metacharacters falling through to the guard. Added pinned-version and process-substitution scenarios; confirmed non-bunx Safeword invocations are already unguarded by the existing known-binary classifier.
- 2026-08-06T01:13:00Z Strict-shape scenarios passed independent re-review with no blocking findings and were re-stamped. Returned to plan-implementation.
- 2026-08-06T01:20:00Z Implementation plan approved by independent cross-agent review and stamped. Four build tasks across two existing code paths are below the split threshold; no ADR. Advanced to implement.
- 2026-08-06T01:36:00Z Implemented the planned strict recovery classifier in canonical and dogfood hooks, added real PreToolUse wiring plus adversarial command-smuggling coverage, and corrected parity recovery guidance. Independent whole-diff quality review approved with no required changes. Plan reconciled with both decisions unchanged and no deviations; advanced to verify.
- 2026-08-06T01:55:43Z Verification complete: full unit, acceptance, build, lint, typecheck, and dependency-audit lanes passed. Added the missing executable Cucumber bindings discovered by the first full lane; all 22 recovery scenarios now run against the real hook. Diff audit passed with no errors or warnings.
- 2026-08-06T01:55:43Z Closed: recovery commands remain runnable through dependency readiness while unrelated package execution stays guarded.
- 2026-08-07T00:22:02Z Revalidated: rebased onto current main, preserving its separate safe install-and-retry recovery for issue #1763. Main added a generated Claude-plugin hook copy, so regenerated the plugin to carry this ticket's command-aware recovery exception across template, dogfood, and shipped runtime surfaces. The 22-scenario recovery feature passes; focused Vitest verification was delayed by sustained shared-lock contention across other worktrees.
- 2026-08-07T01:40:00Z Post-review hardening (`/review-spec`, `/quality-review`, `/refactor` on the PR): retagged the hook rules to `@surface.claude-code` — the guard is wired only in `.claude/settings.json`, so `@surface.safeword-cli` (behavior that holds in a plain terminal) was wrong; rewrote the parity scenario whose `Given` claimed dogfood drift it never established; covered the pre-verb global-option branch (`--cwd`, `--cwd=`, `--quiet`, unrecognized flag) that no scenario or unit row exercised — deleting it would have left every test green; promoted the `setupx` lookalike and `>(...)` process substitution from the unit table into the feature contract; dropped the NTB persona, which had no rule or scenario; documented why `firstSafewordCommandArgument` deliberately diverges from `firstCommandArgument`. Recovery lane now 28 scenarios / 1,094 steps.
- 2026-08-07T00:25:47Z Verified after rebase: shared-lock contention cleared; 144 focused dependency-readiness tests and 5 Claude-plugin/parity release tests pass. Plugin release alignment and both package typechecks are green.
