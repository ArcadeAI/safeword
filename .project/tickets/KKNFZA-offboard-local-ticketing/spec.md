# Spec: Off-board local ticketing: external tracker as system of record, local plane as ephemeral cache

## Intent

Make the customer's external tracker (GitHub Issues or Linear) the system of record for ticket
identity and status, and demote safeword's local `.project/tickets/` plane to a git-ignored,
ephemeral execution cache — so safeword stops churning ticket bookkeeping into the customer's
repo while its gates keep reading local files (network never enters the per-turn loop).

## Intake Brief

- **Requested by:** alex (product owner) — "the local ticketing system is causing a lot of
  problems… minimize ticket churn in customer projects and dogfood."
- **Cost of inaction:** every session writes lifecycle into the customer repo —
  `updateTicketStatus()` rewriting `status`/`phase`/`last_modified` each Stop,
  `INDEX.md`/`INDEX-completed.md` regenerating on every change, a folder per task (347 already in
  this repo). Two systems of record; a git history dominated by safeword's bookkeeping; adoption
  friction for the product and noise in dogfood.
- **Reversibility:** two-way door. We invert an existing one-way bridge (`tracker-sync`,
  `tracker-connect`) rather than build new infrastructure — `external_issue` frontmatter,
  `.safeword/tracker-map.json`, and close-on-terminal already exist. Back-compat keeps existing
  local tickets readable; `provider: none` installs are untouched; a `persistArtifacts` hatch
  restores committed specs. The one cross-cutting edge is flipping which plane is canonical —
  contained by keeping the change opt-in (only when a tracker is connected).

## References

- `/figure-it-out` decision (this session) — coordination plane off-boards, execution plane
  stays local-but-ephemeral.
- `.project/tickets/JS5K5G-sync-tracker/spec.md` — the one-way projection this epic inverts;
  source of the "no network in the execution loop" constraint.
- `M1FGRJ` — deferred v2 (dependency-graph projection, full field parity) — explicitly out of
  scope here.
- Coupling surface: ~20 hook read sites + phase/done gates (`active-ticket.ts`,
  `pre-tool-quality.ts`, `stop-quality.ts`, `hierarchy.ts`, `done-gate.ts`), `ticket-new.ts`,
  `ticket-sync/index.ts` (INDEX), `duplicate-ids.ts` + `scripts/check-ticket-ids.ts`.

## Personas

- **Technical Builder (TB)** — runs safeword on a real project; feels the repo churn and the
  two-systems problem.
- **Safeword Maintainer (SM)** — owns the gates and must keep them working offline and
  backward-compatible.

## Vocabulary

- **Coordination plane** — identity, status, lifecycle: what humans/teams coordinate on. Off-boards
  to the tracker.
- **Execution plane / context anchor** — colocated `spec.md` / `design.md` / `test-definitions.md`
  / `verify.md` / work-logs the gates and skills read mid-session. Stays local, becomes ephemeral.
- **Canonical** — the system of record. Post-change: the tracker for identity + status; the local
  cache for nothing durable.
- **persistArtifacts** — opt-in config to commit planning artifacts to a docs path while still
  git-ignoring lifecycle bookkeeping.

## Jobs To Be Done

### offboard-local-ticketing.TB1 — one place work lives, zero repo churn

**Persona:** Technical Builder (TB)

> When my team coordinates work in GitHub or Linear, I want safeword to treat that tracker as the
> system of record for ticket identity and status and stop committing its bookkeeping into my
> repo, so there is exactly one place work lives and my git history reflects my work, not
> safeword's.

#### offboard-local-ticketing.TB1.AC1 — `ticket new` mints the issue first

With a tracker connected, creating a ticket creates (or adopts) the external issue first and
takes the tracker-issued key as the ticket's canonical identity; the local working folder is
materialized from that key. With `provider: none` the no-tracker base case is unchanged.

#### offboard-local-ticketing.TB1.AC2 — status lives on the issue

A status transition (including terminal) is applied to the issue; local frontmatter records it
as a cache only and is never the authority. safeword writes only identity (existence, title,
back-link) and status — never assignee, priority, or body parity — routed through the existing
single writer call site so GitHub and Linear are both served.

#### offboard-local-ticketing.TB1.AC3 — the local cache is git-ignored by default

With a tracker connected, a full session (create → work → close) produces zero tracked ticket
files. Executable artifacts (`features/*.feature`, source, tests) are unaffected — they live in
the normal committed tree, not the ticket folder.

#### offboard-local-ticketing.TB1.AC4 — INDEX and the dup-ID guard are retired when canonical

`INDEX.md` / `INDEX-completed.md` are not generated when the tracker is canonical (its issue
list replaces them), and the duplicate-ID CI guard is dropped for tracker-minted keys
(collision-proof by construction).

#### offboard-local-ticketing.TB1.AC5 — opt-in to persist planning artifacts

Setting `persistArtifacts` commits `spec.md` / `design.md` to a configured docs path while still
git-ignoring lifecycle bookkeeping (status rewrites, INDEX, logs).

### offboard-local-ticketing.SM1 — gates stay local, offline, and backward-compatible

**Persona:** Safeword Maintainer (SM)

> When a gate fires mid-session, I want it to keep reading local artifacts with no network call,
> and every existing ticket and no-tracker install to keep working, so the change is fast,
> offline-safe, additive, and reversible.

#### offboard-local-ticketing.SM1.AC1 — gates read the local cache, never the API

The phase gate (`test-definitions.md`) and done gate (`verify.md`) read the local cache. No gate,
prompt hook, or per-turn read makes a network call; a session with the network down still
evaluates gates correctly off the cache.

#### offboard-local-ticketing.SM1.AC2 — status read-authority reconciles at session boundaries

Issue state is the read-authority for status; local frontmatter caches it. Reconciliation runs at
session start/resume, not per turn — a status changed in the tracker is picked up without live
two-way field sync and without a stale local value driving a gate mid-session.

#### offboard-local-ticketing.SM1.AC3 — legacy tickets stay readable, no-tracker installs unchanged

All existing local tickets (Crockford `{ID}-{slug}/`, ID-only, legacy numeric) remain resolvable
by ID; no migration is forced. With `provider: none`, the local plane behaves exactly as today.

## Rave Moment

### offboard-local-ticketing — the repo that stopped filling up with tickets

- **Moment:** a TB connects their tracker, runs a week of agent sessions, and opens `git log` —
  not one ticket-bookkeeping diff, just their actual work, while every ticket sits live in
  GitHub/Linear where the team already looks.
- **Beats:** the status quo where safeword sprays status rewrites, INDEX churn, and a folder per
  task across the repo, forcing a second place to track work.
- **They'd say:** "safeword runs the process but my repo stays mine — the tickets just live in
  Linear like everything else."

## Outcomes

- With a tracker connected, a full create→work→close session adds **zero** tracked ticket files.
- Ticket identity and status are observable in the customer's tracker without running safeword.
- Gates pass/fail identically offline (no per-turn network).
- Existing local tickets and `provider: none` installs are unaffected.
- Dogfood (`ArcadeAI/safeword`, GitHub) shows a measurable drop in tracked ticket-file diffs per
  session vs. baseline.

## Open Questions

- defer: exact transition mapping of safeword `phase`/`status` onto GitHub (open/closed + labels)
  vs Linear (workflow states) — resolve in the status-on-issue child ticket, not at intake.
- defer: where re-hydration sources artifact bodies when the cache is absent on a clean checkout
  (issue body vs `persistArtifacts` docs path vs regenerate) — resolve in the ephemeral-cache
  child ticket.
