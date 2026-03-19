---
name: ticket-system
description: Ticket system and work logs for context anchoring during complex work. Use when creating tickets, managing work logs, referencing ticket IDs, or when work needs context anchoring (multi-step tasks, debugging, investigation). Also use when user says 'create ticket', 'work log', 'resume', or references a ticket ID/slug. Do NOT use for simple patches or single-step tasks.
user-invocable: false
allowed-tools: '*'
---

# Ticket System

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

## Templates

**Use the matching template when ANY trigger fires:**

| Trigger                                                    | Template                                            |
| ---------------------------------------------------------- | --------------------------------------------------- |
| Planning new feature scope OR creating feature spec        | `./.safeword/templates/feature-spec-template.md`    |
| Bug, improvement, refactor, or internal task               | `./.safeword/templates/task-spec-template.md`       |
| Need test definitions for a feature OR acceptance criteria | `./.safeword/templates/test-definitions-feature.md` |
| Feature spans 3+ components OR needs technical spec        | `./.safeword/templates/design-doc-template.md`      |
| Making decision with long-term impact OR trade-offs        | `./.safeword/templates/architecture-template.md`    |
| Task needs context anchoring                               | `./.safeword/templates/ticket-template.md`          |
| Starting execution of a plan, ticket, or spec              | `./.safeword/templates/work-log-template.md`        |
