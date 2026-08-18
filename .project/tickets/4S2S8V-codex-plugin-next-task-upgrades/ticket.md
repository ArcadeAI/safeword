---
id: 4S2S8V
slug: codex-plugin-next-task-upgrades
type: feature
phase: implement
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/4S2S8V-codex-plugin-next-task-upgrades/spec.md'
  - 'scenario-gate: packages/cli/features/codex-plugin-next-task-upgrades.feature'
  - 'plan-implementation: .project/tickets/4S2S8V-codex-plugin-next-task-upgrades/impl-plan.md'
  - 'verify: .project/tickets/4S2S8V-codex-plugin-next-task-upgrades/test-definitions.md'
scope:
  - refresh an existing Git-backed Safeword Codex marketplace before reinstalling the released plugin
  - represent post-install activation as pending until a different Codex app-server loads the plugin
  - let existing tasks activate the installed plugin when resumed after that full app restart
  - preserve exact-version hook pinning, hook review, and installation-bound activation proof
  - keep proof exact to the resumed task, Codex profile, canonical project worktree, and installed release
  - recognize and retire the legacy restart-pending marker during upgrades
  - document the restart-bound upgrade workflow in customer and architecture documentation
out_of_scope:
  - hot-reloading plugin skills or hooks into the task that installed the upgrade
  - changing remote MCP server reload behavior
  - silently tracking or executing safeword@latest from an already-trusted hook command
  - changing Claude Code or Cursor upgrade behavior
done_when:
  - an existing Git-backed Safeword marketplace is refreshed before the plugin is reinstalled
  - a fresh profile still adds and installs the marketplace successfully
  - successful output requires a full Codex restart before the same resumed task verifies the installed version
  - status and proof reject same-app SessionStart as coherent activation
  - bootstrap briefly rechecks concurrent SessionStart proof, then remains unverified if it never appears
  - stale, cross-task, cross-profile, and cross-worktree proof never authorizes current protection
  - focused tests, the full suite, lint, typecheck, and documentation checks pass
created: 2026-08-02T04:08:45.228Z
last_modified: 2026-08-18T00:35:30.000Z
---

# Activate Safeword upgrades coherently in Codex

**Goal:** Let Codex users install a Safeword plugin upgrade and know when one coherent skills-and-hooks catalogue has actually loaded.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-02T04:08:45.228Z Started: Created ticket 4S2S8V
- 2026-08-02T04:18:00.000Z Decision: keep immutable version-pinned plugin bundles; install upgrades in the running app and activate them only in a new task. Rejected a stable `safeword@latest` hook dispatcher because it would let trusted hook behavior change without renewed review.
- 2026-08-02T04:18:00.000Z Intake: user pre-approved the complete proposal in the preceding conversation; scope preserves current-task behavior and excludes unsupported hot reload.
- 2026-08-02T04:24:00.000Z Phase: intake → define-behavior. JTBD, four rules, affected surfaces, and engineering scope derive from the accepted no-reboot proposal.
- 2026-08-02T04:31:00.000Z Phase: define-behavior → scenario-gate. Derived six dimensions and nine scenarios covering fresh install, Git refresh, failure isolation, user guidance, exact proof, and legacy compatibility.
- 2026-08-02T04:42:00.000Z Scenario review: fresh-context gate found 5 must-fix and 2 should-strengthen gaps. Tightened released-version selection, added actual running/new-task version behavior, split version and manifest mismatch rows, split malformed and stale legacy rows, and added exact-proof preservation plus fresh-add and later-task coverage.
- 2026-08-02T04:47:00.000Z Scenario re-review: split running-task stability from the separately triggered new-task activation behavior so each lifecycle guarantee can fail independently.
- 2026-08-02T04:50:00.000Z Phase: scenario-gate → plan-implementation after Gherkin lint passed and the final independent re-review returned PASS.
- 2026-08-02T05:36:00.000Z Plan review: added scenario-level proof ownership, per-scenario Cucumber/Vitest TDD loops, explicit live/manual host boundaries, migration result schema v2, marketplace discovery failure cases, and an ADR supersession plan. Final independent re-review returned PASS.
- 2026-08-02T05:37:00.000Z Phase: plan-implementation → implement. Focused activation tests first failed on the missing activation API and next-task state, establishing RED before production changes.
- 2026-08-02T06:55:00.000Z Implementation: marketplace discovery now selects refresh for configured Git sources and add for fresh/non-Git sources; failures stop before plugin installation with stable `PLUGIN_MARKETPLACE_FAILED` output. Canonical activation markers and migration result v2 replace reboot semantics while exact legacy markers remain readable.
- 2026-08-02T06:58:00.000Z Documentation: README, website quick start/FAQ/reference, migration bootstrap, and a superseding architecture decision now distinguish the current task, the next task, and the app restart boundary.
- 2026-08-02T07:05:00.000Z Verification: focused RED/GREEN loops passed; full Vitest passed 404 files / 6,086 tests (5 skipped); full Cucumber passed 685 scenarios / 22,432 steps (3 scenarios and 4 steps skipped); lint, Gherkin lint, formatting, CLI typecheck, and Astro diagnostics passed.
- 2026-08-02T07:08:00.000Z Quality review: hardened marketplace failures to one stable code, rejected unsupported discovery entries, made concurrent exact-marker retirement idempotent, and added regression coverage. Two `@live @manual` host lifecycle scenarios remain release-time gates requiring a published prerelease and transcript in `manual-evidence.md`.
- 2026-08-02T07:20:00.000Z Post-review verification: preserved the public schema-v1 compatibility field while exposing canonical migration schema v2, restricted refreshes to the official Safeword Git source (including supported HTTPS and SSH forms), and made canonical marker writes retire matching legacy state. Focused Vitest passed 120 tests; the full Cucumber rerun passed 685 of 688 scenarios and 22,432 of 22,436 steps, with only the three intentional skips; lint, formatting, typecheck, and website diagnostics remained green. Independent quality review found no remaining code-level blocker; published-prerelease lifecycle evidence is still required before release.
- 2026-08-02T07:30:00.000Z Release candidate: prepared `0.71.0-rc.0` with all package, marketplace, plugin, and hook pins synchronized. The release workflow now publishes prerelease tags to npm's `next` dist-tag so the live exact-version test cannot advance the customer-facing `latest` channel. Release-gate tests, version sync, lint, typecheck, and formatting passed.
- 2026-08-02T07:45:00.000Z CI recovery: the first prerelease CI run exposed two test helpers that incorrectly accepted only stable `x.y.z` hook pins. Expanded their SemVer matchers to accept prerelease and build metadata while keeping exact hook-event parsing; focused schema and dependency-freshness tests passed (44 tests), together with build, typecheck, and formatting.
- 2026-08-02T07:52:00.000Z Acceptance recovery: CI then found the same stable-only parser in the Codex plugin hook-parity Cucumber step. It now accepts any explicit version token while the adjacent schema test retains exact package-version pinning. The targeted Cucumber lane passed 16 scenarios / 218 steps, with lint and formatting green.
- 2026-08-02T16:10:00.000Z Live gate failed: a new Desktop task reused the rc.0 skill catalogue while rc.1 hooks executed. Matching proof timestamps predated the rc.1 installation marker, disproving both next-task activation and hook-proof-as-whole-plugin-proof.
- 2026-08-02T16:40:00.000Z RED/GREEN correction: activation marker v2 now binds the installation to active Codex app-server PID/start identities, invalidates older proof, and clears only after SessionStart runs under a different host instance. Canonical status requires an app restart; POSIX and Windows process-table parsers fail closed. Removed retired dogfood project hooks while preserving MCP configuration. Focused proof/migration tests and revised acceptance scenarios pass.
- 2026-08-02T17:35:00.000Z Phase: implement → verify. Full Vitest passed 407 files / 6,119 tests (5 skipped); full Cucumber passed 684 runnable scenarios / 22,400 steps (3 scenarios and 4 steps skipped); ESLint, Gherkin lint, formatting, and typecheck passed. Quality review tightened malformed-marker fail-closed behavior, replaced the process parser's backtracking-prone regex, narrowed the external-host refresh claim against current Codex app-server documentation, and corrected the restart-bound live runbook. Published rc.2 host evidence remains the final release gate.
- 2026-08-02T17:55:00.000Z Final quality loop: independent review found and resolved an install-time process-observation false-green path, added an explicit observed/unavailable marker discriminator, covered quoted Windows executable paths, and reconciled design/runbook wording. Re-review returned APPROVE with no critical issues. Post-fix full Vitest passed 407 files / 6,121 tests (5 skipped); full Cucumber passed 684 runnable scenarios / 22,400 steps (3 scenarios and 4 steps skipped); ESLint, Gherkin lint, typecheck, formatting, Markdown lint, and Astro diagnostics passed. Published rc.2 same-app/restarted-app evidence remains the only release blocker.
- 2026-08-17T23:30:00.000Z Verification correction: current Codex resume events preserve the authentic task ID, so the restart boundary does not require abandoning existing tasks. Reopened implementation to replace new-task guidance, prove exact resumed-task isolation, and converge the concurrent SessionStart proof race with one bounded recheck.
- 2026-08-18T00:35:30.000Z Phase: implement → verify. Resumed-task proof now accepts the native `source: resume` identity only when the installed version, hook manifest, activation, profile, task, and canonical worktree all match. Bootstrap rechecks concurrent proof for at most 500 ms and remains unverified after the bound. User guidance now says to fully restart Codex and resume the existing task.
- 2026-08-18T00:35:30.000Z Verification: independent quality review found no blocking correctness defect; focused proof tests passed 204 tests, the full CLI suite passed 8,174 tests (7 skipped), full Cucumber passed 1,455 scenarios (3 skipped) and 65,406 steps (4 skipped), proof-tag tests passed 32 tests, and builds, changed TypeScript, Astro diagnostics, formatting, Gherkin lint, dependency audits, and the diff-scoped architecture audit passed. The aggregate repository checker remains red only for pre-existing duplicate Python experiment module names; published-candidate desktop lifecycle evidence remains the release gate.
- 2026-08-18T03:22:45.000Z Live UX correction: Codex Desktop 26.817.1524 treated `/hooks` as chat text; current upstream behavior exposes hook trust through Desktop Settings → Hooks or `/hooks` in the terminal TUI. Because an untrusted SessionStart is not replayed, the released restart-first instruction can require an avoidable second restart. Reopened implementation to put exact hook review before the one required Desktop restart.
