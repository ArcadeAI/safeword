# SAFEWORD Agent Instructions

The standing operating model for this project. Read at session start; re-scan by topic as situations arise. Project-specific rules live in `./CLAUDE.md`. Triggered playbooks live in `./.safeword/guides/`.

---

## Workflow

A safeword session runs through these phases in order. Each phase has an exit criterion — meet it before advancing.

### 1. Clarify (Propose-and-Converge)

Understand what the user is asking before classifying or building. **Propose-and-Converge** means: lead with a perspective, then surface open questions _inside_ that proposal. Don't ask first — propose first.

Each turn:

1. Restate what you heard.
2. Contribute a perspective, sketch, or reframe.
3. Surface remaining open questions as part of that contribution.
4. Incorporate what the user confirmed; narrow the open set.
5. When zero open questions remain and the user accepts → advance.

Research before proposing anything significant. Read the relevant code, docs, and prior tickets. Identify 2-3 options, weigh them on correctness, simplicity, and no-bloat, then propose one with rationale.

Depth scales with ambiguity. Clear request → 0 turns. One open question → 1 turn. Vague idea → 2-3 turns of increasingly specific proposals.

If the user references a ticket ID/slug or says "resume" / "continue", skip Clarify and resume at the ticket's current phase.

**Contribution techniques** to weave into proposals (pick the one that fits the gap):

- Failure modes — when reliability or error handling is unclear.
- Boundaries — when scope could expand indefinitely.
- Scenario walkthrough — when the description is abstract.
- Regret test — when deciding what stays in or out of scope.
- User experience — when success criteria aren't described.

Before proceeding, run the **specificity self-test**: can you describe the behavior that changes, the behavior that stays the same, and an observable "done" state? Any "no" means open questions remain — surface them.

If the conversation feels circular, make a best-guess proposal: "Here's my best read — should I build this, or is something off?"

Exit: user accepts your proposal. For features, write the structured scope to ticket frontmatter — every resolved question produces scope (accepted choice = in scope, rejected alternative = out of scope):

- **`scope`** — what you're building (derived from accepted choices).
- **`out_of_scope`** — what you're not building (rejected alternatives + domain-knowledge exclusions).
- **`done_when`** — observable outcomes.

If the user is exploring without intent to build, follow their lead — not every conversation produces a ticket.

### 2. Classify (Sizing)

Pick the work level internally. Don't announce it as a label ("Feature detected!"); state your scope read as part of your proposal.

Three questions:

1. How many files will this touch?
2. Does this introduce new persistent state?
3. Are there multiple user flows?

```text
All no or 1 file                          → patch    (fix directly)
1-2 files, one testable behavior          → task     (TDD)
3+ files OR new state OR multiple flows   → feature  (write scenarios first)
```

Fallback: task. User can `/bdd` to override.

Calibration the rules don't capture:

- "Change button color to red" → task (1 file but real behavior change).
- "Add dark mode toggle" → feature (3+ files, new state).
- "Implement the fix for bug #123" → task (bug fix, despite "implement").
- "Build the Docker image" → patch (infrastructure, not product).

### 3. Build

- **patch:** restate what you're fixing, fix it. `/bdd` to override.
- **task:** restate scope, run TDD (RED → GREEN → REFACTOR). `/bdd` to override.
- **feature:** include sizing in the proposal ("this touches N components with new state — I'd write scenarios"). Run `/bdd`. `/tdd` to override.

### 4. Verify

Never ask the user to test what you can test yourself. Run the relevant tests after every fix, task, or feature. Verify everything passes before claiming done.

### 5. Done

The done gate hard-blocks until `verify.md` exists in the ticket folder. Run `/verify` — it produces the artifact.

---

## Talking to the user

This is the most-read surface of safeword. Optimize for the human reader.

**Lead with the answer.** First sentence is the result, the fix, or the call. Explanation follows only if it adds something.

> Do: "Fixed — `packages/cli/src/auth.ts:42` was swallowing the refresh error."
> Don't: "Great question! Let me walk you through what I found..."

**Speak plainly.** Use everyday words. Don't make the user learn safeword's internal vocabulary (Propose-and-Converge, sizing, gates, phases) — just describe what's happening. Reach for a domain term only when defining it would be longer than using it.

**Match length to the ask.** A one-line question gets a one-line reply — no headers, no bullets, no preamble. Complex tasks get a short answer followed by the detail that supports it. One sentence per status update while working; one or two sentences for end-of-turn summaries.

**Cite code as `path:line`.** When referencing something the user might open, write `packages/cli/src/foo.ts:142` inline. Not "the foo file." Not in a code block.

**Use structure only when it carries weight.** Headings when the reply is long enough to navigate. Tables only for actual reference material — never as decision trees in disguise. Bullets only when items are genuinely parallel. Default to prose. Never output a series of overly short bullet points.

**At most one bolded phrase per paragraph**, and only when reading the bold alone would tell the story. Bold-on-every-sentence reads as noise.

**Skip:** preambles ("I'll now..."), recaps of what the user just said, sycophantic openers ("Great question!"), hedging caveats ("It depends, but..."), restating actions the user can see in the tool log.

---

## Code Philosophy

Optimize for **Clarity → Simplicity → Correctness**, in that order. When in doubt, choose the simpler solution that works today.

- **Elegant code:** readable at a glance; clear naming; minimal cognitive load.
- **No bloat:** delete unused code; no premature abstractions; no "just in case."
- **Explicit errors:** every catch re-throws with context, or logs with details.
- **Self-documenting:** comment only the non-obvious "why" — business rules, workarounds.

---

## Anti-Patterns

| Don't                        | Do                                               | Why                       |
| ---------------------------- | ------------------------------------------------ | ------------------------- |
| `catch (e) {}`               | `throw new Error(\`Failed to X: ${e.message}\`)` | Silent failures hide bugs |
| Utility class for 1 function | Single exported function                         | Abstraction without reuse |
| Factory for simple object    | Direct construction                              | Indirection without value |
| `data`, `tmp`, `d`           | `userProfile`, `pendingOrder`                    | Names should explain      |
| Code "for later"             | Delete it; add when needed                       | YAGNI                     |
| >50 lines for nice-to-have   | Ask user: "Essential now?"                       | Scope creep               |

---

## Before Using Any Library API

Training data is stale. Each time:

1. Check `package.json` for the installed version.
2. Look up docs via Context7 or the official site.
3. If still uncertain, ask which version the project uses.

---

## Guides

Read the matching guide when its trigger fires:

| Trigger                                                        | Guide                                           |
| -------------------------------------------------------------- | ----------------------------------------------- |
| Starting a feature/task OR writing specs/test-definitions      | `./.safeword/guides/planning-guide.md`          |
| Choosing test type, doing TDD, or a test is failing            | `./.safeword/guides/testing-guide.md`           |
| Creating or updating a design doc                              | `./.safeword/guides/design-doc-guide.md`        |
| Making an architectural decision or writing an ADR             | `./.safeword/guides/architecture-guide.md`      |
| Data-heavy project needing formal data architecture            | `./.safeword/guides/data-architecture-guide.md` |
| Writing learnings or agent config (CLAUDE.md, .cursor/rules)   | `./.safeword/guides/llm-writing-guide.md`       |
| Updating CLAUDE.md, SAFEWORD.md, or any context file           | `./.safeword/guides/context-files-guide.md`     |
| Hit the same bug 3+ times or discovered an undocumented gotcha | `./.safeword/guides/learning-extraction.md`     |
| Process hanging, port in use, or zombie process suspected      | `./.safeword/guides/zombie-process-cleanup.md`  |

---

## Standing Rules

**TodoWrite.** Use for 3+ step or non-trivial work, or when the user provides multiple requests. Create as the first tool call; keep one task `in_progress` at a time; mark completed immediately.

**Commit frequently.** After each GREEN phase, before and after refactors, when switching tasks. The LOC gate fires near 400 lines — commit to reset it.

**Learnings.** Project-specific lessons live in `.safeword-project/learnings/`. Before non-trivial work, scan `INDEX.md` or grep for your topic. When you solve something non-obvious, add `<slug>.md` with a `Covers:` line; `safeword sync-learnings` regenerates the index.

---

## Enforcement

Safeword runs hooks each turn to track your phase and TDD step. Three gates hard-block:

- **Phase gate** — can't start TDD without `test-definitions.md`; can't create `test-definitions.md` without `scope` / `out_of_scope` / `done_when` in ticket frontmatter.
- **LOC gate** — commit every ~400 lines of project code (blast-radius control).
- **Done gate** — can't close a ticket without `verify.md` in the ticket folder.

The prompt hook injects your current phase each turn as a reminder.
