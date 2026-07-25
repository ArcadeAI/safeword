# Verify: Retire the .agents/skills dogfood residue

## Verify Checklist

**Test Suite:** ⚠️ Affected suites green (1368 passed, 92 files); one unrelated
pre-existing failure in this container — see Evidence limits. CI is the arbiter.
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint, lint-gherkin, tsc --noEmit)
**Format:** ✅ Prettier clean
**Parity:** ✅ 194 pairs and 8 contracts in sync
**Scenarios:** N/A — task
**PR Scope:** ✅ Diff matches ticket scope. No piggybacked changes.
**Dep Drift:** ✅ None
**Parent Epic:** N/A
**Reconcile:** ✅ Aligns the repo with behavior already shipped and documented
**Experience:** ⏭️ N/A — repo hygiene, no user-facing change

## What the evidence showed

The issue framed this as a parity gap — a mirror that should be synced but
isn't. Investigation found the opposite: `.agents/skills/` is not a mirror at
all, and three independent sources already say so.

1. **The schema.** All 25 tracked files under `.agents/skills/` are exactly the
   25 entries in `SAFEWORD_SCHEMA.deprecatedFiles`; zero appear in `ownedFiles`.
   `safeword upgrade` deletes these paths from every installed project. The
   repo was tracking precisely the set it removes from customers.
2. **The shipped docs.** `README.md:290` and
   `docs/reference/hooks-and-skills.mdx:101` both state that safeword "no
   longer installs Safe Word-owned workflow aliases into `.agents/skills/`" —
   Codex workflow guidance comes from the packaged plugin.
3. **The acceptance suite.** `features/steps/codex.steps.ts:247` and `:339`
   assert `.agents/skills/bdd/SKILL.md` is **absent** after migration.

Nothing loses coverage. Per [Cursor's skills
docs](https://cursor.com/docs/skills), Cursor natively loads `.claude/skills/`
as a compatibility directory alongside its own `.agents/skills/`, so every
skill remains discoverable to Cursor; Codex reads the generated plugin.

## Evidence

- `bun run lint` — eslint, gherkin lint, typecheck pass.
- `bun run format:check` — clean.
- `bun scripts/parity-check.ts --mode=all` — 194 pairs, 8 contracts in sync.
- Affected suites (`tests/skills`, `tests/hooks`, `verify-skill`,
  `refactor-skill`, `skill-invocation-log`, `discovery-surfaces-substep`) —
  1368 passed.
- Deleting the files first surfaced 13 failing tests across 10 files that
  asserted those paths; each was retargeted onto a surviving surface, and every
  invariant they carried is still asserted on templates, `.claude`, or the
  Codex plugin. No assertion was dropped.

## Scope discipline

The directory is not retired, only safeword's files in it. The upstream skills
CLI installs third-party language packs under `.agents/skills/` for Codex and
Cursor (`src/skills/install.ts:71`), which is why the schema's cleanup is
file-scoped. `agents-skills-retired.test.ts` guards all three properties: no
safeword skill file tracked there, the deprecation entries retained so upgrade
still cleans installed projects, and a non-safeword sibling still tracked.

The deprecation entries were deliberately left in place. Removing them
alongside the files would strand the copies already on customer disks with
nothing left to clean them up.

## Evidence limits

`tests/hooks/self-report.test.ts:410` fails in this container and is unrelated
to this change: it chmods a directory to `0o555` and asserts the write fails,
but the session runs as uid 0 and root bypasses permission bits. Confirmed
rather than assumed — the same test passed on both CI lanes in run
30178350157. CI supplies the full-suite verdict.
