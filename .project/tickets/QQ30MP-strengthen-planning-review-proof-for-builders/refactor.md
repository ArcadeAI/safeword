# Behavior-preserving refactor follow-up

User request: run refactor after f5110a7b7. Preserve the residual #5051 scope,
main #5957 canonical/copy behavior, authenticated approval repairs and tests.
The earlier formal verify/audit reports remain historical; this artifact records
the subsequent structural changes and their own proof.

## Scout ledger and order

Independent read-only scouts covered the disposition command and admission/
test wiring. Lint and diff-scoped architecture checks were clean. The accepted
production ledger is deliberately capped at three small cleanups:

1. Reuse the existing optional `Finding` type in the command. Commit 08a6f9299;
   21 disposition tests passed; static generated surfaces stayed current.
2. Share the persisted finding fingerprint between recording and consuming a
   decline. Commit 03a18d727; 22 disposition/identity tests passed. Before that
   extraction, test commit 5e2719a03 pinned the exact existing info/warning hash
   bytes; its 21 tests passed. This is characterization, not a new RED cycle.
   The helper preserves severity/message field order, SHA-256 encoding and
   string bytes. All five generated surfaces were regenerated and verified.
3. Deferred after revert: rename private `planningCopyFindings` and `copyError`
   names to `planningPacketFindings` and `planningError`. The broader regression
   run failed an unchanged route-timeout test; the isolated control failed too
   with this rename absent. Leave it reverted rather than claiming a green step
   or changing excluded fallback tests. No class, serialized field, public
   command, recovery text or condition change is delivered by this entry.

Deferred, not silently omitted: identical selected-parent Product/scenario
fixture text could move to planning-role-fixtures; duplicated standalone
Product dispatch setup could become another small fixture. These are valid
lower-priority cleanup candidates; this pass keeps their ownership examples
local and avoids widening the test-file refactor. Existing installed fixture
extraction cccae7bcc remains unchanged.

Each committed production edit was isolated and tested before its own commit. No guard,
approval anchor, setup/teardown symmetry or configuration default was removed.
The main `planning-accepted-boundary.ts` change only extracts the existing
fingerprint expression; accepted-boundary digest semantics are unchanged.

## Fresh independent review

Claude/opus cross-agent review fc9a0729-1ed7-4229-afc2-b25a1c7e4013
approved the three-file candidate without errors; signed status was rechecked
before the rename was reverted. It is candidate history, not approval of the
final two-file delivery. A fresh review covers that final scope separately.
The supplied test context includes pinned persisted hashes and real CLI/PTY
write/read and confirmation-time checks. Remaining observations:

- In-lock finding re-selection would add defense against an approved result
  being replaced under the same ID. Existing completeReviewJob only publishes
  results from launching/running; attempting to complete an already completed
  job invalidates it as failed. The existing authenticated status check rejects
  that state. No ordinary API replaces it with a different approved finding.
  Altering authenticated storage inside the trusted key boundary is outside
  this refactor's guarantee; additional re-selection is deferred hardening.
- Rebuilding prior disposition objects can lose YAML comments/anchors/style.
  This existing behavior predates the refactor; prior record values and hook
  readability are protected. Preserving ledger presentation would be a separate
  behavior change, not silently included here.
- Hex/binary finding spellings are additional existing Number conversions.
  Required numeric characterization remains; no syntax tightening is claimed.
- No context-error class was renamed. The existing contextRole discriminator
  and typed metadata paths are unchanged; typechecking and public/native copy
  and context tests check their wiring.

## Execution incident retained

The first final-regression run overlapped generator work and emitted the
distribution-mtime warning. The generator's lifecycle verification then timed
out waiting for the same package test lock (exit 75); no second Vitest process
or lifecycle test started. Both outputs are retained. Neither warning nor
unstarted lane is promoted to a clean final result. Recovery is sequential:
finish the active regression run, revert the failed rename, then validate the
committed fingerprint/type changes independently of source-writing generators.

That six-file run reports 182 passed and one failed: `records a timed-out
OpenCode route without independent evidence`. Its fake Claude fallback also
timed out, so the command returned pending instead of approved. An isolated
control after reverting the rename still failed: the fake Codex process was
classified timed_out rather than process_failed. The test sets a global 500 ms
review subprocess timeout, which applies to the other fake agents too. These
observations demonstrate timing sensitivity without the rename; they do not
establish a production fallback defect or a fix. Assertions and timeout values
remain unchanged, and the failed broad run is not relabeled a pass.

The broad feature's 172 undefined cases, two scenario-review errors, dependency
advisories and host/human/paid-qualification limits remain unchanged. Green CI
on f5110a7b7 is historical after these new commits; Draft state and no merge or
Ready authority remain in force.

## Final kept scope and checks

Delivered: two refactors in the disposition command and its existing boundary
module. Reverted/deferred: private error-helper rename. The final source matches
03a18d727; subsequent changes are this evidence and the ledger disposition.

- Final five-file regression run: 43/43 passed, exit 0, with no stale-build
  warning. The wrapper rebuilt the CLI after all source-writing generators had
  stopped. Files: installed-planning-copy-admission, native-planning-copy-dispatch,
  planning-disposition-identity, planning-review-disposition and planning-review-identity.
- Root lint, Gherkin lint and CLI typecheck: exit 0. The source tree was reverted
  to its kept state before this lint command completed; no code changed afterward.
- All five generated surfaces current. Successful regeneration and lifecycle
  verification for 03a18d727 remain applicable to the identical restored source
  and carriers; the later interrupted rename generation is retained as failed.
- Final diff audit: no dependency violations, 156 modules / 303 dependencies.
  Learning/principle/domain reference checks emit no findings. The new shared
  export has two callers; the command's single-use hash helper/import are gone.
  Whole-repository Knip, clone totals and upgrade discovery remain explicitly
  outside diff scope. Manual regression checks confirm unchanged guard order,
  lock scope, fingerprint bytes, defaults and public result fields.
- Final independent Claude/opus cross-agent review
  d1f4c173-6b98-4ba4-b645-bfa520ba642c approves the two kept source files;
  authenticated status rechecked approved. Its nonblocking suggestions are
  deferred: symlink/owner preservation would widen regular-ticket write
  semantics; finer parse/disappearing-source diagnostics would change error
  behavior. Existing numeric conversion and trusted user-authored ledger
  handling stay unchanged. No new trust-boundary claim is inferred.

The broader 182-pass/1-fail result and reverted isolated control failure remain
failures. The 43-case pass does not overwrite them or claim full-suite success
at this revision. No assertions, timing budgets or skip conditions were changed
to achieve a pass. No additional paid qualification or dependency upgrade ran.

Audit passed with warnings: reproduced local timing sensitivity, explicit
refactor deferrals and existing broad-feature limitations. Two successful
production refactor commits remain separate from the characterization test and
this evidence commit.

**Next:** Keep Draft PR #5980's current-head checks and the deferred timeout-test
observation visible; do not merge or promote it.
