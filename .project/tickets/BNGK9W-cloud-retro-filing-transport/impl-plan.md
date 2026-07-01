# Impl Plan: Cloud retro filing — try-REST-then-agent-subagent transport

**Status:** planned

## Approach

**Riskiest assumption:** that a filed draft can be durably *removed* from the
spool so it neither re-nudges nor double-files — the spool shipped in slice 1 is
**append-only JSONL with no removal function**, and the whole "No duplicates
across the fallback" rule rests on a persisted drain surviving a fresh re-read.
The cheapest scenario that proves it is **"Marking a draft filed drains it from
the persisted spool"** (SM1.AC3): it calls mark-filed inside the `When` and
asserts against a *fresh read of the persisted file*, so a no-op or in-memory-only
stub fails. That is the load-bearing slice and it is built first.

How each behavior is satisfied (primary proof by highest-practical-scope rule):

| Scenario(s) | Owner / layer | Primary proof | Why enough |
| --- | --- | --- | --- |
| Marking a draft filed drains it (SM1.AC3) | `draft-spool.ts` mark-filed/drain primitive | **unit** | pure fs-on-injected-dir logic; re-read asserts persistence, mirrors shipped spool tests |
| Once-per-batch nudge + batch-changed re-nudge (TB1.AC2) | persisted signature-keyed batch marker (`draft-spool.ts` / sibling) | **unit** | pure decision over a persisted marker + the unfiled-signature set; no I/O beyond the injected dir |
| Valid token files + drains + silent; REST 401 retains + defers; REST partial drains only filed (SM1.AC1/AC2) | `retroCommand`/`runRetro` transport-selection | **integration (module-wiring)** | crosses spool ↔ REST transport; mock `IssueTracker`, real selection/drain |
| Subagent posts each draft verbatim; subagent partial failure retains unfiled (SM1.AC1) | spool→agent-transport filing seam | **integration (wiring)** | the load-bearing cloud path; asserts exactly-N posts + byte-equal body incl signature marker against the mocked MCP seam |
| Nudge presence / silence / phrasing (TB1.AC2) | surfacing hook (SessionStart / UserPromptSubmit) | **integration (hook-level)** | drives the real nudge decision; asserts the factual line + banned-marker list |
| Extraction + spool add nothing (TB1.AC1) | async Stop hook | **integration (hook-level)** | asserts drafts persisted AND no conversation-visible output |
| Only post-egress fields reach the spool (NTB1.AC1) | egress pipeline → spool seam | **integration** | drives real egress with a distinctive sentinel; asserts file contents |

**Build order** (each RED→GREEN→REFACTOR; among dependency-free work the
load-bearing drain slice goes first so a wrong persistence design fails cheaply):

1. **mark-filed/drain primitive** in `draft-spool.ts` (add removal to the
   append-only spool; persisted re-read is the assertion surface).
2. **once-per-batch marker** (persisted, signature-keyed) — depends on (1)'s
   persistence shape.
3. **transport-selection wiring** in `retroCommand`/`runRetro` (spool → try-REST →
   drain-filed / retain-rejected; partial-failure per-draft) — consumes (1).
4. **filing-subagent seam** (reads spool, posts verbatim, drains via (1);
   subagent partial failure retains unfiled).
5. **surfacing hook** (SessionStart / UserPromptSubmit) emitting the factual line
   from (2)'s marker.

Any `templates/hooks/**` change is byte-parity mirrored to `.safeword/hooks/**`
and kept registered in `schema.ts`.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Spool drain mechanism | Rewrite the per-session JSONL file minus the filed signatures (mark-filed = remove line, persisted) | Tombstone/append a "filed" record and filter on read | Unbounded growth in a public-repo-adjacent file; read-time filter hides on-disk state the NTB1 guarantee must see |
| Nudge de-dupe key | Persisted marker keyed by the *set of unfiled draft signatures* | In-memory per-process flag; once-per-session sentinel (self-report style) | In-memory resets every hook invocation (proves nothing across boundaries); per-session can't re-nudge when the batch gains a new draft |
| Agent-filing trigger home | A surfacing-capable hook (SessionStart / UserPromptSubmit), NOT the async Stop hook | Surface from the Stop hook (original PATH B) | ZFGWS1 shipped Stop as `async:true` — backgrounded, surfaces nothing; the trigger must live where output reaches the agent |
| Transport selection | Try REST; on auth failure fall back to spool+agent; per-draft outcome | Env-sniff cloud vs local; config flag | "Cheapest transport that works" needs no env detection and degrades correctly on any token failure, not just cloud |
| Footprint of the agent path | **Muted** — nudge is a system-reminder-only `additionalContext` (docs-confirmed: user never sees it as a chat message); agent files via ONE subagent `Task` and emits NO confirmation line | One-line confirmation ("filed N findings"); `mcp_tool` hook filing (no Task at all) | User steer 2026-07-01: "as muted as possible." Confirmation line adds visible footprint; `mcp_tool` hook can't run the search-then-file dedup and SessionStart fires before MCP connects. Floor = one Task call at a boundary |

## Arch alignment

Honors **7D8PJP (invisible retro extraction)** — extraction + spool stay on the
backgrounded async Stop hook, zero conversation footprint. Honors **ZFGWS1 (async
Stop hook + delta re-arm)** — does not re-add surfacing to the Stop hook; the
nudge trigger moves to a surfacing-capable boundary hook. Honors the **egress
pipeline as the security boundary** — only post-egress `{signature,title,body,
labels}` reach disk (NTB1.AC1); the spool never sees raw finding text.

## Known deviations

skip: no deviations planned — this reuses the shipped self-report spool →
factual-surfacing → agent-transport pattern; the only new surface (per-draft drain

+ persisted batch marker) extends the existing `draft-spool.ts` rather than
introducing a new architecture.

## Assessment triggers

Revisit if: (a) the spool needs to survive across containers (would force a
git-backed/committed spool — explicitly rejected in scope today); (b) a second
agent surface (Codex #551 / Cursor #552) needs the same fallback, which would push
the transport-selection + drain logic below `retroCommand` into a shared module;
(c) draft volume per session routinely approaches the `MAX_DRAFTS_PER_SESSION=20`
cap, making the rewrite-on-drain cost non-trivial (would favor a compaction
strategy over full-file rewrite).
