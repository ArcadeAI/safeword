# Impl Plan: Environment-portable tracker transport

**Status:** planned

## Approach

**Riskiest assumption:** that a network-free `computePlan` can be factored out of the existing
`syncTracker`/`projectOne` orchestration — reusing `planTicketSync` (create/update/close decision),
`buildPayload` (ticket→minimal issue payload), and `buildGraphProjection` (parent/blocked-by edges)
— **without changing the `gh` path's behavior**. Cheapest proof: the load-bearing slice
_"A never-synced ticket becomes a create intent"_ — if the factoring is wrong (e.g. the plan and the
gh path diverge on what gets created), it fails on slice 1 while it's cheap.

**Proof plan** (per `testing/SKILL.md` highest-practical-scope; no live tracker per #363):

| Scenario group | Primary proof | Why |
| --- | --- | --- |
| Plan intents: create / update / close / empty-corpus | **unit** over `computePlan` | pure over corpus + map; deterministic |
| Graph edges: parent / blocked-by set / both / dangling-dropped | **unit** over `computePlan` (reuses `buildGraphProjection`) | pure; combinatorial → focused units |
| Offline (spy resolver + client, assert never called) | **unit** with injected spies | proves the seam is not touched |
| Apply-results: record / idempotent / update-close ack | **unit** over `applyResults` (pure over `TrackerMap`) | folding logic is pure |
| Malformed outline (6 defects) + round-trip | **unit** over `parseResults` + `applyResults` | validation + fold, no I/O beyond a temp file |
| Command wiring: `--plan`→stdout JSON, no-flag routes to gh, mutually-exclusive | **integration (wiring)** through `syncTrackerCommand` | the required wiring test per new entry point — real command, capture stdout, mock only fs/process boundary |
| Egress: minimal body / no credential in plan | **unit** over `computePlan` + plan serialization | payload allow-list already tested in `payload.ts`; assert here it carries through |

**Build order** (load-bearing first, each builds on green):

1. `contract.ts` — `SyncPlan` / `Intent` / `SyncResults` types + `parseResults()` validator (discriminated-union result mirroring `loadTrackerMap`). _Foundation._
2. `plan.ts` — `computePlan(deps): SyncPlan`, **create intent first** (the load-bearing slice), then update/close, then empty-corpus.
3. Graph edges in `computePlan` — reuse `buildGraphProjection`, express edges by ticket id; dangling → dropped selectively.
4. Offline guarantee — inject spy credential-resolver/client that throw if called.
5. `apply-results.ts` — `applyResults(map, results)` via `TrackerMap.record` (records `recorded` directly; no `pending`), idempotency, update/close ack.
6. Malformed rejection (incl. `url` tail ≠ `number` and unsupported version) + planned-create round-trip.
7. Wire `--plan` / `--apply-results` into `commands/sync-tracker.ts` + `cli.ts` — branch **before** `buildWriterRegistry`; `--plan` writes JSON to stdout only; no-flag routes to the gh path; the two flags are mutually exclusive. _Wiring tests here._
8. Egress guards — minimal body carries through; no credential in the emitted plan.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Plan computation | Factor `computePlan` reusing `planTicketSync` + `buildPayload` + `buildGraphProjection` | Reimplement the diff in a new module | Divergence from the gh path is exactly the bug class this feature must avoid |
| Shared helpers | Extract `orderTicketsForProjection` / `buildGraphProjection` (today private in `index.ts`) into a shared module both paths import | Duplicate them into `plan.ts` | Duplication re-opens the drift risk |
| Edge reference | By **ticket id**, resolved to number by the executor create-then-link | By issue number in the plan | A new issue's number is unknown until it is created |
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

The `url`-tail==`number` consistency check is deliberately structure-dependent: a future GitHub URL
change would fail every apply **loudly** rather than silently corrupt the map — the acceptable
failure mode, with `number` remaining authoritative. Not a deviation from guidance so much as a
documented, eyes-open choice.

## Doc impact

`packages/website/src/content/docs/reference/tracker-integration.mdx` gains a short "portable
executor (`--plan` / `--apply-results`)" section once the flags land — folded into the build order as
a final task (customer-visible). No other configured `docs.sources` surface is touched.

## Assessment triggers

Revisit these choices when: a second executor lands (token+REST CI, the "bot" co-executor) and wants
to share the contract; Linear projection is wired; GitHub changes the issue `number`/`id`/url
structure; or graph-edge semantics (sub-issue vs blocked-by) change upstream.
