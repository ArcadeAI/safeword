---
id: 112d
slug: zombie-cleanup-trim
status: done
type: task
created: 2026-04-11
parent: '112'
---

# Trim zombie-process-cleanup.md from 285 to ~180 lines

**Goal:** Fix correctness issues, cut human-oriented content that doesn't serve the agent, remove repeated content.

## Correctness fixes

### 1. Broken cross-reference (line 47)

References `development-workflow.md` → "E2E Testing with Persistent Dev Servers". File doesn't exist — confirmed no `*development-workflow*` in templates. E2E persistent dev server content lives in testing-guide.md.

**Fix:** Change reference to point to `testing-guide.md`.

### 2. `kill -9` without graceful shutdown

Every example jumps straight to SIGKILL. Better practice: SIGTERM first, then SIGKILL. `kill -9` prevents cleanup handlers (temp file deletion, port release, socket cleanup).

**Fix:** Update the recommended pattern to:

```bash
kill -15 "$pid" 2> /dev/null
sleep 1
kill -9 "$pid" 2> /dev/null
```

Also consider updating `cleanup-zombies.sh` itself (separate scope — script change, not guide change).

### 3. Hardcoded username (line 206)

`ps aux | grep "/Users/alex/projects/my-project"` — real username in example.

**Fix:** Replace with placeholder path.

## What to cut (~105 lines)

| Section                       | Lines              | Why it's bloat                                                                                                                                                        |
| ----------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Common Patterns by Tech Stack | 102-139 (38 lines) | Four sections showing same `lsof -ti:PORT \| xargs kill -9` with different ports. Script auto-detects framework. Quick Reference table already covers manual pattern. |
| tmux/Screen Sessions          | 142-166 (25 lines) | Teaching tmux to an AI agent is off-scope. Agent doesn't manage terminal sessions. Human workflow advice.                                                             |
| Best Practices                | 168-177 (10 lines) | Restates: use port-based (said above), never killall node (said above), clean up before starting (said in quick start).                                               |
| Key Takeaways                 | 278-285 (8 lines)  | Third restatement of quick start + best practices.                                                                                                                    |

## What to keep

| Section                    | Lines   | Why it earns its place                      |
| -------------------------- | ------- | ------------------------------------------- |
| Quick Start                | 1-22    | Agent reads this first, can act immediately |
| The Problem                | 24-35   | Context for why this matters                |
| Port-Based Cleanup         | 38-70   | Core technique with rationale               |
| Built-in Cleanup Script    | 72-99   | Primary tool documentation                  |
| Debugging Zombie Processes | 180-208 | Useful when script isn't enough             |
| Quick Reference table      | 210-223 | Scannable, actionable                       |
| What NOT to Do             | 225-238 | Clear anti-patterns                         |
| Advanced: Bisect Scripts   | 240-276 | Unique, genuinely useful                    |

## Context

- Claude Code has zero built-in process management — no subprocess tracking, no automatic cleanup, no port management
- This guide fills a real gap that no other Claude Code documentation addresses
- The cleanup script itself is well-designed; this ticket is about the guide content, not the script

## Work Log

- 2026-04-11T23:31 Created ticket from zombie-process-cleanup audit in parent #112.
