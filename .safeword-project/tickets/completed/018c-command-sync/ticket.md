---
id: 018c
type: feature
phase: intake
status: cancelled
parent: 018
created: 2026-01-10T20:42:00Z
last_modified: 2026-01-10T20:42:00Z
---

# Command Sync

**User Story:** When I add a new Safeword command, I want it available in both Claude Code and Cursor automatically.

**Goal:** Single source for commands in `.safeword/commands/`, copied to both IDE directories.

**Parent:** [018 - IDE Parity](../018-ide-parity/ticket.md)

## The Problem

Commands are duplicated:

```
.claude/commands/           .cursor/commands/
  audit.md                    audit.md
  bdd.md                      bdd.md
  cleanup-zombies.md          cleanup-zombies.md
  done.md                     done.md
  lint.md                     lint.md
  quality-review.md           quality-review.md
  refactor.md                 refactor.md
                              tdd.md  ← Missing from Claude!
```

Files are identical (verified), but `tdd.md` drifted - exists in Cursor only.

## Solution

### Source Location

Move commands to `.safeword/commands/`:

```
.safeword/commands/
  audit.md
  bdd.md
  cleanup-zombies.md
  done.md
  lint.md
  quality-review.md
  refactor.md
  tdd.md
```

### Sync Script

Simple copy:

```bash
#!/bin/bash
# .safeword/scripts/sync-commands.sh

cp .safeword/commands/*.md .claude/commands/
cp .safeword/commands/*.md .cursor/commands/
```

Or in TypeScript alongside skill sync:

```typescript
// .safeword/scripts/sync-commands.ts
import { copySync } from 'fs-extra';

for (const cmd of glob('.safeword/commands/*.md')) {
  copySync(cmd, `.claude/commands/${basename(cmd)}`);
  copySync(cmd, `.cursor/commands/${basename(cmd)}`);
}
```

### Integration

Run with skill sync as part of pre-commit or CI.

## Implementation

1. Create `.safeword/commands/` with all command files
2. Add `tdd.md` to source (currently Cursor-only)
3. Create sync script
4. Update pre-commit/CI
5. Verify both IDEs have identical commands

## Acceptance Criteria

- [ ] `.safeword/commands/` is source of truth
- [ ] Both IDEs have identical command files
- [ ] `tdd.md` exists in both IDEs
- [ ] Adding new command = add to `.safeword/commands/` + run sync

## Commands to Migrate

| Command            | Status                      |
| ------------------ | --------------------------- |
| audit.md           | ✓ Both IDEs                 |
| bdd.md             | ✓ Both IDEs                 |
| cleanup-zombies.md | ✓ Both IDEs                 |
| done.md            | ✓ Both IDEs                 |
| lint.md            | ✓ Both IDEs                 |
| quality-review.md  | ✓ Both IDEs                 |
| refactor.md        | ✓ Both IDEs                 |
| tdd.md             | Cursor only → Add to Claude |

## Work Log

---

- 2026-01-10T20:42:00Z Created: Command sync from single source

---
