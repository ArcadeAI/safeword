---
id: HX3KFQ
slug: keep-claude-plugin-recoverable
type: task
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/4519
created: 2026-09-13T04:03:46.412Z
last_modified: 2026-09-13T23:31:10Z
---

# Keep the Claude plugin installable and recoverable

**Goal:** Make published Claude plugin resources executable by the bundled CLI and keep cache-integrity failures recoverable from inside a session.

**Why:** The 1.0.0-rc.3 package cannot install or create tickets, and an ordinary troubleshooting file can make every mutating tool unavailable.

**Type:** Bug

**Scope:** Make both native plugin payloads carry the canonical template tree expected by the
bundled CLI. When Claude plugin integrity cannot be established, require explicit user approval
for mutating tools instead of denying every repair attempt.

**Out of Scope:** Changing npm-package template resolution, weakening normal Safeword gates when
the plugin is healthy, auto-deleting unexpected cache files, or trusting unverified plugin code.

**Done When:**

- [x] A generated Claude plugin and a generated Codex plugin can create a feature ticket and run
      `install` from their bundled CLI without source-repository files.
- [x] Release checks fail if a native plugin payload no longer satisfies the bundled CLI's
      resource contract.
- [x] A damaged Claude plugin cache makes PreToolUse ask the user rather than permanently deny the
      tool, while healthy caches retain current decisions.
- [x] Missing, modified, and unlisted assets remain visible as integrity failures and no unverified
      Safeword hook executes.

**Tests:**

- [x] Release integration: generated Claude payload runs `ticket new` and `install` in a clean repo.
- [x] Release integration: generated Codex payload runs `ticket new` and `install` in a clean repo.
- [x] Dispatcher: an unlisted asset returns a structured PreToolUse `ask` decision with a repair
      explanation and does not execute configured hooks.
- [x] Dispatcher: missing or modified required assets use the same recoverable degraded mode.
- [x] Dispatcher: UserPromptSubmit remains advisory and healthy PreToolUse behavior is unchanged.

## Root Cause

The standalone CLI bundle retains the npm package's flat `templates/` filesystem contract, but the
native plugin generators ship only partial, host-shaped resource trees. Claude ships handbook and
document templates under `resources/` while skills and hooks live elsewhere; Codex ships only the
handbook and hooks under `templates/`. The generated inventories prove only that emitted files are
untampered, not that the bundled CLI can resolve every resource it consumes. Direct execution from
both checked-in plugin payloads reproduced the failure.

The second failure is independent: dispatcher startup treats every non-prompt integrity error as
exit 2. Claude defines exit 2 on PreToolUse as an unconditional denial, so Bash/Edit/Write cannot
repair or disable the damaged plugin. Returning a structured `ask` decision is the host-supported
degraded mode: it preserves explicit human authorization without executing unverified Safeword
hooks.

Ruled out: a single missing template (both payloads lack broad portions of the flat contract); an
incorrect `import.meta.dirname` calculation (it resolves to `runtime/` as designed); inventory
corruption (the inventories match the shipped trees); and downgrading only unlisted extras (skills
are host-discovered, so an unlisted skill is behaviorally active and must remain an integrity
failure).

Related issue: https://github.com/ArcadeAI/safeword/issues/4520

### Hosted verification follow-up

The exact-revision GitHub run exposed a pre-existing timing assumption in the relay measurement
test. The producer records real elapsed time, and the production validator intentionally rejects a
measurement at or above one second. The test nevertheless required every shared runner to return
`enabled: true`, so ordinary scheduler contention could fail the suite after the producer had
correctly emitted and the validator had correctly rejected a slow measurement. The test now keeps
a contention-tolerant upper bound on real elapsed time, then normalizes only that machine-speed
field for a deterministic producer-to-validator schema proof. The production threshold is
unchanged.

Confirmed by the hosted failure reaching only the final validator assertion after the artifact's
shape, accepted-count floor, and deadline bound had passed. Ruled out: malformed output (all shape
assertions passed), insufficient accepted requests (the explicit floor passed), and a plugin-change
regression (the failing relay files are outside this ticket's source diff).

### Verification-plan follow-up

The aggregate verifier exposed a separate orchestration defect: the test-plan resolver emitted a
JavaScript lane for every workspace even when the selected root script explicitly delegated that
same lane. In this repository that ran the CLI, relay, collector, and BDD proof suites twice and
made unrelated worktrees compete for the same package-test lock.

The resolver now removes only exact package-manager delegations at shell-command boundaries; it
does not guess that arbitrary root commands cover a workspace. The root BDD script delegates its
canonical lane directly to the CLI package, so both verify and BDD plans have one JavaScript
authority. Ruled out: weakening the global lock (duplicate work would remain), suppressing every
workspace whenever a root script exists (could hide uncovered packages), and matching command text
anywhere in a script (an echoed example could falsely suppress a real test lane).

## Work Log

- 2026-09-13T04:03:46.412Z Started: Created ticket HX3KFQ
- 2026-09-13T04:18:00Z Investigated: reproduced Claude `Templates directory not found` and
  Codex missing `spec-template.md`; confirmed the generator/runtime contract mismatch.
- 2026-09-13T04:18:00Z Decided: package the canonical flat template tree in both native plugins
  and add executable payload checks. Degrade integrity-failed PreToolUse to an explicit user prompt,
  never execution of unverified hooks.
- 2026-09-13T04:56:41Z Verified: both generated payloads execute `ticket new` and `install`;
  integrity failures use explicit `ask`; focused, release, build, lint, typecheck, audit, and
  generator-drift checks pass. The three full-lane Gherkin regressions caused by treating canonical
  package data as native skills pass after narrowing those assertions to native surfaces.
- 2026-09-13T20:58:00Z Reviewed: assessed BDD/TDD quality, added missing non-prompt lifecycle
  no-execution tests, reran the final full CLI suite (9,642 passed, 13 skipped), and refreshed the
  audit and verification record. Independent quality-review routes exhausted; the permitted
  main-thread supplemental review approved with no remaining findings under `prefer`, explicitly
  with no independence.
- 2026-09-13T21:24:44Z Improved: added post-hoc behavior scenarios and dedicated executable proof
  for both native resource contracts and damaged-cache recovery; deduplicated exact root-delegated
  workspace lanes. A fresh-context supplemental review found two proof defects—source-checkout
  leakage and argument-text command matching—and both mechanisms were corrected with regressions.
- 2026-09-13T21:58:54Z Verified: final current-head runs passed 9,955 project tests, 184 focused
  tests, 74 release tests, 595 BDD scenarios with 11,100 steps, and 45 proof-tag checks. Full lint,
  typecheck, formatting, dependency validation, generated-payload checks, and diff checks passed.
- 2026-09-13T23:31:10Z Audited and refactored: completed a repository-wide architecture, dead-code,
  duplication, dependency, documentation, and test-quality audit. Centralized test script selection
  and shell parsing, restored the CLI build before BDD, named the canonical template boundary, and
  separated cache verification from protocol output. Final verification passed 10,002 tests with
  14 skips, 595 BDD scenarios with 11,100 steps, 45 proof-tag checks, all builds, lint, typechecks,
  and dependency audits. Independent quality review and remote GitHub verification were attempted
  but blocked by outbound/push policy; a current-primary-source local review found no remaining
  error-level issue.
