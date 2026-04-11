# Post-Tool Linting Strategies for AI Coding Assistants

Covers: auto-fix vs error vs warn strategies, feedback loops, retry prevention, multi-language lint orchestration.

**Principle:** Different linting categories require different feedback strategies. Auto-fix vs error vs warn depends on the tool type, failure mode, and risk of infinite retry loops.

## The Gotcha

When AI coding assistants (Claude Code, Cursor, Aider) run linters after edits, the wrong feedback strategy creates problems:

- **Formatters returning non-zero after auto-fixing** → AI thinks there's an error → infinite retry loop
- **Blocking on style issues** → wastes tokens on trivial fixes
- **Silent warnings on semantic errors** → AI doesn't learn from mistakes

❌ **Bad:** Treating all linting failures the same way

```bash
# PostToolUse hook that blocks on any lint failure
eslint "$file" || exit 2           # Blocks on style AND semantic errors
prettier --check "$file" || exit 2 # Blocks even after auto-fix!
```

✅ **Good:** Category-specific feedback strategies

```bash
# Formatters: auto-fix, always exit 0
prettier --write "$file"
exit 0 # Never block - formatting is done

# Type errors: provide feedback to AI
tsc --noEmit 2>&1 || exit 2 # AI should learn from type errors

# Security: hard block
detect-secrets scan "$file" && exit 0 || exit 2
```

**Why it matters:**

- Cursor has explicit rule: "DO NOT loop more than 3 times on fixing linter errors" - but loops still happen
- Each retry burns tokens and time
- Wrong strategy = either too noisy (blocking on style) or too silent (missing real errors)

## Decision Matrix

| Tool Category        | Examples                  | Action            | Exit Code    | Rationale                          |
| -------------------- | ------------------------- | ----------------- | ------------ | ---------------------------------- |
| **Formatters**       | Prettier, gofmt, Black    | Auto-fix silently | Always 0     | Deterministic, no semantic changes |
| **Style linting**    | ESLint stylistic, MD013   | Auto-fix silently | Always 0     | Low-risk, predictable              |
| **Semantic linting** | Unused vars, type errors  | Error → feedback  | 2 on failure | AI should learn                    |
| **Security checks**  | Secrets, vulnerabilities  | Hard block        | 2 on failure | Must not proceed                   |
| **Flaky checks**     | Network-dependent, timing | Warn only         | 0            | Avoid false positives              |

## Hook Architecture

### Claude Code PostToolUse Pattern

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "./.safeword/hooks/post-edit-lint.sh"
          }
        ]
      }
    ]
  }
}
```

### Post-Edit Lint Script Pattern

```bash
#!/bin/bash
file="$CLAUDE_FILE_PATH"
ext="${file##*.}"

case "$ext" in
  ts | tsx | js | jsx)
    # Format silently (always succeeds)
    prettier --write "$file" 2> /dev/null

    # Type check with feedback (may fail)
    tsc --noEmit 2>&1
    exit $?
    ;;
  md)
    # Markdown: format only, no blocking
    # Rationale: docs don't break builds
    markdownlint-cli2 --fix "$file" 2> /dev/null
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
```

## The Infinite Loop Problem

**Root cause:** Formatters return non-zero after making changes, AI interprets this as "error to fix."

**Solutions:**

1. **Ignore formatter exit codes** - Always exit 0 after auto-fix
2. **Separate format and lint steps** - Format first (ignore), then lint (may fail)
3. **Use `--write` not `--check`** - Check mode returns non-zero on diff
4. **Implement retry limits** - Cursor caps at 3, consider similar for hooks

## When NOT to Add Post-Tool Linting

Skip post-tool hooks for:

- **Low-risk file types** (markdown, docs, config)
- **Slow linters** (>500ms adds noticeable latency)
- **Non-deterministic checks** (network, timing-dependent)
- **Already covered at commit time** (lint-staged handles it)

## Testing Trap

**Hooks work locally but cause loops in CI:**

- Local: Fast machine, linter exits quickly
- CI: Slower, timeout issues, different tool versions
- **Fix:** Test hooks with `--dry-run` or in isolated environment

**Auto-fix modifies file, triggering another hook:**

- File change → PostToolUse → auto-fix → file change → infinite loop
- **Fix:** Use file hash check or debounce mechanism

## Key Principles

1. **Formatters always exit 0** - They did their job, no feedback needed
2. **Semantic errors exit 2** - AI should learn from these
3. **Security errors block hard** - Non-negotiable
4. **Prefer commit-time for docs** - Lower stakes, less latency
5. **Cap retries explicitly** - Don't rely on AI to stop

## References

- [Anthropic - Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Claude Code Hooks Reference](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [How Cursor Works](https://blog.sshh.io/p/how-cursor-ai-ide-works) - "DO NOT loop more than 3 times"
- [Aider Lint/Test Docs](https://aider.chat/docs/usage/lint-test.html) - Formatter exit code issue
- [Byldd - Avoiding AI Fix Loops](https://byldd.com/tips-to-avoid-ai-fix-loop/)

Researched: 2025-12-03
