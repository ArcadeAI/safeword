# Verification: Authorized legacy Electron behavior

Code tested: `9ed3d02010f2410c6cdba0fba14dc27f05818a16`.
The reporting follow-up changes verification documents and records existing real
refactor commits only; it does not change production code, tests, dependencies,
policy enrollment, or the missing original histories.

A subsequent CI reliability follow-up changes collector file scheduling, startup
diagnostics and the outer CI job budget. Production code, test assertions,
individual test deadlines, dependencies and generated runtimes remain unchanged.

## CI reliability investigation

At reporting head 3da2eaca2, CI run 45485362001 exposed two infrastructure limits.
The Node 22 collector startup check remained `waiting` beyond its one-second
deadline. Collector production and assertion code was identical to previously
passing 9ed3d020; isolated packaged-collector protection passed all seven tests.
The small integration suite now runs files serially to remove competing fixture
processes, and all 153 collector tests pass under that configuration. The original
failure did not capture child stderr, so a particular transient startup cause is
not presented as proven. Startup failures now include a bounded stderr tail and
signal state. Existing readiness assertions and startup deadlines stay intact.
Unused child stdout is ignored so its pipe cannot block startup. The root test
script runs relay, collector and CLI with sequential `&&` commands; the setting
removes overlap between collector files, not all possible host contention.

The Node 24 package lane passed all 12337 CLI tests, but took 25 minutes 57 seconds.
Acceptance began 27 minutes 6 seconds after job start, leaving under three minutes
of its 30-minute cap for a lane previously measured above five minutes plus the
release gate. GitHub cancelled it at the job limit. The outer cap is now 45 minutes;
all lanes remain required, and full-CLI file parallelism is unchanged. A new
exact-head CI run must finish green before any Ready action.

This rules out an introduced collector production/assertion change and records
the directly measured job-capacity failure. Transient fixture contention remains
an environment risk rather than a fabricated application defect. The CI failures
are preserved separately from passing local behavior and missing original TDD
history. [CI run](https://github.com/ArcadeAI/safeword/actions/runs/45485362001),
[Vitest file scheduling](https://vitest.dev/config/fileparallelism), and
[GitHub job timeout semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes).

## Verify Checklist

**Test Suite:** ✓ 12333/12333 tests pass, with 14 pre-existing local skips, across
770 CLI files at 9ed3d020. Relay: 198 passed / 1 skipped; collector: 153 passed.
All 153 collector tests also pass after the CI-fixture scheduling/diagnostic
changes. Prior CI at 9ed3d020 passed 12337 CLI tests / 10 skips on Node 22 and 24,
plus physical installation and 81 release-gate tests. Each unique root-delegated
suite ran once locally. Final delivery-head CI is separate evidence; this report
does not claim a hosted green result for an untested reporting/configuration head.

**Gherkin:** ✅ The canonical serialized acceptance rerun passed all 602
scenarios / 12451 steps. The separate proof inventory passed all 53 checks.
The first acceptance attempt
had 600/602 scenarios and 12449/12451 steps passing; it is retained as a failure,
not relabeled green. The queued live test rebuilt the same dist directory while
Cucumber was using it. All subsequent build/acceptance/test checks are serialized.
The original failures did not retain child stderr, so no stronger claim about
their individual subprocess failure is made. No assertion or timeout was weakened.

**Build:** ✅ Relay, collector and CLI builds pass.

**Lint:** ✅ Full ESLint, Gherkin lint and formatting checks pass.

**Typecheck:** ✅ Resolved project type checks pass.

**Scenarios:** ❌ 1/25 ordinary source histories complete after recording the
actual primary refactor. Twenty-four original RED/GREEN/REFACTOR histories remain
unavailable and unchecked. This feature has no authority to waive its own normal
TDD requirements. Passing tests, current mutations and operator statements do not
reconstruct those histories.

**Refactor:** ✅ Completed: `7f5ae9ca2` reuses the existing policy import in the
public observation handler; `ca2cb66bf` makes three unused external helper exports
module-private. Each protected test pass and the other deliberate retain/defer
dispositions are recorded in closeout-test-quality-20261124.md. Only these actual
commits are credited; none supplies the missing RED/GREEN history of other cases.

**PR Scope:** ✅ The source diff implements the explicitly authorized fixed
SGWMBS profile, isolated Electron observation, authenticated review/replay,
legacy compatibility and generated installed delivery. No project-configurable
enrollment, arbitrary commands, fabricated approvals or ordinary-TDD waiver is
introduced. The Soulless documentation follow-up is separately merged as PR 193;
the original application feature is already merged as PR 188.

**Dep Drift:** ✅ No new architectural dependency in this branch. Bun and uv
scans report no known vulnerabilities. Go reports zero called vulnerabilities,
with one imported and 14 required-module advisories whose symbols are not called;
this is not a claim that every transitive module is advisory-free.

**Parent Epic:** N/A.

**Reconcile:** ✅ Trusted source-owned policies and existing authenticated
review, journal and CLI contracts are reused; no general enrollment registry.

**Experience:** ✅ Walked the Technical Builder through supported plugin
installation and the actual installed all-17 read-only delivery check. Payoff:
17 rows plus closing approved at original Soulless delivery f7a1d907 while all
review-record bytes stayed unchanged. Worst step is the expensive required
original/mutant execution and independent review; no shortcut or hidden history
repair was introduced. No native Windows walkthrough is claimed.

**Surface Evidence:** ✅ OpenAI Codex: supported actual plugin installation and
real disposable-marketplace/cache smoke pass after source removal. Safeword CLI:
the newly installed runtime approves all 17 existing authenticated rows plus
closing at their original producing delivery commit. Claude, Cursor and OpenCode
interaction paths are unchanged; generated parity and conformance pass, with no
new native host walkthrough claimed for those transports.

**Evidence limits:** ⚠️ Original source TDD provenance remains missing for 24
scenarios. Eight semantic cases have one recorded response each, strong shared
vocabulary cues, no variance/holdout/ablation result and operator-attested model
provenance. The cache smoke takes a refusal route; the separate positive installed
check validates retained real records and does not issue new Electron observations.
The initial overlapping acceptance failure remains recorded. The missing source histories block
formal source-ticket completion and Ready promotion. The other limits bound the
claims above; no receipt is fabricated.

## Audit and independent review

Audit passed: diff-scoped architecture 212 modules / 441 dependencies, no
boundary violations, with configuration, learning, principle and domain checks.
Repository-wide dead-code, clone and version-freshness discovery were explicitly
outside this diff audit.

Current-code cross-agent Claude approvals, with no excluded targets:

- Runtime: `bf674833-683b-4d33-8a50-dd61aef55832` (19 targets).
- Tests: `c81e74d0-dc3f-4bef-bf7c-106bcdb48ccc` (33 targets).
- Evals/install: `16417771-33dc-422b-966a-8b6493a848c8` (7 targets).
- Public docs/fixtures: `82d5a718-3c54-4f5b-9246-2a853f2d36a2` (7 targets).

All non-generated changed runtime/test/public-doc files are covered. Generated
copies are checked through the supported generator and actual parity/contracts.
Warnings are answered in final-closeout-review-dispositions-20261124.md.
Independent review is evidence, not human approval or missing test-first history.

## Installed delivery and retained logs

The [durable output archive](./final-closeout-evidence-20261124.json) preserves
actual test-summary excerpts, original log hashes, the actual read-only installed
driver stdout and inspected refactor commit paths/ancestry. It is operator-captured
output, not an authenticated approval or a repair of missing test-first history.

Supported `codex plugin add safeword@safeword --json` installed the actual source
artifact. Installed and generated CLI SHA-256 both equal
`d8552927ed14a4f398a3dfb1eaa437982c1130f72670b4d37df982f4cad78ff5`.
The actual read-only driver returned 17 approved rows and approved closing at
`f7a1d907c08787908772c5d228c20fb586a5baf8`. Review-record bytes were checked before
and after; no tag, journal or receipt was copied or rewritten. The documentation
branch was restored afterward. This is a local custom installation, not an npm
publication or authorization for later Soulless commits.

Local evidence:

- `/tmp/issue163-closeout-final-full-verification.log`: complete CLI/build/type/
  dependency results and the initial two acceptance failures; aggregate exit 1.
- `/tmp/issue163-closeout-bdd-focused-reproduction.log`: recovery passed 577
  scenarios / 11951 steps, including the two original failures. Cucumber merged
  configured paths with line selection, so this is not the full 602-case lane.
- `/tmp/issue163-closeout-serialized-acceptance.log`: canonical unfiltered
  acceptance rerun after all builds completed.
- `/tmp/issue163-closeout-final-installed-smoke.log`: actual cached-install smoke.
- `/tmp/issue163-closeout-final-installed-delivery.json`: actual all-row gate result.
- `/tmp/issue163-closeout-final-proof-inventory.log`: 53 proof checks passed.
- [Current-code CI run](https://github.com/ArcadeAI/safeword/actions/runs/45471251856).

Ticket remains in progress and PR 8319 remains Draft until its original-history
limitation has an explicitly supported resolution. No all-green ticket closure
or source readiness receipt is claimed.
