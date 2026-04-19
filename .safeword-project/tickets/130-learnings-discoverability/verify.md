# Verify — Ticket 130 (v2, Karpathy-aligned refactor)

Verified: (pending full test suite)

## Verify Checklist

**Test Suite:** pending — see full run
**Build:** ✅ learning-sync/index.ts + sync-learnings.ts compile
**Lint:** clean for new code
**Scenarios:** N/A — no test-definitions.md (AC-driven feature)
**Doc Refs:** ✅ no stale references to `project-learnings` skill, SKILL.md generation, or 1024-char description
**Dep Drift:** ✅ no new dependencies
**Parent Epic:** N/A

## Acceptance Criteria Cross-Check

- [x] `.safeword-project/learnings/INDEX.md` auto-generated, 16 entries visible
- [x] `safeword sync-learnings` CLI command + 19 unit tests (happy, missing Covers:, deletion, idempotency, empty-state, folder-absent no-op, scales to 500 entries)
- [x] PostToolUse hook wired; fires on Edit/Write of learning files
- [x] Templates ship: `post-tool-sync-learnings.ts` + schema entry + SETTINGS_HOOKS wiring
- [x] `safeword audit` W006 flag for missing Covers: (excludes INDEX.md from check)
- [x] All 16 learning files have Covers: on line 3
- [x] SAFEWORD.md + template updated with read-INDEX-before-work / add-learning-when-solved instruction
- [x] `.claude/skills/project-learnings/` deleted
- [x] SessionStart sync hook removed (both code and wiring)
- [x] Pre-commit sync block removed from `.husky/pre-commit`
- [x] W007 audit check removed

## Refactor Delta from v1

|                                  | v1 (umbrella skill, 2026-04-17)                          | v2 (Karpathy-aligned, 2026-04-19)                 |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Generated artifact               | `.claude/skills/project-learnings/SKILL.md`              | `.safeword-project/learnings/INDEX.md`            |
| Hooks                            | 3 (PostToolUse, SessionStart, pre-commit)                | 1 (PostToolUse)                                   |
| Discovery mechanism              | Auto-invocation via skill description keyword match      | CLAUDE.md/SAFEWORD.md instruction → read INDEX.md |
| Scaling ceiling                  | ~15 learnings                                            | None                                              |
| Platform portability             | Claude Code only                                         | Any agent reading SAFEWORD.md/CLAUDE.md           |
| Code in `learning-sync/index.ts` | ~220 lines (with budget math, truncation, ellipsis)      | ~140 lines                                        |
| Audit codes                      | W006 + W007                                              | W006 only                                         |
| Budget math                      | 1024-char description cap, fixed/variable/ellipsis split | none                                              |

Ready to flip `phase: done` after test suite confirms.
