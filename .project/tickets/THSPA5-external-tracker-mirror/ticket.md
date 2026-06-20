---
id: THSPA5
slug: external-tracker-mirror
type: feature
phase: intake
status: superseded
created: 2026-06-10T04:48:32.590Z
last_modified: 2026-06-20T12:36:00Z
---

# Optional one-way coordination mirror to Linear/GitHub/Jira (consumes the ticket bridge)

> **SUPERSEDED 2026-06-20 by [sync-tracker (JS5K5G)](../JS5K5G-sync-tracker/ticket.md).** The collapse merged this coordination mirror into the single `safeword sync-tracker` command — coordination projection is one caller of the writer, not a separate subsystem. The one-way / file-canonical decision and the non-interactive-auth constraint were carried forward into JS5K5G. Kept for history; do not build from here.

**Goal:** An optional, per-project, **one-way** mirror of safeword's coordination layer (epics, ticket status, what's-next) to an external tracker — Linear, GitHub Issues, or Jira — built **on top of the [ticket bridge](../JS5K5G-ticket-bridge/ticket.md) (JS5K5G)**, so teams get a board/roadmap/notifications while the local files stay source of truth. This ticket is now the _coordination consumer_; the provider adapter and auth live in JS5K5G, not here.

**Why:** The file-vs-Linear `/figure-it-out` drew the seam at **execution (local) vs coordination (external-projectable)**. The coordination layer is the part that benefits from a team tool — but it must not be Linear-locked: different projects use GitHub Issues or Jira. Arcade.dev's MCP layer gives a uniform, **auth-handled** (per-provider OAuth) tool interface across all three, so safeword projects the view via MCP tool calls instead of building and credentialing three API clients. One-way (file → tracker) keeps the file canonical and avoids two masters.

> Status: **intake**. Elevated from the conditional sibling noted in [ticket-relations](../AKZJXC-ticket-relations/ticket.md) (AKZJXC) — now provider-agnostic via Arcade. Build only when team coordination is a real need.

## Proposed shape

- **Per-project config** selects the provider (`none | linear | github | jira`) + target (workspace / repo / project). Default `none` — opt-in.
- **One-way projection** (`file → tracker`): safeword maps its coordination view to the tracker via Arcade MCP tools — epic → project/milestone, ticket → issue, `status` → issue state, `depends_on` ([AKZJXC](../AKZJXC-ticket-relations/ticket.md)) → issue relations.
- **Trigger off the per-turn loop:** a `safeword sync-tracker` command and/or a CI job — _never_ a per-turn hook (the figure-it-out's whole point: keep network out of the execution loop).

## Open questions (converge before spec)

- **Non-interactive auth.** Arcade MCP uses per-user OAuth; an automated/CI mirror needs a headless auth path. (Per the runtime note, interactively-authenticated MCP servers can be absent in headless/cron runs — a real constraint.) How does an unattended sync authenticate?
- **Provider feature parity.** Linear/Jira have rich relations + cycles; GitHub Issues is flatter (milestones, task lists, Projects v2, no native epics/relations). Define a lowest-common-denominator mapping + per-provider enhancements; the projection degrades gracefully on GitHub.
- **One-way vs read-back.** Teams will edit in the tracker (assign, comment, reprioritize). v1 is strictly one-way (file wins; tracker is a projection) — do we ever read assignee/comments back, or accept divergence? Lean: one-way for v1.
- **Cadence:** on-demand command, post-commit, or scheduled CI? Lean: explicit command + optional CI, not automatic.
- **Mapping fidelity:** epic / `status` enum / `depends_on` → each provider's primitives. Couples to AKZJXC's relations field.

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md).
- [AKZJXC](../AKZJXC-ticket-relations/ticket.md) (ticket-relations) — this is its elevated conditional sibling; `depends_on` maps to tracker relations.
- The file-vs-Linear `/figure-it-out` — the "extract coordination" half, now multi-provider.
- Arcade.dev MCP (the auth + multi-provider tool layer); [C2F601](../C2F601-absorb-claude-skills/ticket.md) — MCP/integration absorb theme.

## Work Log

- 2026-06-10T04:48:32.590Z Started: Created ticket THSPA5.
- 2026-06-10T04:49:00Z Elevated from AKZJXC's conditional sibling (per user) and made provider-agnostic: route through Arcade.dev MCP (handles per-provider OAuth), supporting Linear / GitHub / Jira selectable per project, default `none`. Kept it one-way (file canonical) and off the per-turn loop (sync command / CI, never a hook) — consistent with the execution-vs-coordination seam. Flagged the load-bearing constraint: non-interactive Arcade auth for an unattended sync. Parented under VKNF1T.
- 2026-06-20T12:00:00Z Re-parented VKNF1T → epic WG3Z2N and demoted to a _consumer_ of the [ticket bridge](../JS5K5G-ticket-bridge/ticket.md) (JS5K5G). The provider adapter, Arcade-MCP routing, and non-interactive-auth constraint were extracted into JS5K5G; this ticket now `depends_on: [JS5K5G]` and supplies only the coordination mapping (epic/status/relations → issues). The "Proposed shape" adapter/auth details below are superseded by JS5K5G — kept for history.

## Work Log

- 2026-06-10T04:48:32.590Z Started: Created ticket THSPA5
