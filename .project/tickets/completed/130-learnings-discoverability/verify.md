# Verify — Ticket 130 (v2 final, Karpathy-aligned)

Verified: 2026-05-03T16:13:00Z

## Verify Checklist

**Test Suite:** ✓ 1536/1537 tests pass (1 skipped, 78 files, 0 failures)
**Build:** ✅ Success (`bun run --cwd packages/cli build` clean)
**Lint:** ✅ Clean for new code (3 pre-existing TS errors flagged below, scoped out)
**Scenarios:** ⏭️ Skipped — no test-definitions.md (AC-driven feature, not BDD)
**Doc Refs:** ✅ Clean — no stale references to removed symbols (`project-learnings`, `SKILL_RELATIVE_DIR`, `MAX_DESCRIPTION_CHARS`, `buildSkillContent`, `descriptionTruncated`, `session-sync-learnings`)
**Dep Drift:** ✅ Clean — zero new dependencies added in ticket 130
**Parent Epic:** N/A

## Acceptance Criteria Cross-Check

- [x] `.safeword-project/learnings/INDEX.md` auto-generated, 16 entries visible
- [x] `safeword sync-learnings` CLI + 19 unit tests (happy, missing Covers:, deletion, idempotency, empty-state, no-op when folder absent, scales to 500 entries)
- [x] PostToolUse hook fires on Edit/Write of `.safeword-project/learnings/*.md`
- [x] Templates ship: `post-tool-sync-learnings.ts` + schema entry + SETTINGS_HOOKS wiring
- [x] `safeword audit` W006 flag for missing Covers: (excludes INDEX.md from check)
- [x] All 16 learning files have Covers: on line 3
- [x] SAFEWORD.md + template updated with read-INDEX-before-work / add-learning-when-solved instruction
- [x] Customer parity: CLAUDE.md prepend uses `@./.safeword/SAFEWORD.md` import (`CLAUDE_MD_IMPORT_BLOCK`); AGENTS.md prepend keeps prose
- [x] `.claude/skills/project-learnings/` deleted
- [x] SessionStart sync hook removed (both code and wiring)
- [x] Pre-commit sync block removed from `.husky/pre-commit`
- [x] W007 audit check removed
- [x] Dogfood: `safeword sync-learnings` runs locally; INDEX.md has all 16 entries
- [x] Dogfood: CLAUDE.md top line is `@./.safeword/SAFEWORD.md`; AGENTS.md top is backtick prose

## Out-of-Scope Findings (Spawned as Follow-ups)

- 3 pre-existing TypeScript errors in unrelated files (`config.test.ts`, `project-detector.test.ts`, `website/content.config.ts`) — noticed during this verify pass, predate ticket 130's branch (last touched in commits `38161c7`, `5123426`, `4a232f9`). Spawned chip: "Fix 3 pre-existing TypeScript errors."

## Refactor Delta from v1

|                                  | v1 (umbrella skill, 2026-04-17)                     | v2 (Karpathy-aligned, 2026-04-19→05-03)                                                                                  |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Generated artifact               | `.claude/skills/project-learnings/SKILL.md`         | `.safeword-project/learnings/INDEX.md`                                                                                   |
| Hooks                            | 3 (PostToolUse, SessionStart, pre-commit)           | 1 (PostToolUse) + compact-context belt-and-suspenders                                                                    |
| Discovery mechanism              | Auto-invocation via skill description keyword match | CLAUDE.md `@` import → SAFEWORD.md → INDEX.md                                                                            |
| Scaling ceiling                  | ~15 learnings (1024-char description cap)           | None                                                                                                                     |
| Platform portability             | Claude Code only                                    | Any agent reading SAFEWORD.md/CLAUDE.md/AGENTS.md                                                                        |
| Code in `learning-sync/index.ts` | ~220 lines                                          | ~155 lines                                                                                                               |
| Audit codes                      | W006 + W007                                         | W006 only                                                                                                                |
| Budget math                      | 1024-char cap, ellipsis truncation                  | none                                                                                                                     |
| Customer-install parity          | Skill ran only when published                       | `@` import works on first session post-install                                                                           |
| Compaction survival              | Skill re-attached within 25k budget; can be dropped | CLAUDE.md re-read fresh each `/compact`; @ import re-expands; compact hook re-emits INDEX pointer as belt-and-suspenders |

Ready to mark done. Update ticket: `phase: done`, `status: done`.
