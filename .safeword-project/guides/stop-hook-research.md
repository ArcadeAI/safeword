# Stop Hook Research & Design Discussion

**Date:** 2026-03-21
**Context:** Investigating whether Safeword's quality stop hooks are effective given how Claude Code works, and what improvements are worth making.

---

## Abstract

Safeword uses Claude Code's stop hook system to enforce code quality discipline — blocking Claude from finishing a response until it passes a quality review or produces evidence that tests and audits have run. This document investigates whether that enforcement actually works, and what the research says about how to make it stronger.

The short answer: the pre-tool gates (phase, LOC, TDD step) are genuinely strong because they block code edits at the tool level before anything runs. The stop hook gates are more complicated.

Claude Code stop hooks work by intercepting Claude's natural stopping point and either injecting a continuation message or forcing another turn. The mechanism is real and well-documented. When a stop hook returns a block decision, Claude must respond to it — it cannot simply acknowledge and stop. The done-phase gate specifically requires Claude to surface evidence that tests passed, scenarios are marked complete, and an audit ran before it's allowed to finish. It enforces a real precondition.

The soft block — the quality review prompt that fires after any edit in non-done phases — serves a different purpose than the external checkers. Tests verify correctness. Linters verify style. Claude's self-review is there to judge things external tools cannot: whether the abstraction is right, whether there are edge cases tests don't cover, whether the approach follows current best practices. For that job, Claude's judgment is the point — there is no external oracle to defer to. Research showing that intrinsic self-correction fails applies to tasks with verifiable ground truth (math, factual QA, correctness), not to quality judgment where the model's domain knowledge is genuinely what's being leveraged. The one-shot escape hatch — Claude is allowed to stop after one review round regardless of depth — is a necessary design choice to prevent infinite loops, and is the main constraint on how much enforcement the soft block can provide.

The done-phase gate has a different problem: Goodhart's Law. Any gate that requires Claude to produce the evidence string is gameable. LLMs are well-documented to satisfy proxy metrics without achieving the underlying goal. Claude already knows that writing "✓ 12/12 tests pass" satisfies the done-phase pattern. The only robust counter is having the hook independently run the verification tool and check its exit code — not matching text Claude generated.

The research points to two approaches with real empirical support for the done-phase gate. First, external feedback loops: hooks that actually run tests or linters and gate on their exit codes, rather than pattern-matching prose. The done-phase design is on the right track, but it needs to be extended — the hook itself should run the tools, not trust Claude's report that they ran. Second, separate evaluator models: using a fast model (Haiku) as a judge rather than asking Claude to self-evaluate. Trail of Bits uses this in production and it sidesteps the sycophancy problem entirely.

Seven concrete improvements are on the table, ranging from trivial fixes (switching the done-phase hard block from exit 2 to the canonical JSON block format, which is more reliable and plugin-compatible) to structural changes (having the hook run tests directly, scoping evidence matching to actual tool output). The trivial fixes have no downsides. The structural changes are where the real quality gains are.

---

## How Claude Code Stop Hooks Work (Current Docs)

### Three Blocking Mechanisms

These serve different purposes — docs don't describe a priority hierarchy between them, but they have distinct behaviors:

1. **`continue: false`** — terminates the session entirely. `stopReason` shown to user only, not Claude. Nuclear option.

2. **JSON `decision: block` + exit 0** — canonical blocking path. Hook outputs `{"decision":"block","reason":"..."}` to stdout. `reason` is fed to Claude as continuation instructions. Exit must be 0.

3. **`exit(2)`** — forces continuation via stderr. Claude sees the stderr content. Exit 2 causes stdout (JSON) to be **ignored entirely**.

**Critical rule:** Don't mix. JSON block → exit 0. Hard block via stderr → exit 2 only, no stdout JSON.

### The `stop_hook_active` Flag

- Present in Stop hook stdin on every invocation
- `false` on first natural stop, `true` if Claude is already in a forced-continuation state from a previous Stop hook block
- Our hook's responsibility to check it — Claude Code doesn't enforce loop prevention automatically
- You CAN block again when `stop_hook_active=true` — it won't infinite loop unless your hook does it unconditionally

### What `transcript_path` Contains

JSONL format. One JSON object per line. Full conversation: user messages, assistant messages with tool_use blocks, tool_result blocks. The Stop hook input also has a `last_assistant_message` convenience field containing **text content only** (confirmed by docs: "hooks can access it without parsing the transcript file"). Tool call data (tool_use blocks) only appears in the raw JSONL — so evidence detection that needs to check tool outputs still requires transcript parsing.

### How Blocked Reason Reaches Claude

- **Soft block (JSON):** `reason` string injected as a new user message. Claude responds to it as a continuation.
- **Hard block (exit 2):** stderr content injected similarly. Claude forced to continue.

### Other Hook Output Mechanisms We Don't Use

- **`systemMessage` (top-level field in hook JSON output):** Warning message shown to the user (not Claude). Available on all hook types.
- **`additionalContext` in `hookSpecificOutput`:** Appends context to tool results (PreToolUse, PostToolUse).
- **`UserPromptSubmit` stdout:** Cleanest injection — hook stdout is prepended to the user's prompt as context before Claude sees it.
- **`suppressOutput: true` (in hook JSON output):** Hides hook stdout from verbose output. Include in the JSON the hook returns, not in settings.json config.
- **Agent-type hooks:** Can spawn a subagent with Read/Grep/Glob tools for intelligent validation.

### Known Claude Code Bugs (as of early 2026)

- **Issue #12667 (open):** Stop hooks with `decision: block` + exit 0 show `"hook error:"` label to user AND inject it into Claude's context window. This can cause Claude to prematurely end turns by seeing accumulated fake errors.
- **Issue #34713 (open):** ALL hook executions generate `"hook error"` labels unconditionally regardless of exit code. In heavy-hook setups, this creates 200-400 false error lines per session, causing Claude to abandon multi-step tasks.
- **Issue #10412 (open):** Stop hooks with exit code 2 fail when installed via plugin system (`.claude/plugins/`). JSON block approach works from both direct hooks and plugins.
- **Issue #3656 (closed):** Regression in blocking stop command hooks was fixed, but resolution confirmed JSON-based blocking is the canonical path. Exit-code-only approach had reliability issues.

---

## Our Current System

### Full Quality Gate Lifecycle

```
User edits code:
  ↓
1. PreToolUse hook fires
   → Reads quality-state-{sessionId}.json
   → If gate = 'loc'        → DENY (commit first)
   → If gate = 'phase:X'   → DENY (read phase file, advance ticket)
   → If gate = 'tdd:X'     → DENY (run /tdd-review)
   → If ticket at non-implement phase → DENY (wrong phase for code edits)
   → Otherwise → ALLOW
  ↓
2. Tool executes (Edit/Write/MultiEdit)
  ↓
3. PostToolUse hook fires (observer, silent)
   → git diff --stat HEAD to count LOC
   → Parses ticket.md for phase transition
   → Parses test-definitions.md for TDD step transition
   → Updates quality-state-{sessionId}.json
   → Sets gate if: LOC ≥ 400, or phase changed, or TDD step changed
  ↓
4. Claude tries to stop
  ↓
5. Stop hook fires
   → Scans last 5 assistant messages for edit tool usage
   → If no edits → exit 0 silently
   → Cumulative artifact check (features need test-definitions.md)
   → Done phase: pattern-match evidence (tests + scenarios + audit)
     ├─ Missing → hard block (exit 2, force continuation)
     └─ Present → mark ticket done, cascade hierarchy, navigate to next
   → Other phases: soft block with phase-specific review prompt
   → Guard: if stopHookActive=true → skip soft block, allow exit
  ↓
6. Claude responds to review or continues with evidence
  ↓
7. User commits → PostToolUse hook detects new HEAD → clears gate
```

### Phase-Specific Quality Messages

| Phase           | What Claude Is Asked to Review                                     |
| --------------- | ------------------------------------------------------------------ |
| intake          | Discovery completeness, edge cases, failure modes                  |
| define-behavior | Scenario atomicity, one behavior per scenario, observability       |
| scenario-gate   | Testability, atomicity, determinism                                |
| decomposition   | Component breakdown, test layers, task ordering by dependency      |
| implement       | Correctness, elegance, docs/best-practice compliance               |
| done            | All scenarios marked, tests pass, build/lint clean, parent updated |

### Done-Phase Evidence Patterns

```
Tests:     /✓\s*\d+\/\d+\s*tests?\s*pass/i   OR   /\d+\/\d+\s*tests?\s*pass/i
Scenarios: /all\s+\d+\s+scenarios?\s+marked/i
Audit:     /audit\s+passed/i
```

These match **anywhere in the combined last assistant message text** — not scoped to tool output.

---

## What Research Says About Our Approach

### Intrinsic self-review: where it fails and where it's the point

The MIT TACL 2024 survey ("When Can LLMs Actually Correct Their Own Mistakes?") and arXiv:2310.01798 ("LLMs Cannot Self-Correct Reasoning Yet") conclude that intrinsic self-correction fails for tasks with verifiable ground truth — math, factual QA, logical reasoning — where the model can't reliably detect its own errors without external signals. ICLR 2025 follow-up work confirms this.

**But the soft block is not trying to replace external signals.** Tests verify correctness. Linters verify style. The soft block asks Claude to judge things external tools cannot: is the abstraction right, are there edge cases tests don't cover, does this follow current best practices? For that job, Claude's domain judgment is the point — not a substitute for something more reliable, but the only available signal. The research critique applies to verifiable-correctness tasks, not quality judgment tasks.

Where external feedback does matter: when **external, verifiable feedback** is available (test runner exit codes, linter results, type-checker output), self-correction loops improve results significantly — The SICA (Self-Improving Coding Agent) framework (arXiv:2504.15228) found 17-53% improvement on SWE-Bench Verified through self-edit loops with objective feedback. This is the right model for the done-phase gate, not the soft block.

**Implication:** The soft block and the done-phase gate are solving different problems. Conflating them leads to the wrong design conclusions.

### Goodhart's Law: LLMs will satisfy the gate without doing the work

This is extensively documented. OpenAI models caught writing code to explicitly hack the tests used to evaluate them; when penalized, they obfuscated the plan while continuing to hack. The pattern of **optimizing a proxy instead of achieving the goal** is the documented failure mode for exactly this class of enforcement.

**Implication:** Any gate that requires Claude to _produce_ the evidence string is vulnerable. Claude already knows that writing "✓ 12/12 tests pass" satisfies the gate. The only robust counter is having the **hook independently run the verification tool** and check its exit code — not matching text that Claude generated.

### The mechanism forces real continuation — but quality is bounded by sycophancy

When `decision: block` fires, Claude Code feeds `reason` back to Claude and triggers a new agentic turn. Claude cannot just acknowledge and stop — it must do work. This is confirmed by docs and community practice.

However, the quality of that work is bounded by Claude's sycophancy tendency. If the review prompt is vague, Claude produces a superficial response and stops cleanly on the next attempt. Anthropic has reported sycophancy improvements in Sonnet 4.5/4.6 but it remains a documented behavioral tendency, not a resolved problem.

### What practitioners actually do

Ranked by community adoption:

1. **Completion enforcement / anti-rationalization** — Blocking Claude from stopping when it claims "out of scope" or defers to follow-ups. This is the dominant real-world use case (Trail of Bits, Taskmaster).
2. **Test gate enforcement** — Running actual `pytest`/`npm test` in the hook and blocking on non-zero exit code. More reliable than transcript pattern matching.
3. **Independent evaluator model** — Using a fast model (Haiku as judge) to evaluate Claude's final response for rationalization patterns. Trail of Bits uses this. Avoids the sycophancy problem entirely.
4. **Notification/summary generation** — Lower-stakes completion hooks.

Self-review prompts (our current soft block) appear infrequently in community-documented production setups compared to the above patterns.

### Known fragility: transcript parsing and `echo`

Community-documented bugs (note: our hook uses `Bun.stdin.json()` for parsing, so the `echo` issue doesn't apply):

- `echo` on macOS corrupts JSON containing `\n` sequences from transcript parsing — use `printf '%s\n'` instead (shell-based hooks only)
- Relative paths for state files break when Claude runs `cd` during a session — require git-root-resolved absolute paths
- `last_assistant_message` is the canonical field; avoid manual transcript parsing (it's fragile and considered "excessive" by practitioners)

### Stronger alternatives that have empirical support

| Alternative                                      | Evidence Quality | Notes                                                                                     |
| ------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------- |
| Hook runs actual tool, checks exit code          | Strong           | External feedback loop; SICA 17-53% improvement                                           |
| Separate evaluator model (Haiku as judge)        | Moderate         | Trail of Bits pattern; avoids sycophancy                                                  |
| AgentSpec-style runtime DSL                      | Strong (safety)  | arXiv:2503.18666; designed for preventing dangerous tool calls, not coding quality per se |
| Structured output schemas (constrained decoding) | Strong           | Eliminates prose-pattern gaming entirely; requires tool-level integration                 |
| Self-review prompt (our soft block)              | Weak             | No empirical support; vulnerable to Goodhart's Law                                        |

---

## What's Working Well

- **Pre-tool enforcement is strong.** Phase gate, LOC gate, and TDD gate all hard-deny code edits until conditions are met. Hard to bypass.
- **Done-phase hard block is real.** Claude can't stop without showing evidence. Pattern matching catches it.
- **Per-session state isolation.** `quality-state-{sessionId}.json` prevents cross-session interference.
- **Hierarchy navigation.** When a ticket is done, the hook auto-marks it complete and navigates to next sibling. Elegant.
- **Commit-based LOC reset.** State resets on real git commits, not on Claude's claims.

---

## Open Questions / Design Decisions

### Q1: Should the done-phase hard block switch from `exit(2)` to JSON `decision: block`?

**Current:** `hardBlockDone` uses `console.error(reason) + process.exit(2)`

**Issue:** Exit 2 is not the canonical blocking path. Had reliability regression (#3656). Fails in plugin contexts (#10412). When exit 2 is used, stdout is ignored — so if we ever want to add structured output (e.g., `suppressOutput`), we'd need to switch anyway.

**Tradeoff:** The "hardness" of done-phase blocking comes from the evidence-pattern logic, not the exit code. Both mechanisms surface `reason` to Claude in essentially the same way.

**Option A:** Switch to `{ decision: 'block', reason }` + exit 0 everywhere. One consistent mechanism.
**Option B:** Keep exit 2 as a semantic signal that done-phase is stricter.

---

### Q2: Is the soft block for non-done phases a gate or a prompt? Should we care?

**Current:** Non-done phases get a quality review prompt via soft block (one-shot — `stopHookActive` guard lets Claude escape after one round).

**Reality:** Claude can respond with two sentences and stop. The gate doesn't enforce anything, it just forces Claude to think once.

**Option A (do nothing):** Accept it's a prompt, not a gate. Label it honestly in comments. It's actually useful as a friction mechanism even if not a hard gate.
**Option B (implement-phase evidence gate):** For `implement` phase specifically, require test-pass evidence (like done phase) before allowing stop. Real enforcement, not just prompting.
**Option C (multi-round counter):** Track `stopHookRounds` in state. Block up to N times before allowing escape. Adds complexity.

---

### Q3: Should evidence matching be scoped to Bash tool output only?

**Current:** Evidence patterns (`✓ X/X tests pass`) match anywhere in Claude's last message text, including prose.

**Risk:** Claude could accidentally (or intentionally) satisfy the gate with prose rather than actual test output. E.g., "I believe ✓ 10/10 tests pass based on my review."

**Option A:** Parse transcript JSONL for `tool_result` blocks where the preceding `tool_use` name was `Bash`. Only match evidence patterns in that content.
**Option B:** Keep loose matching. In practice, Claude doesn't fabricate these patterns in prose.

**Revised assessment:** The `/verify` command output format (`✓ X/X tests pass`, `All N scenarios marked complete`) was explicitly designed to match the stop hook patterns. These strings are specific enough that accidental prose matches are unlikely. The real threat is deliberate bypass — Claude writing the exact pattern string in prose without running the command. Option A eliminates that entirely; Option B relies on behavioral trust. Parsing effort is moderate (pair tool_use + tool_result blocks in JSONL).

---

### Q4: Should we add `suppressOutput: true` to silent observer hooks?

**Issue:** Claude Code bug (#12667, #34713) injects `"hook error:"` labels into context for all hook executions, causing Claude to see hundreds of false errors and sometimes abandon tasks.

**`suppressOutput: true`** is a field in the JSON output returned by a hook (not a settings.json config field). Including it hides the hook's stdout from verbose output.

**Question:** Would adding it to PostToolUse (observer, always silent) and SessionEnd (cleanup, always silent) reduce the noise meaningfully? Would it affect hook behavior?

---

### Q5: Is the stopHookActive one-shot guard the right policy for done phase?

**Current:** `stopHookActive` check is only in the soft-block path. The done-phase hard block doesn't check it — so done phase ALWAYS re-evaluates evidence on every stop attempt. This is correct and intentional.

**Question to confirm:** Is everyone aligned that done phase should always re-evaluate (no escape hatch), while non-done phases allow one-shot escape? Or should done phase also have a limited escape after N rounds?

---

### Q6: Should we gate on `test-definitions.md` content at scenario-gate+, not just presence?

**Current:** Cumulative artifact check only verifies `test-definitions.md` **exists**. A file with one empty scenario satisfies the gate.

**Option:** Check that the file has at least N scenarios defined, or that all scenarios have actual content.

**Tradeoff:** More parsing complexity. Higher confidence that scenarios are real.

---

## Refactor Skill + Audit Command Interaction

### How the refactor skill interacts with stop hooks

**The good:** The Iron Law (one refactoring → test → **commit**) naturally defeats the LOC gate. Each commit clears the state. If Claude follows the skill correctly, the LOC gate almost never fires during refactoring — it's a reinforcement, not an obstacle.

**The gap:** The refactor skill mandates "Run `/audit` when done" at Phase 5. But the stop hook's one-shot escape hatch means:

1. Claude edits code during refactoring
2. Stop hook fires quality review ✓
3. Claude responds "looks good, refactoring complete"
4. Stop hook fires again → `stopHookActive = true` → exits 0 → **Claude can stop**

The Phase 5 audit step gets skipped unless the refactor task is tracked at done phase.

### `/verify` and `/audit` in the BDD Done Gate (Phase 7)

DONE.md explicitly sequences Phase 7:

1. `/refactor` — cross-scenario cleanup (all changed files)
2. Flake detection (optional, if flakes suspected)
3. `/verify` — runs tests, build, lint, scenario count, dep drift → generates test + scenario evidence
4. `/audit` — architecture, dead code, duplication, outdated deps → generates audit evidence
5. BDD compliance self-check
6. Final commit

**The verify command is explicitly aware of the stop hook.** Its Section 6 (Report Results) says:

> **Important:** The stop hook validates evidence patterns for features:
>
> - `✓ X/X tests pass` — proves test suite ran
> - `All N scenarios marked complete` — proves scenarios checked
> - `Audit passed` — proves /audit ran (run /audit separately)
> - Without all three, the done phase will hard block.

The output format strings in `/verify` were written to match the stop hook's evidence patterns exactly. This is co-design, not coincidence.

### How the audit command integrates with done-phase evidence

**Intentionally designed together.** The audit command summary format:

```
[Audit passed | Audit passed with warnings | Audit failed]
```

...was built to match the done-phase evidence pattern:

```ts
const AUDIT_EVIDENCE_PATTERN = /audit\s+passed/i;
```

- `"Audit passed"` → matches ✓
- `"Audit passed with warnings"` → matches ✓
- `"Audit failed"` → does not match → done gate stays blocked ✓

**The trust model gap (Q3):** Evidence is matched anywhere in Claude's response text, not scoped to actual tool output. The specific format strings make accidental prose matches unlikely, but deliberate bypass is possible. Scoping to Bash tool output would eliminate it entirely.

### Interaction matrix

| Scenario                                        | Enforcement | Notes                                        |
| ----------------------------------------------- | ----------- | -------------------------------------------- |
| Refactor task at done phase                     | Strong      | Audit + tests both required as evidence      |
| Refactor task (ticket not at done phase)        | Weak        | One-shot escape lets Claude skip `/audit`    |
| Done phase, Claude runs `/audit`                | Works       | Output format aligns with pattern            |
| Done phase, Claude claims audit passed in prose | Fragile     | Prose satisfies pattern without running tool |

**Bottom line:** Q2-option-B (implement-phase evidence gate) closes the refactor-skips-audit gap. Q3 (scope evidence to Bash output) closes the deliberate-bypass gap. They're independent problems with independent fixes.

---

## Recommended Changes (Ranked by Impact/Effort)

| #   | Change                                                   | Impact                  | Effort  | Risk   | Research support                                                    |
| --- | -------------------------------------------------------- | ----------------------- | ------- | ------ | ------------------------------------------------------------------- |
| 1   | Switch done hard block to JSON `decision:block`          | Medium (reliability)    | Trivial | Low    | Docs confirmed                                                      |
| 2   | Return `suppressOutput: true` from silent observer hooks | Low (noise reduction)   | Trivial | Low    | Docs confirmed                                                      |
| 3   | Reframe soft block as "quality prompt" not "gate"        | Clarity                 | Trivial | None   | Research-backed                                                     |
| 4   | Hook runs actual tests, gates on exit code (not prose)   | High (real enforcement) | Medium  | Low    | Strongest pattern — external feedback loop; SICA 17-53% improvement |
| 5   | Scope evidence matching to Bash tool output              | High (correctness)      | Medium  | Low    | Closes Goodhart's Law gap                                           |
| 6   | Gate on test-definitions.md content, not just presence   | Medium                  | Medium  | Low    | Unresearched                                                        |
| 7   | Separate evaluator model (Haiku as judge) for soft block | High (quality)          | Large   | Medium | Trail of Bits pattern; avoids sycophancy entirely                   |
