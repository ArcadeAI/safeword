---
id: GZZEY7
slug: migrate-legacy-claude-projects-automatically
type: feature
phase: implement
status: in_progress
phase_skips:
  - 'intake: The maintainer approved the scope and migration outcome before this ticket snapshot was first committed; ticket.md and spec.md preserve that intake evidence.'
  - 'define-behavior: The rules, dimensions, and executable scenarios were completed and reviewed before this ticket snapshot was first committed.'
  - 'scenario-gate: Independent scenario review completed before this ticket snapshot was first committed; the feature source and work log preserve the accepted corrections.'
  - 'plan-implementation: Independent plan review completed before this ticket snapshot was first committed; impl-plan.md and the work log preserve its reconciled design.'
phase_anchors:
  - 'define-behavior: .project/tickets/GZZEY7-migrate-legacy-claude-projects-automatically/spec.md'
  - 'scenario-gate: features/automatic-claude-migration.feature'
  - 'plan-implementation: features/automatic-claude-migration.feature'
  - 'implement: .project/tickets/GZZEY7-migrate-legacy-claude-projects-automatically/impl-plan.md'
scope:
  - Automatically retire every exact current or historical Safeword-owned Claude asset after the exact native plugin proves a successful UserPromptSubmit event in that repository.
  - Preserve and loudly report modified or unknown Claude files and settings entries without blocking the prompt or retaining recognized framework junk.
  - Make cleanup and recovery idempotent across crashes, concurrent hook processes, developers, and worktrees.
  - Preserve project-scoped teammate enrollment and support an identical user-scoped installation without duplicate-work or false-overlap errors.
out_of_scope:
  - Silently accepting Claude's repository trust or plugin-install prompt for another developer.
  - Removing project-owned `.safeword` state still used by Cursor, Codex, tooling, tickets, or knowledge.
  - Treating a version marker by itself as ownership proof, or deleting bytes absent from the accepted historical catalogue.
  - Releasing or publishing the patch in this ticket session.
done_when:
  - Real 0.68, 0.69, and 0.72 project fixtures contract automatically after exact plugin execution without deleting changed content.
  - A successful prompt is never blocked by migration success, conflict, or recoverable contention, and receives one plain-language advisory when attention remains.
  - Recovery completes transactions containing any mixture of recorded before and after images and preserves a third concurrent image.
  - Project plugin declarations survive contraction and cause Claude's documented teammate installation prompt; identical user and project declarations resolve to one effective plugin.
  - Targeted, full, BDD, release-contract, live disposable-profile, verification, audit, refactor, and quality-review checks pass before release.
created: 2026-08-05T15:30:27.364Z
last_modified: 2026-08-05T15:30:27.364Z
---

# Migrate legacy Claude projects automatically

**Goal:** Retire exact legacy Claude assets after the native plugin proves it is running, without deleting user changes or requiring cleanup ceremony.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-06T16:00:00Z PR review follow-up resolved missing hook-root fallback, bounded later-session recovery, symlinked-ancestor classification, and direct transaction-before-mutation acceptance coverage; consolidated plugin-mode construction and fail-open advisory framing; stabilized two current-main timing assertions without weakening their behavioral bounds.
- 2026-08-05T15:30:27.364Z Started: Created ticket GZZEY7
- 2026-08-05T15:34:00Z Intake confirmed: The user approved the independently quality-reviewed corrective plan after live failures in Arcade and www proved historical 0.68, 0.69, and 0.72 assets were misclassified. Scope keeps Claude trust human-owned while removing migration ceremony.
- 2026-08-05T15:34:00Z Defined behavior: Four rules and twelve scenarios cover historical ownership, partial safe contraction, automatic proof boundary, crash/race recovery, and project/user scope continuity. Advanced to scenario-gate.
- 2026-08-05T15:39:00Z Scenario review: Independent Claude review approved the contract and suggested stronger observability for failed events, induced contention, all-after recovery, and unsupported history. Adopted all four and added the uncatalogued-runtime rejection before final re-review.
- 2026-08-05T15:43:00Z Scenario re-review: The reviewer caught an unproven mixed-settings deletion boundary. Added an explicit same-file structural-preservation scenario and made fresh plugin-mode marker creation observable.
- 2026-08-05T15:47:00Z Scenario final review: Approved cross-agent with one coverage asymmetry. Added the positive release-contract case, named the deduplicated prompt context effect, and clarified the failed-event boundary.
- 2026-08-05T15:51:00Z Scenario gate passed: Final independent review approved the then-current 16 scenarios. Tightened failed-event recovery guidance, JSON structural preservation, and deterministic teammate enrollment evidence; advanced to plan-implementation.
- 2026-08-05T16:08:00Z Plan review requested changes: Clarified that authorization comes from Safeword's own sequential aggregate commands, moved the no-spawn marker check into the dispatcher, specified bounded loser convergence and fail-closed dual-scope fallback, added an early lifecycle seam proof, and added explicit timeout-deferral acceptance coverage.
- 2026-08-05T16:19:00Z Plan re-review requested changes: Reframed the earliest proof around authorization and interruption safety, pinned normal first-prompt cleanup to a 2,000 ms real-fixture budget, added the over-budget race-loser scenario, assigned the dispatcher seam wholly to slice 0, and required explicit mutation effects on the hidden action.
- 2026-08-05T16:25:00Z Scenario re-review approved and noted two boundary improvements: specified complete removal for an exact hook-only settings file, required unknown settings entries in the advisory, and made race-loser convergence externally deterministic.
- 2026-08-05T16:30:00Z Final scenario review approved; adopted its non-blocking follow-ups by pinning shared `.safeword`, Cursor, and Codex state outside contraction and defining a recoverable filesystem-refusal outcome.
- 2026-08-05T16:38:00Z Plan review approved. Adopted its proof refinements: deterministic fake-clock timeout enforcement plus an informational real-fixture benchmark, explicit hook-only settings deletion, a shared marker contract defined in slice 0, and slice ownership for shared-state, unproven, and filesystem-refusal cases.
- 2026-08-05T16:47:00Z Hash-valid plan re-review found an unbounded slow-repository retry risk. Added durable incremental progress, three prompt retries followed by one automatic retry per new session, a no-spawn cap scenario, exact all-field settings fingerprints with near-match rejection, and a five-run 1,500 ms RC threshold beneath the 2,000 ms host timeout.
- 2026-08-05T16:58:00Z Plan re-review found stable conflicts could still run per prompt. Added an all-launch attempt ledger, an observation-bound attention marker, catalogue-bound unresolved plugin mode, state-change/new-session re-arming, and clarified that slice 0 alone owns the dispatcher fast paths and timeout.
- 2026-08-05T17:10:00Z Plan re-review tightened concurrency and ownership: replaced the mutable ledger with exclusive per-session launch slots and a launch lock, separated clean/unresolved plugin-mode v2 from attention state, parameterized the slice-0 seam over later digests, and required proof that restore-backup has no non-Claude consumer before removal.
- 2026-08-05T17:22:00Z Plan re-review exposed stale launch-lock and settings-format risks. Removed the subprocess and extra launch lock in favor of one shared in-process migration function with cooperative deadlines, assigned all fast-path schemas to slice 0, and required source-range JSONC edits that preserve untouched settings bytes and comments.
- 2026-08-05T17:34:00Z Plan re-review restored explicit irreversible-path guards: added symlink/path-escape refusal, cold first-run RC measurements, mid-session Claude reload coherence evidence, host-kill observation, and made retaining the Codex-compatible restore union the default branch.
- 2026-08-05T17:42:00Z Scenario re-review required the settings promise to be executable: mixed JSONC cleanup now asserts byte-exact preservation of untouched comments, whitespace, and source regions rather than parsed-value equivalence alone.
- 2026-08-05T17:50:00Z Plan gate passed: Independent Claude review approved the in-process, proof-gated design. Advanced to implementation; unexpected-exception containment, silent clean completion, and early reload-coherence evidence remain explicit test notes.
- 2026-08-05T19:57:59Z Pre-release implementation complete: proof-gated historical Claude contraction, crash/race recovery, project/user scope handling, nonblocking prompt advisories, generated runtime delivery, Codex teammate bootstrap continuity, documentation, and release contracts are implemented. Full local verification passed (6,602 tests in the complete suite plus the final direct-prompt protocol regression; 983 non-live BDD scenarios), audit passed, and independent quality review approved. The ticket remains in progress because the authenticated disposable-profile RC lifecycle and five-run cold benchmark are intentionally deferred until a release candidate exists; no release action was taken.
- 2026-08-05T22:55:00Z Full quality/refactor/verify/audit pass complete: consolidated durable writes and inventory contracts, hardened generated/runtime integrity and Claude hook precedence, added real-process installer and dispatcher coverage, made the sealed plugin manifest formatter-idempotent, removed stale audit suppression and unnecessary public API, and updated low-risk dev tooling. The exact final tree passes 6,620 runnable unit tests, 983 runnable BDD scenarios/37,272 steps, lint, format, typecheck, build, release contracts, and dependency audit. Repository audit has no errors; remaining warnings are documented baselines. The earlier independent quality review approved; final bounded re-review retries timed out in headless Claude and produced no valid fallback verdict. Ticket remains in progress for authenticated RC lifecycle/benchmark evidence; no release action was taken.
