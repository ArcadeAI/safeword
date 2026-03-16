# SAFEWORD - AI Agent Configuration CLI

**Problem**: AI agents write code without tests, skip design validation, and lack consistency across projects.

**Solution**: Portable patterns and guides that enforce test-first development (BDD/TDD), quality standards, and best practices across all your projects.

**Repository**: <https://github.com/TheMostlyGreat/safeword>

---

## Quick Start (30 seconds)

**1. Install in your project:**

```bash
cd /path/to/your/project
bunx safeword@latest setup
```

**2. Verify installation:**

```bash
# Check for SAFEWORD files
test -f .safeword/SAFEWORD.md && echo ".safeword/SAFEWORD.md ✓"
test -f AGENTS.md && echo "AGENTS.md ✓"
```

**Result**: Your project now has:

- `.safeword/SAFEWORD.md` - Global patterns and workflows
- `.safeword/guides/` - Testing methodology (BDD/TDD), code philosophy
- `.safeword/hooks/` - Auto-linting, quality review hooks
- `.claude/settings.json` - Hook configuration for Claude Code
- `.claude/commands/` - Slash commands for Claude Code
- `.cursor/hooks.json` - Hook configuration for Cursor
- `.cursor/rules/` - Behavior rules for Cursor
- `.cursor/commands/` - Slash commands for Cursor
- `AGENTS.md` - Project context with framework reference

**Commit these to your repo** for team consistency.

---

## How It Fits Your Project

**Stack-agnostic** — Safeword is a process layer, not a framework opinion. It works alongside any stack — Next, Elysia, Astro, Django, Gin, whatever you use. Your application code and runtime dependencies are never touched.

**Your agent config stays yours** — Safeword uses `AGENTS.md` as the primary entry point. If you have an existing `CLAUDE.md`, it adds one import line at the top — your content is untouched.

**Dev-only tools** — For JS/TS projects, safeword installs ESLint, Prettier, and supporting plugins as `devDependencies`. These are code quality tools for development — they never ship with your application or affect your runtime.

**AI guardrails, not human blockers** — Hooks and stricter linting rules only fire during AI agent sessions (Claude Code / Cursor events). They never run during normal human development. Safeword does not install git hooks or modify your commit workflow.

**Use in CI if you want** — Safeword adds `lint` and `format` scripts to your `package.json`. You can wire these into your CI pipeline or precommit hooks — but it's your choice, not forced.

---

## How It Works

**Project-local framework**: Scripts write to `.safeword/`, `.claude/`, and `.cursor/` in your project (no global install needed)

**Team consistency**: Teammates get the framework from your project repo (no global install needed)

**Living documentation**: Update guides as you learn, extract learnings from debugging, archive completed work

---

## What's Inside

Key directories created in your project:

- `.safeword/guides/` - Core methodology and best practices
- `.safeword/templates/` - Fillable document structures
- `.safeword-project/tickets/` - Tickets for complex/multi-step work (context anchors)
- `.safeword/hooks/` - Automation scripts (Claude Code + Cursor)
- `.claude/commands/`, `.cursor/commands/` - Slash commands
- `.claude/skills/`, `.cursor/rules/` - Specialized agent capabilities

---

## Core Guides

**Purpose**: Reusable methodology applicable to all projects

| Guide                      | Purpose                                                            | When to Read            |
| -------------------------- | ------------------------------------------------------------------ | ----------------------- |
| **planning-guide.md**      | Feature planning workflow, spec creation, BDD/TDD integration      | Starting any feature    |
| **testing-guide.md**       | Test-first workflow (RED/GREEN/REFACTOR), test pyramid, test types | Writing tests           |
| **learning-extraction.md** | Extract learnings from debugging, recognition triggers             | After complex debugging |

---

## Documentation Guides

**Purpose**: Writing effective feature documentation

| Guide                          | Purpose                                            | When to Read                   |
| ------------------------------ | -------------------------------------------------- | ------------------------------ |
| **design-doc-guide.md**        | Design doc structure and best practices            | Designing complex features     |
| **architecture-guide.md**      | Architecture decisions (tech choices, data models) | Making architectural decisions |
| **data-architecture-guide.md** | Data model design (schemas, validation, flows)     | Database/schema design         |
| **context-files-guide.md**     | CLAUDE.md/AGENTS.md structure and best practices   | Setting up project context     |

---

## Meta Guides

**Purpose**: Working with LLMs and documentation structure

| Guide                         | Purpose                                                      | When to Read                    |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------- |
| **llm-writing-guide.md**      | Writing docs that LLMs follow (MECE, examples, recency bias) | Writing skills, commands, hooks |
| **zombie-process-cleanup.md** | Port-based cleanup, multi-project isolation                  | Managing dev servers            |
| **cli-reference.md**          | Safeword CLI command reference and usage                     | Using CLI commands              |

---

## Templates

**Purpose**: Fillable structures for feature documentation

| Template                        | Purpose                                          | Used By             |
| ------------------------------- | ------------------------------------------------ | ------------------- |
| **feature-spec-template.md**    | Feature spec (user stories + constraints)        | planning-guide.md   |
| **task-spec-template.md**       | Bug, improvement, refactor, or internal task     | planning-guide.md   |
| **test-definitions-feature.md** | Test definition structure (suites, tests, steps) | planning-guide.md   |
| **design-doc-template.md**      | Design doc structure (architecture, components)  | design-doc-guide.md |
| **architecture-template.md**    | ADR for decisions with long-term impact          | planning-guide.md   |
| **ticket-template.md**          | Context anchor for complex/multi-step work       | SAFEWORD.md         |
| **work-log-template.md**        | Scratch pad and working memory during execution  | SAFEWORD.md         |

---

## Learnings

**Purpose**: Extracted knowledge that compounds across sessions

**Location**: `.safeword-project/learnings/[concept].md`

**What goes here**:

- Debugging discoveries (non-obvious gotchas, integration struggles)
- Trial-and-error findings (tried 3+ approaches before right one)
- Architecture insights (discovered during implementation)
- Testing traps (tests pass but UX broken, or vice versa)

**How to extract**: Follow `learning-extraction.md` recognition triggers and templates

---

## Tickets

**Purpose**: Context anchors for complex/multi-step work to prevent LLM loops

**Location**: `.safeword-project/tickets/{id}-{slug}/`

**Structure**:

```plaintext
.safeword-project/
├── tickets/
│   ├── 001-feature-name/
│   │   ├── ticket.md           # Ticket definition (frontmatter + work log)
│   │   ├── test-definitions.md # BDD scenarios (Given/When/Then)
│   │   ├── spec.md             # Feature spec for epics (optional)
│   │   └── design.md           # Design doc for complex features (optional)
│   └── completed/              # Archive for done tickets
├── learnings/                  # Extracted knowledge (gotchas, discoveries)
└── tmp/                        # Scratch space (research, logs, etc.)
```

**When to create**: Multiple attempts likely, multi-step with dependencies, investigation needed, or risk of losing context

---

## Hooks, Commands & Skills

**Hooks** (in `.safeword/hooks/`): TypeScript automation scripts (Bun runtime)

- `session-verify-agents.ts` - Verifies AGENTS.md link on session start
- `session-version.ts` - Shows safeword version on session start
- `session-lint-check.ts` - Checks for lint errors on session start
- `prompt-timestamp.ts` - Injects timestamp into prompts
- `prompt-questions.ts` - Reminds agent to ask clarifying questions
- `post-tool-lint.ts` - Auto-lints after file edits
- `post-tool-quality.ts` - Tracks LOC, detects phase changes and feat: commits
- `pre-tool-quality.ts` - Blocks edits when quality gate is active (LOC, phase, or refactor)
- `stop-quality.ts` - Quality review prompt on stop
- `cursor/after-file-edit.ts` - Auto-lints after Cursor file edits
- `cursor/stop.ts` - Quality review prompt on Cursor stop

**Skills** (in `.claude/skills/`): Specialized agent capabilities

- `bdd/` - BDD orchestrator for feature-level work (Discovery, Scenarios, Decomposition, TDD, Splitting, Done)
- `debug/` - Four-phase debugging (investigate before fixing)
- `quality-review/` - Deep code review with web research
- `refactor/` - Small-step refactoring with test verification

**Commands** (in `.claude/commands/`): Slash commands

- `/audit` - Run architecture and dead code analysis
- `/bdd` - Force BDD flow for current task
- `/cleanup-zombies` - Kill zombie processes on ports
- `/verify` - Verify ticket criteria (tests, build, lint, scenarios, dep drift)
- `/lint` - Run linters and formatters
- `/quality-review` - Deep code review with web research
- `/refactor` - Systematic refactoring with small-step discipline

**MCP Servers** (in `.mcp.json` / `.cursor/mcp.json`): Auto-configured integrations

- **context7** - Up-to-date library documentation lookup
- **playwright** - Browser automation for testing

---

## CLI Commands

```bash
# Set up safeword in current project
bunx safeword@latest setup
bunx safeword@latest setup -y # Non-interactive mode

# Check project health and versions
bunx safeword@latest check
bunx safeword@latest check --offline # Skip remote version check

# Upgrade to latest version
bunx safeword@latest upgrade

# Preview changes before upgrading
bunx safeword@latest diff
bunx safeword@latest diff -v # Show full diff output

# Regenerate architecture config for /audit
bunx safeword@latest sync-config

# Remove safeword from project
bunx safeword reset
bunx safeword reset -y     # Skip confirmation
bunx safeword reset --full # Also remove linting config + packages
```

### Publishing (maintainers)

```bash
# From packages/cli/
bun publish
```

**Auto-detection**: Detects project type from `package.json` and installs relevant ESLint/Prettier plugins:

- TypeScript, React, Next.js, Astro
- Vitest, Playwright, Tailwind, Turbo, TanStack Query
- Storybook (always included, file-scoped to `*.stories.*`)
- Publishable libraries (adds publint)

### How Guide Imports Work

`AGENTS.md` contains a link to `.safeword/SAFEWORD.md` (also added to `CLAUDE.md` if present).

SAFEWORD.md then imports guides via the Guides table. Both Claude Code and Cursor auto-load these as context.

### Check for Existing Learnings

```bash
ls .safeword-project/learnings/
```

### Extract New Learning

1. Follow recognition triggers in `learning-extraction.md`
2. Create `.safeword-project/learnings/[concept].md`
3. Use template: Problem → Gotcha → Examples → Testing Trap

---

## Syncing Across Machines

Commit `.safeword/`, `.claude/`, and `.cursor/` in your project repo for team consistency.

---

## Integration with Project Context

**How it works**:

1. `AGENTS.md` links to `.safeword/SAFEWORD.md` (also adds one import line to `CLAUDE.md` if present)
2. `SAFEWORD.md` imports guides via Guides table
3. Guides cross-reference each other and templates
4. Learnings stored in `.safeword-project/learnings/`

**Result**: Modular, maintainable documentation with clear separation of concerns

---

## Principles

1. **Guides** - Reusable methodology (test pyramid, BDD/TDD workflow)
2. **Templates** - Fillable structures (user stories, test definitions)
3. **Learnings** - Extracted knowledge (gotchas, discoveries)
4. **Planning** - Feature planning and design (user stories, test definitions, design docs)
5. **Hooks/Skills** - Automation and specialized capabilities

**Living Documentation**: Update as you learn, archive completed work, consolidate when needed

---

## FAQ

**Will safeword change my stack or framework?**
No. Safeword is a process overlay — it adds quality enforcement (BDD/TDD, linting, code review) on top of whatever you already use. It doesn't install application dependencies or modify your source code.

**Will it overwrite my CLAUDE.md?**
No. Safeword uses `AGENTS.md` as the primary entry point. If you have an existing `CLAUDE.md`, it prepends a single 4-line block that links to `.safeword/SAFEWORD.md`. Your existing content stays exactly where it is.

**What packages does it install?**
For JS/TS projects: ESLint, Prettier, and supporting plugins — all as `devDependencies` (the `-D` flag). These are code quality tools, not application dependencies. Python, Go, and Rust (beta) use their language-native linters (ruff, golangci-lint, clippy).

**I use biome/dprint — is that a problem?**
Safeword detects biome/dprint and skips Prettier installation. ESLint is still installed because biome doesn't support security scanning (`eslint-plugin-security`), cyclomatic complexity checks (`sonarjs`), or framework-specific rules (React hooks, Next.js, Astro). Both tools coexist without conflict.

**Do teammates need to install safeword separately?**
No. Commit the `.safeword/`, `.claude/`, and `.cursor/` directories to git. When teammates pull, they get the full setup. The linting devDependencies install automatically with `npm install` / `bun install`.

**Will it interfere with my development workflow?**
No. Safeword's hooks and stricter linting rules only fire during AI agent sessions. They don't run when you code normally, and safeword does not install git hooks. It adds `lint` and `format` scripts to `package.json` that you can optionally use in CI or precommit hooks.

---

## Development

This section is for contributors to safeword itself.

### Tech Stack

| Component | Technology                  |
| --------- | --------------------------- |
| Runtime   | Bun (dev), Node 18+ (users) |
| CLI       | TypeScript, Commander.js    |
| Build     | tsup (ESM-only output)      |
| Tests     | Vitest                      |
| Linting   | ESLint 9 + Prettier         |

### Optional System Binaries

These tools enhance development scripts but are not required:

| Binary  | Purpose                       | Script           | Install                 |
| ------- | ----------------------------- | ---------------- | ----------------------- |
| `shfmt` | Format shell scripts in repo  | `bun format:sh`  | `brew install shfmt`    |
| `dot`   | Generate dependency graph SVG | `bun deps:graph` | `brew install graphviz` |

Without these binaries, the scripts print a message and skip.

### Development Workflow

**Editing Source Templates:**

1. Edit in `packages/cli/templates/` (source of truth)
2. Run `bunx safeword upgrade` to sync to `.safeword/`
3. Test changes

**Running Tests:**

```bash
# Important: Use `bun run test` (Vitest), NOT `bun test` (Bun's runner)
bun run test                      # All tests
bunx vitest run tests/foo.test.ts # Single file
bun run test:integration          # Integration tests
bun run test:watch                # Watch mode
```

**Publishing:**

Always run `bun publish` from `packages/cli/` directory, not the monorepo root.

### CLI Parity (Claude Code / Cursor)

The CLI installs matching skills for both Claude Code and Cursor IDEs.

**Source of truth:** `packages/cli/src/schema.ts`

**Parity tests:** `packages/cli/tests/schema.test.ts`

| IDE         | Skills Location                        | Commands Location       |
| ----------- | -------------------------------------- | ----------------------- |
| Claude Code | `.claude/skills/safeword-*/`           | `.claude/commands/*.md` |
| Cursor      | `.cursor/rules/{safeword-*,bdd-*}.mdc` | `.cursor/commands/*.md` |

**Editing skills:**

1. Edit templates in `packages/cli/templates/skills/` (Claude) and `packages/cli/templates/cursor/rules/` (Cursor)
2. Update `packages/cli/src/schema.ts` if adding/removing skills
3. Run parity tests: `bun run test -- --testNamePattern="parity"`
4. Run `bunx safeword upgrade` to sync to local project

---

## Getting Help

- **Claude Code docs**: <https://docs.claude.com/en/docs/claude-code>
- **Issues**: <https://github.com/anthropics/claude-code/issues>
- **This repo**: <https://github.com/TheMostlyGreat/safeword>
