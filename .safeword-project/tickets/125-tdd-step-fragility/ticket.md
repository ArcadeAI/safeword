---
id: '125'
type: task
phase: intake
status: backlog
created: 2026-04-14T20:57:00Z
last_modified: 2026-04-14T20:57:00Z
---

# TDD step detection fragility and quality review bypass

**Goal:** Address two related weaknesses in the enforcement architecture: the implicit format contract between BDD skills and hook parsers, and the one-shot nature of stop hook quality reviews.

**Why:** Both issues compound on teams — implicit contracts break when multiple contributors touch skills/hooks independently, and one-shot reviews let Claude bypass quality gates with shallow self-assessment.

## Problem 1: parseTddStep relies on an unspecified format

`parseTddStep()` in `post-tool-quality.ts:186` parses test-definitions.md for RED/GREEN/REFACTOR sub-checkboxes. The contract is implicit:

- `###` headings as scenario delimiters
- Exactly `- [x] RED` / `- [ ] GREEN` / `- [ ] REFACTOR` as sub-checkboxes
- First scenario with mixed checked/unchecked state = "active"

**Failure modes:**

- Claude writes `- [x] Red` (title case) or `- [ ] REVIEW` → parser silently misdetects
- Claude marks `[x] RED` and `[x] GREEN` in one edit → hook sees `green`, skips review. No invariant that RED was committed before GREEN was marked.
- No write-time validation — the BDD skill produces the format, the hook consumes it, neither validates.

**Current defense:** Skill instructions guide Claude to mark one checkbox at a time. The implicit contract works when one developer maintains both sides. Breaks when contributors, skill refactors, or model behavior changes introduce drift.

**Options to explore:**

- Formalize the format with write-time validation in a PreToolUse hook on test-definitions.md edits
- Replace checkbox parsing with a git-diff-based approach (Critique 5 escalating gate from ticket #124 discussion)
- Add case-insensitive matching and extra-checkbox tolerance to the parser (band-aid)
- Remove parseTddStep entirely if ticket #124 eliminates its consumers

## Problem 2: stop_hook_active makes quality reviews one-shot

When `stop_hook_active` is true (stop hook already fired once this turn), the hook lets Claude through to prevent infinite loops. Quality reviews are a speed bump, not a wall — Claude can "acknowledge" with shallow self-assessment and stop.

**Failure modes:**

- Claude responds "Looks good, no issues found" without actually reviewing
- The hook can't evaluate whether Claude's self-review was thorough
- On teams, quality review depth varies by developer's engagement level

**Options to explore:**

- Agent hooks (`type: "agent"`) — spawn a subagent to actually read code and run tests before allowing stop. Real verification, not self-reported. Cost: 30-60s per stop cycle.
- Skill invocation check — stop hook verifies `/verify` or `/tdd-review` was invoked during the session before allowing stop. Lightweight enforcement without agent overhead.
- Graduated bypass — first `stop_hook_active` gets a lighter review, second allows through. Adds one more review cycle without infinite loops.
- Accept the tradeoff — the done gate (hardBlockDone) already enforces at the most critical point. Mid-work quality reviews are advisory by design.

## Relationship to other tickets

- **Ticket #124** (derive phase state): if parseTddStep consumers are removed, Problem 1 becomes moot — parser has no readers. But if TDD step tracking is revived (e.g., via escalating gate), the format contract still matters.
- **Ticket #109** (enforcement redesign): parent context for this architectural discussion.

## Work Log

- 2026-04-14T20:57:00Z Created: from architecture critique session — Critiques 2 and 3
