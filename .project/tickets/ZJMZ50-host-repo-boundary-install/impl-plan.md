# Impl Plan: Install the boundary gate into host repos via setup/upgrade (ZJMZ50)

**Status:** planned

## Approach

**Riskiest assumption:** the hook-manager world can be detected once at plan
time and gated into declarative textPatch entries via a new applicability
predicate without disturbing any existing schema semantics (idempotency,
unpatch symmetry, non-git skip). **Cheapest proof:** scenario "Setup appends
both shims to existing husky hooks" (TB1.R1) — it exercises detection, the
predicate, and one gated append end-to-end. Built as slice 2 so a wrong
engine design fails while only the tiny detection slice is sunk.

Proof plan by rule (highest practical scope; the setup-into-temp-host
integration harness from `tests/commands/setup-core.test.ts` is the workhorse
— real CLI run into a real temp git repo, mocking nothing):

- **TB1.R1, R2, R5, SM1.R1** (append / idempotent / reset / heal): integration
  — `runCli(['setup'|'upgrade'|'reset'])` into temp hosts seeded per
  scenario's pre-state; assert file bytes. Supporting unit coverage in
  `tests/reconcile.test.ts` for the `when` predicate (applies / skips / gates
  unpatch) since it's combinatorial pure logic.
- **TB1.R3** (nudges): integration — same harness, assert stdout contains the
  load-bearing snippet substring (`safeword boundary --at commit`) and config
  files byte-unchanged. Quiescence scenario pastes the captured stdout snippet
  back into `lefthook.yml`, re-runs, asserts silence.
- **TB1.R4** (never blocks / actually invokes): E2E at the shell boundary —
  execute the *emitted* hook file with `sh -e` (husky's invocation) in hosts
  where `node_modules/.bin/safeword` is (a) absent, (b) a stub exiting 1,
  (c) a recorder stub logging its argv; empty PATH proves explicit-path
  resolution. Subprocess is the process boundary — nothing else mocked.
- **SM1.R2** (never-fire guards): integration — non-git temp dir and a
  git-repo-subdirectory host; assert no hook writes + note line.
- Detection itself: focused unit tests over the world matrix (husky dir /
  lefthook configs / pre-commit config / core.hooksPath conflicts / husky-in-
  deps-only / none).
- BDD acceptance: cucumber steps shell the CLI in temp repos (spawnSync
  pattern from `steps/boundary-reconciliation-gate.steps.ts`).

**Build order** (each slice green before the next):

1. Hook-manager detection — pure function in project-detector, world stored on
   `ProjectContext` (follows "Detect Languages Before Framework"). Unit tests.
2. `when?: (ctx) => boolean` on `TextPatchDefinition`, honored by
   planTextPatches / computeInstallPlan / computeUninstallPlan (skip entry
   when false, both directions). Reconcile unit tests. **Load-bearing slice.**
3. Shim textPatch entries for `.husky/pre-commit` + `.husky/pre-push`
   (marker header, create-if-absent, rerender for heal) → TB1.R1, R2, R5,
   SM1.R1 scenarios.
4. Nudge emission + integration-based quiescence for lefthook / pre-commit /
   bare / uninitialized-husky worlds → TB1.R3.
5. Emitted-shim runtime proofs under `sh -e` → TB1.R4 outline.
6. Never-fire guards: monorepo-subdir root check (non-git skip already
   exists) → SM1.R2.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Emission mechanism | textPatch marker-block append | ownedFiles `.husky/*`; imperative auto-patch (eslint-auto-patch pattern) | overwrite clobbers user hook content (husky's top complaint class); imperative hand-rolls idempotency/uninstall the engine already provides |
| World gating | new `when?(ctx)` predicate on TextPatchDefinition | content-only guard (`applyWhenContentIncludes`); separate imperative install step | content guards can't see git config or sibling files; imperative splits the lifecycle across two code paths |
| Detection signals | active signals: `.husky/` dir + `core.hooksPath`, lefthook/pre-commit config files; conflicts resolved by `core.hooksPath` | husky present in devDependencies | dep presence ≠ initialized (dead `.husky` files if prepare never ran) |
| Non-husky worlds | printed verbatim snippet, quiesce on integration | auto-editing lefthook.yml / .pre-commit-config.yaml | user-owned YAML — edits destroy comments/formatting; both tools have native inclusion mechanisms |
| Bare world | nudge recommending husky | writing `.git/hooks` directly; bootstrapping husky | `.git` is a file in linked worktrees (static path wrong) and writes are invisible to teammates; uninvited dep + prepare script (gate-deferred at intake) |
| Shim line shape | `[ -x node_modules/.bin/safeword ] && node_modules/.bin/safeword boundary --at <b> \|\| true` | bare `safeword` via husky PATH prepend | husky's PATH entry is relative — breaks in worktrees (learning 9P3VVH); `sh -e` makes an unguarded failure block the commit |
| Monorepo subdir | skip emission + one-line note | emit into subdir `.husky/` | git only reads hooks at the repo root — dead files mislead |

## Arch alignment

- **Reconciliation Engine** — "Commands never write files directly — they compute a plan from the schema and execute it": shims are schema entries; no bespoke writes.
- **Reconciliation Modes / Key property: Idempotent** — the `when` predicate must preserve mode symmetry and re-run idempotency (TB1.R2 pins it).
- **Language Detection — Detect Languages Before Framework** — hook-manager detection joins `createProjectContext`, computed once before planning.
- **Architecture Review Gate** — this plan is the scenario-gate exit record; Tier-2 review completed (PASS after one FAIL/fix round).

## Known deviations

- The shim calls the binary by explicit `node_modules/.bin` path rather than husky's documented bare-command convention — deliberate (worktree-safety, 9P3VVH); documented in the shim's marker comment.

## Assessment triggers

- Demand for lefthook/pre-commit *auto*-integration (nudge friction reports) → revisit the nudge-only decision with a YAML-preserving editor.
- TB reports of per-commit latency from node cold-start → revisit shim (compiled entry, or push-only default).
- husky v10 changing hook invocation (`.husky/_` layout or `sh -e` semantics) → re-verify R4's harness assumptions.
- Child 3 (server tier) needing hook provenance → the audit record, not the shims, is the interface; don't grow the shim.
