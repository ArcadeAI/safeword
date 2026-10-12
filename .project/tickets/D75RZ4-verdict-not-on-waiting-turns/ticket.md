---
id: D75RZ4
slug: verdict-not-on-waiting-turns
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/5765
scope:
  - In the Claude Code Stop hook (templates/hooks/stop-quality.ts), a non-editing turn whose last tool call launches background work (Bash or Agent with run_in_background true, or Monitor) yields terminal-handoff evidence `none`, so a plain status reply is not corrected.
out_of_scope:
  - Edits-only applicability — it would reverse reviewed spec rule ASG60P R1 (observable current-turn work requires a terminal handoff).
  - Read-only and unattended scheduled turns.
  - Near-miss format hints (colon after the verdict, naming the extra sentence, lists inside the brief).
  - Codex and Cursor Stop adapters (Codex has no run_in_background; Cursor already checks edits only).
done_when:
  - A turn whose last tool call is a background Bash, background Agent, or Monitor launch ends with a plain status reply and the Stop hook emits no correction.
  - A turn that launches background work and then runs a foreground tool is still corrected.
  - A foreground-only tool turn is still corrected (existing behavior, R1 preserved).
  - Stop-hook suites pass; generated surfaces regenerated and checked clean.
created: 2026-10-11T23:28:14.125Z
last_modified: 2026-10-11T23:28:14.125Z
---

# Stop demanding a verdict when a turn only launches background work

**Goal:** A Claude Code turn whose last tool call launches background work may end with a plain status reply

**Why:** The stop hook forces a full decision brief on 'running, will report back' turns (~25 retros, #5765), while spec R1 still requires handoffs after real work

**Type:** Bug

**Design:** `/figure-it-out` (2026-10-11) chose a waiting-turn exemption over edits-only applicability.
Spec ASG60P R1 deliberately makes observable current-turn work subject to the terminal contract, and
its scenario "A brief substantive reply still requires a terminal paragraph" pins that; Cursor checks
edits only because its stop event cannot see other tools. A background launch as the turn's last tool
call means the turn is waiting; its results return in a new turn (the #1431 notification boundary),
which is still checked. Verified in a real transcript: background launches record
`input.run_in_background: true` on Bash and Agent, and `Monitor` is its own tool name.

**Tests:**

- [x] A turn ending with a background Bash, background Agent, or Monitor launch and a plain status
      reply gets no correction.
- [x] A turn that launches background work and then runs a foreground tool is still corrected.
- [x] A turn whose background launch failed (errored tool_result) is still corrected (implement
      review aa516999).
- [x] A foreground-only tool turn is still corrected (existing test).
- [x] A turn that edits files and then launches background work is still corrected (edit evidence wins;
      intake review effdaf3e).

## Work Log

- 2026-10-11T23:28:14.125Z Started: Created ticket D75RZ4
- 2026-10-11T23:29:09.141Z Phase: intake → implement
- 2026-10-11T23:38:38.442Z Phase: implement → verify
- 2026-10-12T00:47:38.841Z Phase: verify → done
