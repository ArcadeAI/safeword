**⚠️ ALWAYS READ FIRST: @./.safeword/SAFEWORD.md**

The SAFEWORD.md file contains core development patterns, workflows, and conventions.
Read it BEFORE working on any task in this project.

---

# SAFEWORD - AI Agent Configuration CLI

A CLI tool that installs AI coding agent configurations into projects. **This repo is safeword's source code AND uses safeword itself (dogfooding).**

## Design Philosophy

1. **Schema as Single Source of Truth**: All managed files/directories defined in `packages/cli/src/schema.ts`. No magic strings scattered across codebase.

2. **Reconciliation Over Copy**: The CLI computes diffs between installed and template versions, enabling clean upgrades without clobbering user changes.

3. **IDE Parity**: Claude Code and Cursor get equivalent skills/commands. Same capabilities, different formats. Parity enforced by tests.

4. **Dogfooding**: This repo runs safeword on itself. Template changes are tested in real usage before release.

5. **Unique Names**: No two skills, commands, subagents, guides, or hooks may share the same name. Duplicates cause ambiguous activation and unpredictable behavior.

## Agent Behavior Principles

### Fire-and-Forget by Default, Power User Escape Hatches

Users shouldn't have to "learn" safeword. It should feel automatic—like working with an experienced engineering team. You don't tell a good team how to do things; they just do them well.

- **Default behavior is invisible**: Agent detects work type (patch/task/feature) and applies the right process automatically
- **No teaching required**: User says "build X" and gets a quality process without asking for it
- **Power users can override**: Explicit commands exist (`/bdd`, `/refactor`, etc.) but 90% of users never need them

### Teammate Voice, Not System Logs

Announcements should sound like a colleague updating you, not a system logging state.

| System-y ❌                           | Teammate-y ✅                                                               |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `→ Feature detected. Using BDD flow.` | `Starting feature work — I'll define behaviors first, then build with TDD.` |
| `→ Phase 4: Scenario Quality Gate`    | `Let me check these scenarios are testable...`                              |
| `→ Override: TDD only`                | `Got it — skipping behaviors, straight to TDD.`                             |

Power users still understand what's happening. Newbies just hear a colleague explaining their approach.

### Progressive Disclosure

Don't front-load complexity. Gather minimum viable context, then offer to go deeper.

- **Minimum first**: Get enough to start (goal, scope, out-of-scope)
- **Offer discovery**: "I can start now, but want to spitball edge cases first?"
- **User controls depth**: They choose how many rounds of refinement, then say "ready"

### PM-Style Questions

When gathering context, ask like a good PM—not like a system collecting form fields.

| Category        | Question Style                                              |
| --------------- | ----------------------------------------------------------- |
| User experience | "What does success feel like? What does failure feel like?" |
| Failure modes   | "What breaks? What are the consequences?"                   |
| Boundaries      | "What's the minimum? Maximum? Where are the edges?"         |
| Scenarios       | "Walk through a concrete situation. What happens?"          |
| Regret          | "If we skip this, what support tickets will we get?"        |

### Skills, Subagents, and Hooks: Know the Difference

Claude Code has three mechanisms for controlling agent behavior. Understanding their enforcement levels prevents design mistakes.

| Mechanism     | What It Does                         | Enforcement | Can Chain? |
| ------------- | ------------------------------------ | ----------- | ---------- |
| **Skills**    | Guidance documents in same context   | Soft        | No         |
| **Subagents** | Isolated execution, separate context | Soft        | No nesting |
| **Hooks**     | Shell commands on lifecycle events   | Hard        | N/A        |

**Skills** add knowledge to the current conversation. Claude decides when to apply them based on semantic matching. They cannot invoke other skills or guarantee execution.

**Subagents** run in isolated context windows with configurable tool access. They're good for task isolation but:

- Cannot spawn other subagents (no nesting)
- Don't inherit skills unless explicitly configured
- Claude decides when to delegate (soft enforcement)

**Hooks** execute shell commands at lifecycle events (PreToolUse, PostToolUse, etc.). They provide hard enforcement:

- Exit code 2 blocks execution until acknowledged
- Run at app level, not relying on Claude to decide
- Perfect for validation, formatting, notifications

**Design principles:**

1. **Don't rely on skill-to-skill handoffs** — they depend on agent memory
2. **Don't expect subagents to chain** — no nesting allowed
3. **Use hooks for guaranteed enforcement** — they always run
4. **Inline guidance when handoffs fail** — merge skills instead of delegating

## Architecture Decisions

### Reconciliation Engine (`reconcile.ts`)

**Decision**: Compute install/upgrade/uninstall plans rather than blindly copying files.

**Why**: Users customize their configs. Blind copy destroys customizations. Reconciliation preserves user changes while updating framework files.

**Trade-off**: More complex than `cp -r`, but essential for upgrade path.

### Template Separation

**Decision**: Source templates in `packages/cli/templates/`, installed configs in `.safeword/`.

**Why**: Clear separation between "what we ship" and "what's installed". Enables `bunx safeword upgrade` to sync changes.

## Directory Roles

See `ARCHITECTURE.md` for full structure including all packages and templates.

| Directory                 | Role                                          |
| ------------------------- | --------------------------------------------- |
| `packages/cli/`           | CLI source code                               |
| `packages/cli/templates/` | Source templates (what CLI installs)          |
| `.safeword/`              | Installed config (dogfooding, tracked in git) |
| `.claude/`, `.cursor/`    | IDE-specific configs synced from templates    |

## Project-Specific Content

**Location**: `.safeword-project/` (never touched by CLI reset/upgrade)

Use for project-specific guides that shouldn't be overwritten by framework updates.

**Read the matching guide when ANY trigger fires:**

| Trigger                                | Guide                                                   |
| -------------------------------------- | ------------------------------------------------------- |
| Creating or modifying a skill          | `.safeword-project/guides/skill-authoring-guide.md`     |
| Creating or modifying a hook           | `.safeword-project/guides/hooks-authoring-guide.md`     |
| Creating or modifying a command        | `.safeword-project/guides/command-authoring-guide.md`   |
| Adding files to CLI templates (schema) | `.safeword-project/guides/schema-registration-guide.md` |
| Calling LLMs from code (APIs, caching) | `.safeword-project/guides/llm-integration-guide.md`     |

## Ticket Naming

Write ticket names that describe **user value**, not implementation.

**Pattern:** `<Action verb> <benefit> for <beneficiary>`

| Instead of...             | Write...                                     |
| ------------------------- | -------------------------------------------- |
| Add .vscode/settings.json | Format and lint on save for developers       |
| Wire PreToolUse hooks     | Protect config files from accidental changes |
| Customer template vscode  | Auto-configure IDE for customer projects     |
| Fix bug #123              | Prevent login timeout for slow connections   |

**Test:** Can a non-technical stakeholder understand what the ticket delivers?

**Examples by ticket type:**

| Type    | Bad                       | Good                                        |
| ------- | ------------------------- | ------------------------------------------- |
| Feature | "Add OAuth"               | "Let users sign in with Google"             |
| Task    | "Refactor AuthService"    | "Speed up login by caching tokens"          |
| Patch   | "Fix typo in README"      | "Fix typo in README" (patches can be brief) |
| Epic    | "Authentication overhaul" | "Secure and simplify user authentication"   |

## Common Gotchas

1. **templates/ vs .safeword/**: Edit `packages/cli/templates/` first, then `bunx safeword upgrade` to sync. Never edit `.safeword/` directly for framework changes.

2. **Schema registration**: Every file in `packages/cli/templates/` MUST have an entry in `packages/cli/src/schema.ts`. Without it, the file exists but never gets installed. Run `bun run test -- --testNamePattern="should have entry"` to verify.

3. **`bun test` vs `bun run test`**: This project uses Vitest. Always use `bun run test` (runs package.json script) not `bun test` (runs Bun's built-in test runner, which will fail on Vitest tests).

4. **Hook paths**: Always use `"$CLAUDE_PROJECT_DIR"/.safeword/hooks/...` format (quoted variable) for Claude Code hooks.

5. **Monorepo publishing**: `workspace:^` resolves at `bun install` time, not publish time. For 0.x packages, `^0.6.0` excludes 0.7.0. Run `bun install` after version bumps, or use explicit versions for cross-package deps.

6. **Preset vs Project config**: When fixing lint errors in THIS repo, modify `/eslint.config.mjs` (project config), NOT `packages/cli/src/presets/` (preset). Preset changes affect ALL safeword users. Project config only affects this repo. Rule of thumb: if a rule is a false positive for CLI tools specifically, add an override to the root eslint.config.mjs with the `cli-package-override` block.
