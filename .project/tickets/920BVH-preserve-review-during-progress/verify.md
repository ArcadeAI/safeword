# Verification: keep valid approval while builders record progress

Candidate: `d2100c869`, branch `codex/4200-completion-progress`, based on
main `e00ea1e65`. No push, PR, merge, release or shared-plugin replacement.

The test logs' `/private/tmp/safeword-4200-main-evidence` path is the **same
candidate worktree**, not another main checkout. It was named before creating
`codex/4200-completion-progress`, then moved to its persistent location after
testing. `evidence/worktree-provenance.json` includes its Git-managed HEAD
reflog, unchanged worktree administration directory and exact comparisons of
seven implementation/test/bundle files against `d2100c869`. No checkout of
main occurred during the candidate runs. Metadata is transparently post-run;
the controller's branch/command observations and Git history supply attribution,
not a reconstructed pre-run header or a claim of signed hostile-runner provenance.

## Verify Checklist

**Test Suite:** ✓ 11624/11624 tests pass — full CLI package, 14 skipped, 718 files.
**Gherkin:** ✅ Focused plain-language receipt scenario passes; no new feature lane required for this task.
**Build:** ✅ Success — CLI bundle and declarations built by the test wrapper.
**Lint:** ✅ Clean — all changed TypeScript files; pre-commit formatting and Markdown checks.
**Typecheck:** ✅ Clean — strict package typecheck.
**Scenarios:** Task regression checks pass; no original feature-ledger credit granted.
**Refactor:** ✅ No change warranted — small parser projection retains existing AST conventions.
**PR Scope:** ✅ Diff matches ticket scope — bounded fix, tests, generated bundles and task records; no PR opened.
**Dep Drift:** ✅ Clean — frozen lockfile unchanged; no dependency version change.
**Parent Epic:** #4200; no sibling completion credit changed.
**Reconcile:** ✅ No pattern deviation — existing Markdown AST and semantic-identity conventions retained.
**Experience:** ✅ Actual CLI approval survives progress; genuine scope/decision edits still revoke it.
**Surface Evidence:** ⚠️ CLI fixture proof only, not native Codex/Cursor acceptance.
**Evidence limits:** ⚠️ Original epic host, migration, dispute and delivery gaps remain separately recorded.

## Outcome

An owned planning approval remains current after the standard Work Log is
added or extended. Scope changes and decisions after the log still make it
stale. An execution-scheduling-only change stales Execution approval while
preserving unchanged Implementation approval.

This resolves one confirmed cause in #5766, not every reported coverage,
resolver, or non-planning-review issue. It does not complete epic #4200.

## Tests and checks

- RED `bb2e17ade`: actual CLI review/status reports stale after log append;
  one new regression fails, six tests pass. Failure retained, not reconstructed.
- GREEN `b43f1e4de`: seven focused integration tests pass. The source change
  excludes only the standard Work Log section from semantic ticket identity.
- `cf218e1f5`: adds the public-CLI execution-scheduling control and test lint fixes.
- 119 tests pass in six planning/context/contract/approval/Markdown files.
- A separate seven-file run passes 96 tests and fails one plain-language
  receipt scenario because this fresh worktree lacks the relay build. After
  building relay and collector, the three-file final run passes 15/15,
  including the blocked scenario. Counts overlap and are not summed.
- Full CLI suite: **718 files pass; 11,624 tests pass; 14 skipped**.
  This is package verification, not all monorepo service tests or native-host acceptance.
- First release run: 79 pass, two fail on stale generated plugins after moving
  from borrowed dependency symlinks to a normal frozen-lockfile installation.
  `d2100c869` regenerates those bundles with actual locked dependencies.
- Final release suite: **13 files, 81 tests pass**. The failed run is preserved.
- Verification review `98becbd3` correctly rejected attributing the earlier
  borrowed-dependency full run to the final build. A fresh full run on the
  frozen-lockfile tree again passes **718 files, 11,624 tests, 14 skipped**.
  All 136 emitted JavaScript artifact names and sizes match the final release
  build. Metadata records the branch, HEAD and remaining documentation-only
  changes after completion; it does not claim that metadata was captured earlier.
- ESLint for the three changed TypeScript files passes; strict package typecheck
  passes. Initial test lint errors and missing-workspace dependency errors are retained.
- All five generated surfaces pass the freshness check. Pre-commit validates
  all 11 contracts, template registration, formatting and generated freshness.
- No new acceptance feature or historical R/G/R ledger was created: this is
  a bounded bug fix with actual RED, not retrospective feature credit.

## Review and phase evidence

- Intake review `4189c8ba` approved, Claude Opus 5.5, cross-agent; stamped.
- Source/test reviews `68af1050` and `579fc090` approved with warnings retained.
  The latter did not cover all generated work, so its implement-phase stamp
  was refused. No skip or fabricated stamp was used.
- The expanded packet `b56196b3` was cancelled when dependency installation
  required regenerating its bundle inputs. It supplies no approval.
- Complete packet `13a94973-9c46-4d86-b017-6f51c13385fc` approved, Claude Opus
  5.5, cross-agent. Its legitimate generated-runtime exclusions plus reviewed
  source/tests/metadata cover the changed work; the implement stamp succeeds
  before the ticket advances to verify. That is dated phase-exit evidence,
  not a claim that an old review with mutable ticket context stays current forever.

Warnings retained: pre-upgrade log-bearing identities can become stale once;
the standard heading is exact; nested log entries are history, not permission
to change accepted scope. Accepted decisions must be in the bound contract.
No extra normalization, migration framework or qualification mechanism added.

Verification review `a07a1e2d` requested proof that generated `dispatch.js`
was not omitted from code review. `evidence/net-diff.json` records the complete
base-to-candidate diff and Git blob IDs: `plugin/runtime/dispatch.js` is
`fe466c897546b8e842d72d2514a7540df081a551` at both main `e00ea1e65`
and candidate `d2100c869`. Intermediate generated churn reverted during final
generation; there is no net dispatch change requiring review. The seven
implementation/test/bundle files are all net changes; the eighth changed file
is this task's ticket. Additional earlier regression, lint, typecheck and
freshness logs are attached under `evidence/`, indexed by `sha256.json`.
RED ran on the uncommitted test tree subsequently committed as `bb2e17ade`.
The 136-name/size comparison is supplementary consistency evidence, not a
claim of byte equality between separately captured build outputs. Pre-commit
checks were observed during those commits; no standalone transcript is claimed.

## Evidence archive

Raw logs and review JSON are retained in:
`/Users/alex/Projects/safeword-trials/2026-11-08-main-da2778353-csv/epic-followthrough-2026-11-09/`.
The final full/release logs are copied there after completion. Earlier failures
and cancelled reviews stay retained alongside passing results.

## Limits and remaining epic work

The tests use real CLI processes with private deterministic reviewer fixtures.
They do not qualify a model or stand in for native Codex/Cursor walkthroughs,
an NTB comprehension exercise, migration completeness, or PR preparation.
The earlier Claude trial provides separate bounded evidence.

Installed Codex 1.2.0 runtime bytes match neither tested main build. No native
evidence from that installation is promoted to proof of this candidate.
Cursor is installed and authenticated, but a shim status probe was interpreted
as an agent prompt; it changed no files and earns no workflow credit.

A separate private Codex profile now contains a byte-matching candidate plugin
without repointing that shared registration. A read-only native Sol session
loads its skills but dispatches no trusted hooks. The actual status reports
`plugin_enabled_hook_unproven`, all five lifecycle events missing, and an
explicit human recovery action. The interactive session is waiting at its
folder-trust prompt; plugin hook trust must also be reviewed. No bypass flag or
manual trust record is used. A process-only bootstrap entrypoint pin runs the
candidate instead of npm latest while retaining every configured check; this
is development-harness evidence, not a claim that default installation works.

The candidate worktree is now persistent at
`/Users/alex/.codex/worktrees/4200-completion-progress/safeword`.
The private native profile lives outside the shareable evidence archive at
`/Users/alex/.codex/dev-profiles/4200-native-proof`.

Historical RED remains missing where originally missing. All failed, rejected,
stale or exhausted evidence and all 33 deferred OpenCode/cloud cases remain.
