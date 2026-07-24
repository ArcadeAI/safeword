# Impl Plan: Environment-portable tracker transport

**Status:** planned

## Approach

**Riskiest assumption:** that `computePlan` can build **plan-side graph edges by corpus membership**
(via `aliasMap` + `resolveTicketReference`) and **fold reconcile/close** correctly on top of
`planTicketSync`. Reusing `planTicketSync` + `buildPayload` for the plain create/update decision is
near-zero-risk — they are already pure and already called by `projectOne` (`index.ts:202-203`). The
load-bearing risk is the graph path, because the existing `buildGraphProjection` is the
**executor-side** resolver (it maps only *already-recorded* prerequisites to issue numbers) and is
the wrong tool plan-side. Cheapest proof: the load-bearing slice _"a ticket whose parent is an
**unrecorded** corpus ticket still carries the parent edge"_ — if `buildGraphProjection` were
(wrongly) reused, this fails immediately, on the first graph slice, while it is cheap.

**The kind fold** (`computePlan` layers over `planTicketSync = create | update | reconcile`):
`create → create` (payload state open/closed); `update` + open `→ update`; `update` + closed
`→ close`; `reconcile` (a `pending` entry, only the `gh` path writes it) `→ update` carrying the
existing ref. Close is derived from `buildPayload`'s `state`, not a `planTicketSync` kind.

**Proof plan** (per `testing/SKILL.md` highest-practical-scope; no live tracker per #363):

| Scenario group | Primary proof | Why |
| --- | --- | --- |
| Plan intents: create / update / close / empty-corpus | **unit** over `computePlan` | pure over corpus + map; deterministic |
| Graph edges: parent / blocked-by set / both / dangling-dropped | **unit** over `computePlan` (new corpus-membership projection via `aliasMap`+`resolveTicketReference`) | pure; combinatorial → focused units |
| Offline (spy resolver + client, assert never called) | **unit** with injected spies | proves the seam is not touched |
| Apply-results: record / idempotent / update-close ack | **unit** over `applyResults` (pure over `TrackerMap`) | folding logic is pure |
| Malformed outline (7 defects, incl. missing-`url`) + round-trip | **unit** over `parseResults` + `applyResults` | validation + fold, no I/O beyond a temp file |
| Command wiring: `--plan`→stdout JSON; `--apply-results <file>` read→apply→**save**; no-flag routes to gh; mutually-exclusive | **integration (wiring)** through `syncTrackerCommand` | required wiring test per new entry point — real command; `--plan` captures stdout, `--apply-results` asserts the on-disk sidecar changed; mock only the fs/process boundary |
| Egress: minimal body / no credential in plan | **unit** over `computePlan` + plan serialization | payload allow-list already tested in `payload.ts`; assert here it carries through |

**Build order** (load-bearing first, each builds on green):

1. `contract.ts` — `SyncPlan` / `Intent` / `SyncResults` types + `parseResults()` validator (discriminated-union result mirroring `loadTrackerMap`). _Foundation._
2. `plan.ts` — `computePlan(deps): SyncPlan`, create intent (foundation — every edge attaches to an
   intent, so this must exist first), then the update/close/reconcile fold, then empty-corpus.
3. **Graph edges (the risk-bearing slice — sequenced as early as the intent dependency allows):** a
   new corpus-membership projection (`aliasMap` + `resolveTicketReference`, filtered to `byId`
   membership) emitting `{ parentTicketId?, blockedByTicketIds? }`; dangling edges dropped
   selectively. Extract `aliasMap`/`resolveTicketReference`/`orderTicketsForProjection` into a shared
   module; **leave `buildGraphProjection` on the `gh` path untouched**.
4. Offline guarantee — inject spy credential-resolver/client that throw if called.
5. `apply-results.ts` — `applyResults(map, results)` via `TrackerMap.record` (records `recorded` directly; no `pending`), idempotency, update/close ack.
6. Malformed rejection (incl. `url` tail ≠ `number` and unsupported version) + planned-create round-trip.
7. Wire `--plan` / `--apply-results` into `commands/sync-tracker.ts` + `cli.ts` — branch **before** `buildWriterRegistry`; `--plan` writes JSON to stdout only; no-flag routes to the gh path; the two flags are mutually exclusive. _Wiring tests here._
8. Egress guards — minimal body carries through; no credential in the emitted plan.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Plan computation | Factor `computePlan` reusing `planTicketSync` + `buildPayload`; fold close/reconcile on top; compute edges plan-side by corpus membership | Reimplement the diff; reuse `buildGraphProjection` for edges | Divergence from the gh path is the bug class to avoid; `buildGraphProjection` resolves only *recorded* prereqs to numbers → wrong plan-side |
| Kind fold | close derived from payload `state`; reconcile → `update` carrying the ref | Add `reconcile`/`close` as `planTicketSync` kinds | Keeps the contract's three intents; close/reconcile are derivations, not new SyncActions |
| Shared helpers | Extract `aliasMap` / `resolveTicketReference` / `orderTicketsForProjection` (private in `index.ts`) into a shared module both paths import; leave `buildGraphProjection` on the gh path | Duplicate them into `plan.ts`; move `buildGraphProjection` too | Duplication re-opens drift; `buildGraphProjection` is executor-side, not shared |
| Edge reference | By **ticket id** (corpus membership), resolved to number by the executor create-then-link | By issue number in the plan | A new issue's number is unknown until it is created |
| Results `number` type | string (e.g. `"549"`) | JSON number | `TrackerReference.id` is a string and the gh path records `"549"`; a number would break idempotency + byte-for-byte parity |
| Contract shape | Separate versioned `SyncPlan` and `SyncResults` schemas | One combined annotated-intents doc | Clean plan↔executor boundary; results are the executor's product |
| Identity capture | `number` authoritative (from API `number` field); `url`-tail==`number` a fail-loud cross-check | Parse the html_url for the number | GitHub best practice: read `number`, don't parse the URL (verified 2026-07-24) |
| `--plan` sink | stdout | a `--out <file>` flag | Unix-composable (`--plan \| executor`); a file is `> plan.json` away |
| Apply status | `record` as `recorded` directly | mark `pending` then promote | No crash-mid-network window in apply — the network already happened in the executor |

## Arch alignment

Honors the **tracker-sync one-way-projection boundary** (ARCHITECTURE.md → "tracker-sync/ — One-way
projection of the ticket corpus into the configured tracker"): the plan/executor seam keeps
projection strictly outward and adds no inward path. Honors the **offline-first invariant** — gates
and now `--plan`/`--apply-results` touch no network.

**ADR candidate (flagging, not blocking):** the versioned `SyncPlan`/`SyncResults` JSON is an
explicit **one-way-door public contract**, which meets the ADR bar ("difficult to reverse"). Recommend
drafting the first repo ADR for it (`ARCHITECTURE.md` has a Key Decisions section but no ADR dir yet).
Offered to the user at the plan-exit.

## Known deviations

None. (The one eyes-open choice — the structure-dependent `url`-tail cross-check — is recorded in the
Decisions table's identity-capture row and `spec.md`; not repeated here.)

## Doc impact

`packages/website/src/content/docs/reference/tracker-integration.mdx` gains a short "portable
executor (`--plan` / `--apply-results`)" section once the flags land — folded into the build order as
a final task (customer-visible). No other configured `docs.sources` surface is touched.

## Assessment triggers

Revisit these choices when: a second executor lands (token+REST CI, the "bot" co-executor) and wants
to share the contract; Linear projection is wired; GitHub changes the issue `number`/`id`/url
structure; or graph-edge semantics (sub-issue vs blocked-by) change upstream.
