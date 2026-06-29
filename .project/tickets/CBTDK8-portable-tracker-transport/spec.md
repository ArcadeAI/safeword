# Spec: Environment-portable tracker transport (plan + pluggable executor)

## Intent

Make `sync-tracker` work in any environment by computing a network-free sync **plan** (the
create/update/close intents from local tickets vs the tracker-map) and letting a pluggable
**executor** apply it through whatever GitHub access the environment has — instead of hard-wiring
the `gh` binary, which is dead anywhere `gh` is absent.

## Intake Brief

- **Requested by:** alex@arcade.dev — surfaced from a live-fire investigation this session (the
  question "have you live-fired it?" exposed that `sync-tracker` is `gh`-or-death).
- **Cost of inaction:** `sync-tracker` reaches GitHub only by shelling out to `gh`
  (`packages/cli/src/tracker-sync/clients.ts`). Anywhere `gh` is absent — an agent session, a
  token-only CI runner, this very container (which has `GITHUB_TOKEN` but no `gh`) — the mirror is
  silently dead or fails with a confusing `ENOENT`. The KKNFZA promise ("status visible in the
  tracker without running safeword") never materializes for those users, and safeword stays on the
  treadmill of owning every transport forever.
- **Reversibility:** The new `--plan` / `--apply-results` flags are a two-way door (additive,
  opt-in, removable). The **intent JSON schema** they expose is a one-way door once executors
  depend on it — treat the schema as a public contract and design it deliberately.

## References

- Epic **KKNFZA** (offboard-local-ticketing); sibling **DGH59K** (tracker identity + join, the
  tracker-map sidecar this builds on); existing `sync-tracker` (JS5K5G) and its `gh` client.
- Decided via `/figure-it-out` this session; de-risked by a live-fire MCP spike (issue #549).

## Personas

- **Technical Builder (TB)** — runs safeword on a real project across CI, agent sessions, and a dev
  laptop; wants the mirror to work regardless of which GitHub access that environment has.
- **Safeword Maintainer (SM)** — builds the integration; wants to add transports without rewriting
  the diff logic.

## Vocabulary

- **Plan** — the deterministic set of create/update/close **intents** computed offline from local
  tickets diffed against the tracker-map. Network-free.
- **Executor** — whatever applies a plan against the real tracker: an agent via MCP, CI via
  token+REST, a dev via `gh`. Swappable; the plan does not know which one ran.
- **Intent** — one create/update/close operation in the plan, with its minimal-egress payload.

## Jobs To Be Done

### portable-tracker-transport.TB1 — Keep the mirror working without `gh`

**Persona:** Technical Builder (TB)

> When I run safeword in an environment that has no `gh` binary (an agent session, a token-only
> runner), I want my tickets to still mirror to the tracker through whatever GitHub access that
> environment does have, so the mirror isn't dead just because `gh` isn't installed.

#### portable-tracker-transport.TB1.AC1 — `sync-tracker --plan` emits the sync intents offline

The command computes the deterministic set of create/update/close intents (local tickets diffed
against the tracker-map) and emits them as JSON. It performs **no network I/O** — pure over the
tickets dir + the sidecar — so it runs anywhere and is fully unit-testable without a live tracker.

#### portable-tracker-transport.TB1.AC2 — executor results fold back into the tracker-map idempotently

`sync-tracker --apply-results <file>` takes an executor's results and records each into the
tracker-map, keyed per ticket id, storing the **bare issue number** (e.g. `549`) and url — never
the executor's internal object id. Applying the same results twice is a no-op; the sidecar stays
the single source of dedup.

#### portable-tracker-transport.TB1.AC3 — the `gh` path still works, unchanged, as the default executor

Where `gh` is present, today's behavior is preserved exactly (zero regression); headless CI that
relies on the `gh` executor stays green. The plan/apply seam is **additive**, not a replacement.

#### portable-tracker-transport.TB1.AC4 — secrets and egress discipline are preserved end to end

Plan and apply never read a credential from config, never embed a secret in the emitted intent
JSON, and honor `body: minimal` by default (title/status/labels/back-link only — never the spec or
work-log).

### portable-tracker-transport.SM1 — Add a transport without rewriting the diff

**Persona:** Safeword Maintainer (SM)

> When a new tracker or access channel appears, I want to plug an executor in against a stable,
> documented plan contract, so I implement only the I/O and never re-derive the create/update/close
> diff logic per transport.

#### portable-tracker-transport.SM1.AC1 — the plan is a documented, validated contract independent of any transport

The intent JSON has a declared shape that `--plan` produces and `--apply-results` consumes, and it
round-trips (plan → results → map) with no transport present — so an executor can be written against
the contract alone, and a malformed results file is rejected with an actionable error rather than
silently corrupting the map.

## Contract & design decisions (resolved from the cold-start check)

The cold-start check confirmed the mechanism is ready to reuse — `planTicketSync` (`tracker-map.ts`)
and `buildPayload` (`payload.ts`) already compute the create/update/close decision offline, and
`TrackerMap.record()` already stores `{ provider, id, url }` keyed per ticket — and flagged that the
**JSON contract** and its edge semantics were undefined. Pinned here (the schema is the one-way door):

### The JSON contract (versioned from day one)

- `sync-tracker --plan` writes a **SyncPlan** to **stdout** (Unix-composable; pipe to a file or an
  executor): `{ "version": 1, "intents": Intent[] }`.
- `Intent` is discriminated on `kind`:
  - `create` → `{ kind, ticketId, payload: { title, body, labels, state } }`
  - `update` → `{ kind, ticketId, ref: { provider, number, url }, payload }`
  - `close` → `{ kind, ticketId, ref: { provider, number, url }, stateReason? }`
  - each MAY carry `graph?: { parentNumber?, blockedByNumbers? }` — see the open fork below.
- The executor produces a separate **SyncResults**: `{ "version": 1, "results": [{ ticketId,
  number, url, status }] }`.
- `sync-tracker --apply-results <file>` reads SyncResults from a path and folds each **create**
  result into the map via `record()` as `recorded` (no `pending` — the network already happened in
  the executor), storing `ref = { provider, id: number, url }`.

### Decisions

- **Plan and apply are offline** — neither resolves a credential (TB1.AC4); the credential gate
  stays on the live executor path only.
- **`--plan` and `--apply-results` are mutually exclusive**; no flag = today's `gh` path,
  byte-for-byte (TB1.AC3).
- **Internal-id trap guard (sharp catch):** a bare-digits check alone *cannot* catch the spike's
  internal id `4764539863` — it's also numeric. So results carry both `number` and `url`, and
  `--apply-results` **rejects a result whose `url` path tail ≠ `number`**. The issue url is
  `.../issues/549`, so a mistaken internal id fails the tail check structurally.
- **Malformed** = invalid JSON / missing `ticketId`|`number` / `ticketId` not in the corpus /
  `url` tail ≠ `number` → rejected with an actionable error, the map left untouched.
- **Results scope:** required for `create` intents (they mint identity); `update`/`close` act on a
  ref already in the map, so their results are acks (optional) and fold to no map change.
- **Versioning:** the contract `version` is independent of the sidecar `SIDECAR_VERSION`
  (`--apply-results` does not change the map's on-disk format).

## Rave Moment

skip: child of epic KKNFZA (inherits its rave moment); this slice is internal transport plumbing.

## Outcomes

- `sync-tracker --plan` produces the same create/update/close set the `gh` path would act on, with
  zero network calls — verifiable offline.
- An executor with no `gh` (an agent via MCP today) can apply that plan and feed results back, and
  the tracker-map ends in the same state the `gh` path would have produced.
- Re-running `--apply-results` with the same results changes nothing (idempotent).
- The `gh` executor path is byte-for-byte unchanged; the full suite stays green with no live tracker.

## Open Questions

- **Graph edges in executor #1 (the one real fork from the cold-start check).** The `gh` path
  projects parent + blocked-by edges via a separate `projectGraph` step. Does the *agent* executor
  in this slice have to reproduce those edges, or is core create/update/close enough for now? The
  contract carries `graph?` on each intent either way (forward-compatible, protects the one-way
  door); the question is only whether *applying* edges is in this ticket's done-when.
  _Proposed: carry edges in the contract, defer their **execution** to a follow-on; core CRUD is
  the slice. Awaiting signoff at the scope gate._
- _(10 other cold-start gaps resolved — see "Contract & design decisions" above.)_

## Notes / evidence

- Live-fire spike (this session) proved the agent-as-executor path end-to-end: created and closed
  real issue **#549** in `ArcadeAI/safeword` via the GitHub MCP server with **no `gh` binary**. The
  returned ref shape (`number: "549"`, url tail == number) matches what the tracker-map records
  from the `gh` path, so the map is executor-agnostic.
- Spike finding to honor in TB1.AC2: the MCP create response's `id` (`4764539863`) is GitHub's
  internal database id, **not** the issue number — capture `number`, never the create `id`.
- Deferred to follow-on children (out of scope here): the **token+REST CI executor**, a packaged
  **agent-executor** automation, the **Linear** executor, and **label-rejection** hardening.
