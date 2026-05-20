# Verify — ticket 158

## Verify Checklist

**Test Suite:** ✓ 1883/1883 tests pass (1 skipped; full vitest run from `packages/cli/`, 634s)
**Build:** ✅ Success (`bun run build`, tsup ESM + DTS)
**Lint:** ❌ 41 errors (all pre-existing in unrelated files — `tests/hooks/stop/quality.test.ts`, `tests/packs/rust-setup.test.ts`, `tests/schema.test.ts`, `tests/skill-invocation-log.test.ts`, `tests/technical-constraints.test.ts`). Zero new lint errors in any of the 15 files this ticket added or modified.
**Scenarios:** All 31 scenarios marked complete (8 rules, mapped to slices 1–7 in [test-definitions.md](./test-definitions.md))
**Dep Drift:** ⏭️ Skipped — no ARCHITECTURE.md at repo root (the architecture check via depcruise was run separately and passed: 114 modules, 311 dependencies cruised, zero violations)
**Parent Epic:** N/A (supersedes 080, not a child)

## Slice-by-slice evidence

| Slice | Subject                                         | Tests                                               | Commit                                                                |
| ----- | ----------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| 1     | `safeword ticket new <slug>` happy path         | 11 (6 unit + 5 integration)                         | `feat(cli): safeword ticket new <slug>`                               |
| 2     | EEXIST retry + fresh-install                    | 5 (unit, RNG-stubbed)                               | `test(cli): ticket-writer EEXIST retry`                               |
| 3     | Slug normalization at CLI boundary              | 9 (6 unit + 3 integration)                          | `feat(cli): slug normalization`                                       |
| 4     | Dual-format active-ticket lookup                | 6 (unit, synthetic fixtures)                        | `feat(hooks): dual-format active-ticket lookup`                       |
| 5     | Duplicate-ID guard (detector + pre-commit + CI) | 11 (7 unit + 4 integration via spawn)               | `feat(ci): duplicate-ticket-ID guard`                                 |
| 6     | Skill prompt rewrite + template-sync regression | 4 (substring-asserting content tests)               | `docs(skill): ticket-system tells Claude to call safeword ticket new` |
| 7     | Cross-process + cross-branch integration        | 4 (real `git init` fixture + `child_process.spawn`) | `test(integration): cross-process + cross-branch capstone`            |

Total new tests this ticket: **50** (all green in the full suite).

## Audit summary

**Architecture (depcruise):** ✓ no dependency violations found (114 modules, 311 dependencies)
**Dead code (knip):** ✓ none of the 15 files this ticket touched are flagged unused; the 744 entries knip reports are all under `.claude/worktrees/` (foreign sibling-session worktrees), not the main tree.
**Test quality:** Each new test asserts an observable outcome (folder existence, frontmatter substring, exit code, stderr substring, git merge status) — no `toBeTruthy`/`toBeDefined`-only assertions, no shared mutable state across tests, every fixture set up per-test with `beforeEach`. RNG-dependent tests use deterministic stubs (`seededIdMinter`, `sequenceMinter`, `constantMinter`, `SAFEWORD_TICKET_ID_OVERRIDE`) — zero flake surface.
**Documentation:** the ticket-system SKILL.md (both template and consumer copy) was rewritten in slice 6; AODI changelog appended at the bottom of [test-definitions.md](./test-definitions.md); ticket.md carries the full Design context and decision rationale.

Audit passed.

## Remaining loose ends (NOT blockers for this ticket)

- **Pre-existing lint debt (41 errors)** in files unrelated to ticket 158 — worth a separate cleanup ticket, scoped out here.
- **`tests/schema.test.ts` walks `.safeword/logs/`** and flags any work-log files as untracked, even though `.safeword/logs/` is in `preservedDirs`. Triggered once during this ticket (my work log under `.safeword/logs/ticket-158-crockford-ticket-ids.md` failed the drift test); removed the log to clear it. Worth a small follow-up to exclude `.safeword/logs/**` from that walk.
- **SAFEWORD_TICKET_ID_OVERRIDE env var** is the test-injection point for slice 7's collision-forcing scenarios — intentionally undocumented for consumers. If we later need a documented way for users to pin an ID (e.g., for restoring an archived ticket), that becomes its own UX question.

Ready to mark done.
