# Impl Plan: Retry-safe retro relay foundation

**Status:** planned

## Approach

**Riskiest assumption:** two independent SQLite connections can atomically
elect one creator while the public HTTP clients converge on one receipt.
Cheapest proof: the delayed concurrent-first-attempt scenario through a real
server and file database, with only GitHub HTTP mocked.

| Build order | Deliverable | Primary proof |
| --- | --- | --- |
| 0 | Disposable runtime qualification: clean workspace install, native `better-sqlite3` load on the supported Node 24 LTS image, WAL migration/reopen, package build/start, exclusive process lock with stale-lock recovery | Qualification test and recorded fallback to PostgreSQL if any check fails |
| 1 | First scenario RED through the real HTTP fixture; minimum request validation/hash, SQLite store, auth registry, server/client, and named adapters | Cross-adapter Cucumber + Vitest wiring proof |
| 2 | Mismatch scenario outline | Unit hash partitions plus public-route 409 proof |
| 3 | Concurrent-first RED; minimum CAS election and bounded receipt polling | Two independent DB connections, no transaction held over delayed GitHub I/O, both clients return one issue |
| 4 | Response-loss and crash-window REDs; service-open `claimed`/`dispatching` recovery | Fresh store/service instance after post-create/pre-receipt fault; filed receipt before lost HTTP response |
| 5 | Real admin reconcile route and raw REST evidence reservation | Public admin route; paginated 0/1/2/partial/conflicting raw fixtures, PR filtering, MCP fixture ignored |
| 6 | Repository authz and credential-safety scenarios | Submit/status/reconcile authz matrix; zero DB/token access before authz; DB/log/error/metric secret absence |
| 7 | Root workspace verification wiring, package README, and architecture record | Full test/build/lint/typecheck plan |

Fault hooks exist only at named external boundaries: before durable acceptance,
before dispatch-state commit, after GitHub response/before receipt commit, and
after receipt commit/before HTTP response. Tests reopen the file database with
a fresh service instance; connection-level concurrency ensures the event loop
cannot make the CAS proof vacuous.

Every scenario—and every behaviorally distinct Scenario Outline example—runs
its own RED → GREEN → REFACTOR loop before the next example is enabled. A row
only groups the resulting ordered loops; it cannot batch REDs or let a later
example pass accidentally. The Vitest integration is the fast RED and the thin
Cucumber step is enabled in that same loop before GREEN is recorded.
Production process-kill qualification remains a deployment gate; this slice
proves durable reopen at every persisted boundary and leaves #1479 open for
rollout evidence.

## Decisions

| Decision | Choice | Alternatives | Why |
| --- | --- | --- | --- |
| Package/runtime | separate `packages/retro-relay`, Node 24.18.0 production image | CLI `src/retro`; Bun-only daemon | keeps a credential-bearing service out of the published CLI and tests the declared Node baseline |
| SQLite driver | `better-sqlite3` 13.0.1 | experimental `node:sqlite`; PostgreSQL now | current release supports Node >=22; smallest durable slice; store interface preserves migration |
| Topology | one active process/host with process lock | multi-process/multi-host | WAL is same-host and single-writer; multi-host triggers PostgreSQL |
| Convergence | POST receipt + client status polling | return `creating`; in-memory waiter | every caller can receive the same filed receipt across processes/restarts |
| Dispatch boundary | `claimed` then durable `dispatching` | one `creating` state | separates confirmed pre-dispatch retry from downstream uncertainty |
| Identity | tenant+installation+repo+requestId | harness or semantic identity | proves cross-harness retry; semantic keys remain migration evidence |
| Marker authority | complete raw REST only | MCP/search/rendered bodies | current connector sanitization is not a stable API contract |
| Auth | versioned high-entropy relay credential + tenant/repo ACL | client GitHub token | universal harness support without upstream credentials in clients |

Sources:

- better-sqlite3 Node support/API: https://github.com/WiseLibs/better-sqlite3
- SQLite WAL limits: https://sqlite.org/wal.html
- SQLite uniqueness behavior: https://sqlite.org/lang_conflict.html
- GitHub raw issue bodies: https://docs.github.com/en/rest/issues/issues
- GitHub App installation token narrowing/expiry:
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app

## Arch alignment

The root architecture currently documents Bun CLI/website packages and retro
under the CLI. This is a deliberate new service package, so implementation must
update the monorepo, dependency, build, and key-decisions sections rather than
claiming existing alignment. It preserves pure injected collaborators and keeps
CLI template schema untouched.

## Known deviations

- Single-host availability is narrower than the destination service. It is
  explicit, process-locked, and blocked from multi-host rollout.
- Named adapters prove the contract but are not yet installed production
  routing. #1479 remains open.

## Doc impact

skip: no customer command or deployed endpoint ships in this slice; update
`ARCHITECTURE.md` and package README only.

## Assessment triggers

- Any production multi-host plan requires PostgreSQL before rollout.
- Any internal-seam-only test fails the wiring gate; public HTTP + real store is
  required.
- Any shared client credential helper makes #1495 a readiness dependency.
- Any marker path other than complete raw REST requires contract re-review.
