---
id: WG3Z2N
slug: ticket-anchor-external-bridge
type: feature
phase: intake
status: in_progress
epic: ticket-anchor-external-bridge
created: 2026-06-20T11:53:02.755Z
last_modified: 2026-06-20T11:53:02.755Z
---

# Epic: Ticket system — local execution anchor + one-way bridge to external trackers

**Goal:** Settle one seam for safeword's ticket system — **local files are the canonical execution anchor; external trackers (Linear/GitHub/Jira) are one-way projections** via a shared provider bridge — and group the tickets that build each half so their couplings stay visible.

**Why:** The ticket system's reason to exist is to be a deterministic, offline, grep-able anchor that keeps an agent from looping mid-task. That purpose breaks if we drag the network and a second master into the agent's loop. Meanwhile humans coordinate in a real tracker. The two needs are different layers, not competitors — but today the work is scattered across two epics (VKNF1T platform-uplift, S4997T arcade-signals) and two tickets (`THSPA5` mirror, `JS5K5G` alert-routing) independently reinvent the same "write an issue to the customer's tracker" machine. This epic draws the line once.

> **Decision (from `/figure-it-out`, 2026-06-20):** one-way projection, file canonical. Two-way sync (git-bug's bridge model) was rejected — two masters = conflict/idempotency/data-loss, and it puts the network in the per-turn loop. External-canonical (tracker is source of truth) was rejected — it degrades the agent's local reasoning to GitHub's lowest-common-denominator and turns the ticket _folder_ (a spec/test/work-log workspace) into a status row. Precedent: [Fossil](https://fossil-scm.org/home/doc/tip/www/bugtheory.wiki) keeps ticket **data** shared but **display/interpretation** local; [git-bug](https://github.com/git-bug/git-bug)'s bidirectional bridges are its most fragile surface.

## The seam

| LOCAL — execution anchor (canonical, offline, hook-gated)                                                              | EXTERNAL — one-way projection to the customer's tracker                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Ticket **folder as workspace**: spec.md, test-definitions/`.feature`, design.md, work-log                              | **Coordination view**: epic→project/milestone, ticket→issue, status→state, `depends_on`→issue relations |
| **Schema the hooks reason on**: id, slug, status, phase, type, `epic`/`parent`/`paired_with`/`blocked_on`/`depends_on` | **Assignment, comments, triage, roadmap, notifications**                                                |
| **Validation** (`safeword check`: dangling refs, cycles, symmetry) + **phase-hook gating**                             | **Breach→ticket** creation on a signal (one event source, not the architecture)                         |
| The **INDEX** (agent-facing discovery)                                                                                 | Trigger = `sync` command / CI — **never** a per-turn hook                                               |

## Child tickets

| ID                          | Half                | Becomes                                                                                                                                                                                                                                    |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MBGQ89**                  | LOCAL               | Complete the local ticket schema (the anchor). De-duped against AKZJXC — drops the already-shipped `depends_on`/`blocks`; keeps `epic`/`parent`/`paired_with`/`blocked_on` + phase-hook gating + check validation + cross-repo ref syntax. |
| **JS5K5G**                  | EXTERNAL (spine)    | Reframed from "alert-routing" → the **ticket bridge**: one-way provider-adapter contract (Linear/GitHub/Jira via Arcade MCP). Defines the layer both consumers share.                                                                      |
| **THSPA5**                  | EXTERNAL (consumer) | One-way **coordination projection** (epics/status/relations → tracker), now a _consumer_ of JS5K5G's bridge instead of defining its own adapter.                                                                                           |
| **(new) breach projection** | EXTERNAL (consumer) | Split out of old JS5K5G — the signals use-case: project a breach as an issue via the bridge. Keeps `depends_on: 1W107W`, `paired_with: 5FBD29`; cross-linked to signals epic S4997T.                                                       |

## Completed predecessors (built the local relations the bridge maps outward)

- [AKZJXC](../AKZJXC-ticket-relations/ticket.md) — `depends_on:` field + derived `blocks` + `safeword check` validation (✅ done).
- [E11N48](../E11N48-replan-blocker-moved/ticket.md) — replan "blocker moved" advisory (✅ done).

## Adjacent (local-anchor maintenance — cross-linked, not load-bearing here)

`129` auto-move-done · `160` stale-detection · `7VEYAY` smoke-id warning · `FM5EDA` slug-rename · `1GGD28` dedup-index. These harden the local anchor but don't decide the seam.

## Sequencing

1. **MBGQ89** (local schema) and **JS5K5G** (bridge contract) are independent — both can proceed in parallel.
2. **THSPA5** and the **breach projection** are consumers — they `depends_on` JS5K5G's adapter contract.
3. THSPA5's coordination mapping consumes MBGQ89's `epic`/`blocked_on` and AKZJXC's `depends_on` → tracker relations.

## Work Log

- 2026-06-20T11:53:02.755Z Started: Created ticket WG3Z2N.
- 2026-06-20T11:55:00Z Framed from the local-vs-external `/figure-it-out`. Seam = local execution anchor (canonical) vs one-way external projection via a shared bridge. Folds MBGQ89 (local schema), JS5K5G (reframed → bridge spine), THSPA5 (coordination consumer), and a new breach-projection child (signals consumer) under one epic. Reconciliation flagged: MBGQ89 overlaps AKZJXC's shipped `depends_on`.
