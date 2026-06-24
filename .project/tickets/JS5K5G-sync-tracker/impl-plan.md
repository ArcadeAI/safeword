# Impl Plan: safeword sync-tracker — one-way projection (v1)

**Status:** implemented

<!--
Reconciliation (implement-phase exit): shipped as planned. The tracker-sync
module, all-unit test layers, and the 6-step bottom-up build order held exactly
(payload f4c50ee · tracker-map 827655a · secrets+backoff fafa40d · writers
1e86033 · orchestrator 6412112 · CLI wiring 1328141). All six Decisions held.
Two reconciliation notes:
  - Arch alignment "minimize deps" held strongly: the live GitHub adapter shells
    out to `gh` (zero new runtime deps) rather than adding an SDK; no new
    template/managed file was added, so the schema.ts "no unregistered
    templates" contract needed no entry (the ticketBridge block is read-only
    here; its WRITE/template is 2TK5AD's).
  - The missing-sidecar decision shipped as the "require --reset-tracker-map"
    branch (the simpler of the two pre-approved options); back-link reconcile was
    not built (would need a tracker list API, out of v1 scope).
See "Known deviations" for the Linear live-client deferral.
-->

## Approach

A new `packages/cli/src/tracker-sync/` module (mirrors the existing
`ticket-sync/`), plus a thin `commands/sync-tracker.ts` wrapper wired in
`cli.ts`. Every scenario is **unit**-testable against pure functions + injected
fakes — done-when forbids a live tracker, so the writers take an injected client
and the backoff takes an injected timer. The command wrapper gets one thin smoke
test (the `provider: none` no-op) as the closest thing to an integration check.

Module layout and ownership:

| File                                                  | Owns (ACs)                                                                                                                                                    | Test layer              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `tracker-sync/types.ts`                               | `IssuePayload`, `TrackerRef`, `TrackerWriter`                                                                                                                 | (types only)            |
| `tracker-sync/payload.ts`                             | ticket → flat payload; minimal body (AC3, AC10)                                                                                                               | unit (pure)             |
| `tracker-sync/tracker-map.ts`                         | sidecar read/write/reconcile; pending; missing/corrupt (AC5, AC6, AC8, AC9)                                                                                   | unit (fs in tmpdir)     |
| `tracker-sync/secrets.ts`                             | keychain/env resolution, never config/log (AC11)                                                                                                              | unit                    |
| `tracker-sync/backoff.ts`                             | rate-limit retry w/ injected timer (AC13)                                                                                                                     | unit (fake timer)       |
| `tracker-sync/writers/linear.ts`, `writers/github.ts` | create/update, field-ownership, close-on-terminal (AC4, AC7)                                                                                                  | unit (mocked client)    |
| `tracker-sync/index.ts`                               | `projectTicket(payload, provider, deps)` call site + corpus orchestration: no-op (AC1), fail-loud (AC2), egress warning (AC10-public), CI-auth warning (AC12) | unit                    |
| `commands/sync-tracker.ts`                            | commander action → orchestrator                                                                                                                               | unit smoke (none no-op) |

Build order (each step builds on what's already green):

1. `types.ts` + `payload.ts` — pure mapping, no deps (AC3, AC10 default body).
2. `tracker-map.ts` — sidecar lifecycle (AC5 record, AC6 lookup, AC8 pending-resume, AC9 missing/corrupt refuse).
3. `secrets.ts` + `backoff.ts` — independent utilities (AC11, AC13).
4. `writers/` + the `TrackerWriter` interface — routing + field ownership against mocked clients (AC4, AC7).
5. `index.ts` orchestrator — wires the above; no-op / fail-loud / egress / CI-auth (AC1, AC2, AC10-public, AC12).
6. `commands/sync-tracker.ts` + `cli.ts` wiring + the `ticketBridge` config block (default `provider: none`, `body: minimal`).

## Decisions

| Decision                   | Choice                                                                                                               | Alternatives considered                           | Rejected because                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Provider seam              | Two concrete writers behind one `projectTicket` call site + a `TrackerWriter` interface, injected client             | Pluggable adapter framework / dynamic loading     | Rule of three — two providers don't earn a framework (ticket decision; Metz "wrong abstraction")                          |
| Idempotency store          | Sidecar `.safeword/tracker-map.json`                                                                                 | ticket frontmatter; query the tracker each run    | frontmatter pollutes the canonical files; per-run query puts the network in the loop + needs a list API                   |
| Missing vs corrupt sidecar | connect seeds an empty sidecar → present+empty = first run (create), absent/corrupt = refuse + `--reset-tracker-map` | back-link reconcile scan; blind-create on missing | reconcile needs a list API (out of v1's stable create/update scope); blind-create reintroduces the mass-duplicate footgun |
| Secret storage             | keychain/env resolver, never read from config                                                                        | token in `.safeword/config.json`                  | secret-leak / egress (verified best practice; done-when)                                                                  |
| Backoff timing             | injected fake timer in tests                                                                                         | real `sleep`                                      | deterministic, no flake (testing iron law: no arbitrary timeouts)                                                         |
| Body default               | `minimal`                                                                                                            | `full`                                            | fail-safe egress default (Saltzer & Schroeder; ticket decision)                                                           |

The empty-sidecar seeding is a contract on the sibling connect/setup ticket
(2TK5AD); JS5K5G consumes it and additionally defends by treating "absent on a
configured project" as refuse rather than create.

## Arch alignment

ARCHITECTURE.md is a single record (no ADR directory). This implementation honors:

- **CLI Structure** — `commands/` + lazy `import()` wiring in `cli.ts`; `sync-tracker` follows the existing command shape (setup/check/diff/…).
- **Dependencies (Runtime) — minimize new deps** — the sidecar is plain JSON (native), payload/frontmatter reading reuses existing parsers; no new runtime dependency for the core. (A keychain accessor, if added, is the one candidate — see Decisions/secrets.)
- **Reconciliation Engine / `schema.ts` single source** — the `ticketBridge` config block and any new managed/template file register through `schema.ts` (the "no unregistered templates" contract).
- **Off the per-turn loop** (Key Decisions / the seam) — projection is a command, never a hook; network stays out of the execution loop.

## Known deviations

Outbound network in a command is consistent with the "off the per-turn loop"
decision (not a deviation). The cross-ticket dependency on 2TK5AD seeding the
sidecar is implemented defensively (absent-on-configured → refuse), so JS5K5G is
correct even if run before connect seeds the file.

**Shipped deviation — Linear live client deferred to 2TK5AD.** The done-when says
"both Linear and GitHub writers ship." Both _writer logics_ ship and are
unit-tested over the `TrackerClient` port (writers.test.ts). GitHub's live client
is wired (`gh` subprocess); Linear's live client needs the Arcade integration,
whose auth/setup is owned by the connect-flow ticket (2TK5AD), so it surfaces an
actionable error pending that work rather than adding an Arcade SDK dependency
unilaterally here. Acceptable because: (a) the seam is proven for both providers,
(b) the deferred piece is a pure I/O shim with a clear owner, (c) no live tracker
is exercised in tests by design. Tracked as a follow-up against 2TK5AD.

## Assessment triggers

- **Provider #3** (e.g. Jira) — extract the `TrackerWriter` interface + a capabilities descriptor from the concrete writers (the proto-contract becomes a real one); widen `body` markdown → ADF.
- **The v2 graph projection (M1FGRJ)** — sub-issues / relations / issue-types / topo-sort need newer APIs; GitHub routes natively (gh), not Arcade.
- **A real need for back-link reconcile** — would add a tracker list API and change the missing-sidecar decision from "refuse" to "reconcile."
- **CI service identity** — if the `Arcade-User-ID` user-identity caveat (AC12) becomes a hard blocker, promote from warning to a dedicated service-account path.
