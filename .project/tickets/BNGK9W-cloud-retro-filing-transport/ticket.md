---
id: BNGK9W
slug: cloud-retro-filing-transport
type: feature
phase: intake
status: in_progress
parent: RV9JT4-retro-transcript-mining
github: https://github.com/ArcadeAI/safeword/issues/568
scope: |
  Close the cloud filing gap (#568): the invisible retro extracts findings but
  cannot file them in a Claude cloud session, because the headless CLI's REST
  transport relies on GITHUB_TOKEN/gh — and in cloud GITHUB_TOKEN is 401 and gh
  is absent. The only working GitHub write path in cloud is the live agent's
  inherited GitHub MCP. Decision (figure-it-out, this session): file via a
  "cheapest transport that works" two-path design, selected automatically:

  1. SPOOL the sanitized, code-assembled drafts to disk at Stop, after the
     invisible headless extraction (reuse the existing self-report spool shape;
     drafts are post-egress, already sanitized).
  2. PATH A — direct REST (zero footprint): the Stop hook attempts the REST
     transport (resolveGitHubToken → createRestTransport) against the spool.
     On success → mark filed, emit NO surfacing. This is the local-with-token
     path; the user's conversation stays completely silent.
  3. PATH B — agent subagent (one isolated footprint): on REST failure (401 /
     no token — the cloud case), leave drafts spooled and emit a FACTUAL
     one-liner via hookSpecificOutput.additionalContext (copy the proven
     phrasing from formatSelfReportSurfacing — statement of fact, never an
     imperative). The live agent, still connected this session, spawns ONE
     filing subagent that reads the spool and posts each draft VERBATIM via its
     inherited GitHub MCP, then marks them filed.
  4. The selection is automatic — "try the silent path, fall back to the agent
     path" — no environment-sniffing and no config flag.
  5. Footprint guarantees preserved: extraction stays headless/invisible
     (7D8PJP); PATH A adds zero conversation entries; PATH B adds exactly one
     isolated Task call at the Stop boundary (subagent intermediate work does
     not reach the parent transcript). Never mid-turn.
  6. Gated to fire rarely: substance gate + once-per-session sentinel + friction
     gate (#563) all still apply before any filing is attempted.
out_of_scope: |
  - Codex (#551) and Cursor (#552) transports — separate tickets. (Codex/Cursor
    have their own agent-owned write paths; this ticket is the Claude path.)
  - Robust dedup (1FGE1C) — the subagent dedups via the existing search-then-file
    procedure in self-report-filing.md; hardening is 1FGE1C.
  - A persistent git-backed spool (commit drafts, flush in CI/later) — REJECTED:
    the spool holds drafts that, while egress-sanitized, should not accrete in a
    public repo, and it adds a whole new flush surface. In-session filing avoids it.
  - Provisioning a real cloud GITHUB_TOKEN — out of safeword's control (the 401
    is the platform's token, not a safeword bug).
  - asyncRewake / non-blocking Stop — deferred (same as 7D8PJP).
done_when: |
  - In a cloud session (no valid token), a substantial session's Stop spools the
    drafts and surfaces a factual one-liner; a test asserts the surfacing fires
    on REST-failure and is a statement of fact (not an imperative), and that the
    drafts are spooled for the agent to read.
  - In a local session WITH a valid token, the same Stop files directly via REST
    and emits NO additionalContext (zero footprint); a test asserts the silent
    path (REST attempted, success → no surfacing).
  - The filing subagent reads the spool and posts each draft body VERBATIM via
    the agent transport; covered by a test at the transport-selection boundary
    (REST mock fails → spool retained + surfacing emitted → subagent path chosen).
  - Drafts in the spool are the post-egress, sanitized, code-assembled bodies
    (no raw finding text reaches disk); asserted by a test.
  - Once-per-session + substance + friction(#563) gates still hold before filing.
  - Scenarios green; /verify + /audit pass.
created: 2026-06-30T05:58:08.315Z
last_modified: 2026-06-30T05:58:08.315Z
---

# Cloud retro filing: try-REST-then-agent-subagent transport (#568)

**Goal:** Make the invisible retro actually FILE its findings in a Claude cloud
session, by filing through the live agent's GitHub MCP when the headless REST
transport can't authenticate — while keeping the silent zero-footprint REST path
on local installs that have a working token.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.
**GitHub:** [#568](https://github.com/ArcadeAI/safeword/issues/568).
**Decision:** figure-it-out (this session) — "cheapest transport that works."

## Why (the load-bearing facts, proven live this session)

- A Claude cloud container is **ephemeral** — reclaimed at session end. So
  "spool now, flush next session" CANNOT work in cloud (no next session on the
  same container; the spool is gone). Filing must happen **in the same session**.
- In cloud, `GITHUB_TOKEN` returns **401 Bad credentials** and `gh` is absent —
  proven live by `safeword retro --auto-extract` (0 filed / N failed). The
  headless REST transport genuinely cannot file there.
- An in-session **subagent inherits the harness GitHub MCP** (live-proven:
  `GITHUB_MCP_AVAILABLE`), and its intermediate work is isolated — only the
  spawn-call + final result reach the parent transcript. A headless subprocess
  does **not** inherit MCP. So the subagent is the cloud-working, footprint-
  isolated transport.
- The existing self-report feature already ships the spool → factual-Stop-
  surfacing → agent-owned-transport pattern (`stop-self-report.ts`,
  `self-report-filing.md`). This ticket reuses that pattern; the delta is the
  REST-first attempt + routing the agent transport through a subagent for
  footprint isolation.

## Two paths (automatic selection)

| Condition | Path | Footprint |
| --- | --- | --- |
| Working token (local) | Direct REST in the Stop hook | Zero — fully silent |
| 401 / no token (cloud) | Spool → factual surfacing → 1 filing subagent via MCP | One isolated Task call at Stop |

Selection rule: **try REST; on failure, fall back to the agent path.** No
env-detection, no flag.

## Work Log

- 2026-06-30T05:58:08.315Z Started: Created ticket BNGK9W
- 2026-06-30T05:58Z Intake from /figure-it-out (#568). Parent RV9JT4; sibling of
  7D8PJP (which built invisible extraction; this completes its transport story).
  Decision captured: try-REST-then-agent-subagent, in-session, selected
  automatically. Next: spec.md (personas/JTBD), then scenario gate (it's a
  feature — multiple flows + new spool state).
