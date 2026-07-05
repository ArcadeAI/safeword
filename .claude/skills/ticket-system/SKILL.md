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

**Creating a ticket:** Resolve the Safeword CLI locally first, then run `ticket new` through that resolver:

```bash
if [ -x node_modules/.bin/safeword ]; then
  SW="node_modules/.bin/safeword"
elif [ -f packages/cli/src/cli.ts ]; then
  SW="bun packages/cli/src/cli.ts"
else SW="bunx safeword"; fi

$SW ticket new <slug> # optionally add --type=patch|task|feature and --title="..."
```

The CLI mints a 6-char Crockford Base32 ID, creates the folder atomically, and writes a starter ticket.md. **Do not scan the tickets directory and pick the next ID yourself** — that races between parallel sessions and silently collides across git branches. If the resolver cannot run, stop and report that the CLI is unresolvable; do not hand-mint a fallback ID.

**Location:** `<namespace-root>/tickets/{ID}-{slug}/` for tickets created by the resolved `ticket new` command above (6-char Crockford ID plus normalized slug). Lookup remains backward-compatible with older `{ID}/` Crockford folders and legacy `{numeric-id}-{slug}/` folders — all formats remain reachable by ID.

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

**Create a ticket** when any of these holds: multiple attempts are likely,
the work is multi-step with dependencies, it needs investigation/debugging, or
there's a risk of losing context mid-session. Otherwise skip it.

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
- `phase`: `intake | define-behavior | scenario-gate | implement | verify | done` (see ticket-template.md)
- `phase_skips`: `["<phase>: <reason>", ...]` (optional; feature tickets only) — one entry per phase a feature was born into or advanced past without traversing it. Block sequence, non-empty reason each; the phase-provenance gate requires it when a feature skips phases (see glossary "Gate")
- `phase_anchors`: `["<phase>: <commit-sha>", ...]` (optional; feature tickets only) — one entry per phase entered on a forward advance, recording the commit SHA the transition rides (7–40 hex — HEAD at advance time). Append one entry per phase, never overwrite. This is the evidence distinguishing a real advance from a forged frontmatter edit; the deliverable-boundary gate validates it
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

**Create a log** when executing a plan, ticket, or spec, or when
investigation/debugging spans multiple attempts. Skip it for a quick
single-action task.

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
