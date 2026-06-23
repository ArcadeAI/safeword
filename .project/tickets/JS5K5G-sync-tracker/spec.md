# Spec: safeword sync-tracker — one-way projection to Linear + GitHub Issues (v1)

## Jobs To Be Done

### sync-tracker.TB1

**Persona:** Technical Builder (TB)

When my team coordinates work in a real tracker (Linear or GitHub Issues) but my
agent executes against local ticket files, I want one command to project my
tickets outward — one-way, files staying canonical — so humans see status where
they live without my repo ever becoming a second master or putting the network
in the execution loop.

#### sync-tracker.TB1.AC1 — no-tracker base case is a friendly no-op

With `provider: none` (the default), `sync-tracker` prints guidance to run
`safeword setup`, makes no writer calls, and exits 0. An unsupported tracker is
treated as `none`. The local system is fully unaffected — projection is additive.

#### sync-tracker.TB1.AC2 — a configured provider without a credential fails loudly

When `provider` is set but no credential resolves, `sync-tracker` emits a loud
warning and a visible (non-zero) failure — it never silently exits 0 (the CI
"runs, does nothing, looks fine" trap). No writer calls are made.

#### sync-tracker.TB1.AC3 — each ticket maps to a flat IssuePayload

A ticket maps to a provider-neutral `IssuePayload`: title carries **no** safeword
ID prefix; `labels` include `epic:<slug>` and `type:<type>`; `state` is `open`
for an active ticket and `closed` for a terminal one; `body` carries the mirror
banner and a back-link to the canonical ticket. A ticket with no epic yields only
the `type:` label.

#### sync-tracker.TB1.AC4 — one call site routes to the provider's writer

All projection funnels through a single `projectTicket(payload, provider)` call
site that dispatches to the Linear writer for `linear` and the GitHub writer for
`github`, each via an injected client (mocked in tests).

#### sync-tracker.TB1.AC5 — first sync creates issues and records refs

For a ticket with no entry in a **present, parseable** sidecar, `sync-tracker`
calls the writer's create and records the returned `TrackerRef` in the
`.safeword/tracker-map.json` sidecar (never in ticket frontmatter — the canonical
files stay pure). `safeword setup`/connect (2TK5AD) seeds an empty sidecar when a
provider is configured, so "present + empty" is the legitimate first run and an
**absent** sidecar means it was lost (→ AC9), not a fresh project.

#### sync-tracker.TB1.AC6 — re-run is idempotent (update, never duplicate)

For a ticket already in the sidecar, `sync-tracker` calls the writer's update
with the existing ref and never calls create — re-running reconciles, it does not
duplicate.

#### sync-tracker.TB1.AC7 — field ownership: write only owned fields

On re-sync, `sync-tracker` writes only the fields it owns — title, labels,
back-link — and never writes status, assignee, or priority. The **one** exception
is the universal close-on-terminal: when local status is terminal the issue is
closed (the only status write, supported by every tracker).

#### sync-tracker.TB1.AC8 — partial-failure resume never double-creates

When a prior run created an issue but failed to record its ref (a `pending` sidecar
entry), the next run reconciles to the existing issue rather than creating a second
one — a crash mid-corpus resumes cleanly.

#### sync-tracker.TB1.AC9 — a missing/corrupt sidecar never blind-recreates

On a configured project, if the seeded sidecar is **absent** (lost) or **present
but unparseable** (corrupt), `sync-tracker` refuses to blind-recreate — it stops
with guidance to pass `--reset-tracker-map`, and makes no writer calls until the
operator opts in. (The absent case is distinguishable from a fresh first run
because connect seeds an empty sidecar — see AC5.)

#### sync-tracker.TB1.AC10 — body egress defaults to minimal

`body` defaults to `minimal` (title, status, labels, back-link — never the
spec/work-log body). `full` is opt-in per project; projecting `full` to a
**public** GitHub repo emits a loud egress warning.

#### sync-tracker.TB1.AC11 — secrets stay out of the repo and the logs

Tokens resolve from the OS keychain or an env var only — never read from
`.safeword/config.json`, never written to logs or command output.

#### sync-tracker.TB1.AC12 — CI auth caveat is surfaced

A non-interactive run authenticated by an `Arcade-User-ID` (a user identity, not a
service account) emits an explicit warning naming the silent-failure mode on grant
lapse.

#### sync-tracker.TB1.AC13 — corpus writes are rate-limited with backoff

When a writer hits a rate-limit error, the write is retried with backoff and
eventually succeeds, rather than failing the run or hammering the API.

## Out of scope

See `ticket.md` "Out of scope" — the dependency-graph projection (sub-issues,
relations, issue-types, topo-sort → v2 / M1FGRJ), a pluggable adapter interface /
`custom` provider, two-way sync / read-back, GitHub Projects v2 board placement,
the breach→issue caller (K51FYZ), and any third provider (Jira/Slack).
