# Hooks Authoring Guide

How to write hooks for Claude Code and Cursor that enforce quality gates and automate workflows.

**Sources:** [Claude Code Hooks](https://code.claude.com/docs/en/hooks) | [Cursor Hooks](https://cursor.com/docs/agent/hooks)

**Related:** [LLM Writing Guide](../../.safeword/guides/llm-writing-guide.md) for general principles

---

## Hooks vs Commands vs Skills

| Feature       | Hooks              | Commands            | Skills/Rules         |
| ------------- | ------------------ | ------------------- | -------------------- |
| **Trigger**   | Events (automatic) | Manual (`/command`) | Agent judgment       |
| **Behavior**  | Deterministic      | Deterministic       | Non-deterministic    |
| **Use case**  | Enforcement, gates | Explicit workflows  | Contextual knowledge |
| **Can block** | Yes                | No                  | No                   |

**Use hooks when:** You need guaranteed behavior, want to validate/block operations, or need automatic quality gates.

---

## Hook Events

### Claude Code

| Event               | When                      | Blocks? | Use Cases                    |
| ------------------- | ------------------------- | ------- | ---------------------------- |
| `PreToolUse`        | Before tool execution     | Yes     | Block commands, modify input |
| `PostToolUse`       | After tool completion     | No      | Format, log                  |
| `Stop`              | Agent finishes            | Yes     | Run tests, force continue    |
| `UserPromptSubmit`  | User submits prompt       | Yes     | Add context, validate        |
| `PermissionRequest` | Permission dialog appears | Yes     | Auto-allow/deny              |
| `SubagentStop`      | Subagent finishes         | Yes     | Control task tool            |
| `SessionStart`      | Session starts/resumes    | No      | Set environment              |
| `SessionEnd`        | Session terminates        | No      | Cleanup                      |

### Cursor

| Event                  | When                 | Blocks? | Use Cases            |
| ---------------------- | -------------------- | ------- | -------------------- |
| `beforeShellExecution` | Before shell command | Yes     | Block dangerous cmds |
| `afterFileEdit`        | After file edit      | No      | Auto-format, lint    |
| `stop`                 | Agent completes      | Yes     | Run tests, continue  |
| `beforeSubmitPrompt`   | Before processing    | Yes     | Validate, inject     |
| `beforeReadFile`       | Before file read     | Yes     | Block sensitive      |

---

## Configuration

### Claude Code (settings.json)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bun .claude/hooks/validate.ts",
            "timeout": 60
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "bun .claude/hooks/quality.ts" }]
      }
    ]
  }
}
```

**Matchers:** `Write` (exact), `Edit|Write` (alternation), `Notebook.*` (regex), `*` (wildcard)

**Locations:** `~/.claude/settings.json` (user) → `.claude/settings.json` (project) → `.claude/settings.local.json` (local)

### Cursor (hooks.json)

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [{ "command": "./.cursor/hooks/format.sh" }],
    "stop": [{ "command": "bun test" }]
  }
}
```

**Locations:** `.cursor/hooks.json` (project) or `~/.cursor/hooks.json` (user)

---

## Exit Codes

| Exit Code | Claude Code Behavior             | Cursor Behavior     |
| --------- | -------------------------------- | ------------------- |
| **0**     | Success, stdout processed        | Continue execution  |
| **2**     | Block action, stderr shown       | Block (return JSON) |
| **Other** | Non-blocking error, stderr shown | Error, continue     |

**Cursor blocking hooks** return JSON: `{ "continue": false, "userMessage": "Blocked: reason" }`

**Cursor stop hook** can auto-continue: `{ "followup_message": "Fix the errors" }` (max 5 iterations)

---

## Essential Patterns

### Pre-Tool Validation (Block Dangerous Commands)

```typescript
#!/usr/bin/env bun
const input = await Bun.stdin.text();
if (!input) process.exit(0);

const data = JSON.parse(input);
const cmd = data.tool_input?.command || '';
const filePath = data.tool_input?.file_path || '';

// Block dangerous commands
const dangerous = ['rm -rf /', 'mkfs', ':(){ :|:& };:'];
if (dangerous.some(d => cmd.includes(d))) {
  console.error(`Blocked: ${cmd}`);
  process.exit(2);
}

// Block protected paths
const protectedPaths = ['.env', '.git/', 'credentials', '.ssh/'];
if (protectedPaths.some(p => filePath.includes(p))) {
  console.error(`Blocked: protected path ${filePath}`);
  process.exit(2);
}

process.exit(0);
```

### Stop Quality Gate (Run Tests Before Completion)

```typescript
#!/usr/bin/env bun
import { $ } from 'bun';

const test = await $`bun test`.quiet().nothrow();
if (test.exitCode !== 0) {
  console.error('Tests failed. Fix before completing.');
  process.exit(2);
}

const lint = await $`bun run lint`.quiet().nothrow();
if (lint.exitCode !== 0) {
  console.error('Lint errors. Fix before completing.');
  process.exit(2);
}

process.exit(0);
```

---

## Best Practices

### Naming

- Use lowercase letters, numbers, and hyphens only
- Be descriptive: `validate-edits.ts`, `quality-gate.ts`, `lint-check.ts`
- Avoid vague names: `hook.ts`, `check.ts`, `run.ts`

### Implementation

1. **Keep hooks fast** — They block execution. Quick validation on PreToolUse, full tests on Stop.
2. **Exit code 2 to block** — Always provide clear error message via stderr.
3. **Quote shell variables** — `"$file_path"` not `$file_path` (prevents injection).
4. **Handle missing input** — `if (!input) process.exit(0);`
5. **stderr for debug, stdout for user** — Debug logs go to stderr.
6. **Test independently** — `echo '{"tool_name":"Edit"}' | bun hook.ts && echo $?`

---

## Security

**Do:** Quote variables, validate inputs, use minimum permissions, review hook code.

**Don't:** Run as root, trust unvalidated input, store secrets in hooks, hardcode paths.

**Protected paths:** `.env`, `.git/`, `.ssh/`, `.aws/`, `credentials`, `secrets`, `id_rsa`

---

## Troubleshooting

| Problem               | Solution                                                        |
| --------------------- | --------------------------------------------------------------- |
| Hook not firing       | Check JSON valid, matcher exact, script executable (`chmod +x`) |
| Firing multiple times | Known issue—dedupe in script or restart session                 |
| Permission denied     | `chmod +x hook.sh`, verify path                                 |
| Timeout               | Increase timeout config, optimize hook                          |

---

## Anti-Patterns

| Don't                         | Do                                      |
| ----------------------------- | --------------------------------------- |
| Full test suite on every edit | Quick validation on edit, tests on Stop |
| Block without explanation     | Always provide clear error message      |
| Write to stdout for debugging | Use stderr for debug logs               |
| Hardcode absolute paths       | Use relative paths or env vars          |

---

## Quality Checklist

- [ ] Script is executable
- [ ] Exit codes correct (0 success, 2 block)
- [ ] Error messages are clear
- [ ] Handles missing/malformed input
- [ ] Performance acceptable (<5s common ops)
- [ ] No command injection vulnerabilities
- [ ] Tested with sample input
- [ ] Tested in actual session
