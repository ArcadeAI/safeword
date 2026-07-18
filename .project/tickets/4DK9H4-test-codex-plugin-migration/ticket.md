---
id: 4DK9H4
slug: test-codex-plugin-migration
type: feature
phase: done
status: done
phase_anchors:
  - implement: 1898cec6
  - verify: 4361afec
  - done: 567615eb
scope:
  - Static plugin/package contract tests for the Safe Word Codex plugin manifest, marketplace entry, bundled skills, bundled hooks, and published package contents
  - Isolated Codex plugin install harness using a temp CODEX_HOME and local marketplace, proving plugin install/enablement without repo-local Safe Word assets
  - Prompt-surface checks with `codex debug prompt-input`, proving Safe Word Codex skills are visible from the plugin and pinning the intended invocation names
  - Deterministic hook-entrypoint contract tests that feed Codex hook JSON to packaged Safe Word CLI commands instead of repo-installed `.safeword/hooks` scripts
  - Opt-in live Codex smoke that runs `codex exec --json` against the installed plugin and proves the supported hook path blocks/permits edits as expected
  - Migration coverage from the existing project-local Codex install shape to the plugin-backed shape, preserving user data while removing or ignoring obsolete managed assets
out_of_scope:
  - Shipping the production Codex plugin migration itself before the test harness is in place
  - Changing Claude Code or Cursor install behavior
  - Publishing to a remote plugin marketplace or designing the release channel beyond local/package-backed verification
  - Rewriting Safe Word's BDD/TDD policy, quality gates, or ticket model
  - Proving Codex Cloud behavior unless it becomes explicitly supported by the plugin mechanism
done_when:
  - A fresh temp repo can install the Safe Word Codex plugin from a local marketplace under an isolated CODEX_HOME, and `codex plugin list --json` proves it is installed and enabled
  - The same fresh repo exposes Safe Word Codex skills through `codex debug prompt-input` without requiring `.agents/skills` in the repo
  - The packed Safe Word package includes the plugin assets and CLI hook entrypoints needed by plugin hooks
  - Plugin hook commands invoke package-runner or packaged CLI entrypoints and contain no dependency on repo-local `.safeword/hooks` paths
  - Existing Codex hook deny/allow/continuation semantics are covered through packaged CLI entrypoints with exact Codex hook JSON fixtures
  - The opt-in live smoke exercises plugin-installed hooks through real `codex exec --json --dangerously-bypass-hook-trust` and records any known Codex interception boundary
  - A migration fixture starting from today's project-local Codex install shape ends with no bulky Safe Word Codex skill/hook dependency in the repo, while user-owned project data is preserved
created: 2026-07-09T01:04:07.604Z
last_modified: 2026-07-09T20:10:04Z
---

# Test Codex plugin migration

**Goal:** Prove Safe Word works in Codex through a plugin and package-runner CLI entrypoints without installing bulky repo-local assets.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-09T01:04:07.604Z Started: Created ticket 4DK9H4
- 2026-07-09T01:04:31Z Drafted intake scope from Codex plugin testing research; awaiting intake confirmation before define-behavior.
- 2026-07-09T01:13:16Z Decision: accepted plugin-scoped Codex skill names (`safeword:<skill>`); remaining package-runner and hook-trust questions deferred to implementation/product docs decisions.
- 2026-07-09T01:13:16Z Phase: intake → define-behavior
- 2026-07-09T01:19:50Z Drafted dimensions plus 18 behavior scenarios; `lint-gherkin features/test-codex-plugin-migration.feature` passed, `safeword check` still reports pre-existing repo health advisories plus this ticket's uncommitted phase-anchor advisory.
- 2026-07-09T01:51:29Z Quality-review pass tightened repo-footprint, hook-event, and hook-trust coverage; final draft has 23 behavior scenarios. `lint-gherkin features/test-codex-plugin-migration.feature` and `git diff --check` passed; `safeword check` still reports known project-health advisories plus this ticket's uncommitted phase-anchor advisory.
- 2026-07-09T01:52:29Z Tightened malformed-hook-input scenario to assert a deterministic fail-open result with unchanged self-report spool.
- 2026-07-09T02:22:34Z Phase: define-behavior → scenario-gate → implement. Scenario-gate local review found 0 must-fix issues after precision edits; independent fresh-context review skipped because this Codex tool policy only permits sub-agent spawning when the user explicitly asks for delegation. Wrote impl-plan.md with per-scenario proof plan and build order.
- 2026-07-09T02:24:49Z Validation: `lint-gherkin features/test-codex-plugin-migration.feature` passed; `git diff --check` passed; feature source and R/G/R ledger both contain 23 scenarios. `safeword check` still reports known repo-health advisories plus this ticket's uncommitted implement phase anchor.
- 2026-07-09T18:05:56Z Phase: implement → verify after completing the Codex plugin migration test harness, including non-live BDD, opt-in live smoke, typecheck, and parity checks.
- 2026-07-09T20:10:04Z Verify/audit complete: full Vitest, BDD, lint/typecheck, build, config drift, dependency-cruiser, and focused Codex migration checks pass; audit warnings are limited to baseline duplication, `shellcheck` Knip hints, and low-risk dev patch updates.
- 2026-07-09T20:10:04Z Phase: verify → done; status: done after writing verify.md and aligning README, website docs, and ARCHITECTURE.md with the plugin-backed Codex install model.
