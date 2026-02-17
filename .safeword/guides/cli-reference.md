# Safeword CLI Reference

Commands for managing safeword in projects.

## Commands

| Command                        | Purpose                             |
| ------------------------------ | ----------------------------------- |
| `bunx safeword@latest setup`   | Install safeword in current project |
| `bunx safeword@latest check`   | Check project health and versions   |
| `bunx safeword@latest upgrade` | Upgrade to latest version           |
| `bunx safeword@latest diff`    | Preview changes before upgrading    |
| `bunx safeword reset`          | Remove safeword from project        |

## When to Use

| Situation                  | Command                        |
| -------------------------- | ------------------------------ |
| New project setup          | `bunx safeword@latest setup`   |
| Check if update available  | `bunx safeword@latest check`   |
| Update after CLI release   | `bunx safeword@latest upgrade` |
| See what upgrade changes   | `bunx safeword@latest diff`    |
| Remove safeword completely | `bunx safeword reset --full`   |

## Options

Run `bunx safeword <command> --help` for command-specific options.

Common flags:

- `-y, --yes` - Skip confirmation (setup, reset)
- `-v, --verbose` - Show detailed output (diff)
- `--offline` - Skip remote version check (check)
- `--full` - Also remove linting config + packages (reset)

---

## Key Takeaways

- Always use `@latest` for setup/check/upgrade/diff to get current CLI
- Use `diff` before `upgrade` to preview changes
