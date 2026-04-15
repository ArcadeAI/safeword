# Test Definitions: Derive Phase State (#124)

**Feature**: Eliminate cached phase/TDD state — derive from ticket files at read time
**Related Issue**: #124
**Test File**: `packages/cli/tests/integration/quality-gates.test.ts` (extend existing suite)
**Total Tests**: 11 (0 passing, 0 skipped, 11 not implemented)

---

## Rule: Prompt hook derives phase from ticket file, not cache

> Rationale: The core behavioral change — prompt-questions.ts must call getTicketInfo() using activeTicket instead of reading lastKnownPhase from state.

- [x] Given activeTicket is set in session state and ticket.md has `phase: implement`, when prompt hook runs, then output includes phase-specific reminder for implement

### Scenario 1.1: Prompt hook reads phase from ticket file

- [x] RED
- [x] GREEN
- [x] REFACTOR

- [x] Given activeTicket is set and ticket.md has `phase: define-behavior`, when ticket.md is edited to `phase: implement` between two prompt hook invocations, then second invocation outputs implement reminder (not define-behavior)

### Scenario 1.2: Prompt hook reflects phase change between invocations

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Rule: Prompt hook derives TDD step from test-definitions.md, not cache

> Rationale: TDD step (RED/GREEN/REFACTOR) must be read live from test-definitions.md checkboxes, not from lastKnownTddStep in state.

- [x] Given activeTicket is set, phase is implement, and test-definitions.md has an active scenario with 1 checked sub-checkbox (RED), when prompt hook runs, then output includes "TDD: RED"

### Scenario 2.1: TDD step derived from test-definitions at prompt time

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Rule: Cold start shows "no active ticket"

> Rationale: When no ticket is bound (new session, cleared binding), the prompt hook must say so explicitly rather than silently omitting phase info.

- [x] Given session state has no activeTicket (null), when prompt hook runs, then output includes "no active ticket"

### Scenario 3.1: Cold start with no active ticket

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Rule: Freshness check clears stale activeTicket binding

> Rationale: If a ticket transitions away from in_progress (done, backlog, blocked, etc.), the binding should auto-clear at consumption time, not only at write time.

- [x] Given activeTicket points to a ticket whose status is "done", when prompt hook runs, then output shows "no active ticket" (binding cleared)

### Scenario 4.1: Binding cleared when ticket status is done

- [x] RED
- [x] GREEN
- [x] REFACTOR

- [x] Given activeTicket points to a ticket whose status is "blocked", when prompt hook runs, then output shows "no active ticket" (binding cleared for any non-in_progress status)

### Scenario 4.2: Binding cleared for non-standard statuses

- [x] RED
- [x] GREEN
- [x] REFACTOR

- [x] Given activeTicket points to a ticket whose folder has been deleted, when prompt hook runs, then output shows "no active ticket" (graceful degradation)

### Scenario 4.3: Binding cleared when ticket folder is missing

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Rule: Compact context uses per-session state, not legacy shared file

> Rationale: session-compact-context.ts currently reads hardcoded quality-state.json. Must switch to per-session state file + getTicketInfo() for phase.

- [x] Given per-session state file exists with activeTicket set, when compact context hook runs with session_id, then output includes ticket context derived from ticket.md

### Scenario 5.1: Compact context reads per-session state

- [x] RED
- [x] GREEN
- [x] REFACTOR

- [x] Given only legacy quality-state.json exists (no per-session file), when compact context hook runs with session_id, then it exits cleanly (no crash, no stale data)

### Scenario 5.2: Legacy shared file ignored gracefully

- [x] RED
- [x] GREEN
- [x] REFACTOR

- [x] Given per-session state has activeTicket set but the ticket status is "done", when compact context hook runs, then it outputs no ticket context (freshness check applies to compact context too)

### Scenario 5.3: Compact context skips stale ticket binding

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Rule: Post-tool no longer caches phase or TDD step

> Rationale: post-tool-quality.ts must stop writing lastKnownPhase and lastKnownTddStep to state. activeTicket binding remains.

- [x] Given a ticket.md is edited with a phase change, when post-tool hook runs, then state file contains activeTicket but NOT lastKnownPhase

### Scenario 6.1: Post-tool sets activeTicket but not phase cache

- [x] RED
- [x] GREEN
- [x] REFACTOR

- [x] Given test-definitions.md is edited, when post-tool hook runs, then state file does NOT contain lastKnownTddStep

### Scenario 6.2: Post-tool does not cache TDD step

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Rule: No residual cache fields or functions remain

> Rationale: Type-level and code-level guarantee that no consumer can accidentally read cached phase/TDD state or call removed helpers.

- [x] Given the codebase after implementation, when grepping for `lastKnownPhase` and `lastKnownTddStep`, then zero matches found in hook source files

### Scenario 7.1: Cache fields removed (static verification)

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Coverage Summary

**Total**: 13 scenarios
**Passing**: 13 (100%)
**Not Implemented**: 0 (0%)

**Rules**: 7

- Prompt hook derives phase from ticket (2 scenarios)
- Prompt hook derives TDD step from test-definitions (1 scenario)
- Cold start shows no active ticket (1 scenario)
- Freshness check clears stale binding (3 scenarios — done, blocked, missing folder)
- Compact context uses per-session state (3 scenarios — happy path, legacy fallback, stale binding)
- Post-tool no longer caches phase/TDD (2 scenarios)
- No residual cache fields or functions (1 scenario — static grep verification)
