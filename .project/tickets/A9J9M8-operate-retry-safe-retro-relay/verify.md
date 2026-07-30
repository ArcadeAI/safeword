# Verification: Operate the retry-safe retro relay

## Verify Checklist

**Test Suite:** ✓ 5,891/5,891 tests pass (relay 165/165; CLI 5,726/5,726; 6 intentional skips)
**Gherkin:** ✅ 616 aggregate scenarios passed with 3 intentional skips; 4 setup-only shared-lock timeouts passed 4/4 and 130/130 steps in clean isolation
**Build:** ✅ Success, including the pinned production container on Node 24.18.1
**Lint:** ✅ Clean (ESLint, Gherkin lint, and TypeScript)
**Scenarios:** All 187 RED/GREEN/REFACTOR checks marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ Walked a cloud-harness operator through configuring one external durable outbox, losing the disposable workspace, and retrying/listing/discarding from another harness; worst step = provisioning a platform-durable absolute path; new steps vs before = 1
**Evidence limits:** ⚠️ Experiment-only Python import-linter/dead-code checks are unavailable locally. The optional Docker Vitest lane cannot detect Homebrew/OrbStack Docker, so its exact build, mounted-volume UID, non-root process, Node version, and `node:sqlite` checks were executed directly.

Audit passed with warnings — 0 feature-blocking errors. Config sync, Knip,
domain-doc reconciliation, and dependency-cruiser are clean across 713 modules
and 2,364 dependencies. Configured documentation sources (`README.md` and
`packages/website/src/content/docs`) and the architecture narrative show no
feature drift. The stable repository-minus-generated-trees scope reports 554
clones (8.46%). `@openai/codex` has a low-risk dev-only minor update
(0.145.0 → 0.146.0) deferred as unrelated scope; the production dependency
audit reports no vulnerabilities.

## Evidence

- The generated verification plan passed the complete relay and CLI test suites:
  165 relay tests and 5,726 CLI tests, with six intentional skips.
- The aggregate acceptance lane passed 616 scenarios with three intentional
  skips. Its four setup-only shared-lock timeouts then passed 4/4 scenarios and
  130/130 steps in clean isolation.
- `bun run lint`, the full formatter, config sync, Knip, and dependency-cruiser passed.
- The production image built from pinned Debian and official checksum-verified
  Node 24.18.1 artifacts. Its entrypoint repaired a mounted `/data` directory,
  dropped to UID 1000, and executed `node:sqlite`.
- The six-surface environment-driven HTTPS collaborator path and built
  `dist/main.js` process both passed through real configuration, authentication,
  SQLite, and local GitHub HTTP boundaries.
- Raw GitHub REST bodies remain the only marker authority. Sanitized MCP reads are not used for duplicate decisions.
- GitHub issue 834 remains open and is not superseded.
- GitHub issue 1495 is not a readiness gate because this slice does not reuse its client credential helpers.
- GitHub issues 1474 and 1481 are now closed on main. Checked-in relay readiness remains disabled because the required fresh post-fix measurement artifacts and evidence review have not landed.

## 2026-07-29 fifth-round comment resolution

- The only new PR feedback was `issuecomment-5123953571`; a final pre-push
  sweep found no later conversation, review, or inline comments.
- Invalid explicit relay configuration now fails visibly through the real
  command before extraction or native filing. One coordinated persistence
  snapshot indexes reserved states and discard intents, aggregate payload reads
  stay capped at 64, and the 50-finding/500-backlog regression stays within its
  latency budget.
- Recovery removes only stale relay-owned atomic temporaries. Cleanup after a
  durable target link is best-effort, cross-directory renames synchronize both
  directory entries, filesystem root is rejected as an outbox, and a concurrent
  hard-link loser synchronizes the winning directory entry before accepting it.
- Real filesystem fault injection covers stale-intent cancellation, snapshot
  failure settlement, temporary cleanup failure, rearm ownership loss, injected
  rearm faults, and concurrent durable-link publication.
- `NEW-1`, `NEW-2`, and `NEW-3` remain declined under the canonical contract:
  durable acceptance transfers ownership; ambiguous 403/422 outcomes retain
  status-only deadline recovery; 409 payload conflict rolls back correctly.
  Semantic identity drift remains explicitly out of scope.
- Raw REST bodies remain marker authority, sanitized MCP reads never decide
  duplicates, issue 834 is not superseded, and issue 1495 is a readiness gate
  only if client credential helpers are reused.
- After merging current `main`, lint, formatting, build, typecheck, config sync,
  Knip, dependency boundaries, focused fault tests, 165 relay tests, and 5,726
  CLI tests passed. Four aggregate Gherkin setup timeouts caused only by another
  worktree's global test lock passed 4/4 (130/130 steps) immediately in clean
  isolation.
- Fresh independent quality review approved the final candidate with no
  critical, important, or suggested improvements.

## 2026-07-29 final independent-review remediation

- Semantic readiness now parses versioned, nonempty measurement artifacts and
  rejects empty samples or evidence for the wrong metric.
- Every harness uses one configured outbox that must physically resolve outside
  the disposable project. Built retry/list/discard coverage destroys the project
  before continuing from that external store.
- File publication, replacement, acknowledgement, and newly created directory
  hierarchy entries are explicitly synchronized. Fault injection proves failed
  directory sync does not report durable success, and successful hierarchy sync
  caching is invalidated when a path is recreated.
- GitHub create classification uses documented status and header signals only;
  response prose is not an authority. Raw REST bodies remain the sole duplicate
  marker authority, and sanitized MCP reads never participate.
- The runtime floor and CI matrix use the July 2026 security releases:
  22.23.2, 24.18.1, and 26.5.1+. The production image verifies official Node
  archive checksums and recreates the non-root `node` identity expected by its
  entrypoint.
- Full lint/typecheck, relay and CLI suites, full acceptance, production
  container qualification, production dependency audit, and repository audit
  passed on the final implementation.
- A final fresh independent review caught and drove two last fail-safe changes:
  the default drain again has a 500 ms request deadline plus only 250 ms of
  aggregate headroom, and every GitHub 422 remains retryable because the
  documented status conflates validation with temporary spam throttling.
  Multi-draft blackhole and prose-independent 422 tests pass; the fresh
  re-review approved `ec32ac2fc` with no critical issues or suggested
  improvements.

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
