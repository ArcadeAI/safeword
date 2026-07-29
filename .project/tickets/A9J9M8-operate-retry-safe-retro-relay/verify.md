# Verification: Operate the retry-safe retro relay

## Verify Checklist

**Test Suite:** ✓ 5,836/5,836 tests pass (relay 163/163; CLI 5,673/5,673; 6 intentional skips)
**Gherkin:** ✅ Acceptance lane passes (isolated CLI lane: 93/93 scenarios and 1,109/1,109 steps)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 124 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked Technical Builder through automatic stop-retro filing; worst step = the bounded relay timeout before native fallback; new steps vs before = 0
**Evidence limits:** ⚠️ The aggregate verification attempt overloaded the acceptance lane's shared setup, producing two setup-only 60-second timeouts after 618 scenarios passed and 3 were skipped. The direct CLI acceptance lane then passed 93/93 scenarios and 1,109/1,109 steps. Experiment-only Python import-linter/deadcode checks are unavailable locally.

Audit passed with warnings — 0 feature-blocking errors. Config sync, Knip, Go dead-code, domain-doc reconciliation, and the dependency-cruiser error gate are clean across 708 modules and 2,348 dependencies. Configured documentation sources (`README.md` and `packages/website/src/content/docs`) and the architecture narrative show no feature drift. The stable repository-minus-generated-trees scope reports 551 clones (8.60%), +8 from the prior same-scope branch audit and attributable to this review's state-machine tests and resolution record. `@openai/codex` has a low-risk dev-only minor update (0.145.0 → 0.146.0) deferred as unrelated scope; the production dependency audit reports no vulnerabilities.

## Evidence

- The generated verification plan passed the complete relay and CLI test suites.
  Its acceptance phase hit two setup-only resource-contention timeouts after
  618 passing scenarios; the direct CLI lane passed cleanly. Both generated
  builds and package typechecks then passed.
- `bun run lint`, the full formatter, config sync, Knip, and dependency-cruiser passed.
- Independent quality review approved the final tree with no critical issues or suggested improvements after the six-surface HTTPS collaborator path, SQLite transaction process lock, retry scheduling, and shutdown reacquisition proof were reviewed.
- Raw GitHub REST bodies remain the only marker authority. Sanitized MCP reads are not used for duplicate decisions.
- GitHub issue 834 remains open and is not superseded.
- GitHub issue 1495 is not a readiness gate because this slice does not reuse its client credential helpers.
- GitHub issues 1474 and 1481 are now closed on main. Checked-in relay readiness remains disabled because the required fresh post-fix measurement artifacts and evidence review have not landed.

## 2026-07-29 fourth-round comment resolution

- Full post-fix suites: relay 163 passed with 1 intentional skip; CLI 5,673
  passed with 5 intentional skips.
- The aggregate acceptance run completed 618 scenarios before two shared
  setup-only 60-second timeouts; the prescribed direct CLI lane then passed
  93/93 scenarios and 1,109/1,109 steps.
- Both package builds and typechecks, full lint, Gherkin lint, formatting,
  config sync, dependency boundaries, domain-doc reconciliation, and diff
  hygiene passed.
- Compatible renewed bytes now reconcile across every durable client state;
  acknowledgement retains one immutable source record; operators can list every
  discardable ID and truthful state; disappeared duplicate claims are benign;
  and leased discard recovery converges truthfully.
- Explicit discard now compacts its active source reservation into an indefinite
  discarded-source tombstone, so exact replay cannot mint a new request ID.
  Acknowledgement wins concurrent terminal races and post-write cleanup retains
  only its one source tombstone.
- Raw GitHub REST bodies remain the sole marker authority. N4 normalization
  remains declined; R8 key deletion remains declined while unresolved payloads
  require indefinite recovery. Issue 834 is not superseded, and issue 1495 is
  not a readiness gate because no client credential helper is reused.
- Fresh independent quality review and final delta review both approved with no
  critical issues or suggested improvements.

## 2026-07-28 third-round comment resolution

- Relay: 163 passed, 1 intentional ordinary-lane skip.
- CLI aggregate: 5,665 passed, 5 intentional skips.
- Acceptance: 623 scenarios (620 passed, 3 skipped) and 19,861 steps
  (19,857 passed, 4 skipped). The changed feature independently passed 44/44
  scenarios and 1,444/1,444 steps.
- Both package builds and typechecks passed. Full lint, format, dependency
  boundaries, config sync, diff hygiene, Go dead-code, and outdated-dependency
  checks passed.
- Fresh independent quality review approved the exact-token discard state
  machine with no critical issues or suggested improvements.
- Exact discard-intent tokens eliminate the shared-alias ABA window; producers
  check intent both before and after publication; recovery cancels only its own
  token around foreign claims; and an immutable source acknowledgement preserves
  source identity across stale discard snapshots.
- Raw REST response bodies remain marker authority. Sanitized MCP reads never
  participate in duplicate decisions. Issue 834 remains open and unsuperseded;
  issue 1495 remains irrelevant because no client credential helper is reused.

## 2026-07-28 R1–R14 final re-review

- All new PR feedback since the prior sweep was contained in
  `issuecomment-5105516755`; no later conversation, review, or inline comment
  existed at the final pre-push check.
- Accepted findings now have executable coverage for corruption isolation,
  fail-closed spool persistence, active backlog reporting, 401 retry, operator
  recovery, lock-before-store-open, current-v4 repair, raw scan credential
  invalidation, environment parity, bounded reconciliation, and exact raw
  canonical/legacy evidence agreement.
- R4 remains outside the canonical same-requestId contract. R8 would violate
  indefinite ambiguous/dead-letter recoverability. R7 remains an operator-only
  recovery path so the legacy native agent cannot become a second filing owner.
- Fresh independent review: APPROVE after both final Important findings were
  resolved. No Critical or Important finding remains.
- Final lint, formatting, typecheck, diff hygiene, dependency graph, config
  drift, domain-doc reconciliation, and production dependency audit are clean.

## 2026-07-28 PR comment resolution rerun

- Relay: 138 passed, 1 ordinary-lane skip; the CI-gated production Docker image test passed 6/6 with process UID 1000, `/data` UID 1000, and unsafe `/` configuration rejected.
- CLI aggregate: 5,622 passed and 5 skipped; eight subprocess timeouts in three legacy integration files passed 19/19 when immediately rerun in isolation.
- Acceptance: 623 scenarios (620 passed, 3 skipped) and 19,861 steps (19,857 passed, 4 skipped).
- Release gate: 22/22. Non-git physical install proof: 1/1.
- Build, full lint, typecheck, format, dependency validation, diff hygiene, and production audit passed; audit found no vulnerabilities.
- Fresh independent quality review and final delta review both approved with no critical issues after atomic source reservation, corruption fencing, restart-safe deadline recovery, shared-tenant enforcement, and normalized process locks.
- Ticket remains `verify/in_progress`: the ticket-system contract requires explicit user confirmation before marking a ticket done.
