# Spec: Off-board local ticketing: external tracker as system of record, local artifacts stay tracked

## Intent

Make the customer's external tracker (GitHub Issues or Linear) the system of record for ticket
identity and status, and move the **lifecycle bookkeeping** (status/phase rewrites, INDEX
regeneration) out of the repo onto the tracker — while ticket **content** artifacts (spec,
design, impl-plan, test-definitions, verify, work-log) stay **git-tracked and reviewable**. Gates
keep reading local files, so the network never enters the per-turn loop. The win is "stop the
bookkeeping noise," not "hide the work."

## Intake Brief

- **Requested by:** alex (product owner) — "minimize ticket churn in customer projects and
  dogfood," and "avoid git-ignore on all this stuff" (artifacts must stay reviewable).
- **Cost of inaction:** the painful churn is **mechanical bookkeeping** — `updateTicketStatus()`
  rewriting `status`/`phase`/`last_modified` into `ticket.md` on every Stop, and
  `INDEX.md`/`INDEX-completed.md` regenerating on every change. This noise dominates git history
  and creates a second system of record alongside the team's real tracker. (Note: it is the
  *bookkeeping* that hurts — the content artifacts are legitimate, reviewable history and stay.)
- **Reversibility:** two-way door. We invert an existing one-way bridge (`tracker-sync`,
  `tracker-connect`) — `external_issue` frontmatter, `.safeword/tracker-map.json`, and
  close-on-terminal already exist. Existing tickets stay readable; `provider: none` installs are
  untouched. The one cross-cutting edge is flipping which plane owns status — contained by keeping
  it opt-in (only when a tracker is connected).

## References

- `/figure-it-out` decision (this session) — off-board the *coordination plane* (identity +
  status) to the tracker; keep the *content* tracked in the repo (reviewable), and stop the
  bookkeeping churn rather than git-ignoring artifacts.
- `.project/tickets/JS5K5G-sync-tracker/spec.md` — the one-way projection this epic inverts;
  source of the "no network in the execution loop" constraint.
- `M1FGRJ` — deferred v2 (dependency-graph projection, full field parity) — out of scope here.
- Coupling surface: ~20 hook read sites + phase/done gates (`active-ticket.ts`,
  `pre-tool-quality.ts`, `stop-quality.ts`, `hierarchy.ts`, `done-gate.ts`), `ticket-new.ts`,
  `ticket-sync/index.ts` (INDEX), `duplicate-ids.ts` + `scripts/check-ticket-ids.ts`.

## Personas

- **Technical Builder (TB)** — runs safeword on a real project; feels the bookkeeping churn and
  the two-systems problem; needs the plan/work reviewable by a teammate.
- **Safeword Maintainer (SM)** — owns the gates; must keep them working offline and
  backward-compatible.

## Vocabulary

- **Coordination plane** — identity, status, lifecycle: what humans/teams coordinate on.
  Off-boards to the tracker.
- **Content artifacts** — `spec.md` / `design.md` / `impl-plan.md` / `test-definitions.md` /
  `verify.md` / work-log. Meaningful, reviewable; **stay git-tracked**.
- **Lifecycle state** — `status` / `phase` / `last_modified` and the INDEX. The churny
  bookkeeping. Moves to the tracker (status) plus a git-ignored runtime cache (derived/phase
  state the gates read) — never rewritten into tracked files.
- **Runtime cache** — git-ignored session-scoped state (today's `.project/quality-state-*.json`
  family) the gates read each turn so no per-turn network call is needed. Not content.

## Jobs To Be Done

### offboard-local-ticketing.TB1 — stop the bookkeeping churn, keep the work reviewable

**Persona:** Technical Builder (TB)

> When my team coordinates work in GitHub or Linear, I want safeword to treat that tracker as the
> system of record for identity and status and stop rewriting bookkeeping into my repo, while my
> plan and work stay visible in git for a teammate to review — so my history reflects real work,
> not safeword's churn, and the team tracks status in one place (the tracker) while the work stays
> reviewable in the repo.

#### offboard-local-ticketing.TB1.AC1 — `ticket new` mints the issue first

With a tracker connected, creating a ticket creates (or adopts) the external issue first and
takes the tracker-issued key as the ticket's canonical identity; the local folder is materialized
from that key. With `provider: none` the no-tracker base case is unchanged.

#### offboard-local-ticketing.TB1.AC2 — lifecycle state leaves tracked files; tracker gets an allow-listed payload

`status` lives on the issue (the read-authority); `phase` and derived gate state live in the
git-ignored runtime cache. None of `status`/`phase`/`last_modified` is rewritten into tracked
`ticket.md` per Stop. The single writer call site emits **exactly** the allow-listed fields
{existence, title, back-link, status} to the tracker — observable by asserting the writer payload
equals that set (assignee/priority/body are absent, not merely "not written"). GitHub and Linear
are both served through that one call site.

#### offboard-local-ticketing.TB1.AC3 — content artifacts stay git-tracked and reviewable

`spec.md`, `design.md`, `impl-plan.md`, `test-definitions.md`, `verify.md`, and the work-log
remain tracked files in the repo — committed (at session boundaries, not per action) so a
teammate can review them in a normal PR/diff. Nothing in this set is git-ignored. Tracked
`ticket.md` keeps only stable identity + scope, which changes rarely.

#### offboard-local-ticketing.TB1.AC4 — INDEX and the dup-ID guard are retired when canonical

`INDEX.md` / `INDEX-completed.md` are not generated when the tracker is canonical (its issue list
replaces them), and the duplicate-ID CI guard is dropped for tracker-minted keys (collision-proof
by construction).

#### offboard-local-ticketing.TB1.AC5 — a session adds no bookkeeping diffs

With a tracker connected, a full create→work→close session produces **zero** bookkeeping diffs
(no `status`/`phase`/`last_modified` rewrites, no INDEX diff). The diffs it does produce are the
content the user actually authored — committed at session boundaries, so no mid-session action
produces a commit on its own. The tracker shows current status without running safeword.

#### offboard-local-ticketing.TB1.AC6 — `ticket new` degrades safely when the tracker is unreachable

Issue-first creation is the one place the network is on a critical path. When the tracker is
unreachable (or auth fails) at `ticket new`, the command fails loudly with guidance and creates
**no** half-state — no orphan local folder pointing at a non-existent issue. If the issue is
minted but recording its key locally fails (partial-create), the next `ticket new`/resume
reconciles to the existing issue rather than minting a duplicate (reusing the `tracker-map.json`
pending-entry pattern from `JS5K5G`). secrets resolve from the OS keychain / env only — never
config, never logs — and the only egress is the AC2 allow-list (a public-repo target surfaces the
existing egress warning).

### offboard-local-ticketing.SM1 — gates stay local, offline, and backward-compatible

**Persona:** Safeword Maintainer (SM)

> When a gate fires mid-session, I want it to read local files with no network call, and every
> existing ticket and no-tracker install to keep working, so the change is fast, offline-safe,
> additive, and reversible.

#### offboard-local-ticketing.SM1.AC1 — gates read local files, never the API

The phase gate (`test-definitions.md`) and done gate (`verify.md`) read the tracked artifacts and
the runtime cache. No gate, prompt hook, or per-turn read makes a network call; a session with
the network down still evaluates gates correctly.

#### offboard-local-ticketing.SM1.AC2 — status reconciles at session boundaries

Issue state is the read-authority for status; the runtime cache holds the last-known value.
Reconciliation runs at session start/resume, not per turn — a status changed in the tracker
(e.g. a teammate closes the issue) is picked up without live two-way field sync and without a
stale value driving a gate mid-session.

#### offboard-local-ticketing.SM1.AC3 — existing tickets stay readable, no-tracker installs unchanged

All existing local tickets (current `{ID}-{slug}/`, ID-only, and older numeric-id folders) remain
resolvable by ID — i.e. reading old on-disk ID formats, which is distinct from legacy-project
*workflows* (out of scope). No migration is forced. With `provider: none`, the local plane behaves
exactly as today (local identity and status).

#### offboard-local-ticketing.SM1.AC4 — concurrent sessions don't corrupt the runtime cache

The git-ignored runtime cache tolerates parallel sessions / branches: concurrent writers never
leave it unparseable, and a per-ticket (not global) granularity keeps one session's status from
clobbering another's. A torn or missing cache is treated as "unknown" and re-reconciled from the
tracker at the next boundary, never as a false gate signal.

## Rave Moment

### offboard-local-ticketing — the repo that stopped churning but kept the receipts

- **Moment:** a TB opens `git log` after a week of agent sessions — no `last_modified` bumps, no
  INDEX rewrites, no status flip-flops; just the spec, the plan, and the work, each reviewable in
  its PR, while status lives in GitHub/Linear where the team already looks.
- **Beats:** the status quo where safeword sprays status rewrites and INDEX churn across the repo,
  forcing a second place to track work.
- **They'd say:** "the noise is gone but I can still review the plan — tickets just live in Linear
  like everything else."

## Outcomes

- A full create→work→close session adds zero bookkeeping diffs (no status/phase/last_modified
  rewrites, no INDEX).
- Content artifacts (plan, spec, test-defs, work-log) stay in the repo and are reviewable by a
  teammate in a normal PR.
- Identity and status are observable in the tracker without running safeword.
- Gates pass/fail identically offline (no per-turn network).
- Existing tickets and `provider: none` installs are unaffected.
- INDEX no longer churns and ticket keys never collide (tracker-minted), with no local dup-ID
  guard needed.
- `ticket new` fails safely when the tracker is unreachable — no orphaned or duplicated tickets.
- Dogfood (`ArcadeAI/safeword`, GitHub) shows a measurable drop in bookkeeping diffs per session
  vs. baseline.

## Implementation decomposition (proposed child tickets)

Matches the current content-vs-lifecycle model (not the dropped ephemeral-cache one):

1. **issue-first creation** — `ticket new` creates/adopts the issue, takes its key as identity,
   and degrades safely when the tracker is unreachable (TB1.AC1, TB1.AC6).
2. **status-on-issue + runtime cache** — status writes go to the issue via the allow-listed
   writer; phase/derived state moves to the git-ignored runtime cache; session-boundary
   reconciliation and concurrent-session safety (TB1.AC2, SM1.AC2, SM1.AC4).
3. **stop the bookkeeping writes** — lifecycle fields stop being rewritten into `ticket.md`;
   content artifacts stay tracked; a session yields zero bookkeeping diffs (TB1.AC3, TB1.AC5).
4. **retire INDEX + dup-ID guard** when the tracker is canonical (TB1.AC4).
5. **instructions + back-compat + docs** — rewrite `SAFEWORD.md` / `ticket-system/SKILL.md` /
   guides / website to the tracker-canonical flow; existing tickets stay readable; `provider:none`
   unchanged (SM1.AC1, SM1.AC3).

Deferred follow-up (not a KKNFZA child): tracker-side approval gate for impl-plan review (see
Open Questions).

## Open Questions

- defer: exact mapping of safeword `status` onto GitHub (open/closed + labels) vs Linear
  (workflow states) — resolve in the status-on-issue child ticket.
- resolved (default): impl-plan review by another person uses **normal PR review** — the plan is a
  tracked file, so no new mechanism is needed and SM1.AC1's "no per-turn network" holds. A
  tracker-side approval gate (issue label/state reconciled at session boundary to block the
  implement phase) is a **deferred follow-up child ticket**, not in KKNFZA scope. Reversible: it
  layers on the SM1.AC2 reconciliation we're already building, so it can be added later without
  rework. (User can elevate it into scope; default stands otherwise.)
