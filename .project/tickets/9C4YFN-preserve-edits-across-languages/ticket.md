---
id: 9C4YFN
slug: preserve-edits-across-languages
type: task
phase: done
status: done
scope: Check-only post-edit linting across all supported language branches
out_of_scope: Explicit fix defaults, new hosts, dependencies, scheduling and live model evals
done_when: Hook checks preserve edited and sibling source bytes and retain diagnostics; explicit fix mode still writes
created: 2026-11-14T20:25:14.311Z
last_modified: 2026-11-14T23:53:31.850Z
---

# Preserve unfinished edits across supported languages

**Goal:** Make automatic post-edit checks non-mutating for Python, Go, Rust, SQL, shell and remaining formatted files while retaining explicit fix behavior

**Why:** The same pending-import loss and unrelated rewrite risks fixed for JS/TS remain in other language branches

## Delivery plan

## Scope and completion

Extend the existing lintFile fix:false contract across Python, Go, Rust, SQL,
shell and Prettier-supported formats. Post-edit hooks must preserve edited and
sibling source bytes while retaining actionable diagnostics. Explicit helper
fix mode keeps its default behavior; SQL fix opt-in applies only in fix mode.
No new scheduling, state, dependencies, model evals or host adapters.

Delivery base is e40f35db01396677042079c698ee9f2f671b4ae3 from the existing
Draft PR #7158. This follow-up lives on codex/preserve-language-edits; earlier
JS preservation and opt-in eval files are reviewed stack ancestry, not new
scope. The implementation stamp checks the full branch against main, so its
required review packet also includes that ancestry; the audit uses e40f35db0
to isolate this follow-up's authored changes.

## Root Cause

The shared hook already passes fix:false, but only its JS/TS branch observes it.
Python unconditionally invokes Ruff fixes and formatting; Rust invokes package
Clippy fixes and rustfmt; Go's bundled helper always formats; SQL and generic
format branches write independently of the option. This rules out host-specific
dispatch and tool installation as causes: every affected branch directly
requests mutation after the shared entry point has selected check-only mode.

## Inline test plan

Use real hook/helper processes with external-tool process doubles that destroy
source on write requests and return distinct diagnostics on checks. Require
unchanged edited/sibling bytes and positive checker output, so skipping checks
cannot pass. Exercise Python, Rust, Go, SQL default/opt-in/host-Prettier, shell,
and a generic formatting file. Keep explicit-fix characterization coverage.
Run one new regression RED before each implementation group, then targeted
surrounding tests. Check lint/types/parity/generated surfaces and independently
review the combined diff before completion. No historical RED will be inferred.

Applicable principle: preserve user work through explicit mode selection at the
existing boundary; no edit-range guessing or automatic repair of source bytes.

Shell also invokes the shared Prettier writer when configured. Check mode must
retain formatting feedback: Ruff format --check, rustfmt --check, Go fmt --diff,
and Prettier --check, alongside lint diagnostics. Explicit fix mode retains Ruff
fixes/format, package-wide Clippy fixes and rustfmt, edited-file Go formatting,
SQL's configured fix opt-in or host Prettier, and generic/shell Prettier writes.
These explicit commands are deliberately allowed to change source.

## Work Log

- 2026-11-14T20:25:14.311Z Started: Created ticket 9C4YFN.
- User explicitly approved updating existing language/formatting tests while
  retaining explicit-fix coverage. Fresh intake review c26ab12a approved and
  earned the intake stamp before advancing to implementation.
- Python RED: canonical Vitest regression failed by source equality: the tool
  rewrote the pending import fixture. Initial exit 75 was lock contention with
  no tests started; the longer-wait run executed and failed as intended.
- Real Ruff 0.16.5 before/after proof: the original hook deleted import os and
  reformatted an unrelated line with fix=true and fix-only=true. The new branch
  passes --no-fix and --no-fix-only, checks formatting without writes, preserves
  exact bytes and returns both F401 and formatting feedback. The first manual
  after-proof assertion expected older formatting wording; the observed output
  said "would be reformatted" instead, and the corrected probe passed without
  any production change. Canonical GREEN is still queued behind another run.
  That canonical Python run subsequently passed 1/1.
- Remaining-language RED: all 20 Claude/Cursor preservation cases failed on
  original writers; the explicit Rust fix characterization passed. The first
  combined GREEN attempt passed 76/77, including the full new matrix. Its one
  failure was a package-context test expecting silence for an unformatted Go
  fixture; that fixture is now formatted while keeping the original sibling
  resolution assertion. A complete six-file rerun is pending.
- Go also honors issues.fix=true from configuration without a --fix argument.
  Check mode explicitly supplies --fix=false, with real-Go and process-boundary
  tests protecting edited and sibling files. The Go helper was split into
  package checking and configuration/lifetime handling to satisfy existing
  complexity limits; focused lint passes without suppressions.
- Real Rust/Clippy and rustfmt preserved both edited and sibling source while
  surfacing exit-zero warnings and formatting diffs. Real installed Prettier
  preserved JSON bytes and reported its formatting diagnostic through a private
  launcher, without downloads. SQLFluff is not installed locally; its dispatch
  and SQL-host fallback are covered at the external-process boundary.
- Source reviews f69928bb and ce311e89 approved; the partial supplemental review
  was correctly refused as whole-phase evidence. Complete review db687e4e
  requested distinct Python lint/format witnesses. The regression now asserts
  both independent markers. Isolated hook copies with either check removed are
  rejected while unchanged source passes; the original template hash remained
  unchanged throughout (.project/tmp/9C4YFN/python-sensitivity.json).
- Review's shell-parser warning was reproduced with real Prettier. Its native
  --ignore-unknown check option avoids unsupported-shell noise while retaining
  ShellCheck feedback and supported-format diagnostics. A real-Prettier test
  asserts the exact helper result; Go formatting-only cases cover clean lint
  with a formatting diff on both hosts. These final cases await canonical GREEN.
- Closing rerun hit a twenty-minute shared-lock limit without starting tests;
  a longer supported wait now sequences targeted checks, mirror generation,
  and the complete verbatim verification plan. No lock was removed or test
  execution policy changed. Current full lint/Gherkin and all package types pass.
- Canonical focused validation passed 80/80 across six files. Official mirror
  sync and all five generators passed, including lifecycle update and verify;
  pre-commit confirmed all generated surfaces current. Implementation checkpoint
  committed as 7b31ad97b. No production code has changed after that checkpoint.
- The first full verification exposed ten legacy write-expectation failures in
  Go/Rust golden paths and Python hooks. Only our failing plan and its own
  Vitest were interrupted; its wrapper completed normal lock cleanup. That
  interrupted invocation is not passing evidence. User-approved test updates
  now require exact preservation and positive findings, retaining explicit
  formatter coverage. The clean-Python case initially inherited a missing-config
  warning; it now supplies and finally restores its own config. All 136/136
  tests in the three legacy files pass. Together, targeted runs cover 216 tests
  across nine files; a fresh complete verification plan is running.
- Complete code review c499adda approved after the stronger Python witnesses.
  The phase-stamp helper nevertheless requires every file in the full branch's
  change from main, including reviewed stack ancestry. With the three additional
  legacy-test files that is 66 files; the coordinator rejects it before dispatch
  at its 64-file limit, with recovery.requires_human=true. Exact public output:
  .project/tmp/9C4YFN/phase-review-capacity.json. No review gate was disabled,
  receipt forged, or phase exception granted. Ticket remains implement pending
  this closure-policy decision; code verification continues independently.
- Intake review fc3d5664 approved with warnings; clarified shell's writer,
  formatting diagnostics and explicit-fix compatibility. Frontmatter scope was
  added while that review ran, so its receipt was correctly rejected as stale;
  a fresh review is required before advancing.
- Fresh intake c26ab12a earned the supported stamp and advanced to implement.
  A second complete verification attempt exposed four more old writer
  expectations in mixed Python/Go projects and Python golden paths; the run was
  interrupted and is not green evidence. The approved test updates now require
  exact bytes plus formatting feedback. Rust/Python missing-file and syntax
  cases also assert observable results rather than merely that spawnSync did
  not throw. One Rust assertion initially matched escaped JSON rather than the
  parsed error; correcting that assertion produced 166/166 passing tests across
  all six affected integration files. Together with the six focused files,
  targeted validation covers 246 passing tests across twelve files.
- Independent six-file test review d98613d5 approved. Sibling preservation and
  explicit-fix coverage are deliberately in the dedicated boundary/helper tests,
  not duplicated in each golden path. Root lint/Gherkin/typecheck, documentation
  site build and refreshed scoped code/learning/domain audits pass. Complete
  verification is running from frozen test sources. Current phase coverage is
  67 files, exceeding the unchanged 64-file packet cap; no exception has been
  granted. verify.md records evidence, limitations and the closure decision.
- Complete verbatim verification finished with exit zero: 12095 distinct
  workspace tests passed with 13 existing skips; the scheduled duplicate CLI
  (11744) and collector (153) runs also passed. All 599 acceptance scenarios,
  11786 steps and 52 proof tests passed. All detected builds/typechecks and
  supply-chain lanes passed; Go reported zero reachable vulnerabilities while
  identifying uncalled transitive advisories. No source/test code changed
  during the final run. Raw evidence is .project/tmp/9C4YFN/verify-complete.log.
- Final 67-file public review dispatch reproduced REVIEW_PACKET_INVALID and
  recovery.requires_human=true before model dispatch. Code and tests are ready;
  the ticket remains implement/in_progress pending explicit permission to use
  the completed separate reviews for local closure. This does not request or
  imply permission to publish, ready, merge or release the existing Draft PR.
- 2026-11-14T23:32:41Z: User replied "accept" to the concrete recommendation
  to use the completed separate independent reviews and close local ticket
  9C4YFN. This explicitly authorizes the implementation-review exception for
  the 67-file branch versus 64-file packet limit and confirms local closure;
  it grants no publishing, Ready, merge or release authority.
- Verification artifact review 0bdc520e-c2a6-42a6-a57f-07c282e90ea9 approved.
  The frozen production/test sources from the successful complete plan are
  delivered in e93a1071d: production checkpoint 7b31ad97b plus the six approved
  integration-test updates. The final plan ran before that commit; the test
  files passed read-only formatting checks, and pre-commit lint/format passed.
  Subsequent edits only record ticket/verification metadata. Codex proof is
  explicitly transitive through its existing packaged shared-hook dispatch;
  no native-app installation or direct language-by-language Codex RED is claimed.
- Native completion command (`safeword hook codex stop`, run from local source
  through scripts/dev with the actual host identity) completed with exit zero
  and the valid no-continuation response {}. Its shared done-evidence gate
  reran the resolved test and acceptance lanes, then itself changed this ticket
  to phase done/status done at 2026-11-14T23:53:31.850Z. No test result or
  completion receipt was fabricated. Raw response is
  .project/tmp/9C4YFN/native-completion.log. Only local closure metadata changed
  after the verified production/test commit e93a1071d.
