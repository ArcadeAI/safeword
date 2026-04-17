---
id: 018
type: epic
phase: intake
status: cancelled
created: 2026-01-10T20:36:00Z
last_modified: 2026-01-10T20:42:00Z
children: ['018a', '018b', '018c']
---

# IDE Parity: Eliminate Claude Code / Cursor Configuration Drift

**User Story:** When I add a new Safeword skill or hook, I want it to work identically in both Claude Code and Cursor without maintaining two separate implementations.

**Goal:** Single source of truth for Safeword configuration that works in both IDEs.

## The Problem

Safeword maintains separate configurations that drift over time:

| Category      | Claude Code                  | Cursor                    | Drift         |
| ------------- | ---------------------------- | ------------------------- | ------------- |
| Hook bindings | 8 in `.claude/settings.json` | 2 in `.cursor/hooks.json` | 6 missing     |
| Hook code     | Direct to `.safeword/hooks/` | Needs `hooks/cursor/`     | Adapter files |
| Commands      | 7 files                      | 8 files                   | `tdd.md`      |
| Skills/Rules  | `SKILL.md` format            | `.mdc` format             | Different     |
| Phase aware   | Yes (`stop-quality.ts`)      | No (`cursor/stop.ts`)     | Bug (→017b)   |

**Pain:** Every change requires updating two places. Drift accumulates.

## Research Summary

### Key Differences

| Aspect      | Claude Code                  | Cursor                     |
| ----------- | ---------------------------- | -------------------------- |
| Project dir | `$CLAUDE_PROJECT_DIR` env    | `workspace_roots[0]`       |
| Hook input  | `{ tool_input: { ... } }`    | `{ file_path, ... }`       |
| Stop output | `{ decision: "block", ... }` | `{ followup_message: "" }` |

### What Can Be Unified

1. **Hook logic** - Same code, runtime IDE detection
2. **Skill content** - Same markdown, different frontmatter wrappers
3. **Commands** - Identical files, just copy to both

### What Must Stay Separate

1. **Config files** - `.claude/settings.json` vs `.cursor/hooks.json` (different schemas)
2. **Frontmatter** - Claude needs `allowed-tools`, Cursor needs `alwaysApply`

## Solution: Three-Layer Unification

| Layer | Ticket | What It Does                  | Eliminates               |
| ----- | ------ | ----------------------------- | ------------------------ |
| 1     | 018a   | Unified hook I/O library      | `hooks/cursor/` adapters |
| 2     | 018b   | Skill sync from single source | Content drift in skills  |
| 3     | 018c   | Command sync                  | Missing commands         |

**Note:** Cursor phase-awareness fix (part of 017b) will be resolved by 018a's unified I/O.

### Why Not Generate Config Files?

Originally considered a `hooks.config.json` that generates both IDE configs. **Rejected because:**

1. Config schemas differ significantly - generator would be complex
2. Only ~8 hooks total - manual sync is manageable
3. Hook changes are rare - not worth the abstraction
4. Debugging generated configs is harder than direct editing

Simpler: Unified hook code + documented manual config updates.

## Design Decisions

| Decision         | Choice                       | Rationale                           |
| ---------------- | ---------------------------- | ----------------------------------- |
| Hook unification | Runtime IDE detection        | One codebase, no adapters           |
| Skill sync       | Script generates from source | Frontmatter differs, content same   |
| Config sync      | Manual + documentation       | Rare changes, schemas too different |
| Commands         | Copy script                  | Files are identical                 |

## Success Criteria

- [ ] No `hooks/cursor/` directory (adapters eliminated)
- [ ] Single skill source generates both formats
- [ ] Commands identical in both IDEs
- [ ] Both IDEs behave identically for all features
- [ ] Adding new hook = update 2 configs + 1 code file (not 2 code files)

## Related Tickets

- **017b** - Phase transition gates (includes Cursor phase-awareness fix, but 018a may resolve it first)

## Work Log

---

- 2026-01-10T20:42:00Z Refactored: Converted to epic, dropped config generator, simplified to 3 focused layers
- 2026-01-10T20:36:00Z Created: Research complete, unified source architecture designed

---
