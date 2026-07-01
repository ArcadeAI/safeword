---
id: 417FKH
slug: github-transport-discovery
type: feature
phase: intake
status: backlog
parent: RV9JT4-retro-transcript-mining
scope: |
  Change the retro's Lane 1 (the silent, direct filing path) from "REST-with-token
  only" to a DISCOVERED, PREFERENCE-ORDERED GitHub write transport. Today Lane 1 is
  `createRestTransport(resolveGitHubToken())` and nothing else; if no token, it
  no-ops (or in cloud, 401s → Lane 2). This ticket makes Lane 1 probe for the best
  available GitHub write path and use the first that works, silently, before ever
  falling back to the agent (Lane 2).

  Preference order (first that is present AND can write → use it):
  1. Arcade GitHub MCP server (if a local Arcade MCP is connected/configured).
  2. GitHub's official GitHub MCP server (if connected).
  3. The agent's own inherited GitHub MCP (the harness-provided one — what Lane 2
     uses today, but invoked directly here when reachable without surfacing).
  4. `gh` CLI (if installed + authenticated).

  (REST-with-token is intentionally NOT a discovery rung — dropped as too much work
  for its value; 2026-07-01 steer. The MCP/`gh` transports cover the environments we
  care about, and anything they can't reach degrades to Lane 2.)

  The whole point: in more environments Lane 1 succeeds silently, so Lane 2's
  one-line agent nudge fires even less often. Egress stays the boundary — every
  transport files the SAME post-egress `{signature,title,body,labels}` drafts
  through the existing pipeline; discovery changes only WHO writes, never WHAT.
out_of_scope: |
  - Lane 2 (the agent-subagent fallback) — unchanged; this only enriches Lane 1 so
    the fallback is needed less.
  - The egress pipeline, sanitizer, spool, dedupe, nudge — untouched.
  - Codex / Cursor transports (#551 / #552) — separate agent-owned write paths.
  - Provisioning credentials for any of these servers — discovery uses whatever is
    already connected/authenticated; it never prompts or configures auth.
done_when: |
  - Lane 1 tries the preference-ordered transports and files via the first that can
    write, WITHOUT surfacing anything; a test drives the selection (each higher
    transport unavailable → falls to the next; a working one short-circuits).
  - When NONE of the direct transports can write, it degrades to Lane 2 exactly as
    today (drafts stay spooled, nudge fires) — a test asserts the hand-off.
  - Every transport files the post-egress drafts unchanged; egress-safety test holds.
  - How an MCP server is invoked from the (headless) Lane-1 context is resolved
    (see Open Question) — a headless CLI subprocess does NOT inherit the agent's MCP.
  - Scenarios green; /verify + /audit pass.
created: 2026-07-01T20:09:53.342Z
last_modified: 2026-07-01T20:09:53.342Z
---

# Lane 1: discover and prefer a real GitHub MCP transport

**Goal:** Make the retro's silent direct-filing lane use the best GitHub write path
available in the environment — Arcade MCP → GitHub-official MCP → the agent's own
MCP → `gh` CLI — so findings file silently in far more setups and the
agent-mediated fallback (Lane 2) is needed only as a true last resort. (REST-with-
token is dropped — not worth the work; 2026-07-01 steer.)

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

**Origin:** alex@arcade.dev, 2026-07-01, off BNGK9W (#601). BNGK9W shipped the
two-lane design; this deepens Lane 1's transport so Lane 2 fires less.

## Open Question (raised at intake — resolve before design)

**Is there a more elegant framing than a hardcoded preference ladder?**

The scope lists an explicit ordered probe (Arcade → GitHub MCP → agent MCP → gh).
That works but is a special-case pile — exactly the "wrong level of
abstraction" smell. Candidates to weigh at `/figure-it-out`:

- **A `GitHubWriteTransport` interface + a registry of `{ probe(): bool; make() }`
  providers**, tried in priority order. Adding a transport = registering a provider,
  not editing an `if/else` ladder. The ladder becomes data.
- **Capability discovery, not a fixed list:** ask "what connected MCP servers expose
  an issue-write tool?" and rank, rather than naming Arcade/GitHub by hand — future
  MCP servers work with no code change. (Needs a way to enumerate connected MCP
  servers + their tools from the filing context.)
- **The load-bearing unknown underneath both:** *can the headless Lane-1 path even
  reach an MCP server?* A headless `claude -p` / CLI subprocess does NOT inherit the
  session's MCP connections (that's WHY Lane 2 exists). So "use the agent's MCP in
  Lane 1" may be impossible without either (a) an MCP client the CLI opens itself
  (Arcade/GitHub servers are addressable; the agent's inherited one may not be), or
  (b) collapsing "MCP-capable" rungs into Lane 2. Resolve this FIRST — it may prune
  the ladder to just `{ gh }` for Lane 1 (REST already dropped) and route all MCP
  through Lane 2.

Recommendation: run `/figure-it-out` on the transport-abstraction + the
headless-MCP-reachability question before writing scenarios; the elegant design
likely falls out of the reachability answer.

## Work Log

- 2026-07-01T20:09:53.342Z Started: Created ticket 417FKH; captured scope +
  preference order + the elegance/reachability open question. Parked at `backlog`
  (intake) — not started; child of RV9JT4, follow-on to BNGK9W (#601).
