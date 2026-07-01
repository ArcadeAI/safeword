---
id: BNGK9W
slug: cloud-retro-filing-transport
type: feature
phase: done
status: done
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

## Dependency / sequencing note

Transport is **necessary but not sufficient.** A live head-to-head eval
(2026-06-30, see **ZFGWS1**) showed the current DEFAULT tier (haiku) under-
delivers — 1-3 weak findings — though a stronger tier (sonnet) yields 9 valid
ones. Fix the extractor's recall (ZFGWS1 — delta re-arm + sonnet + async hook)
alongside this; otherwise BNGK9W delivers a thin pipe filled by the weakest model.

## Design reconciliation (2026-07-01) — PATH B conflicts with ZFGWS1's async hook

The intake design predates ZFGWS1 **shipping** the retro Stop hook as `async: true`.
An `async:true` hook runs fully backgrounded and its stdout /
`hookSpecificOutput.additionalContext` **never reaches the conversation** — that is
the invisibility ZFGWS1 bought. So PATH B as written ("the Stop hook emits a factual
`additionalContext` line → the live agent spawns a filing subagent") **cannot fire
from the async Stop hook.** The two ship-decisions are in tension.

Reconciled approach (fold into spec.md before implementing PATH B):

- **Extraction + spool stay on the async Stop hook** (invisible, backgrounded) — the
  async hook writes the sanitized drafts to the spool; no surfacing.
- **The agent-filing trigger moves OFF the Stop hook** to one that CAN surface — a
  `SessionStart` / `UserPromptSubmit` check that, when it finds unfiled spooled
  drafts, emits the one factual line so the live agent files them via MCP. Keeps the
  Stop invisible (ZFGWS1) AND gives PATH B a channel that reaches the agent (BNGK9W).
- Open for the spec: dedupe the nudge (fire once per unfiled batch) and mark-filed so
  the spool drains and doesn't re-nudge.

## Work Log

- 2026-07-01T18:06Z DONE. /verify: full suite 4224/4224 pass (298/298 files, 5
  skipped), build green, lint clean, tsc unchanged (11 pre-existing baseline), 14/14
  scenarios, PR scope clean (26 files, all BNGK9W), no dep drift. /audit passed (0/0
  — config in sync, no arch violations, no BNGK9W dead code). Independent
  quality-review APPROVE (0 critical; hook API shapes verified vs current docs).
  verify.md written. Live-fire: PATH B fired for real this session (retro spooled a
  finding → REST 401 → nudge surfaced). Caught + fixed one runtime-data gap live
  (retro-drafts spool needed gitignore + preservedDirs; tripped schema-drift). Ready
  to merge (do NOT rebase onto main until the ZFGWS1/#543 base lands).
- 2026-07-01T17:27Z implement: slices 3-5 shipped + PATH B made real. (3)
  transport-selection wiring in runRetro — spool post-egress drafts before filing,
  drain the ones that reached the tracker (triage.filedSignatures), report
  agentFilingNeeded (0beb652). (4) fileSpooledDrafts seam — post each draft verbatim,
  drain posted, retain failed (8b21bd3). (5) prompt-retro-nudge UserPromptSubmit hook
  — one factual system-reminder line once per unfiled batch, wired into config.ts +
  dogfood settings.json, schema-registered, hook-coverage-exempt (9f6a485). Added
  NTB1.AC1 on-disk no-leak + drained-boundary coverage (ffeb3b1). Taught
  self-report-filing.md to file cloud-spooled retro drafts — the nudge referenced it
  but it only covered the self-report spool; an agent would have read the wrong spool
  (57589eb). All 14 scenarios green; 149/149 BNGK9W-surface tests, eslint clean, tsc
  unchanged (11 pre-existing baseline). Full suite running for the verify gate.
  Design note: no cloud-side drain CLI — the once-per-batch marker prevents re-nudge
  and the container is ephemeral, so the spool needn't drain in cloud (local REST
  path drains via markDraftsFiled). Next: /verify + /audit → verify.md → done.
- 2026-07-01T14:41Z implement: slices 1-2 shipped. (1) `markDraftsFiled` drain
  primitive — rewrites the spool minus filed signatures, atomic, persisted
  (57db830). Relocated the spool to `templates/hooks/lib/retro-draft-spool.ts`
  (self-contained, mirrored, schema-registered) so both the CLI and the customer-repo
  surfacing hook can use it — the lib/self-report.ts precedent (cbb1db8). (2)
  `lib/retro-nudge.ts` once-per-batch decision + factual non-imperative line, keyed
  by a persisted sha256 of the unfiled signature set (5413bbf). Muted footprint
  decision recorded in impl-plan (user steer + docs-confirmed additionalContext is a
  user-invisible system reminder). Remaining: slice 3 transport-selection wiring in
  retroCommand, slice 4 filing-subagent seam, slice 5 the surfacing hook.
- 2026-07-01T03:18Z Complete: scenario-gate. Independent fresh-context /review-spec
  round 1 (3 must-fix / 4 should-strengthen) → applied; round 2 (0 must-fix / 3
  should-strengthen / 8 looks-good) → applied. Gate stamped (same-model reviewer;
  crossModelReview off in config so a same-model independent review satisfies Tier 2).
  14 scenarios, ledger + dimensions resynced. Phase → implement. Proof plan + build
  order below. **Paused for user steer before the implement slices** (as told).
  - **Proof plan** (mocked boundaries only: GitHub REST transport, agent/MCP filing
    seam, spool fs via injected `projectDirectory`; selection + drain + nudge run real):
    - SM1.AC1/AC2 transport selection → module-wiring test on `retroCommand`/`runRetro`
      with a mock `IssueTracker` (REST success → filed + drained + silent; REST 401 →
      retained + defer signal; partial → only REST-filed drained).
    - SM1.AC1 subagent seam → wiring test at spool→transport: exactly-N posts, each body
      byte-equal incl signature marker; subagent partial failure → unfiled retained.
    - SM1.AC3 drain / TB1.AC2 once-per-batch → unit tests on the new mark-filed/drain
      primitive + persisted signature-keyed batch marker (re-read, not in-memory).
    - TB1.AC2 nudge presence/phrasing → hook-level test (factual line, banned-marker list).
    - NTB1.AC1 → egress→spool seam test with distinctive sentinel.
  - **Build order** (each RED→GREEN→REFACTOR): (1) mark-filed/drain primitive in
    `draft-spool.ts` (append-only today; add removal). (2) transport-selection wiring
    (spool → try-REST → drain-filed / retain-rejected) in `retroCommand`. (3) filing
    subagent seam (reads spool, posts verbatim, drains). (4) once-per-batch marker +
    the surfacing hook (SessionStart/UserPromptSubmit). Parity-mirror any templates/hooks
    change to `.safeword/hooks/**` + keep schema.ts registration.
- 2026-07-01T03:10Z Complete: intake→define-behavior — authored spec.md (3 JTBD /
  6 AC across SM/TB/NTB, reconciled two-path design) + dimensions.md; /self-review
  stamped. 11 scenarios / 5 rules in features/cloud-retro-filing-transport.feature
  (@manual). Next: scenario-gate independent review.
- 2026-07-01T00:37Z Slice 1 shipped: `packages/cli/src/retro/draft-spool.ts`
  (`spoolDrafts`/`readSpooledDrafts` — capped 20/session, fail-open, torn-tolerant;
  5 unit tests, tsc+eslint clean). The conflict-free foundation both paths need:
  persists post-egress drafts so a cloud REST-401 no longer LOSES them. Recorded the
  async:true↔PATH-B reconciliation above (intake design was stale re: ZFGWS1).
  Remaining: wire spool into retroCommand (spool-then-try-REST + mark-filed), the
  SessionStart/prompt filing nudge, and the filing subagent. Branch
  `claude/cloud-retro-filing-transport` (off ZFGWS1). Still a feature at intake —
  spec.md refresh + scenarios owed before the PATH-A/B wiring.

- 2026-06-30T05:58:08.315Z Started: Created ticket BNGK9W
- 2026-06-30T06:15Z Added 0XEMEE dependency note after the recall eval: transport
  is moot if extraction finds nothing. Re-sequenced 0XEMEE as the higher-priority
  sibling.
- 2026-06-30T05:58Z Intake from /figure-it-out (#568). Parent RV9JT4; sibling of
  7D8PJP (which built invisible extraction; this completes its transport story).
  Decision captured: try-REST-then-agent-subagent, in-session, selected
  automatically. Next: spec.md (personas/JTBD), then scenario gate (it's a
  feature — multiple flows + new spool state).
