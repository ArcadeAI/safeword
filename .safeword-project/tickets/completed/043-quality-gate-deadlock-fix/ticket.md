---
id: 043
type: bugfix
phase: done
status: done
created: 2026-03-20T05:25:00Z
last_modified: 2026-03-20T07:54:00Z
parent: 044
---

# Quality Gate Deadlock: Pre-tool blocks edits to project artifacts

**Goal:** Fix circular dependency where quality gates block edits to `.safeword-project/` files, creating unrecoverable deadlocks.

**Why:** Discovered in production use (overlord project). Gates exist to enforce code commit discipline, but they collaterally block edits to project management artifacts (tickets, test-definitions.md, work logs). This creates deadlocks where you can't fix the thing that caused the gate.

## Observed Failures (overlord project)

### Case 1: Ticket creation triggers phase gate → blocks all subsequent writes

1. Write creates ticket 018 with `phase: implement`
2. Post-tool detects null→implement phase change, sets `gate: phase:implement`
3. Edit/Write to ticket 018 to fix phase → **blocked by pre-tool**
4. Write to create ticket 019 (completely unrelated) → **also blocked**
5. Agent had to use `Bash cat >` heredoc to bypass pre-tool hook entirely

**Root cause:** Pre-tool blocks ALL Edit/Write when gate is set, regardless of target file. Also, null→phase (ticket creation) shouldn't be treated as a phase transition.

### Case 2: test-definitions.md wrong checkbox → deadlock

1. Accidentally check wrong TDD checkbox in test-definitions.md
2. Post-tool sets TDD gate (e.g., `tdd:green`)
3. Can't edit test-definitions.md to uncheck → **blocked by pre-tool**
4. Can't commit to clear gate → nothing useful to commit

**Root cause:** Same as Case 1 — pre-tool doesn't distinguish code files from project artifacts.

### Case 3: Phase correction cascading gates

1. Fix phase from `implement` to `intake` → post-tool sets NEW gate `phase:intake`
2. Every phase correction triggers another gate requiring another commit
3. Not a deadlock (ticket.md exempt with partial fix), but annoying for ticket housekeeping

## Analysis

**What gates protect:** Code commit discipline — "commit before writing more code."

**What gets collateral-blocked:** `.safeword-project/` files — tickets, test definitions, work logs, learnings. These are metadata/control-plane artifacts, not code.

**Key insight:** Exempting project artifacts doesn't weaken gate enforcement. Code edits are still blocked. The TDD commit discipline (write test → commit → write impl → commit → refactor → commit) is enforced by blocking code edits, not by blocking checkbox updates.

## Fix (two changes)

### Change 1: Pre-tool — exempt `.safeword-project/` files

In `pre-tool-quality.ts`: if the target file is inside `.safeword-project/`, exit immediately. No gate check, no blocking.

- Fixes Case 1 (ticket edits), Case 2 (test-definitions.md edits)
- Code edits still fully gated

### Change 2: Post-tool — skip gate on null→phase (ticket creation)

In `post-tool-quality.ts`: when `lastKnownPhase` is null and a phase is detected, update `lastKnownPhase` silently without setting a gate.

- Fixes Case 3 (ticket creation isn't a phase transition)
- Real phase transitions (intake→implement) still gate

## Scope

**Files changed:**

- `.safeword/hooks/pre-tool-quality.ts` — add file path check, exempt `.safeword-project/`
- `.safeword/hooks/post-tool-quality.ts` — skip gate when `lastKnownPhase` is null
- `packages/cli/tests/integration/quality-gates.test.ts` — add test coverage

**Out of scope:**

- Escape hatch command (`/clear-gate`) — not needed if artifacts are exempt
- Phase ordering / directional gates — unnecessary complexity

## Work Log

- 2026-03-20 05:25 UTC — Ticket created from overlord production incident. Analysis complete, fix designed. Partial implementation exists (ticket.md-only exemption + 3 tests passing).
