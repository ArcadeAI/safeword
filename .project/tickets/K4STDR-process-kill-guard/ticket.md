---
id: K4STDR
slug: process-kill-guard
type: task
phase: intake
status: in_progress
created: 2026-07-06T01:04:22.130Z
last_modified: 2026-07-06T01:04:22.130Z
external_issue: https://github.com/ArcadeAI/safeword/issues/773
scope:
  - lib/process-kill-guard.ts predicate (bare-runtime-name killall/pkill detection)
  - pre-tool-quality.ts Bash-branch denial next to the ledger gate
  - Claude settings Bash matcher for pre-tool-quality (revives the dormant Bash branch)
  - cursor requiresFailClosedShellGate routing
  - zombie-process-cleanup.md:34 prose trimmed to enforcement pointer
out_of_scope:
  - plain `kill <pid>` (targeted, safe)
  - pkill -f with path/pattern-scoped targets (guide-sanctioned)
  - browser/test process names (chromium, playwright) — interpreters only
  - runtime-materialized targets (variables, eval) — documented detection limit
done_when:
  - killall node / pkill -9 node denied on Claude, Codex, and Cursor shell channels
  - guide-sanctioned scoped kills still allowed
  - zombie-process-cleanup.md warning is a pointer to the hook
---

# Bash denylist: block broad killall/pkill process kills

**Goal:** A PreToolUse hook denies Bash commands that kill processes by bare runtime name (killall node, pkill -9 node), pointing to project-scoped alternatives

**Why:** Nothing but prose (zombie-process-cleanup.md:34) stops an agent from wiping every project's node processes on a shared machine; #773 graduates this invariant to code first, then trims the prose to a pointer

## Design

**Home: pre-tool-quality.ts Bash branch, predicate in lib/process-kill-guard.ts** — mirrors the W42G34 bash-ledger-writes architecture exactly: pure predicate on shell-segments tokenization, consumed by the one gate all three surfaces delegate to (Codex adapter forwards every Bash call; Cursor via `requiresFailClosedShellGate`; Claude via settings matcher).

**Deviation recorded (Claude wiring):** Claude's generated settings never registered `pre-tool-quality.ts` under a `Bash` matcher, so the entire Bash branch (W42G34 ledger gate, J7VBGJ REFACTOR-commit gate) has been dead on Claude since birth — both were designed for the Bash channel (commits only happen via Bash). Concrete defect fixed: dormant enforcement. Pre-mortem: if this was wrong, the ledger/refactor gates were meant to be Codex/Cursor-only — nothing in their tickets says so, and their integration tests exercise the Claude-shaped payload. Adding `matchedHook('Bash', pre-tool-quality.ts)` is part of this graduation.

**Detection semantics:** deny `killall`/`pkill` when any non-flag argument token (after `^`/`$` anchor stripping) equals a shared interpreter runtime name: node, bun, deno, python, python3, ruby, java. Signal flags irrelevant (`-9`, `-SIGKILL`, TERM — all cross-project). `pkill -f "playwright.*$(pwd)"` and other path/pattern-scoped targets pass (guide-sanctioned). Detection limits documented in-module, same doctrine as bash-ledger-writes: close the accident path, not every adversarial path.

**Rejected:** standalone `pre-tool-process-kill-guard.ts` hook (Cursor/Codex delegate to pre-tool-quality, so a standalone hook would need duplicate adapter routing); `ask` instead of `deny` (config-guard precedent is for legitimate-but-risky edits — a broad kill always has a project-scoped alternative, so deny + alternatives is strictly better guidance).

## Work Log

- 2026-07-06T01:04:22.130Z Started: Created ticket K4STDR
- 2026-07-06T01:15:00Z Found: pre-tool-quality Bash branch unreachable on Claude (settings matcher is EDIT_TOOLS only) — ledger + REFACTOR gates dead on the primary surface; wiring fix folded into this ticket
- 2026-07-06T01:15:00Z Decided: predicate lib + Bash-branch consumer + Claude Bash matcher + cursor fail-closed routing (see Design)
- 2026-07-06T01:34:00Z RED: unit + integration + config-matcher tests written and failing (pre-commit lint blocks committing an unresolved import, so RED and GREEN land in one commit)
- 2026-07-06T01:36:00Z GREEN: lib/process-kill-guard.ts + Bash-branch deny + config.ts Bash matcher + cursor routing + schema registration; dogfood mirrors synced (.safeword/hooks, .claude/settings.json); guide prose trimmed to pointer; 50/50 targeted + 1009/1009 hooks/templates tests pass; parity 213 pairs in sync
- 2026-07-06T02:10:00Z Verified: full suite 4803 passed / 8 failed — all 8 are pre-existing `Error.isError is not a function` (container runs Node 22 workers; repo floor is Node 24 since v0.66.0), in gherkin/self-report/codify suites untouched by this change; identical failures reproduce with and without the change
