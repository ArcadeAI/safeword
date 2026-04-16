---
id: '125'
type: task
phase: done
status: done
created: 2026-04-14T20:57:00Z
last_modified: 2026-04-15T23:10:00Z
scope:
  - Add explicit checkbox format example to TDD.md (valid vs invalid contrast)
  - Add one-checkbox-per-edit constraint with commit-after-each-step instruction
  - Sync change to both .claude/skills/bdd/TDD.md and packages/cli/templates/skills/bdd/TDD.md
out_of_scope:
  - PreToolUse or PostToolUse hooks for format validation (escalation path only)
  - Changes to parseTddStep() parser code
  - Problem 2 (stop hook quality reviews) — closed as designed
  - Agent hooks on stop
done_when:
  - TDD.md contains exact checkbox format example with valid/invalid contrast
  - TDD.md contains one-checkbox-per-edit + commit constraint
  - Both copies (active skill + source template) are identical
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

## Analysis (post ticket #124)

### Problem 1 reassessment

**Phantom failure mode:** Ticket claims `- [x] Red` (title case) would silently misdetect. False — `parseTddStep()` regex already uses `/i` flag (case-insensitive). One of four listed failure modes is not real.

**Real failure modes:**

- Multi-checkbox edit: Claude marks `[x] RED` and `[x] GREEN` in one Edit → parser returns `'green'` → skips the RED→GREEN quality review. But that review is `softBlock` (advisory), so the thing being skipped is itself a speed bump.
- Silent null return: parser returns `null` on format mismatch, prompt hook falls back gracefully to "Phase: implement. Pick first unchecked scenario, start TDD." — degraded but not broken.

**Root cause:** The BDD skill (TDD.md:20) says "Mark checkboxes in test-definitions.md after each step" but never shows the format. The contract is implicit — Claude infers from existing files.

**Post-124 state:** `parseTddStep()` moved from post-tool inline to shared library. Still actively called by prompt hook and stop hook via `deriveTddStep()`. Not dead code.

### Problem 2 reassessment

**Closed as designed.** The done gate runs actual tests (`runTests()`), checks scenario completion (`checkScenariosComplete()`), checks verify.md artifact existence (#124b), and hard-blocks. That's the wall — now stronger with the verify.md artifact gate. Mid-work quality reviews are advisory by design — `softBlock`, not `hardBlockDone`. Making them genuinely blocking creates the infinite loop problem that `stop_hook_active` was built to solve. Agent hooks (30-60s per stop) for an advisory gate is bloat.

### Decision: Document the format contract (Option C + partial E)

**Document the format in the BDD skill + add one-checkbox-per-edit instruction.** No new hooks, no new parser code.

**Changes:**

1. Add format example to TDD.md showing exact checkbox layout with valid-vs-invalid contrast
2. Add "mark ONE checkbox per edit, commit after each step" constraint
3. Close Problem 2 — done gate is the wall, reviews are advisory

**Why this over enforcement hooks:**

Anthropic's own hook guidance: "hooks for actions that must happen every time with zero exceptions" vs "instructions for guidance that applies broadly." A file format contract is guidance, not control flow. The Claude Code docs show no examples of PreToolUse hooks validating file content — all examples are coarse-grained (blocking `rm -rf`, gating `git push`).

| Approach              | Docs alignment                                          | Overhead            | Verdict                            |
| --------------------- | ------------------------------------------------------- | ------------------- | ---------------------------------- |
| PreToolUse deny       | Against guidance (hooks are for zero-exception actions) | Subprocess per edit | Overkill                           |
| PostToolUse feedback  | Acceptable but reactive                                 | Subprocess per edit | Catches after the fact             |
| **Skill instruction** | **Aligned** (instructions for broad guidance)           | Zero                | Opus follows explicit format specs |
| Agent hook on Stop    | Against guidance                                        | 30-60s per stop     | Problem 2 is closed as designed    |

**Escalation path:** If multi-checkbox violations become a real problem, `"if": "Edit(test-definitions.md)"` on PreToolUse can scope a validation hook to that file with zero overhead on other edits. `updatedInput` could even normalize content before the write lands. Tooling exists — just not warranted yet.

**Template finding:** `test-definitions-feature.md` already includes RED/GREEN/REFACTOR checkboxes. Claude sees the format when creating the file but not when editing later. The TDD.md instruction closes that gap.

## Work Log

- 2026-04-14T20:57:00Z Created: from architecture critique session — Critiques 2 and 3
- 2026-04-15T18:01:00Z Analysis: reviewed post-#124 state, reassessed both problems, decided Option C + partial E
- 2026-04-15T21:49:00Z Research: verified against Claude Code hook docs, Opus instruction-following guidance, and template state. Decision confirmed — instructions over hooks for format contracts. Escalation path documented.
- 2026-04-16T03:01:00Z Complete: All done-when criteria verified met. TDD.md has format example (lines 26-44), one-checkbox constraint (line 24), both copies identical. Ticket closed.
