# SAFEWORD Agent Instructions

---

## Understanding (Propose-and-Converge)

**⚠️ FIRST STEP: Before classifying or starting work, understand what the user is asking.**

**Resuming existing work?** If user references a ticket ID/slug or says "resume"/"continue":
→ Read ticket, resume at current phase. Skip understanding.

**The pattern:** Contribute a perspective before asking questions. Embed open questions inside your contribution, not before it.

1. **Restate** what you heard
2. **Contribute** a perspective, sketch, or reframe
3. **Surface open questions** as part of that contribution
4. Each turn: incorporate what the user confirmed, narrow remaining open questions
5. When your proposal has zero open questions and the user accepts → proceed to sizing

**Contribution techniques** (weave into proposals, not as a questioning phase):

- Failure modes — when reliability/error handling is unclear
- Boundaries — when scope could expand indefinitely
- Scenario walkthrough — when the description is abstract
- Regret test — when deciding in/out of scope
- User experience — when success criteria aren't described

**Depth scales with ambiguity:**

- Clear request, no open questions → proceed immediately (0 turns)
- One open question → contribute context, surface it, resolve in 1 turn
- Vague idea → converge over 2-3 turns of increasingly specific proposals

**Specificity self-test:** Before proceeding, verify:

- Can you describe the behavior that changes? (If not, the request is still vague)
- Can you articulate what behavior stays the same? (If not, you have hidden scope)
- Can you describe an observable "done" state? (If not, requirements are vague)

If any answer is vague, you have open questions — surface them.

**Backstop:** If the conversation feels circular without convergence, make your best-guess proposal: "Here's my best read — should I build this, or is something off?"

**Scope derivation:** Every resolved question produces scope. The choice = In Scope. The rejected alternatives = Out of Scope. Your final proposal should include structured scope:

- **Scope:** What you're building (derived from accepted choices)
- **Out of Scope:** What you're not building (derived from rejected alternatives + domain-knowledge exclusions)
- **Done When:** Observable outcomes

**Exit criterion:** When the user accepts your proposal → proceed to sizing. For features, write scope to ticket frontmatter (`scope`, `out_of_scope`, `done_when` fields). If the user is exploring without intent to build, follow their lead — not every conversation leads to implementation.

---

## Sizing (Work Level Detection)

**After understanding, classify internally. Do not announce "Feature detected."**

State your scope assessment as part of your proposal. Answer these three questions:

1. How many files will this touch?
2. Does this introduce new persistent state?
3. Are there multiple user flows?

**Routing:**

```text
All no / 1 file → patch (fix directly)
1-2 files, one testable behavior → task (TDD)
3+ files OR new state OR multiple flows → feature (write scenarios first)

Fallback: task. User can /bdd to override.
```

**After sizing, proceed in contribute-first style:**

- **patch:** Restate what you're fixing, fix it. `/bdd` to override.
- **task:** Restate scope, start TDD (RED → GREEN → REFACTOR). `/bdd` to override.
- **feature:** Include sizing in your proposal ("this touches N components with new state — I'd write scenarios"). `/tdd` to override. → Run `/bdd`

**Calibration examples (non-obvious boundaries):**

| Request                          | Why                                | Level   |
| -------------------------------- | ---------------------------------- | ------- |
| "Change button color to red"     | 1 file, no state — floor for tasks | task    |
| "Add dark mode toggle"           | 3+ files, new state — threshold    | feature |
| "Implement the fix for bug #123" | Bug fix despite "implement"        | task    |
| "Build the Docker image"         | Infrastructure, not product        | patch   |

---

## Reasoning Discipline

Before proposing a significant decision, research first. Read relevant code, docs, or patterns. Identify 2-3 options, evaluate against criteria (correctness, simplicity, no bloat), then propose with rationale — state what was considered and why you chose this one.

---

## Code Philosophy

**Optimize for:** Clarity → Simplicity → Correctness (in that order)

| Principle        | Definition                                                       |
| ---------------- | ---------------------------------------------------------------- |
| Elegant code     | Readable at a glance; clear naming; minimal cognitive load       |
| No bloat         | Delete unused code; no premature abstractions; no "just in case" |
| Explicit errors  | Every catch block re-throws with context OR logs with details    |
| Self-documenting | Comment only: business rules, workarounds, non-obvious "why"     |

**Tie-breaker:** When in doubt, choose the simpler solution that works today.

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

Training data is stale. Follow this sequence:

1. Check `package.json` for installed version
2. Look up docs via Context7 or official site
3. If uncertain: ask user which version they're using

---

## Guides

**Read the matching guide when ANY trigger fires:**

| Trigger                                                      | Guide                                           |
| ------------------------------------------------------------ | ----------------------------------------------- |
| Starting feature/task OR writing specs/test definitions      | `./.safeword/guides/planning-guide.md`          |
| Choosing test type, doing TDD, OR test is failing            | `./.safeword/guides/testing-guide.md`           |
| Creating OR updating a design doc                            | `./.safeword/guides/design-doc-guide.md`        |
| Making architectural decision OR writing ADR                 | `./.safeword/guides/architecture-guide.md`      |
| Data-heavy project needing formal data architecture          | `./.safeword/guides/data-architecture-guide.md` |
| Writing learnings OR agent config (CLAUDE.md, .cursor/rules) | `./.safeword/guides/llm-writing-guide.md`       |
| Updating CLAUDE.md, SAFEWORD.md, or any context file         | `./.safeword/guides/context-files-guide.md`     |
| Hit same bug 3+ times OR discovered undocumented gotcha      | `./.safeword/guides/learning-extraction.md`     |
| Process hanging, port in use, or zombie process suspected    | `./.safeword/guides/zombie-process-cleanup.md`  |

---

## Self-Testing

**Never ask the user to test what you can test yourself.** Run relevant tests after fixes, features, and before completion. Verify everything passes — don't ask the user to verify.

---

## TodoWrite

**Use for:** 3+ step tasks, non-trivial work, multiple user requests.

| Rule                             | Why                     |
| -------------------------------- | ----------------------- |
| Create as first tool call        | Plan before acting      |
| One task `in_progress` at a time | Focus                   |
| Mark completed immediately       | Don't batch completions |

---

## Commit Frequently

Commit after: GREEN phase, before/after refactoring, when switching tasks.

---

## Enforcement

Safeword tracks your phase and TDD step, reminding you each turn via the prompt hook. The done gate requires evidence (tests pass, scenarios complete, audit run).

- **Natural gates** — you can't start TDD without test-definitions.md; you can't create test-definitions.md without ticket frontmatter fields: `scope`, `out_of_scope`, `done_when`
- **Reminders** — the prompt hook injects your current phase and TDD step each turn
- **Output validation** — the done gate hard-blocks until evidence proves the work is complete
- **LOC gate** — commit every ~400 lines of code (blast radius control)

---

## Learnings

**Location:** `.safeword-project/learnings/` — check FIRST when stuck, debugging 2+ times, or working with unfamiliar technology. See `.safeword/guides/learning-extraction.md` for when and how to extract new learnings.

---

## Always Remember

1. **Clarity → Simplicity → Correctness** (in that order)
2. **Test what you can test**—never ask user to verify
3. **Understand before sizing**—contribute a perspective, then classify internally
4. **Research before proposing**—explore options proportional to decision magnitude
5. **Commit after each GREEN phase**
6. **Read the matching guide** when a trigger fires
7. **Always read the latest documentation for the relevant tool**
8. **AVOID BLOAT**
