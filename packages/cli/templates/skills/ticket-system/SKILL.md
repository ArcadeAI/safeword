---
name: ticket-system
description: Ticket system and work logs for context anchoring. Use when creating
  tickets, managing work logs, or anchoring context across multi-step tasks or
  sessions. Do NOT use for simple patches or single-step tasks.
user-invocable: false
allowed-tools: '*'
---

# Ticket System

**Purpose:** Context anchor to prevent LLM loops during complex work. Colocates all artifacts.

**Namespace root:** Resolve from `paths.projectRoot` in `.safeword/config.json`; if unset, use `.project/` by default, falling back to legacy `.safeword-project/` only when that directory already exists. Substitute the resolved root in every path below.

**Creating a ticket:** Run `safeword ticket new <slug>` (optionally with `--type=patch|task|feature` and `--title="..."`). The CLI mints a 6-char Crockford Base32 ID, creates the folder atomically, and writes a starter ticket.md. **Do not scan the tickets directory and pick the next ID yourself** — that races between parallel sessions and silently collides across git branches.

**Location:** `<namespace-root>/tickets/{ID}-{slug}/` for tickets created by `safeword ticket new` (6-char Crockford ID plus normalized slug). Lookup remains backward-compatible with older `{ID}/` Crockford folders and legacy `{numeric-id}-{slug}/` folders — all formats remain reachable by ID.

**Folder structure:**

```text
<namespace-root>/
├── tickets/
│   ├── 7K9M3P-login-bug/       # Current format: Crockford ID + normalized slug
│   │   ├── ticket.md           # Ticket definition (frontmatter + work log)
│   │   ├── test-definitions.md # BDD scenarios (Given/When/Then)
│   │   ├── spec.md             # Feature spec for epics (optional)
│   │   └── design.md           # Design doc for complex features (optional)
│   ├── 7K9M3P/                 # Historical Crockford ID-only format, still readable
│   │   └── ticket.md
│   ├── 080-ticket-id-collision/  # Legacy numeric format, still readable
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
id: 7K9M3P
slug: feature-name
status: in_progress
---

# [Title]

**Goal:** [one sentence]

## Work Log

- [timestamp] Started: [task]
- [timestamp] Found: [finding]
- [timestamp] Complete: [result]
```

**Frontmatter values:**

- `status`: `in_progress | done | cancelled | superseded | wontfix | blocked`
- `phase`: `intake | define-behavior | scenario-gate | implement | done` (see ticket-template.md)
- `parent`: `<id>` (optional)
- `epic`: `<slug-or-id>` (optional)
- `blocked_on`: `[<id>, <id>]` (optional)
- `depends_on`: `[<id>]` (optional)
- `external_issue`: `<https://.../issues/nnn>` (optional; one canonical issue/link)
- `external_prs`: `[<https://.../pull/nnn>, ...]` (optional; active or relevant PR links)

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

| Working on...                | Log file name            |
| ---------------------------- | ------------------------ |
| Ticket `7K9M3P` (slug: foo)  | `ticket-7K9M3P-foo.md`   |
| Legacy ticket `080-fix-auth` | `ticket-080-fix-auth.md` |
| Spec `task-add-cache`        | `spec-task-add-cache.md` |
| Design doc `oauth`           | `design-oauth.md`        |

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
