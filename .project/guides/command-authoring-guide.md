# Command Authoring Guide

How to write slash commands for Claude Code and Cursor that are discoverable, focused, and effective.

**Sources:**

- [Claude Code Slash Commands](https://code.claude.com/docs/en/slash-commands)
- [Cursor Commands](https://cursor.com/docs/agent/chat/commands)

**Related:** [LLM Writing Guide](../../.safeword/guides/llm-writing-guide.md) for general principles

---

## Commands vs Skills vs Rules

| Aspect         | Commands                         | Skills (Claude) / Rules (Cursor) |
| -------------- | -------------------------------- | -------------------------------- |
| **Trigger**    | Manual (`/command`)              | Automatic (agent decides)        |
| **Complexity** | Single file, focused prompt      | Multi-file, complex workflows    |
| **Use case**   | Frequent tasks, explicit control | Standards, contextual workflows  |
| **Weight**     | Higher (explicit invocation)     | Lower (may be ignored)           |

**Use commands when:**

- You want explicit control over when logic runs
- The task is frequent and needs consistent instructions
- You want to guarantee execution (not rely on agent matching)

**Use skills/rules when:**

- You want automatic activation based on context
- The workflow is complex and multi-step
- Standards should apply without user action

---

## File Structure

### Claude Code

```
.claude/commands/           # Project commands (shared with team)
├── review.md               → /review
├── commit.md               → /commit
└── frontend/
    └── component.md        → /frontend:component

~/.claude/commands/         # Personal commands (all projects)
└── daily.md                → /daily
```

### Cursor

```
.cursor/commands/           # Project commands
├── review-code.md          → /review-code
└── generate-tests.md       → /generate-tests

~/.cursor/commands/         # Global commands
└── standup.md              → /standup
```

**Namespacing:** Claude Code supports subdirectories for namespaced commands (e.g., `frontend/component.md` → `/frontend:component`). Cursor does not support subdirectories—all commands must be in the root `.cursor/commands/` directory.

---

## Format

### Claude Code

```markdown
---
description: Review code for security and performance issues
allowed-tools: Read, Grep, Glob
argument-hint: [file-or-directory]
model: claude-sonnet-4-20250514
disable-model-invocation: false
---

Review the code at $ARGUMENTS for:

1. Security vulnerabilities (OWASP top 10)
2. Performance issues
3. Code style violations

Provide findings grouped by severity (Critical/High/Medium/Low).
```

**Frontmatter fields:**

| Field                      | Required | Purpose                                             |
| -------------------------- | -------- | --------------------------------------------------- |
| `description`              | Yes      | Brief description (required for /command discovery) |
| `allowed-tools`            | No       | Restrict which tools the command can use            |
| `argument-hint`            | No       | Help text shown to user (e.g., `[file] [options]`)  |
| `model`                    | No       | Override model for this command                     |
| `disable-model-invocation` | No       | Prevent automatic invocation (default: false)       |

**Arguments:**

- `$ARGUMENTS` - All arguments as single string
- `$1`, `$2`, etc. - Positional arguments
- `@file.ts` - File references (included in context)
- `` `!git status` `` - Bash execution (backticks with `!` prefix)

### Cursor

```markdown
# Code Review

## Objective

Perform a comprehensive code review of the selected code.

## Requirements

1. Check for potential bugs and edge cases
2. Verify adherence to coding standards
3. Suggest performance improvements

## Output Format

- Group findings by severity
- Include line numbers
- Provide fix suggestions
```

**Key differences:**

- No frontmatter support (plain Markdown)
- Filename becomes command name
- Any text after `/command` is appended to prompt

---

## Best Practices

### 1. Use Descriptive Names

**Naming requirements:**

- Lowercase letters, numbers, and hyphens only
- Filename becomes command name (e.g., `review-security.md` → `/review-security`)
- Max 64 characters for consistency with skills
- No reserved words: `anthropic`, `claude`

Filename should clearly indicate what the command does.

```
# BAD
do-stuff.md
helper.md
run.md

# GOOD
review-security.md
generate-component.md
commit-with-tests.md
```

### 2. Keep Commands Focused

One clear purpose per command. If you need multiple steps, consider a skill instead.

```markdown
# BAD - Too many concerns

Review code, generate tests, update documentation, and deploy.

# GOOD - Single purpose

Review the provided code for security vulnerabilities.
Focus on: injection, auth bypass, data exposure.
```

### 3. Include the Description (Claude Code)

The `description` frontmatter is **required** for command discovery. Without it, the command won't appear in `/` autocomplete.

```yaml
---
description: Generate React component with tests and stories
---
```

### 4. Structure Output Expectations

Tell the agent what format you want. This reduces variance and improves consistency.

```markdown
## Output Format

1. Summary (2-3 sentences)
2. Findings table: | Issue | Severity | Location | Fix |
3. Recommendations (bullet list)
```

### 5. Use Argument Hints

Help users understand expected inputs.

```yaml
# Claude Code
argument-hint: [component-name] [--with-tests] [--with-stories]

# Cursor (in body)
Usage: /generate-component [name] [options]
Options: --with-tests, --with-stories
```

### 6. Restrict Tools When Appropriate

For commands that shouldn't modify files, restrict allowed tools.

```yaml
# Read-only review command
allowed-tools: Read, Grep, Glob

# Command that can edit
allowed-tools: Read, Edit, Write, Bash(npm test:*)
```

---

## Length Recommendations

| Platform    | Guidance                                           |
| ----------- | -------------------------------------------------- |
| Claude Code | Keep focused; description under 200 chars          |
| Cursor      | Plain Markdown, no strict limit but keep scannable |
| Both        | Commands carry more weight than rules—be concise   |

**Character budget:** Claude Code has a default 15,000 character budget for all command descriptions combined. Exceeding this may cause commands to be dropped from discovery.

---

## Common Patterns

### Code Review Command

```markdown
---
description: Review code for bugs, security, and style issues
allowed-tools: Read, Grep, Glob
argument-hint: [file-or-directory]
---

Review $ARGUMENTS for:

1. **Bugs**: Logic errors, edge cases, null handling
2. **Security**: Injection, auth, data exposure
3. **Style**: Naming, structure, duplication

Output as table: | Issue | Severity | Line | Suggestion |
```

### Commit Command

```markdown
---
description: Create a well-formatted git commit
allowed-tools: Bash(git:*)
---

1. Run `git diff --staged` to see changes
2. Analyze the changes
3. Generate commit message:
   - First line: type(scope): summary (50 chars max)
   - Body: what and why, not how
4. Run `git commit -m "..."`
```

### Test Generation Command

```markdown
---
description: Generate tests for a module
allowed-tools: Read, Write, Bash(bun test:*)
argument-hint: [source-file]
---

Generate tests for $1:

1. Read the source file
2. Identify public API and edge cases
3. Write tests covering:
   - Happy path
   - Error cases
   - Edge cases
4. Run tests to verify they pass
```

---

## Platform-Specific Notes

### Claude Code

- Commands can be invoked automatically if `disable-model-invocation: false` (default)
- Use `disable-model-invocation: true` for commands that should only run explicitly
- Subdirectories create namespaced commands (e.g., `frontend/component.md` → `/frontend:component`)

### Cursor

- Commands appear in dropdown when typing `/`
- Anything after command name is appended to prompt
- No frontmatter support—use body text for instructions
- Commands carry more weight than rules (agent follows them more closely)

---

## Anti-Patterns

| Don't                      | Do                                          |
| -------------------------- | ------------------------------------------- |
| Omit description (Claude)  | Always include `description` in frontmatter |
| Pack multiple concerns     | One purpose per command                     |
| Use vague names            | Use descriptive, action-oriented names      |
| Assume tools are available | Specify `allowed-tools` explicitly          |
| Write novel-length prompts | Keep focused and scannable                  |

---

## Troubleshooting

**Command not appearing in autocomplete:**

- Claude Code: Ensure `description` frontmatter is present
- Both: Check file is in correct directory (`.claude/commands/` or `.cursor/commands/`)

**Command not executing:**

- Claude Code v2.x known issue: Commands may load but not execute. Workaround: Reference with `@.claude/commands/filename.md`

**Arguments not working:**

- Use `$ARGUMENTS` for all args, `$1`/`$2` for positional
- Check for typos in argument syntax

---

## Quality Checklist

Before publishing a command:

- [ ] Filename is descriptive and action-oriented
- [ ] Description is present and clear (Claude Code)
- [ ] Single, focused purpose
- [ ] Output format specified
- [ ] Argument hint provided (if arguments expected)
- [ ] Allowed tools restricted appropriately
- [ ] Tested in both platforms (if cross-platform)

---

## Schema Registration (SAFEWORD-specific)

**Every new command template MUST be registered in `packages/cli/src/schema.ts`.**

```typescript
// In ownedFiles:
'.claude/commands/{name}.md': { template: 'commands/{name}.md' },
'.cursor/commands/{name}.md': { template: 'commands/{name}.md' },
```

Commands typically share the same template file for both platforms (Cursor ignores frontmatter).
