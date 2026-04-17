---
id: '133'
type: task
phase: intake
status: backlog
created: 2026-04-17T13:35:00Z
last_modified: 2026-04-17T13:35:00Z
scope:
  - Add drift-detection tests to schema.test.ts that catch files deployed locally but missing from templates/schema/config
out_of_scope:
  - Content parity between dogfood and templates (already covered by dogfood-parity.release.test.ts)
  - Cursor rule parity for new skills (separate decision per skill)
done_when:
  - Three new tests in schema.test.ts catch the three drift categories
  - Tests run in the default suite (not gated behind release flag)
  - All current drift is resolved (no test failures on merge)
---

# Schema Drift Detection

**Goal:** Catch template/schema/config drift before it ships, not after a manual audit finds 5 issues at once.

**Why:** A single audit session (2026-04-17) found 5 independent drift issues — all from the same structural gap: local project files and the CLI package (templates/, schema.ts, config.ts) are two registries with no automated parity check. The existing `dogfood-parity.release.test.ts` checks content parity for files already in schema, but doesn't catch files that should be in schema but aren't.

## Root Cause

When a feature adds a file to `.claude/skills/` or `.safeword/hooks/`, the natural workflow is: edit local, test, confirm. Propagating to `templates/` and updating `schema.ts`/`config.ts` is a separate manual step with no enforcement. The 5 drift issues found:

| Drift type                   | Example                           | How it happened                                                      |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| Local skill, no template     | brainstorm, tdd-review, VERIFY.md | Skill added to `.claude/skills/` but not `templates/` or `schema.ts` |
| Hook deployed, not wired     | session-cleanup-quality.ts        | Added to `schema.ts` ownedFiles but not `config.ts` SETTINGS_HOOKS   |
| File removed, not deprecated | cli-reference.md                  | Removed from ownedFiles but not added to `deprecatedFiles`           |

## Three Tests

### Test 1: Local skills have templates

For every `SKILL.md` in `.claude/skills/*/`:

- Assert a matching `packages/cli/templates/skills/*/SKILL.md` exists, OR
- The skill name is in a `LOCAL_ONLY_SKILLS` allowlist

Catches: brainstorm, tdd-review, VERIFY.md class of drift.

**Allowlist pattern:** Some skills may be intentionally local-only (dev tools for this project, not shipped to customers). The allowlist documents this decision explicitly rather than silently ignoring the gap. Currently empty — all skills should ship.

### Test 2: Hook files in ownedFiles are wired in SETTINGS_HOOKS

For every `schema.ts` ownedFiles entry matching `.safeword/hooks/*.ts` (excluding `lib/` modules):

- Assert the hook filename appears in at least one `SETTINGS_HOOKS` event array, OR
- The hook is in an `UNWIRED_HOOKS` allowlist (with comment explaining why)

Catches: SessionEnd class of drift.

**Implementation note:** `SETTINGS_HOOKS` values contain command strings like `bun ${HOOKS_DIR}/session-cleanup-quality.ts`. Extract the filename and match against ownedFiles keys. The `lib/*.ts` files are shared modules, not hooks — exclude by path pattern.

### Test 3: Deployed .safeword/ files are tracked

For every file in `.safeword/` on disk:

- Assert it's in `schema.ts` ownedFiles, OR
- It's in a known generated/dynamic files list (e.g., `config.json`, `version`, `depcruise-config.cjs`, `.DS_Store`), OR
- It's in `deprecatedFiles`

Catches: cli-reference.md class of drift (file removed from ownedFiles but still deployed, never added to deprecatedFiles).

**Scope limitation:** This only works in the dogfood repo where `.safeword/` is populated. That's fine — it's the same constraint as `dogfood-parity.release.test.ts`. The test should use the same `repoRoot` resolution pattern.

## Why not ungating dogfood-parity.release.test.ts?

The existing release test checks **content equality** between dogfood files and templates. Running it in the default suite would block development whenever a local file is being iterated on before syncing to templates. The three new tests check **structural completeness** (does a template exist? is the hook wired? is the file tracked?) which should always pass and won't block normal iteration.

## Work Log

- 2026-04-17T13:35:00Z Created: from audit session that found 5 drift issues (SessionEnd unwired, VERIFY.md/brainstorm/tdd-review missing from templates, cli-reference.md missing from deprecatedFiles). All 5 fixed in same session — this ticket prevents recurrence.
