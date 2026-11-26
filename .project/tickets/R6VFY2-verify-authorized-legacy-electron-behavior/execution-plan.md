# Execution Plan: Verify authorized legacy Electron behavior

**Status:** planned
**Prepared on:** 2026-11-23

## Pull-request slicing

**Decision:** one pull request

**Rationale:** Enrollment, the typed runner and authenticated row/close admission
form one usable exception; none is independently useful with another missing.
This is one delivery boundary, with small scoped commits for TDD. No new pull
request, publication or merge is authorized merely by this plan.

## PR 1 — Independently verify the approved historical Electron work

- **Purpose:** Support the specifically approved SGWMBS exception while preserving history.
- **Boundary:** Source policy, fixed Electron runner, public observation route,
  row/closing integration, ordinary test-first proof, docs and generated parity.
  Excludes arbitrary enrollment, commands, runtime cache edits and old receipt rewrites.
- **Prerequisites:** None beyond accepted scenario and implementation plans.
- **Proof:** Policy/report/process/CLI/authorization tests, legacy regressions,
  generated parity, actual installed public command and all-17 Electron replay.
- **Completion signal:** Installed runtime authorizes only the approved policy
  after real discrimination and independent reviews; CKWE2D and ordinary TDD stay green.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. Historical completed RED at the highest-risk public boundary, before the
   original production edits: the original installed baseline 1.2.0 bundle from
   3f5353165 rejected the request. The real RED is retained in 21aca3867 and its
   executable review eaa0c9e4-af02-484b-a94c-477dbb15c441; GREEN 2185c1d77 was
   recorded before this reconciliation. Do not rerun the current extended bundle
   and describe its result as that missing-command RED. Original sequence: commit a
   truthful request for the existing mixed-case package scenario in the approved
   Soulless checkout (spec 89, its existing real renderer assertion at line 39,
   removing only the package metadata branch in tabLifecycle). Invoke the currently
   installed runtime:
   `bun /Users/alex/.codex/plugins/cache/safeword/safeword/1.2.0/runtime/cli.js --cwd /Users/alex/.codex/worktrees/cc7f/soulless-monorepo review observe retrospective --request .project/tickets/SGWMBS-open-save-soul-electron/retrospective-proof/cased-suffix.request.json --json`.
   Expected RED: the typed public result rejects the absent observation command
   or unsupported SGWMBS runner, rather than returning the required independently
   built original-pass/mutant-assertion-failure observation. Keep the request
   syntactically complete and the real selected test/anchor present, so missing
   files or fixture errors cannot stand in for that RED. Record this outside-in
   failure before supporting policy/report tests. After Task 5, rerun this exact
   public request through the supported updated installation; do not claim the
   real-host GREEN from the portable fixtures.
2. Record the reviewed planning state in a scoped commit. Write RED tests in
   `tests/review/legacy-electron-policy.test.ts` for fixed SGWMBS identity,
   exact 17-heading inventory, real Git cutoff ancestry, wrong repository and
   missing/changed history; extend legacy history tests without changing their
   expected authorization. Run P-policy and capture genuine rejection of SGWMBS
   before production implementation. GREEN: source-defined policy registry and
   per-policy history selection. Commit before the next behavior.
3. Write RED pure report/request tests in
   `tests/review/legacy-electron-proof.test.ts`: one original pass and declared
   assertion kill accepted; missing/malformed reports, extra tests/results,
   retries, skip/fail annotations, wrong title/file/project/line, setup/global
   errors, crash/timeout, surviving mutation and zero/repeated anchors refused.
   Include matcher exhaustion at the exact expectation as a positive sibling.
   GREEN: typed request/report validation without accepting arbitrary shell/cwd.
4. Write RED process-boundary integration tests in
   `tests/review/legacy-electron-runner.test.ts` using real temporary Git
   archives and controlled external process fixtures. Prove independent frozen
   installs/builds, no checkout node_modules or live build reuse, lock drift
   rejection, contained regular tracked inputs, unrelated untracked exclusion,
   owned reports/ports/profiles and cleanup on failure. Name dirty tracked input,
   untracked declared support and occupied owned port refusals explicitly. GREEN: actual Electron
   adapter in `src/review/retrospective-electron-proof.ts`, sharing safe archive
   mechanisms where that preserves legacy behavior. Build each snapshot fully.
5. Write RED public CLI observation wiring in
   `tests/cli-protocol/retrospective-observe.test.ts`. Call the real parser and
   handler; mock only external process execution for portable assertions. GREEN:
   register `review observe retrospective --request <path>` in catalog/handlers
   and describe its non-authorizing observation result. Add assertions that the
   README and CLI reference describe the public route, separate VERIFIED and its
   scope/setup-failure limits; parity alone cannot prove documentation content. For the early real-host GREEN, run the supported intermediate generation
   `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts --fix`, then
   `codex plugin add safeword@safeword --json` against the already registered local
   marketplace. Rerun Task 1's exact public observation command against its
   committed request. This is the early single-row observation, not P-host (the
   all-row driver does not exist yet). A synthetic process/report fixture is not
   this real-host proof. Task 11 regenerates again after final template/doc changes.
6. Write RED `tests/review/legacy-electron-authorization.test.ts` and focused
   hook cases for both independent receipts, including project configuration
   requesting author-only review, changed exact reviewed bytes despite
   fresh successful runs, policy digest binding, foreign/forged records, metadata
   HEAD requiring fresh execution, failed replay never refreshing a row, and
   preservation of original history. Add a same-HEAD failure-then-pass sequence:
   a signed failed-replay record must reject the later passing rerun under the
   same proof-review ID; only a fresh observation and new independent proof review
   can restore eligibility. Old failures remain audit evidence. Add crash-boundary tests for a terminated
   pending invocation, failed final record write, and concurrent callers; neither
   a leftover pending record nor its lock permits retry recovery. GREEN: reuse existing authenticated review
   jobs/row signing, add SGWMBS policy binding without changing CKWE2D shapes.
7. Write RED `tests/review/legacy-electron-close.test.ts`: exact all-17 coverage,
   missing/duplicate/foreign/forged rows, dirty ticket metadata, stale view and
   stale review despite fresh successful execution. GREEN: per-policy close record,
   fresh strict replay of every required row, before/after identity checks and
   existing atomic aggregate writer. Keep ordinary TDD closure blocked without RED.
8. Add the feature's `.bdd-proof.json` manifest mapping every scenario and
   outline example to its normally collected executable tests, in example order.
   Prove every SWM1 constituent with a focused regression underneath its coherent
   compatibility scenario. Extend existing CKWE2D gate/close/history/import-boundary
   and generated-host tests. Nonblocking scenario-review wording concerns do not
   permit omitting those individual assertions.
9. Write RED delivery-driver tests in
   `tests/review/legacy-electron-delivery.test.ts`: call the real script against
   temporary committed ledgers and process-boundary fixtures. Assert nonzero
   refusal for missing, stale or forged rows, the wrong exact 17-heading set and
   any runtime path that is not the supported installed distribution. Its positive
   fixture must report the exact ticket/ledger and each required row as approved.
   GREEN: create `packages/cli/scripts/verify-legacy-electron-migration.ts` as a
   read-only evidence driver. Resolve the supported installed runtime, ask its
   gate about every checked row and the aggregate, validate exact response identity
   and fail on any missing/blocked response. Never create receipts or check a
   ledger box. P-delivery proves this driver contract; P-host requires real
   authenticated installed responses and the real all-17 closing replay.
   Add P-rollback coverage in `tests/review/legacy-electron-rollback.test.ts`:
   extract the immutable baseline generated Codex bundle from source commit
   3f5353165447d6c5565dcc1c8b077f0c76d03c7f into an owned temporary directory.
   Run that actual old bundle against SGWMBS row and close requests, using synthetic SGWMBS-shaped records in a temporary fixture with test keys.
   These portable tests do not read external Soulless state. Assert explicit blocked results for the
   new policy and no new authorization; a new-runtime-only test cannot count.
   Retain the old bundle's Git blob identity in evidence, and clean its temporary
   extraction. This local delivery proof requires that pinned baseline object.
   The same test helper accepts `SGWMBS_ROLLBACK_PROJECT` for the separately
   invoked real-record comparison after Task 13; normal portable execution uses
   only its synthetic fixture and never depends on later delivery output.
10. REFACTOR only after protection passes: keep policy selection separate from
   execution and report validation; remove new duplication in one change/test/commit
   steps. Do not restructure unrelated review machinery. Run P-contract and P-regression.
11. Update README/CLI reference and retrospective rubrics for scoped policies and
   separate VERIFIED. Generate via `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts --fix`;
   do not hand-edit plugin or cache files. Run P-generated and P-public.
12. Install the generated bundle using the supported persistent local Codex
    marketplace registration, `codex plugin add safeword@safeword --json`, and
    inspect supported project install reconciliation before applying its changes.
    The actual preview proposes unrelated helper/configuration and lockfile churn;
    retain the existing delivery checkout because the native plugin is sufficient
    and that churn would invalidate executable proofs. Confirm installed identity and
    public command before claiming rollout. Retain the previous marketplace
    source as rollback context; no normal npm release is required.
13. Current continuation — whole-test exception correction. The genuine RED is
    `tests/review/legacy-electron-runner.test.ts` case
    `refuses an unreported renderer exception despite an otherwise qualifying matcher report`.
    Its real Git/process fixture emits BrowserContext weberror after launch while
    returning a qualifying matcher report. Before repair, it resolves instead of
    rejecting: one failed / 13 passed in `/tmp/issue163-unreported-exception-red-valid.log`.
    Run from packages/cli with
    `../../scripts/dev bun run test tests/review/legacy-electron-runner.test.ts --maxWorkers=1`.
    The real installed after-readiness probe also incorrectly returned observed
    at Soulless a1ba355a, retained without any review or verification credit.
    GREEN: add the fixed owned preload in
    `src/review/retrospective-electron-monitor.ts` and integrate it into the runner.
    Extend that external-process fixture and add
    `tests/review/legacy-electron-monitor.test.ts` for main uncaught exceptions,
    buffered/live renderer errors, future windows, crashes, missing startup or
    arming markers and malformed telemetry. Assert a named refusal in every case;
    retain ordinary original-pass/mutant-assertion-kill protection. Run both files
    with the same package test command. Keep normal exception handling and existing
    launch options; add only the owned main `-r` preload. Install/build environments
    stay clean. Earlier observations keep their truthful producing runtime; no
    original observation is rewritten to claim that it had this monitor.
14. Re-run P-generated, P-public and P-host using the supported final installation.
    Re-run the exact real negative probe through installed `review observe retrospective`
    with `--cwd /Users/alex/.codex/worktrees/cc7f/soulless-monorepo` and
    `--request .project/tickets/SGWMBS-open-save-soul-electron/retrospective-proof/renderer-after-readiness.rejected-request.json`.
    It must return blocked for the recorded runtime exception. This is an unsigned
    negative observation and has no proof-review ID; it can grant no row credit.
    All 17 earlier individual rows passed under 2185c1d77; this is earlier evidence,
    not final monitored replay. Preserve their original ledger history and producing
    observations. Commit final delivery metadata, then execute all 17 again under
    the strengthened installed runner for exact-current-HEAD closing authorization.
    A failed replay consumes its proof ID and requires fresh observation/review.
    Run P-rollback-host afterward with SGWMBS_ROLLBACK_PROJECT set to the actual
    delivery checkout. Require the immutable original old bundle to refuse its
    actual SGWMBS row/closing records without modifying them.
15. Re-run all affected P-contract, P-regression and P-full lanes after the monitor
    change, plus Safeword verify/audit. Only after the focused, generated, real-host
    closing and final verification evidence passes, reconcile impl-plan status to
    implemented. Record actual receipts/checklist results and revision. A later
    material change invalidates affected evidence and requires fresh proof.

## Obligation ownership

| Accepted obligation | Owning PRs |
| --- | --- |
| R1 scoped authority, honest history and independent eligibility/proof | PR 1 |
| R2 actual independent frozen Electron builds and meaningful discrimination | PR 1 |
| R3 exact input/review binding and real execution at every HEAD | PR 1 |
| R4 exact-set current closing replay and stale/dirty/forged refusals | PR 1 |
| SWM1 CKWE2D compatibility, ordinary TDD and generated installed public command | PR 1 |
| Documentation, supported local rollout, reversal and all-17 real-host evidence | PR 1 |

## Deferred scope ownership

- skip: none of the accepted obligations is deferred. General runner enrollment,
  normal release publication and broader test scheduling are excluded in ticket.md.

## Decision accounting

- Trusted migration enrollment: unchanged.
- Typed Electron evidence: unchanged.
- Preserve legacy authorization and replay chronology: unchanged.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| P-policy | command | integration | Policy selection and real Git history | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/review/legacy-electron-policy.test.ts"]} |
| P-contract | command | integration | Runner report contracts and isolated process preparation | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/review/legacy-electron-proof.test.ts","tests/review/legacy-electron-runner.test.ts"]} |
| P-public | command | integration | Actual public parser and observation handler | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/cli-protocol/retrospective-observe.test.ts"]} |
| P-regression | command | integration | Signed row/closing gates and existing retrospective/ordinary paths | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/review","tests/hooks/retrospective-gate.test.ts","tests/bdd-proof-tags.test.ts"]} |
| P-generated | command | integration | Source to generated native-plugin parity | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-generated-surfaces.ts"]} |
| P-host | command | E2E | Installed public CLI to real approved Electron original/mutant and authenticated all-row closing | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/verify-legacy-electron-migration.ts","--project","/Users/alex/.codex/worktrees/cc7f/soulless-monorepo"]} |
| P-delivery | command | integration | Read-only driver to installed runtime and exact response identity | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/review/legacy-electron-delivery.test.ts"]} |
| P-rollback | command | integration | Actual pinned old bundle refuses SGWMBS row and closing authorization | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/review/legacy-electron-rollback.test.ts"]} |
| P-rollback-host | command | integration | Actual pinned old bundle refuses retained real SGWMBS records after closing | real_boundary | current_required | {"type":"command","cwd":".","argv":["env","SGWMBS_ROLLBACK_PROJECT=/Users/alex/.codex/worktrees/cc7f/soulless-monorepo","scripts/dev","bun","run","test","tests/review/legacy-electron-rollback.test.ts"]} |
| P-full | command | integration | Full repository verification including legacy regression | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test"]} |

P-host is a bounded ticket-owned evidence driver, not a generalized product command.
It checks through the installed trusted closing gate that the replay-produced
aggregate binds the exact current HEAD; old records cannot satisfy it.
It must invoke the installed trusted public runtime, inspect authentic review/row
responses and fail on any missing or stale row. It cannot create fake receipts or
set ledger checkboxes itself. The installed observation/attestation commands,
independent reviews and guarded ledger edit own those respective actions. Its
first observation can calibrate failures, but completion requires the exact all-17
closing view. Any preparatory observation failure remains a failure record.
P-full's invocation covers tests; final verify also runs the repository's build,
type/lint, generated and dependency checks from the verified command inventory.

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| outcome-scope | outcome and scope | Only approved SGWMBS historical rows earn separate credit | contributor | P-host | open | missing | | |
| resolved-decisions | resolved decisions | Trusted fixed policy and typed runner enforce accepted design | contributor | P-policy | open | missing | | |
| pr-decomposition | dependency and pull-request decomposition | One complete usable delivery with no unmerged successor | contributor | P-host | open | missing | | |
| testing | testing | Actual Electron discrimination | contributor | P-host | open | missing | | |
| testing-contracts | testing | Current deterministic repository tests | contributor | P-full | open | missing | | |
| data-compatibility | data and compatibility | Legacy receipts and missing original history remain intact | contributor | P-regression | open | missing | | |
| monitoring | monitoring and failure signals | Invalid preparation reports a blocking reason | contributor | P-contract | open | missing | | |
| monitoring-replay | monitoring and failure signals | Invalid replay reports the blocked row and reason | contributor | P-regression | open | missing | | |
| security-privacy | security and privacy | Scope, receipt identity, exact bytes and execution ownership are bound | contributor | P-regression | open | missing | | |
| rollout-rollback | rollout and rollback | Actual old runtime refuses retained real new-policy records | contributor | P-rollback-host | open | missing | | |
| rollout-install | rollout and rollback | Generated supported install works | contributor | P-host | open | missing | | |
| documentation | documentation | Public command and separate VERIFIED limits documented | contributor | P-public | open | missing | | |
| ownership-dependencies | ownership and human dependencies | Scope approval | human | | not_applicable | missing | | User explicitly approved implementing the supported exception; no further product approval is configured |
| completion-evidence | completion evidence | Exact all-17 final committed closing proof is authentic | contributor | P-host | open | missing | | |
