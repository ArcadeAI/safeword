# SAFEWORD Agent Instructions

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
| Using `safeword` CLI commands                                | `./.safeword/guides/cli-reference.md`           |

---

## Templates

**Use the matching template when ANY trigger fires:**

| Trigger                                                    | Template                                            |
| ---------------------------------------------------------- | --------------------------------------------------- |
| Planning new feature scope OR creating feature spec        | `./.safeword/templates/feature-spec-template.md`    |
| Bug, improvement, refactor, or internal task               | `./.safeword/templates/task-spec-template.md`       |
| Need test definitions for a feature OR acceptance criteria | `./.safeword/templates/test-definitions-feature.md` |
| Feature spans 3+ components OR needs technical spec        | `./.safeword/templates/design-doc-template.md`      |
| Making decision with long-term impact OR trade-offs        | `./.safeword/templates/architecture-template.md`    |
| Task needs context anchoring (see Ticket System below)     | `./.safeword/templates/ticket-template.md`          |
| Starting execution of a plan, ticket, or spec              | `./.safeword/templates/work-log-template.md`        |

---

## Ticket System

**Purpose:** Context anchor to prevent LLM loops during complex work. Colocates all artifacts.

**Location:** `.safeword-project/tickets/{id}-{slug}/`

**Folder structure:**

```text
.safeword-project/
├── tickets/
│   ├── 001-feature-name/
│   │   ├── ticket.md           # Ticket definition (frontmatter + work log)
│   │   ├── test-definitions.md # BDD scenarios (Given/When/Then)
│   │   ├── spec.md             # Feature spec for epics (optional)
│   │   └── design.md           # Design doc for complex features (optional)
│   ├── 002-another-task/
│   │   └── ticket.md
│   └── completed/              # Archive for done tickets
├── learnings/                  # Extracted knowledge (gotchas, discoveries)
└── tmp/                        # Scratch space (research, logs, etc.)
```

**Artifact Levels:**

| Level       | Artifacts                                           |
| ----------- | --------------------------------------------------- |
| **feature** | ticket.md + test-definitions.md (+ spec.md if epic) |
| **task**    | ticket.md with inline tests                         |
| **patch**   | ticket.md (minimal), existing tests                 |

**Create ticket? Answer IN ORDER, stop at first match:**

1. Multiple attempts likely needed? → Create ticket
2. Multi-step with dependencies? → Create ticket
3. Investigation/debugging required? → Create ticket
4. Risk of losing context mid-session? → Create ticket
5. None of above? → Skip ticket

**Examples:** "Fix typo" → skip. "Debug slow login" → ticket. "Add OAuth" → ticket.

**Minimal structure:**

```markdown
---
id: 001
status: in_progress
---

# [Title]

**Goal:** [one sentence]

## Work Log

- [timestamp] Started: [task]
- [timestamp] Found: [finding]
- [timestamp] Complete: [result]
```

**Rules:**

- Log immediately after each action
- Re-read ticket before significant actions
- For detailed scratch notes, use a separate work log (see Work Logs below)
- **CRITICAL:** Never mark `done` without user confirmation

---

## Work Logs

**Purpose:** Scratch pad and working memory during execution. Think hard. Keep notes.

**Location:** `.safeword/logs/{artifact-type}-{slug}.md`

**Naming convention:**

| Working on...         | Log file name            |
| --------------------- | ------------------------ |
| Ticket `001-fix-auth` | `ticket-001-fix-auth.md` |
| Spec `task-add-cache` | `spec-task-add-cache.md` |
| Design doc `oauth`    | `design-oauth.md`        |

**One artifact = one log.** If log exists, append a new session. Don't spawn multiple logs for the same work.

**Create log? Answer IN ORDER, stop at first match:**

1. Executing a plan, ticket, or spec? → Create log
2. Investigation/debugging with multiple attempts? → Create log
3. Quick single-action task? → Skip log

**Think hard behaviors:**

1. **Re-read the log** before each major action
2. **Pause to review** your approach periodically
3. **Log findings** as you discover them, not after
4. **Note dead ends** so you don't repeat them

**Log what helps you stay on track:** findings, decisions, hypotheses, blockers, scratch calculations. Use your discretion.

**Edge cases:**

| Situation                       | Action                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Multiple artifacts at once      | One log per artifact (don't combine)                                         |
| No clear artifact (exploratory) | Create `explore-{topic}.md`, convert to proper artifact when scope clarifies |

---

## Work Level Detection

**⚠️ MANDATORY: Run this decision tree on EVERY request BEFORE doing any work.**

**Resuming existing work?** If user references a ticket ID/slug or says "resume"/"continue":
→ Read ticket, use its `type:` field (feature/task/patch) instead of this tree.

Stop at first match:

```text
Is this explicitly a bug fix, typo, or config change?
├─ Yes → patch
└─ No ↓

Does request mention "feature", "add", "implement", "support", "build", "iteration", "phase"?
├─ No → task
└─ Yes ↓

Will it require 3+ files AND (new state OR multiple user flows)?
├─ Yes → feature
└─ No / Unsure ↓

Can ONE test cover the observable change?
├─ Yes → task
└─ No → feature

Fallback: task. User can /bdd to override.
```

**Always announce after detection:**

- **patch:** "Patch. Fixing directly."
- **task:** "Task. Writing tests first. `/bdd` to override." → TDD (RED → GREEN → REFACTOR)
- **feature:** "Feature. `/tdd` to override." → Run `/bdd`

**Examples:**

| Request                      | Signals                         | Level   |
| ---------------------------- | ------------------------------- | ------- |
| "Fix typo in README"         | 1 file, no test needed          | patch   |
| "Fix login error message"    | 1-2 files, 1 test               | task    |
| "Change button color to red" | 1 file, 1 test, no state        | task    |
| "Add dark mode toggle"       | 3+ files, new state, user prefs | feature |
| "Add user authentication"    | Many files, state machine       | feature |
| "Move onto iteration 2"      | New work chunk, scope in spec   | feature |
| "Implement iteration 3 of X" | Iteration = sub-feature of spec | feature |
| "Continue to phase 3"        | Phase = spec continuation       | feature |

**Edge cases:**

- "Add a comment to function X" → patch (not behavior change)
- "Implement the fix for bug #123" → task (bug fix despite "implement")
- "Build the Docker image" → patch (infrastructure, not product)

---

## Self-Testing

**Never ask the user to test what you can test yourself.**

| After...          | Do                       |
| ----------------- | ------------------------ |
| Fixes             | Run relevant tests       |
| Features          | Run affected test suites |
| Before completion | Verify everything passes |

**Anti-patterns:**

- ❌ "Please refresh and test"
- ❌ "Can you verify it works?"
- ✅ "Fixed. Running tests..." → "Tests pass"

---

## TodoWrite

**Use for:** 3+ step tasks, non-trivial work, multiple user requests.

| Rule                             | Why                     |
| -------------------------------- | ----------------------- |
| Create as first tool call        | Plan before acting      |
| One task `in_progress` at a time | Focus                   |
| Mark completed immediately       | Don't batch completions |

---

## Response Format

End responses with this JSON when you've made or proposed changes:

```json
{"proposedChanges": boolean, "madeChanges": boolean, "askedQuestion": boolean}
```

| Field           | True when...                                                  |
| --------------- | ------------------------------------------------------------- |
| proposedChanges | NEW or MODIFIED proposal in THIS response                     |
| madeChanges     | Used Edit, Write, MultiEdit, or NotebookEdit tools (not Read) |
| askedQuestion   | Asked question, need response before proceeding               |

**When to include:** After edits, proposals, or when quality review fires. Skip for simple Q&A.

**After quality review fires:**

- Proposal CHANGED after review → `proposedChanges: true`
- Proposal UNCHANGED after review → `proposedChanges: false`

This breaks the review loop when your proposal stabilizes.

Quality reviews, test runs, research, discussion = `madeChanges: false`

---

## Commit Frequently

Commit after: GREEN phase, before/after refactoring, when switching tasks.

---

## Code Fence Languages (MD040)

When markdown lint reports MD040 (missing language), choose:

| Content Type             | Language Hint                |
| ------------------------ | ---------------------------- |
| TypeScript/JavaScript    | `typescript` or `javascript` |
| Shell commands           | `bash`                       |
| JSON, YAML, TOML configs | `json`, `yaml`, `toml`       |
| SQL queries              | `sql`                        |
| Directory trees          | `plaintext`                  |
| Templates, pseudocode    | `text`                       |
| Command output, logs     | `text`                       |
| Truly ambiguous          | `text`                       |

**Why this matters:** Language hints help LLMs understand code context. Use real languages for real code, `text` for everything else.

---

## Learnings

**Location:** `.safeword-project/learnings/`

**Check learnings FIRST when:**

1. Stuck on an issue OR debugging same problem 2+ times
2. Working with unfamiliar technology in this codebase
3. Issue involves testing, processes, or integrations

**How:** `ls .safeword-project/learnings/` then read relevant files.

**Extract new learning when ANY apply:**

- 5+ debug cycles on same issue
- 3+ approaches tried
- Undocumented gotcha discovered
- Integration struggle between tools

**Before extracting:** Check for existing similar learnings—update, don't duplicate.

---

## Always Remember

1. **Clarity → Simplicity → Correctness** (in that order)
2. **Test what you can test**—never ask user to verify
3. **Run Work Level Detection on EVERY request**—announce patch/task/feature
4. **Commit after each GREEN phase**
5. **Read the matching guide** when a trigger fires
6. **Always read the latest documentation for the relevant tool**
7. **AVOID BLOAT**
8. **After edits/proposals**, end with: `{"proposedChanges": bool, "madeChanges": bool, "askedQuestion": bool}`
