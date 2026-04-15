---
id: '111'
title: Reflexion-style structured failure memory for reminders
type: task
phase: done
status: done
created: 2026-04-11
parent: '109'
scope: Three-layer failure learning — session detection, persistent counters, CLAUDE.md escalation
out_of_scope: Custom persistence layer, embedding/retrieval, adversarial review agent, cross-session free-text memory
done_when: Hooks detect structural failures, inject session-scoped reminders, track cross-session pattern counters, and prompt hook suggests CLAUDE.md entries when patterns repeat
---

## Goal

Evolve the reminder layer (#109) from static status lines to failure-informed reminders. Three layers: session-scoped detection, persistent pattern counters, and human-approved CLAUDE.md escalation.

## Architecture decision: work WITH Claude Code, not against it

Research (April 2026) found:

- **Memory poisoning is a proven production attack.** Cisco demonstrated a complete chain against Claude Code MEMORY.md — npm postinstall → poisoned memory → agent exfiltrates data. Anthropic remediated in v2.1.50 by demoting memory file authority.
- **No production coding agent does autonomous cross-session _failure-specific_ memory.** General cross-session memory exists (Copilot Memory, Claude auto-memory, Mastra Observational Memory), but none autonomously track and learn from _structural failures_. SWE-agent, OpenHands, Aider all reset between tasks. Devin's Knowledge system is user-curated.
- **Claude Code's product direction solves persistence.** Auto-memory + AutoDream consolidation + Memory Tool API (`memory_20250818`, client-side CRUD). Building a parallel persistence layer fights the platform.
- **CLAUDE.md has full system prompt authority** (not demoted post-Cisco). The only persistence layer where instructions are treated as hard rules, not suggestions.

**Decision:** Don't build custom persistence. Use session state for detection, counters for cross-session tracking, CLAUDE.md for permanent learning. Let Anthropic solve memory consolidation.

## Three-layer design

### Layer 1: Session-scoped failure detection (automatic)

Hooks detect structural failures and write to `quality-state-{session}.json`:

```json
{
  "recentFailures": [
    { "pattern": "done-gate-tests-failed", "timestamp": "2026-04-12T22:30:00Z" },
    { "pattern": "loc-exceeded", "timestamp": "2026-04-12T21:15:00Z" }
  ]
}
```

Prompt hook (UserPromptSubmit) injects the most relevant failure as a parenthetical. UserPromptSubmit supports `additionalContext` in JSON output and stdout injection — both documented.

Example injection: `"TDD: GREEN. (You hit the LOC gate earlier — commit before this grows.)"`

**Detectable patterns (start with 2, expand later if data warrants):**

| Hook             | Failure        | Pattern key              |
| ---------------- | -------------- | ------------------------ |
| Stop (done gate) | Tests failed   | `done-gate-tests-failed` |
| Pre-tool         | LOC gate fires | `loc-exceeded`           |

The other done-gate variants (scenarios-incomplete, audit-missing) are subsets of "didn't run /verify or /audit" — collapse into `done-gate-tests-failed` for now. Phase-skip detection (intake→implement) requires tracking visited phases — defer unless dogfooding shows it's needed. Start with 2 patterns.

**Writes:** Stop hook writes failure to `recentFailures` BEFORE calling `hardBlockDone` (which exits immediately). Pre-tool hook writes when LOC gate fires. ~10 lines across stop-quality.ts and pre-tool-quality.ts.

**Reads:** Prompt hook (prompt-questions.ts) reads `recentFailures`, injects most recent failure as parenthetical. Relevance mapping:

| Current phase | Relevant failure         | Injection                                                         |
| ------------- | ------------------------ | ----------------------------------------------------------------- |
| implement     | `loc-exceeded`           | "(You hit the LOC gate earlier — commit before this grows.)"      |
| done          | `done-gate-tests-failed` | "(Tests failed at done last time — run /verify before stopping.)" |
| any           | most recent              | Fallback: inject most recent failure regardless of phase          |

~10 lines.

### Layer 2: Persistent pattern counters (near-zero risk)

`.safeword-project/failure-counts.json`:

```json
{
  "loc-exceeded": { "count": 7, "lastSeen": "2026-04-12", "countAtLastSuggestion": 3 },
  "done-gate-tests-failed": { "count": 3, "lastSeen": "2026-04-11", "countAtLastSuggestion": null }
}
```

Written by the same hooks that write Layer 1 (stop-quality.ts, pre-tool-quality.ts). Increment counter when a failure occurs. No filesystem restrictions documented for hooks — confirmed against latest Claude Code docs.

**Why this is safe:** Counters are integers, not text. No free-text reflections, no tool output, no agent prose. You can't prompt-inject through `{"count": 7}`. The poisoning risk in Reflexion comes from storing reflections (free text from error flows) — we store only tallies.

**Count inflation guard:** Max 1 increment per pattern per session. Prevents a bad session with 50 LOC gate fires from counting as 50 occurrences. Track `incrementedPatterns` array in quality-state (session-scoped, auto-resets). Check before incrementing counter file.

**Gitignore:** Add `.safeword-project/failure-counts.json` to `.gitignore` at implementation time. Currently only `quality-state*.json` is ignored — counter file would be committed to git, sharing one developer's failure counts with the team.

~15 lines: read/write a JSON counter file + per-session dedup.

### Layer 3: CLAUDE.md escalation (human-approved, full authority)

**Injected by the prompt hook (UserPromptSubmit), NOT the stop hook.** This is a key design choice:

- Stop hook output supports only `decision` and `reason` — no `additionalContext`.
- UserPromptSubmit stdout is "added as context that Claude can see and act on" (documented).
- The existing prompt hook outputs plain text via `console.log(lines.join('\n'))`. The escalation suggestion is just another line — no need to switch to JSON `additionalContext` format.
- Escalation is better at session start (prompt hook reads counter file on first turn) than mid-stop (noisy, competes with quality review message).

**Mechanism:** Prompt hook reads `failure-counts.json`. When a pattern's counter exceeds threshold (calibrate via dogfooding — start at 3), inject a one-line suggestion:

```
- Pattern "loc-exceeded" has fired 3 times across sessions. Consider adding a commit-frequency reminder to CLAUDE.md if the user agrees.
```

Claude sees this in context and can ask the user: "I've hit the LOC gate repeatedly. Want me to add a reminder to CLAUDE.md?" User decides. If yes, Claude writes to CLAUDE.md using standard Edit/Write tools (no restrictions documented). Claude Code docs confirm: "To add instructions to CLAUDE.md instead, ask Claude directly."

**CLAUDE.md has full system prompt authority** — changes persist ("loaded at the start of every conversation") and survive compaction ("project-root CLAUDE.md survives compaction: after /compact, Claude re-reads it from disk").

**Re-trigger logic:** Count-based, not time-based. Suggest when `count - countAtLastSuggestion >= threshold`. This means:

- First suggestion at count=3
- If user declines and problem stops → count stays, never re-fires
- If user declines but problem continues → re-fires at count=6, 9, 12...
- Frequency is proportional to problem severity, not calendar time

Time-based cooldown was considered and rejected — it nags on stale counts (same anti-pattern as the schema.ts warning we removed in #115). At threshold=3, the suggestion fires once per 3 failure sessions — well within acceptable alert rates even if the user never acts.

```json
{
  "loc-exceeded": { "count": 7, "lastSeen": "2026-04-12", "countAtLastSuggestion": 3 }
}
```

Auto-dismiss (stop suggesting after N ignored suggestions) deferred — at one suggestion per 3 failure sessions, alarm fatigue is unlikely. Add if dogfooding shows otherwise.

~12 lines in prompt-questions.ts: read counter file, check threshold + countAtLastSuggestion, append suggestion to output.

### Counter threshold calibration

No research gives a specific number. Start at 3 (fires after 3 occurrences across sessions). Adjustable constant.

- Too low (1-2): fires on first occurrence, before pattern is established — noise
- Too high (5+): pattern must repeat many times before escalation — too slow
- 3 is the minimum where "this keeps happening" is meaningful

Revisit based on dogfooding data.

## Hook contract verification (April 2026 docs)

All capabilities confirmed against `code.claude.com/docs/en/hooks` and `code.claude.com/docs/en/memory`:

| Capability                            | Confirmed | Mechanism                                           |
| ------------------------------------- | --------- | --------------------------------------------------- |
| Stop hook receives `session_id`       | Yes       | Common field on all hooks                           |
| Stop hook receives `stop_hook_active` | Yes       | Stop-specific field                                 |
| Hooks can write JSON files            | Yes       | No filesystem restrictions documented               |
| UserPromptSubmit injects context      | Yes       | `additionalContext` field or stdout                 |
| UserPromptSubmit fires every turn     | Yes       | Documented                                          |
| Claude can write to CLAUDE.md         | Yes       | "ask Claude directly, like 'add this to CLAUDE.md'" |
| CLAUDE.md persists across sessions    | Yes       | "loaded at the start of every conversation"         |
| Multiple hooks on same event          | Yes       | "All matching hooks run in parallel"                |
| `CLAUDE_PROJECT_DIR` env var          | Yes       | Documented                                          |

## What we explicitly don't build

| Approach                             | Why not                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Custom persistence layer             | Fights Claude Code's auto-memory + AutoDream direction                 |
| Free-text reflections                | Memory poisoning via tool output (Cisco incident)                      |
| Embedding/vector retrieval           | Overkill for 2-5 failure patterns                                      |
| Phase-skip detection                 | Requires tracking visited phases — defer unless dogfooding warrants    |
| Adversarial review agent             | Different architecture, different ticket                               |
| Writing to MEMORY.md from hooks      | Post-Cisco authority demotion; no hook-to-memory API; fragile coupling |
| Autonomous cross-session text memory | No production system does this safely                                  |
| Stop hook escalation suggestions     | Stop doesn't support `additionalContext` — use prompt hook instead     |

## Prerequisite

Dogfood #115 first. The improved hooks (frequency reduction, TDD-step messages, structural verification) may reduce failure repetition enough to make #111 unnecessary. Need 3-5 sessions of data.

If the same structural failures keep repeating across sessions, build this. If #115's improvements are sufficient, close as won't-fix.

## Implementation estimate

~50-55 lines of new code across 4 hook files + 4 template copies (8 files total). Includes error handling consistent with existing hooks:

- `quality-state.ts`: Add `recentFailures` and `incrementedPatterns` to `QualityState` interface (+3 lines)
- `stop-quality.ts`: Write failure to `recentFailures` when done gate blocks (+5 lines), increment counter file with per-session dedup (+12 lines)
- `pre-tool-quality.ts`: Write failure to `recentFailures` when LOC gate fires (+5 lines), increment counter file with per-session dedup (+8 lines)
- `prompt-questions.ts`: Read `recentFailures` for session injection (+8 lines), read counter file for escalation suggestion + update `countAtLastSuggestion` when suggestion fires (+15 lines). Note: this makes prompt-questions.ts a writer of `failure-counts.json` — new responsibility for a currently read-only hook.

No post-tool-quality.ts changes (phase-skip deferred). No new files except `failure-counts.json` (auto-created on first failure). No new dependencies. Templates synced as usual.

**Implementation notes (from code trace, April 2026):**

Before you start:

- **Pre-tool hook needs `writeFileSync` import.** Currently only imports `readFileSync`/`existsSync`.
- **Counter file won't exist on first run.** Handle gracefully: read returns empty → create with `{ pattern: { count: 1, lastSeen: today, countAtLastSuggestion: null } }`.
- **QualityState interface lies about required fields.** All fields are typed as required (`recentFailures: FailureEntry[]`) but old state files on disk won't have them. Use `state.recentFailures ?? []` at every read site — same pattern as existing `locAtLastReview ?? 0`.
- **Test field count assertion.** Test `3.2: PostToolUse creates state file with 7 fields` checks `toHaveLength(7)`. Adding `recentFailures` + `incrementedPatterns` bumps to 9. Update assertion AND add `toContain` checks for new keys. (This exact issue cost 20 min in #115.)

Patterns to use:

- **Stop hook: `recordFailureAndBlock(pattern, reason)` helper.** Done gate has 3 separate `hardBlockDone` calls (tests failed, scenarios incomplete, audit missing). The helper writes failure to state + increments counter + calls `hardBlockDone`. Alternative considered: write-at-top-then-remove-on-success — rejected because decrement interacts badly with `incrementedPatterns` dedup (session guard thinks pattern already counted, blocks future real increments).
- **Prompt hook: append to `lines` array (stdout), not JSON `additionalContext`.** The hook already outputs `console.log(lines.join('\n'))`. Escalation suggestion is just another line. Consistent with existing code.
- **Prompt hook: early return before counter file write.** Only write `countAtLastSuggestion` to `failure-counts.json` when a suggestion actually fires. Avoid I/O on every prompt.

Invariants:

- `recentFailures` accumulates within a session (no clearing). Prompt hook picks most relevant by phase match, falling back to most recent.
- No concurrent write risk: UserPromptSubmit fires at turn start, Stop fires at turn end. Claude Code blocks new input while the agent is active, so they never overlap within a turn.
- **8 files total** (not 4): each hook file has a template copy in `packages/cli/templates/hooks/`. Don't forget the sync.

## Research basis

- Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning" (NeurIPS 2023, arxiv 2303.11366) — GPT-4 improved from ~80% to ~91% on HumanEval with verbal reinforcement from past failures
- Cisco, "Identifying and Remediating a Persistent Memory Compromise in Claude Code" (2026) — npm postinstall → poisoned MEMORY.md → agent exfiltrates data. Remediated in v2.1.50
- Environment-Injected Memory Poisoning (arxiv 2604.02623) — "frustration exploitation": agents under error stress are 8x more vulnerable to injection
- MINJA (arxiv 2503.03704) — >95% injection success rate on agent memory systems
- MemoryAgentBench (Mem0, 2026) — inability to discard outdated info "gradually poisons retrieval precision" even without adversarial attack
- Anthropic, "Effective Context Engineering" (2025) — smallest set of high-signal tokens; progressive context, not raw accumulation
- Anthropic, "Trustworthy Agents in Practice" (2026) — per-action approval, prompt injection requires defense at every level
- Claude Code docs: hooks reference, memory docs, settings — all verified April 2026
- Claude Code AutoDream (rolling out 2026) — 4-phase memory consolidation, 200-line MEMORY.md cap
- Claude Code Memory Tool API (`memory_20250818`) — client-side CRUD; you control the storage backend
- Voyager (MineDojo/NVIDIA, 2023) — success-only skill storage + separate failed_tasks list fed to task proposer
- agentmemory (rohitg00) — 4-tier consolidation, Ebbinghaus-curve decay, hook-based failure capture

See also `.safeword-project/learnings/agent-behavior-research.md`

## Work Log

- 2026-04-11T22:54Z Created: Gap identified during research review of #109
- 2026-04-12T22:07Z Updated: Full architecture exploration. Decided three-layer approach (session detection + persistent counters + CLAUDE.md escalation). Rejected custom persistence, free-text reflections, and writing to MEMORY.md. Gated on #115 dogfooding data.
- 2026-04-12T22:19Z Updated: Verified all capabilities against latest Claude Code docs (April 2026). Moved escalation from stop hook to prompt hook (stop doesn't support additionalContext). Collapsed 5 detectable patterns to 3 (start lean). Added hook contract verification table, implementation estimate, and counter threshold calibration notes.
- 2026-04-12T22:33Z Quality review: Fixed Reflexion arxiv ID (2303.11366, not 2305.11738). Replaced unverified "Managed Memory Stores API" with verified Memory Tool API. Tightened cross-session memory claim to "failure-specific." Added count inflation guard (max 1 increment/pattern/session), updated estimate to ~50-55 lines.
- 2026-04-12T22:49Z Redesigned re-trigger logic: replaced time-based cooldown (7-day) with count-based (`countAtLastSuggestion`). Time-based nags on stale counts (same anti-pattern as schema.ts warning). Count-based is silent when problem stops, proportional when it continues. Auto-dismiss deferred. Fixed hardBlockDone ordering note, consistent naming for incrementedPatterns.
- 2026-04-12T23:12Z Code trace pass (5th review): Traced implementation against actual hook code. Found: stop hook needs `recordFailureAndBlock` helper for 3 block points; pre-tool needs `writeFileSync` import; prompt hook should use stdout lines not JSON `additionalContext` (matches existing code pattern); counter file creation on first failure needs handling. Updated implementation notes and Layer 3 mechanism to match actual codebase.
- 2026-04-13T00:30Z Final quality review (7th pass): Found `failure-counts.json` not covered by `.gitignore` (only `quality-state*.json` is) — would leak developer failure counts to team via git. Fixed concurrency reasoning (turn lifecycle, not event types). Updated estimate to 8 files (4 hooks + 4 templates).
- 2026-04-13T00:37Z 8th pass: Found QualityState interface backwards-compat issue (new fields on required interface, old files lack them — need `?? []` fallbacks). Found test field count assertion (test 3.2 checks `toHaveLength(7)`, needs bump to 9). Both are repeat traps from #115.
