---
id: AJVXWV
slug: keep-codex-protection-continuous
type: feature
phase: verify
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/AJVXWV-keep-codex-protection-continuous/spec.md'
  - 'scenario-gate: packages/cli/features/keep-codex-protection-continuous.feature'
  - 'plan-implementation: packages/cli/features/keep-codex-protection-continuous.feature'
  - 'implement: .project/tickets/AJVXWV-keep-codex-protection-continuous/impl-plan.md'
  - 'verify: .project/tickets/AJVXWV-keep-codex-protection-continuous/test-definitions.md'
external_issue: https://github.com/ArcadeAI/safeword/issues/1572
scope:
  - Make `safeword codex migrate` a resumable Expand → Prove → Contract state machine.
  - Preserve working legacy Codex assets during generic setup and upgrade until profile-plugin hook execution is proven.
  - Record profile-local hook-execution proof bound to the plugin version and hook manifest.
  - Add human and stable JSON status for legacy, restart-required, trust-unproven, compatibility, and plugin states.
  - Finalize repository cleanup only after current proof and explicit team confirmation, with backup and recovery.
  - Preserve unrelated Codex configuration, hooks, and `.agents/skills/` content while leaving a small setup bootstrap.
  - Make plugin hook dispatchers no-op while a complete legacy installation remains authoritative.
out_of_scope:
  - Automatically trusting Codex hooks.
  - Treating one developer's profile state as proof that every teammate migrated.
  - Project-scoped plugin activation before Codex supports it.
  - Replacing unrelated Claude Code or Cursor integration behavior.
done_when:
  - Generic upgrade leaves working legacy Codex protection intact and recommends one migration command.
  - Migration is idempotent in every state and installation failure leaves the repository unchanged.
  - Enabled-but-untrusted hooks cannot satisfy proof, while a trusted SessionStart writes current profile-local proof.
  - Compatibility mode executes exactly one Safe Word hook implementation.
  - Finalization requires current proof plus explicit interactive confirmation or an explicit non-interactive flag.
  - Finalization backs up and atomically updates Codex config, removes only known Safe Word assets, and offers recovery.
  - Finalized repositories retain a concise bootstrap skill for future Codex users.
  - `safeword codex status` provides useful human output and stable JSON output and exit semantics.
created: 2026-07-28T06:40:27.528Z
last_modified: 2026-07-28T10:32:05Z
---

# Keep Codex protection continuous while teams migrate to the profile plugin

**Goal:** Keep repository protection continuously available while each teammate migrates from legacy Codex assets to the profile plugin.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-28T06:40:27.528Z Started: Created ticket AJVXWV
- 2026-07-28T06:44:00Z Intake: Adopted GitHub issue #1572 as the approved
  product contract. The prior design discussion and the user's explicit
  instruction to tackle the issue provide signoff for its JTBD, Rules, scope,
  exclusions, and done-when outcomes.
- 2026-07-28T06:49:00Z Cold-start check: The initial spec was insufficient
  because operational state, proof, compatibility, finalization, recovery, and
  JSON contracts required guesses. Resolved each gap in spec.md with explicit,
  conservative behavior before advancing.
- 2026-07-28T06:55:00Z Define behavior: Derived eight behavior dimensions and
  saved 20 scenarios covering all ten numbered Rules, affected surfaces,
  rejection paths, failure recovery, and real CLI/hook wiring.
- 2026-07-28T07:02:00Z Scenario gate: Independent review found three blockers
  (dual no-op authority, contradictory rollback outcomes, and an incorrect
  protection assumption) plus missing boundary cases. Rewrote the blockers and
  expanded coverage for proof corruption, partial profile failure, status
  precedence and exit codes, flag combinations, and the deprecated alias.
- 2026-07-28T07:05:00Z Scenario re-review: The original blockers were resolved;
  tightened the remaining protection labels and made partial-install,
  recovery, and deprecated-alias outcomes concrete.
- 2026-07-28T07:09:00Z Scenario gate passed: Independent adversarial review
  returned 0 must-fix and 0 should-strengthen findings after three correction
  passes; Gherkin lint is clean.
- 2026-07-28T07:15:00Z Plan implementation: Chose content-bound profile proof,
  event-level coexistence, shared legacy inventory, and transactional
  finalization/recovery. Kept the coupled state machine in one feature despite
  the split suggestion; five ordered slices each carry command-level proof.
- 2026-07-28T07:24:00Z Plan review requested changes: narrowed proof to
  operational provenance, added disabled/restart/setup-required states, defined
  the complete transition and JSON schemas, made legacy authority depend on a
  runnable handler, moved inventory ownership into schema, and made recovery
  fingerprinted and conflict-safe. Added the missing boundary scenarios.
- 2026-07-28T07:35:00Z Plan gate passed: Independent review approved the
  revised schema-owned migration design after restart, legacy-protection,
  machine-contract, viability, idempotence, and recovery gaps were resolved.
- 2026-07-28T10:32:05Z Implemented: Shipped schema-owned legacy preservation,
  profile proof and restart markers, event-level compatibility, typed status,
  transactional finalization/recovery, teammate bootstrap, and migration
  documentation. Bound the complete 90-scenario continuity feature to real CLI
  and filesystem behavior. The acceptance lane exposed and closed a repeated
  migration regression; all 183 repository BDD scenarios now pass.
