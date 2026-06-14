---
id: 645W8H
slug: session-reentry-brief
type: feature
phase: done
status: done
created: 2026-05-22T15:11:24.096Z
last_modified: 2026-05-22T22:34:00.000Z
scope:
  - Stop hook appends one line per turn to `.safeword-project/re-entry.md` in the canonical shape `<ISO-timestamp> <session-id> ticket=<id>/<phase> Next: <imperative>` (POSIX append, atomic for sub-PIPE_BUF writes).
  - All deterministic fields (timestamp, session_id, ticket id, ticket phase) are hook-injected from Stop-hook stdin and ticket frontmatter — never typed by the agent. Only the Next: imperative is extracted from the agent's final assistant message via regex.
  - Next:-extraction rule (Phase 4 refinement) — the regex matches the **last** occurrence of `**Next:** <imperative>` in the assistant's final message regardless of position; if multiple `**Next:**` lines are present, the last one wins. Aligns with the SAFEWORD.md "end with the call" voice rule. Existing Rule 1 scenarios cover the behavior; no new scenario required.
  - SessionStart hook reads the log tail, filters entries by current session_id, and injects the last 3 matching entries via `additionalContext`. Includes a one-line trailer "N other Claude sessions active here, most recent at HH:MM" when N>0.
  - When the agent's final message has no extractable `**Next:** ...` line, the hook skips the entry (no garbage entries with empty intent).
  - When there is no active ticket, the field renders `ticket=∅/freeform`; the line still emits with the Next: imperative.
  - Resume paths: `/resume <name>` → filter to picked session id; `claude --continue` → filter to most-recent session id; fresh `claude` → no specific session, render most recent entry with "(from another session)" tag.
  - Surfacing (post-elicit, Q1 = D): SessionStart hook injects additionalContext **silently** (Claude has it for "where were we?" recall). A separate **status-line script** renders the most recent Next: imperative ambient and always-perceptible. Two channels — one for Claude, one for the user's glance — combined per Trafton & Altmann's "blatant cue beats subtle cue" finding plus IDE convention (VS Code/Zed/JetBrains do ambient persistence, not "welcome back" modals).
  - Multi-session handling (post-elicit, Q2 = silent unless conflict, supersedes earlier "trailer states count" scope): conflict = another session in this worktree edited a file in its last 10 turns AND that file is currently dirty in `git status`. On conflict: (a) additionalContext includes one warning line naming the file(s); (b) status-line prepends `⚠️ conflict: <file>` before the Next: imperative. No mention of other sessions otherwise — silent by default.
  - Fresh `claude` (post-elicit, Q3 = A): show the single most-recent entry across all sessions, tagged "(from another session)" — matches Anthropic's documented memory-tool pattern ("ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE") and Parnin & Rugaber's task-aligned-cue finding (one targeted cue, not a feed).
  - Slice 3 added: standalone status-line script reads `.safeword-project/re-entry.md` tail, calls the shared conflict-detection lib, emits a one-line ambient indicator.
out_of_scope:
  - Dirty-file count, last-test verdict, or any derivable retrospective state on the line. Per Anthropic's just-in-time context-engineering principle (cited in research): identifiers stay in context; state gets pulled on demand by the agent if the next move needs it. Promote a state field to scope only when its value would change the agent's immediate next action (e.g., last run was RED → re-run test before editing). None of the current candidates clear that bar.
  - Cross-worktree dashboard (proposed Option B from figure-it-out). Pointless without per-worktree artifact existing; can be a follow-up feature once this lands.
  - Auto-trim / TTL on the log file. Phase 2 if log size becomes a problem in practice.
  - Compaction / SDK memory-tool integration (`memory_20250818`). Useful but adds dependency on a beta primitive; revisit after this ships.
  - "Where do I stand across all 7 worktrees" cross-worktree status view (proposed Option B / scope (c) from the earlier conversation). Out for this ticket; possible follow-up.
done_when:
  - A cold `claude` invocation in a worktree with prior re-entry entries shows the last 3 filtered entries via additionalContext within the first agent turn, no user action required.
  - Two concurrent Claude sessions writing to the same `.safeword-project/re-entry.md` produce two correctly-tagged entries with no interleaving (test: scripted concurrent appends).
  - When a `**Next:** ...` line is absent from the assistant's final message, no log entry is written for that Stop.
  - When `additionalContext` is injected, the human-readable render is ≤ 5 lines and each entry is one line.
  - Resume via `/resume <name>`, `claude --continue`, and fresh `claude` start all show the correct filtered tail per the scope rules above (test: integration tests for each resume path).
---

# session-reentry-brief

**Goal:** Make worktree re-entry fast — when a user returns to a Claude Code worktree after hours/days away, they should know "what was happening" and "what to do next" in under 10 seconds, without reading more than one or two lines.

**Why:** Re-entry's bottleneck is reconstructing _intent_, not state (Parnin & Rugaber 2011: only 10% of resumed programming sessions begin editing within a minute; Altmann & Trafton 2002: goal-activation decay, not lookup, is the rate-limiter). The single most effective intervention in the literature is an explicit "next step" marker authored at suspension time. Safeword just shipped that discipline for skill output (PR #133); the same pattern wins for session boundaries.

## Convergent evidence (from research, 2026-05-22)

- **Anthropic SDK pattern (documented):** `compact-2026-01-12` summarizes at suspension → `memory_20250818` stores the brief → next session reads in one tool call. This is the canonical "pick up where you left off" pattern.
- **Claude Code rails (available, not wired):** `SessionStart` hook accepts `additionalContext` injection; `MEMORY.md` auto-loads first 200 lines; `claude agents` dashboard for `/bg`'d sessions. Gap: no automatic bridge writes the brief at session end or injects it at next start.
- **Human-factors literature:** prospective intent in glance-readable form beats retrospective state. Diff-reading is "last resort" for programmers (Parnin & Rugaber).

## Direction (figure-it-out output)

**Recommend Option A: per-worktree re-entry brief.** `Stop` hook writes one line per turn to an append-only `.safeword-project/re-entry.md` log: `<timestamp> <session-id> <ticket-or-branch> Next: <imperative>`. `SessionStart` hook reads the tail and injects via `additionalContext`, filtering by current session_id, with a tail line acknowledging any other sessions active in the worktree.

**Smallest viable form:** one line at Stop, one line at SessionStart. No new schema. Reuses ticket frontmatter + work log + Next: discipline already shipping.

**Why A over B (cross-worktree dashboard) or C (lean on `claude agents` + naming):** A captures intent at suspension automatically. C parasitically relies on user discipline (naming, `/bg`) that won't happen. B is a thin aggregator that only earns its keep after A exists.

## Multi-session handling (designed in, not phase 2)

Two sessions in one worktree share the filesystem. Solution baked into the design:

- **Append-only** entries — POSIX append is atomic for writes under PIPE_BUF (~4KB); single-line entries from concurrent writers can't interleave.
- **Session-tagged** — every line carries the writing session's ID.
- **Filter on read** — SessionStart shows the current session's tail first, plus a one-line note: "N other Claude sessions active in this worktree, most recent at HH:MM."

## Open scope questions (resolve in Clarify)

- What goes on the line? Just `Next:`? Plus dirty-file count? Plus last test status? Plus active-ticket phase?
- Trigger on every `Stop`, or only when an active ticket exists / when the line would be different from the previous entry?
- How does the brief decay? Cap at last N entries? Auto-trim entries older than X days?
- Resume from `/resume` picker (knows session ID) vs `claude --continue` (most recent) vs fresh `claude` start (no specific session) — confirm injection logic for all three.
- What does the user see when they invoke `claude` cold in a worktree with no prior session at all (empty log)? Silent, or a one-liner like "no recent work logged for this worktree"?

## Research sources

- [Anthropic — Memory tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/memory-tool)
- [Anthropic — Compaction](https://platform.claude.com/docs/en/docs/build-with-claude/compaction)
- [Claude Code — SessionStart hook](https://code.claude.com/docs/en/hooks)
- [Claude Code — Memory](https://code.claude.com/docs/en/memory)
- Parnin & Rugaber (2011), [Resumption Strategies for Interrupted Programming Tasks](https://link.springer.com/article/10.1007/s11219-010-9104-9)
- Altmann & Trafton (2002), [Memory for Goals](http://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2012/12/6ema_jgt_2002_a.pdf)
- Mark, Gudith & Klocke (2008), [The Cost of Interrupted Work](https://ics.uci.edu/~gmark/chi08-mark.pdf)
- Kirsh (1995), [The Intelligent Use of Space](https://adrenaline.ucsd.edu/kirsh/Articles/Space/AIJ1.html)

## Design refinement: hook injects all deterministic fields

The agent never types `session_id`, `timestamp`, `ticket=id/phase`, or any other deterministic field — eliminating hallucination risk. Contract:

- **Agent's responsibility:** end structured replies with `**Next:** <imperative>` (already required by SAFEWORD.md voice rule + skill discipline).
- **Stop hook's responsibility:** read `session_id`, `transcript_path`, `cwd` from Stop-hook stdin (Claude Code's documented hook input format); read active-ticket frontmatter from `.safeword-project/`; extract the `**Next:**` line from the assistant's last message in the transcript via regex; assemble the canonical line; atomic-append to `.safeword-project/re-entry.md`.

## Validation against Anthropic's documented patterns (research, 2026-05-22)

A second research pass validated the "+orientation" shape against current Anthropic guidance:

- **Memory-tool multi-session pattern** explicitly prescribes _progress log + feature checklist_ — intent + identifier — matching the chosen shape. No reference template ships dirty-state or test-verdict fields.
- **Effective Context Engineering** essay: "find the smallest possible set of high-signal tokens"; "maintain lightweight identifiers (file paths, stored queries, web links, etc.) and use these references to dynamically load data into context at runtime." This is the just-in-time principle that rules state fields out of scope: identifiers stay in context; state pulled on demand by the agent if the next move needs it.
- **Claude Code changelog (last 90 days)** has no shipped session-brief format — Anthropic hasn't chosen one. Greenfield design space; the chosen shape is consistent with their stated principles, not in conflict with a published format.
- **Healey preattentive timing** (200–250ms gist): supports keeping each entry to one line with fixed field order over packing fields per line.

## Work Log

- 2026-05-22T15:11:24.096Z Started: Created ticket 645W8H
- 2026-05-22T15:14:00.000Z Phase 0-2 seeded: figure-it-out research synthesized (3 parallel deep-research agents); Option A recommended with multi-session handling baked in; open scope questions enumerated for Clarify.
- 2026-05-22T15:30:00.000Z Design refinement: agent never types session_id — Stop hook reads it from stdin; only the Next: imperative is agent-authored. Eliminates hallucination risk.
- 2026-05-22T15:33:30.000Z Phase 0-2 closed: 4th research agent validated `+orientation` shape against Anthropic's memory-tool pattern + context-engineering essay; state fields ruled out via just-in-time principle. Scope/out_of_scope/done_when locked. Advancing to define-behavior.
- 2026-05-22T15:43:30.000Z Complete: Phase 3 — 17 scenarios defined across 7 rules. Trimmed from initial 23-scenario draft via figure-it-out debate (correct/elegant/no-bloat); cut partitions that exercised defensive coding or presentation pluralization rather than behavior. Saved `dimensions.md` and `test-definitions.md`. Advancing to scenario-gate.
- 2026-05-22T15:48:00.000Z Complete: Phase 4 — AODI clean across all 17 scenarios; adversarial pass surfaced two Next:-extraction ambiguities (position-in-message + multi-occurrence) resolved as scope refinements (last occurrence wins, regardless of position). No new scenarios. Advancing to decomposition.
- 2026-05-22T15:50:00.000Z Complete: Phase 5 — light decomposition; two slices (Slice 1 Stop-hook writer = 9 scenarios; Slice 2 SessionStart reader = 8 scenarios) sharing a `re-entry.ts` lib. No deeper breakdown needed (architecture clear). Advancing to implement.
- 2026-05-22T16:00:00.000Z Complete: Slice 1 scenarios 1.1–1.3 (RED + GREEN + REFACTOR triplets, with scenarios 1.2/1.3 covered as side effect of 1.1's bail-out logic). 969 hook+integration tests green.
- 2026-05-22T17:55:00.000Z In-flight re-scope after /elicit: Q1 → D (silent additionalContext + status-line ambient); Q2 → silent-unless-conflict, conflict = other session edited file AND dirty in git, surfaces in both additionalContext and status-line prefix; Q3 → A (fresh shows most-recent tagged "(from another session)"). Two parallel research agents validated Q1 (Trafton & Altmann blatant-cue + IDE convention) and Q3 (Anthropic memory-tool pattern + Parnin task-aligned cues). Cascade to test-definitions.md: replaced Rule 5 (multi-session trailer, 2 scenarios) with new Rule 5 (conflict detection, 3 scenarios); added Rule 8 (status-line script, 3 scenarios). Added Slice 3 (status-line script). Total: 21 scenarios across 8 rules (was 17/7). Slice 1 unaffected; resuming scenario 2.1 RED.
- 2026-05-22T19:25:00.000Z Complete: Phase 6 — all 21 scenarios closed across Slices 1, 2, and 3. Cross-scenario REFACTOR (45c1a5b) extracted shared pure functions to `.safeword/hooks/lib/re-entry.ts`. Re-entry test surface: 22 tests across 5 files (re-entry-stop, re-entry-session-start, re-entry-conflict-detection, re-entry-statusline, re-entry-concurrent). Parity 106 pairs + 3 contracts. Advancing to verify.
