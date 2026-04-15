---
id: 112h
slug: cli-reference-remove
status: done
type: task
created: 2026-04-11
parent: '112'
---

# Remove cli-reference.md, inline decision table into SAFEWORD.md

**Goal:** Eliminate a guide that duplicates `bunx safeword --help` and has zero inbound references.

## Problem

- 43 lines restating what `--help` produces
- Already drifted: documented `-y, --yes` flags that are no-ops, inconsistent `@latest` usage (patched in this session)
- Zero inbound cross-references from any other guide, skill, or template
- No mechanism prevents future drift; `--help` is the single source of truth
- Only unique content: 6-row "When to Use" decision table

## Action

### 1. Inline decision table into SAFEWORD.md

Add to the existing SAFEWORD.md routing table or a new "CLI Commands" section:

```markdown
## CLI Commands

| Situation                   | Command                             |
| --------------------------- | ----------------------------------- |
| New project setup           | `bunx safeword@latest setup`        |
| Check if update available   | `bunx safeword@latest check`        |
| Update after CLI release    | `bunx safeword@latest upgrade`      |
| See what upgrade changes    | `bunx safeword@latest diff`         |
| Regenerate depcruise config | `bunx safeword@latest sync-config`  |
| Remove safeword             | `bunx safeword@latest reset --full` |

Run `bunx safeword <command> --help` for options.
```

### 2. Remove guide file

Delete `packages/cli/templates/guides/cli-reference.md`

### 3. Remove schema entry

Remove the ownedFiles entry from `packages/cli/src/schema.ts` (lines ~317-319)

### 4. Remove SAFEWORD.md routing table entry

The current entry `| Using safeword CLI commands | ./.safeword/guides/cli-reference.md |` becomes the inline section above.

### 5. Update reconciliation tests

Tests in `packages/cli/tests/commands/setup-reconcile.test.ts` that validate cli-reference.md exists need updating.

## Touches

- `packages/cli/templates/guides/cli-reference.md` — delete
- `packages/cli/templates/SAFEWORD.md` — add inline CLI section
- `packages/cli/src/schema.ts` — remove ownedFiles entry
- `packages/cli/tests/commands/setup-reconcile.test.ts` — update assertions
- `packages/cli/tests/commands/setup-templates.test.ts` — may need update
- `packages/cli/tests/npm-package.test.ts` — may need update

Rigor: LOW — straightforward deletion + inline. Run test suite after.

## Work Log

- 2026-04-11T23:43 Created ticket. cli-reference already patched earlier in session (flags, @latest).
