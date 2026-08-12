---
id: 5JKNQG
slug: preview-every-install-change
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/2479
created: 2026-08-11T14:32:08.719Z
last_modified: 2026-08-11T14:32:08.719Z
---

# Preview every install change before mutation

**Goal:** Make install planning enumerate the complete project effect set before apply.

**Why:** Issue #2479 shows install can mutate configured projects beyond the preceding plan.

## Scope

- Make the project surface of `safeword plan install` preview the same file, package, configuration, and network effects that project convergence can apply from the same state.
- Cover newly detected pack registration, the Codex project bootstrap, and missing workspace format scripts in one configured-workspace regression.
- Keep planning read-only and offline-safe.

## Out of Scope

- Changing configured-project install convergence, automatic pack adoption, Codex bootstrap enrollment, workspace format scripts, or `--no-modify` semantics.
- Adding a narrow single-template sync command.
- Requiring install-plan confirmation before apply.

## Done When

- [x] `plan --json --offline` includes `.safeword/config.json`, `.codex/config.toml`, and the workspace `package.json` that install will change.
- [x] Applying install from the unchanged planned state reports no project file/package/configuration/network effect absent from the plan, except an explicitly modeled runtime-only effect.
- [x] Planning leaves the configured workspace byte-for-byte unchanged and performs no network operation.
- [x] Existing convergence and customer-preservation tests remain green.

## Tests

- [x] Integration: configured polyglot workspace previews missing pack registration, Codex bootstrap, and workspace format-script changes before install.
- [x] Integration: compare the planned project effect set with the subsequent install effect set from unchanged state.
- [x] Integration: exercise the documented Claude, Codex, and Cursor project-profile combination.
- [x] Integration: execute a controlled npm update and observe its real manifest and lockfile mutations, package effect, and registry effect.
- [x] Matrix: preview uv, Poetry, and Pipenv effects plus Rust workspace, architecture, and conservative ESLint writes.

## Root Cause

`prepareLifecycle` plans the project surface exclusively through
`createReconciliationPlan(..., 'upgrade', projectSchema)`. `installLifecycle`
instead applies `convergeSetup`, which performs schema reconciliation and then
additional compatibility, bootstrap, handoff, architecture, workspace,
dependency, Python, and package-compatibility stages. Those later stages are
mutation-observed only after apply; they have no shared pre-apply planner.

Confirmed by tracing both command paths: the missing effects originate after
`reconcile(...)` inside `applySetup`.

Ruled out:

- `--no-modify` suppressing these effects: the option is read only by the vendored ESLint-ignore stage; pack, bootstrap, and workspace stages run independently.
- agent-profile observation being incomplete: all three reported omissions belong to the project surface and occur even with `--agents=none`.
- reconciliation dropping its own effects: reconciliation reports its dry-run actions and package intents; the omissions are stages invoked after reconciliation returns.

## Work Log

- 2026-08-11T14:32:08.719Z Started: Created ticket 5JKNQG
- 2026-08-11T15:00:00.000Z Investigated: traced plan to reconciliation-only preparation and install to the broader convergeSetup/applySetup pipeline; ruled out no-modify, profile observation, and reconciliation effect-loss alternatives.
- 2026-08-11T15:34:00.000Z RED: command-level configured polyglot fixture failed because plan omitted `.safeword/config.json`, `.codex/config.toml`, and `packages/app/package.json`; the fixture also proved plan left the project tree unchanged.
- 2026-08-11T15:48:00.000Z GREEN: lifecycle planning now uses a read-only setup planner covering reconciliation, pack compatibility, Codex bootstrap, architecture, workspace, ESLint, JavaScript/Python package and lockfile, Rust tooling, and Safeword package-compatibility effects.
- 2026-08-11T15:51:00.000Z Verified: regression and lifecycle/setup suites passed (40/40); full lint, Gherkin lint, TypeScript, formatting, and diff checks passed. Rust-only rerun was not started because another checkout held the repository's single-Vitest lock; existing Rust behavior was unchanged and the new pure target observer passed TypeScript/lint checks.
- 2026-08-11T16:20:00.000Z Hardened coverage: expanded the walking-skeleton regression to eight scenarios covering the documented agent combination, real fake-boundary npm execution, exact deterministic package/network parity, Python manager variants, Rust workspace manifests, architecture outputs, ESLint conservative writes, read-only planning, and fixture cleanup.
- 2026-08-11T17:35:00.000Z Quality review: fixed Rust workspace containment for absolute paths, parent traversal, sibling-prefix paths, symlinked member directories, and externally symlinked Cargo manifests; added regression coverage for each writable escape route.
- 2026-08-11T17:45:00.000Z Refactor: reused the setup effect normalizer for planning and removed duplicate empty-effect literals; focused plan coverage remained green.
- 2026-08-11T18:05:00.000Z Full verification: repository suite passed with retro-relay 167 passed/1 skipped and CLI 7,431 passed/5 skipped across 483 files; formatting, lint, Gherkin lint, TypeScript, generated plugin, CLI contract, and diff checks passed.
- 2026-08-11T19:00:00.000Z Review hardening: bound option-driven installs and full uninstalls to package-manager inputs, replaced generic agent placeholders with concrete Claude/Codex effects, and added real documented-agent plan/apply parity.
- 2026-08-11T19:30:00.000Z Rust hardening: moved workspace member and lint detection to TOML semantics, ignored table-like comments/strings, reported actual Cargo manifest writes, and proved Rust plan/apply parity.
- 2026-08-11T20:00:00.000Z Plan security: framed every filesystem digest field with explicit tags and lengths and added an adversarial boundary-shift regression. Four full quality-review passes were attempted; three produced actionable findings that were fixed, while the final pass exhausted both external reviewer routes without a new finding.
