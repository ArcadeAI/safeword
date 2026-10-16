# D1BKYA verification — in progress

## Implemented behavior

One authenticated current phase receipt admits Implementation Planning approval.
The redundant artifact self-stamp is removed. A current rejected review reports
only `REVIEWER_FINDING` messages; approved warnings and coordinator assurance
sentences are never rejection findings. Existing provenance and exact plan-byte
checks remain in `phaseReviewAdmission`.

## Evidence collected

- Focused current-source suite: 5 files, 123 tests passed (planning/design approval,
  planning guidance, degraded explanation, review surface parity, Bun pin contract).
- Both RED loops earned current independent executable RED approval before GREEN.
  Scenario 1: `20bf6afd-3cf3-4685-96d2-e5e8c8b05431`; scenario 2:
  `9048b493-0dd9-4224-82c9-f738419e189f`.
- Independent final Claude review `8ef57710-b37d-4576-882b-730003b2085f`:
  approved, cross-agent, no error findings. Source packet remains current.
- Changed TypeScript ESLint, formatting, Markdown lint, generated four-surface
  checks, and commit hooks passed. Full verification is still pending.
- User-requested repository toolchain repair is separate: `scripts/dev` resolves
  Bun and Node with mise and prepends their executable directories for children.
  The commit hook uses that same PATH. A smoke run under Homebrew-first PATH
  proved Bun 1.3.14, Node 24.18.1, preserved arguments/cwd/exit status, and explicit
  missing-mise recovery. The earlier personal `.zprofile` edit was reverted.

## Final-review warning dispositions

- Concurrent execution-plan scaffolding, receipt ordering after scaffold failures,
  plan changes during a human prompt, and mid-flight phase returns: existing
  behavior outside this narrow duplicate-stamp/rendering repair. Retained as
  limitations; no fix is claimed.
- Degraded-route authority versus guidance: existing behavior owned by 5F5ZZA PR 4.
  This PR preserves current authenticated admission and does not add authority.
- Structural failure accompanied by a current rejection: only authenticated actual
  rejection findings are rendered. Structural validation still blocks admission;
  changing precedence between two valid failures is deferred, not silently fixed.
- Generated guidance copies were outside the reviewer packet: the real guidance
  contract tests and generated/parity checks verify those copies independently.
- POSIX PTY and tight existing timing assertions: evidence limitations retained.

## Epic and sibling acceptance remain incomplete

PR #4989's current-source Claude review was refreshed:
`a0a1fed2-bb5c-4a39-8f60-24b6740e37ce`, approved with no error findings.
Its existing assertion warnings are retained; the PR remains Draft and Node 24
acceptance CI remains failed. No merge or promotion occurred.

Full configured sibling acceptance: 2,372 scenarios — 1,778 passed, 3 skipped,
585 undefined, 6 failed. A pinned-toolchain rerun using six line selectors
actually selected 2,181 scenarios — 1,593 passed, 3 skipped, 585 undefined,
zero failed. It is not represented as a complete full-lane rerun. No undefined
steps, skip tags, or failure assertions were hidden or weakened.

## Outstanding

Pre-launcher full suite collected: 642 files — 640 passed, 2 failed; 10,562 tests
passed, 10 failed, 13 skipped. Seven failures explicitly report Bun 1.4.0 in
child generation commands, and three are intentional Cursor tree-byte changes.
Do not call that run green. Then run final
verification through the repository launcher, including the new launcher tests,
and collect the independent launcher review before any completion claim.

The pre-launcher full suite also exposed three Cursor lifecycle tree-fixture
mismatches. The canonical planning guidance intentionally changed installed
Cursor bytes; inspect and regenerate only those expected tree hashes with the
existing local update workflow, then rerun without update mode. No behavioral
assertion may be weakened.

## Toolchain review follow-up

Initial toolchain review `00cf209f-8887-4554-9f1f-e62c40b35942` approved.
The repository already has the requested Bun-pin synchronization assertion in
`dogfood-source-worktree.test.ts`; reuse that evidence instead of adding a duplicate.
The existing Bun-version contract test also proves the generator invokes the guard
before `Bun.build`. The hook PATH-output proof and missing-pinned-tool recovery
are now added and awaiting current-source test/review collection. Stable exact
Bun pins are intentional; support for prerelease or Corepack hash formats is
outside this repair. Other pinned languages and duplicate historical boundary
hooks are not changed.

The fixture update changed only the three Cursor tree hashes and their manifest
hashes. Lifecycle result hashes, Codex/Claude fixtures, and uninstall fixtures
were unchanged. The update-mode run passed all 13 checks; its required independent
verification without update mode is included in the next targeted run.

Current-source targeted verification through `scripts/dev`: 11 files, 229 tests
passed. This includes the three launcher tests, seven previously failing Bun
cases, lifecycle checks without update mode, the existing tool-pin sync assertion,
and the planning approval/admission/guidance/provenance regressions. No filtering
or update-mode environment was used for this run.

## Isolated delivery checkout

Historical review IDs and original-suite observations above belong to the
original continuation checkout. They are not authenticated receipts for this
worktree; none was copied.

**PR Scope:** ✅ The isolated branch above `codex/4200-repo-toolchain` contains
D1's approval/rendering repair, its real CLI regressions, canonical guidance and
required generated surfaces, matching lifecycle fingerprints, and only the two
acceptance counts affected by the added admission tests. The toolchain repair
is a separate parent PR, and broader 5F5ZZA planning/proof changes are absent.

Fresh targeted verification passed 150 tests in six actual files. The first
command also named two nonexistent paths, which Vitest did not select; these
are not counted. The intended degraded-explanation and lifecycle suites were
then selected by their correct paths and passed all 15 tests. All four generated
surfaces passed their check.

The first complete CLI run in this fresh worktree failed: 643 files, 622 passed
and 21 failed; 10,554 tests passed, 21 failed, 13 skipped. Each of those 21
failures reports the missing `packages/retro-relay/dist/index.js` during
Cucumber support-code loading. The monorepo build had not been run after the
fresh dependency install (which builds only the CLI). A complete monorepo build
now succeeds; a fresh complete CLI rerun is required before calling that check
green. The original failed result remains retained at
`/tmp/4200-planning-approval-full-cli.log`.

The parent PR's historical six acceptance failures and 585 undefined scenarios
remain visible. The continuation's later zero-failure / 586-undefined result is
not verification of this isolated head. Full acceptance here remains pending.

### Full CLI retry after monorepo build

The retry completed with **10,574 passed, 1 failed, 13 skipped** in 643 files (642 passed, 1 failed). The failure was `hierarchy-navigation.test.ts > allows stop when parent directory is missing`: the fixture fell through to published `bunx safeword`, which failed to load `eslint-visitor-keys` from its temporary cache. The unchanged isolated file subsequently passed all six tests; this does not erase the failed full result or establish a stable full pass. The toolchain branch is binding that fixture to its existing local built-CLI override, followed by fresh targeted verification. Current isolated full acceptance remains pending; the parent’s six acceptance failures and 585 undefined scenarios remain preserved.

### Full CLI with the hierarchy fixture binding

This complete run retained **10,573 passed, 2 failed, 13 skipped** in 643 files. The failures were `stop-hook-transcript-format.test.ts > shows done-phase hard block when active ticket at done phase` and `codex-stop-retro.test.ts > codex-done-gate.SWM1.R1.returns_filing_after_success_without_an_advisory`. Both invoked published `bunx safeword` and reported dependency-link `EEXIST` errors in the shared temporary cache. The hierarchy binding passed its cases. The toolchain branch is centralizing that existing local CLI override for source-hook fixtures, followed by new scoped/full verification. This failed result remains recorded; no full-pass or isolated-acceptance claim is made.

### Full CLI with shared source-hook fixture environment

The complete CLI retry passed: **643/643 files; 10,575 tests passed, 13 existing skips**, 663.63 seconds. The run used the repository launcher and the rebuilt checkout CLI, with no test-name filtering or snapshot update mode. The source-hook fixtures share their existing explicit local CLI override; consumer hook behavior remains unchanged. The previous 21-, 1-, and 2-failure runs above remain historical evidence. This passing CLI run does not establish a full acceptance pass: the separate complete acceptance lane is running, with its full result still pending. Log: `/tmp/4200-D1-full-cli-shared-source-fixtures.log`.

### Complete isolated acceptance and lint

The unfiltered configured acceptance lane completed with **2,372 scenarios: 1,784 passed, 3 existing skips, 585 undefined, zero failed**; **110,463 steps: 108,700 passed, 4 skipped, 1,759 undefined**. It exited 1 because undefined scenarios remain. This is not a passing acceptance lane. The parent's historical six failures remain recorded above; they did not recur in this complete isolated stacked-checkout run. No undefined steps were supplied, skipped, filtered, or weakened by this patch. Log: `/tmp/4200-D1-full-acceptance.log`.

Root lint passed ESLint, Gherkin validation and CLI TypeScript. Log: `/tmp/4200-D1-final-lint.log`. Current native final review `89c8e5dd-a98e-4102-85e6-7a2ba6d81a99` remains approved after the final supporting-evidence commit.

## Verify Checklist

**Test Suite:** ✓ 10575/10575 executed tests pass; 13 existing skips
**Gherkin:** ❌ Failed — 585 undefined scenarios; zero failed scenarios in the current complete lane
**Build:** ✅ Success — complete monorepo build
**Lint:** ✅ Clean
**Typecheck:** ✅ Clean
**Scenarios:** All 2 D1 scenarios marked complete in their TDD ledger; epic scenarios remain unfinished
**Refactor:** ✅ No change warranted — duplicate authority and unused imports removed; existing phase-admission owner reused
**PR Scope:** ✅ Diff matches D1 scope above its separate repository-toolchain parent
**Dep Drift:** ✅ Clean — no runtime dependency changes
**Parent Epic:** #4200 — incomplete; no sibling-completion claim
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — walked Tool Builder through native review and CLI rejection; worst step = waiting for the independent reviewer; new steps versus before = 0. This walk covers rejection, not native approving warnings.
**Surface Evidence:** ✅ Real CLI regressions and generated guidance checks pass; no live-host UI claim
**Evidence limits:** ⚠️ Acceptance retains 585 undefined scenarios and 3 existing skips; native manual walkthrough covers rejection; approval-with-warning proof mocks only the external reviewer process

### Native manual rejection walkthrough

At unchanged production head `e2c661f38`, a first attempted installation under `/tmp/4200-D1-manual-walk` was correctly refused as a nested project because `/tmp` was already configured. This is a setup failure, not a successful walk. A fresh system-temporary project then installed the real built CLI with Cursor, offline and without application-tool modifications. A native Claude Implementation review (`1bc97291-4d2f-4151-9d07-c7b9e446344d`) actually requested changes to the example plan. Ordinary `ticket approve-plan WALK01 --no-input --json` returned action-required, left `phase: plan-implementation`, and emitted exactly the current review's `REVIEWER_FINDING` messages. The independent-assurance sentence was absent. No fake reviewer, copied authenticated receipt, or hand-written review stamp was used. Approval without the extra stamp remains separately proven by the automated real-coordinator regression; no native approval claim is made here. Logs: `/tmp/4200-D1-native-walk-install.json`, `/tmp/4200-D1-native-walk-review-status.json`, `/tmp/4200-D1-native-walk-approval.json`.
