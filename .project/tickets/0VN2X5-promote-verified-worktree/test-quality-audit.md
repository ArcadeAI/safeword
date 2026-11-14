# Test quality audit — issue #5511

Audited 2026-10-16 against commit `b3c21126a`. Scope: the four changed test
files, their source collaborators, the eight inline task test definitions,
and the recorded RED/verification evidence. This is a test-quality audit,
not a new whole-repository verification or an independent scenario-gate receipt.

## Verdict

At the audited commit, the original worktree regression had discriminating
integration coverage, with gaps in additional safety contracts. The four
findings below are historical and were addressed in the user-authorized
follow-up recorded next. Their counterexamples fail safely with the production
implementation; this audit found test gaps rather than production defects.

## Follow-up resolution — 2026-10-16

All three P2 coverage findings and the P3 reporting finding are addressed in
`packages/cli/tests/integration/project-pr-ready.test.ts`. Twelve new cases
raise the command suite from 32 to 44. Existing operational-failure cases now
assert exit status, failed state, no reported change, and exact network effects.

| Finding | Added or strengthened proof | Result |
| --- | --- | --- |
| HEAD recheck | Commit and refresh its valid receipt during inspection; require evidence-changed refusal and no Ready call. | Current code passes; removing only HEAD equality fails the new case. |
| Environment filtering | Inject invalid Git configuration and assert both GitHub calls receive no Git/launch override keys; keep unrelated session-state selection in its own case. | Current code passes; removing the filter or retaining only the launch hint each fails. |
| Metadata fields | Ten otherwise valid responses with one invalid PR number, draft flag, head, or state. | All pass; removing boolean, safe-integer, positivity, head-type, or state-type validation is detected. |
| Failure reporting | Five pre-promotion failures require inspection-only effects; failed Ready requires inspection plus attempted promotion, with exit 1. | All pass; erasing failure effects fails both failure groups. |

Characterization checks ran after each addition, followed by deliberate runtime
mutations. Ten targeted mutation runs, covering nine distinct changes, all
failed the intended assertions. The same effect-erasure mutation ran separately
against pre-promotion and promotion failures. These are sensitivity checks of
existing correct behavior, not reconstructed historical TDD evidence or an
exhaustive mutation score.

Final restored-runtime results: **44/44 command tests** and **174/174 tests
across five focused files**, with zero failures or pending tests. The latter
includes command integration, hook delivery integration, shared readiness guard,
readiness guidance, and CLI catalog tests. CLI TypeScript checking, targeted
ESLint, formatting, and `git diff --check` passed.

The test now uses the existing `testCliPath` helper, which selects the normal
wrapper's immutable package snapshot. A disposable serial coordinator held the
normal wrapper's global lock, launched one real Vitest process at a time, and
mutated only a private copied runtime chunk. It restored that chunk after every
run and before the final green checks; wrapper cleanup removed its snapshot.
Production source and generated artifacts did not change. No live GitHub PR
was touched.

Evidence: `.project/tmp/5511-test-improvements/results.jsonl`, per-run JSON
reports/logs, `typecheck.log`, and the local `runner.mjs` coordinator. The initial
standalone request expired while waiting for the shared lock, before starting
any CLI test; the successful HEAD proof is `head-green.json` in the follow-up
directory. No queued request is counted as a passing test. The earlier broad
verification qualifications and incomplete historical TDD trace remain as
recorded; this follow-up does not claim a new full-plan pass or close the ticket.

## Findings at the audited commit

### P2 — Independently protect the HEAD recheck

Location: `packages/cli/tests/integration/project-pr-ready.test.ts:97` and
the fake GitHub's `commit-during-view` branch at line 305.

Removing only `current.stdout.trim() === head` from `localStillCurrent` leaves
all 32 command tests passing. The existing commit-during-inspection fixture
also invalidates the receipt, so the remaining readiness check masks the
missing HEAD comparison.

A disposable counterexample commits a new HEAD and refreshes its receipt during
inspection while returning the previously inspected remote head. The current
code refuses with `PR_READY_EVIDENCE_CHANGED`; the mutant reports successful
promotion. Add this as a separate integration case, requiring refusal and no
Ready call even though the new local receipt is valid.

Proof: `.project/tmp/5511-test-quality/skip-head-recheck.json` and
`head-and-receipt-change-proof.json` in that directory.

### P2 — Make the environment sanitization example discriminating

Location: `packages/cli/tests/integration/project-pr-ready.test.ts:172`.

Replacing the entire environment filter with `() => true` leaves all 32 tests
passing. The existing injected `core.worktree` example does not distinguish
sanitized from inherited environments for these Git operations and fixture.

An additional disposable probe sets `GIT_CONFIG_COUNT=1` with an invalid config
key. The current implementation strips the inherited configuration and
promotes the verified fixture; the mutant incorrectly returns
`PR_READY_NOT_WORKTREE`. Add an input that actually changes Git's result when
retained. For the child-environment contract, the fake GitHub process can also
report whether forbidden keys exist, without recording environment values.

Proof: `retain-git-environment.json` and `git-environment-proof.json` in the
audit scratch directory.

### P2 — Exercise malformed fields in otherwise valid PR metadata

Location: `packages/cli/tests/integration/project-pr-ready.test.ts:93` and
its fixed metadata response at line 308.

The malformed-response cases supply invalid JSON and `{}`. They do not isolate
draft type or positive safe-integer PR-number validation. An otherwise valid
response with `isDraft: "true"` is refused by the current implementation, but
removing its boolean check allows promotion. Add a table of individual invalid
fields on otherwise valid records, asserting `PR_READY_INVALID_RESPONSE` and
no Ready call; keep parser edge cases at this integration/contract level.

Proof: `wrong-draft-type-proof.json` in the audit scratch directory. This is a
discriminating CLI counterexample and a source-inspected coverage gap; a full
32-case run with only the boolean guard removed did not start. Separate
positive/safe-integer number-guard mutations also did not run.

### P3 — Assert failed-operation network effects

Location: `packages/cli/tests/integration/project-pr-ready.test.ts:143`.

The failed Ready case checks the error and actual fake-GitHub calls, but does
not check the machine-readable effects. The verification matrix specifically
claims proof of the attempted network effect. Assert inspection plus the
attempted `mark-ready` effect for promotion failure, and inspection only for a
failure before promotion. Assert exit status 1 alongside these results.

This is a reporting-contract gap; the external call assertions already protect
whether promotion was attempted. It is distinct from a false success claim,
which the existing test catches.

## Behavior and workflow assessment

| Task definition group | Quality assessment |
| --- | --- |
| Actual cwd, explicit --cwd, subdirectory, symlink | Strong: real CLI and linked Git worktrees; asserts selected root and external command cwd. |
| Verified launch versus unfinished delivery | Strong: inverse fixture requires refusal before any GitHub call. |
| Missing/stale receipts, wrong remote head, inspection failure, offline | Specific refusals and external non-mutation; malformed-field partitions need strengthening. |
| Evidence changes, frozen PR number, already-Ready | Useful paired outcomes; HEAD-only recheck is masked by stale receipt in the current fixture. |
| Failed Ready | Specific failure and attempted external call; declared effects need direct assertions. |
| Canonical/generated guidance | Static delivery contract only; string checks cannot prove an agent follows guidance or obtains authorization. |
| Unrelated session and inherited Git config | Unrelated state is exercised; the environment example survives removal of sanitization. |
| Repository overrides and open state | Table-driven named overrides and CLOSED/MERGED refusals; invalid selectors have specific status/code assertions. |

The three added hook-delivery cases exercise adapter JSON, native JSON, and
native exit-code delivery with real collaborators and simulated host payloads.
They assert the selected checkout, hook cwd, recovery, and correctly rooted
allow. They do not prove that a live Codex version emits that payload.

These are task-level inline behavior definitions, not a dedicated `.feature`
file. They cover the representative worktree behaviors without requiring a new
Gherkin file for this bug fix. Their implementation-specific undefined-session
and exhaustive override details belong in lower-level contracts, as they do
here. No dedicated independent BDD scenario review is claimed.

The recorded runtime RED fails because `pr-ready` does not exist, followed by a
GREEN reproduction. The diagnostic ticket separately records three diagnostic
RED cases. Neither record establishes an individual RED/GREEN/REFACTOR cycle
or independent TDD-step review for every later safety case. Current test quality
and historical TDD discipline are separate claims; this audit cannot recreate
missing historical evidence.

## Mutation method and evidence

The committed 32-case integration file and its assertions run unchanged against
one source mutation at a time in a disposable `git archive HEAD` extraction.
Only dependency directories are symlinked; the extraction owns its source and
build output. Each run uses the normal build-lock wrapper and one Vitest worker.
The original checkout's source, tests, generated files, and dist are untouched.
Baseline and restored-baseline runs must pass all 32 cases. A failed build is
not counted as a detected behavioral mutation.

Focused counterexamples use private copies of the built runtime, real temporary
Git repositories, and fake GitHub. They distinguish genuine missing coverage
from a redundant mutation. No live GitHub operation is performed.

Baseline and restored baseline each passed 32/32 command cases. All eleven
mutant runs built successfully and executed all 32 cases: nine mutations were
detected and two survived. This is a deliberately selected sample, not an
exhaustive mutation score.

| Removed or broken behavior | Failing cases | Assessment |
| --- | ---: | --- |
| Select execution root instead of launch root | 10 | Detected, including both directions of the original issue. |
| Initial readiness check | 4 | Detected before-GitHub contract. |
| Entire post-inspection recheck | 2 | Detected HEAD and reopened-ticket cases. |
| Explicit HEAD equality within the recheck | 0 | Survived; confirmed gap with refreshed-receipt counterexample. |
| Readiness within the recheck | 1 | Detected reopened-ticket case. |
| Remote/local head equality | 1 | Detected mismatched remote head. |
| Frozen PR number in Ready argv | 1 | Detected exact external command contract. |
| Git/launch environment filtering | 0 | Survived; confirmed gap with invalid inherited Git config. |
| Entire metadata shape validator | 1 | Detected empty-object response; does not isolate individual field checks. |
| Open-state check | 2 | Detected CLOSED and MERGED cases. |
| Handling failed Ready process status | 1 | Detected false-success regression. |

Raw results and failing test names are in
`.project/tmp/5511-test-quality/summary.json`, with one JSON report and build
log per variant. Scratch drivers are `.project/tmp/5511-mutation-audit.py` and
`5511-field-probe.py`. The latter also records baseline-versus-mutant results
for the wrong draft type, refreshed HEAD/receipt, and invalid Git config.

An optional additional batch for individual metadata checks, explicit PR-number
matching, and failed-operation effects remained queued behind another
checkout's test lock for over nine minutes. Only this audit's driver and queued
wrapper were stopped, before they launched Vitest; disposable source was
restored. These additional suite mutations are not counted as run, detected,
or passed. The P3 effects finding is from source/assertion review, not an
executed effects mutation. The original source and test files remain unchanged.

Previously recorded broad verification results remain in `verify.md`; they
were not rerun or upgraded by this audit. Full-plan timeouts, unchanged
dependency advisories, the raw host missing-workdir limitation, and the remote
head race retain their existing qualifications. No production change, ticket
closure, push, PR, or live Ready authorization is part of this audit.
