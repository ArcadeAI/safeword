---
id: 1J6JKP
slug: lint-hook-hygiene
title: 'Lint hook hygiene — detect all prettier config names, scope biome to edited path'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
created: 2026-05-24T19:10:08.683Z
last_modified: 2026-05-24T19:10:30.000Z
---

# Lint hook hygiene — detect all prettier config names, scope biome to edited path

**Goal:** Fix two related lint-hook bugs that surface as noise during normal use — (1) the session-start prettier-config check only recognizes 3 of prettier's many valid config filenames, producing a false-negative warning in projects that use the others; and (2) the PostToolUse biome invocation runs project-wide on every file edit instead of being scoped to the edited file, wasting time on large repos.

**Why:** Both surfaced during dogfooding on arcade-monorepo this session. The prettier false-negative is loud (warning on every session start) and undermines trust in safeword's checks — if it's wrong about prettier being present, what else is it wrong about? The biome-project-wide invocation is silent but expensive — on a monorepo, every file edit triggers a full-repo biome pass. Both are cheap to fix.

**Parent epic:** DZ2NM5 (filed under the epic because both surfaced during this work, not because they're Phase-0-related — see "Note on scope membership" below).

**Depends on:** —

## Scope

### Issue 1: Prettier config detection too narrow

- File: `packages/cli/templates/hooks/session-lint-check.ts` line 31.
- Current detection set: `['.prettierrc', '.prettierrc.json', 'prettier.config.js']`.
- Per [prettier docs](https://prettier.io/docs/configuration), prettier also recognizes: `.prettierrc.yaml`, `.prettierrc.yml`, `.prettierrc.toml`, `.prettierrc.js`, `.prettierrc.cjs`, `.prettierrc.mjs`, `prettier.config.cjs`, `prettier.config.mjs`, `prettier.config.ts`, and a `"prettier"` key in `package.json`.
- Fix: extend the detection set to all valid prettier config locations. Add a `package.json` key check.
- False-negative observed in arcade-monorepo, which uses `.prettierrc.yaml`.

### Issue 2: Biome runs project-wide on every Edit/Write

- File: the `.claude/settings.json` template that safeword setup writes, where the PostToolUse `Edit|Write` hook fires `bun x biome check --write` with no file argument.
- Current behavior: every single ticket edit, source file edit, even unrelated `.md` edit triggers `biome check --write` against the entire project's biome-include pattern.
- Fix: scope the invocation to the file(s) actually edited. Claude Code passes the edited file paths via `$CLAUDE_FILE_PATHS` (or per-hook env var). The hook should pass that to biome:

  ```json
  {
    "matcher": "Edit|Write",
    "hooks": [
      {
        "type": "command",
        "command": "bun x biome check --write \"$CLAUDE_FILE_PATHS\""
      }
    ]
  }
  ```

- Defensive: handle the case where `$CLAUDE_FILE_PATHS` is empty (no-op rather than scanning the whole repo).

### Documentation

- Update the safeword setup docs to note that prettier config detection covers all standard config locations.
- Update the safeword setup docs to note that the biome hook is now per-file-scoped.

## Out of scope

- Replacing biome with prettier (or vice versa) anywhere — file-type ownership is unchanged.
- Changing what `safeword setup` writes to `.claude/settings.json` for projects that don't have biome — biome detection is separate work.
- Routing `.md`/`.yaml`/`.toml` files in `post-tool-lint.ts` — that hook already routes correctly.
- Validating the prettier config contents — just detecting its presence is enough.

## Done when

- `session-lint-check.ts` recognizes all valid prettier config filenames + the `"prettier"` key in `package.json`. Tests fixture each variant.
- A project with only `.prettierrc.yaml` no longer triggers the false-negative warning at session start.
- The PostToolUse biome hook in the setup-installed `.claude/settings.json` template passes the edited file path(s) to biome.
- Test verifies that editing a single file does not cause biome to scan unrelated files (assert via timing or via a fixture that biome's output mentions only the edited file).
- Documentation updates landed.

## Note on scope membership

This ticket isn't a Phase-0-merge sub-task — both issues are unrelated to bdd or to the product layer. It's filed as a child of DZ2NM5 because both bugs were discovered during this session's dogfooding work and the user prefers to use this epic as the holding pen for safeword improvements surfaced during this work. If the system-hygiene work grows beyond two tickets, splitting into its own "safeword setup hygiene" epic is the obvious next step.

## Open questions

- **Hook-script approach for the biome fix** — pass `$CLAUDE_FILE_PATHS` directly to `bun x biome check --write`, or wrap in a small shell script that handles the empty-paths case? Driver leans wrapping (handles empty case cleanly; centralizes the logic for future tweaks).
- **What does Claude Code actually pass?** Confirm the env var name (`$CLAUDE_FILE_PATHS` is the documented one but worth checking against the version of Claude Code arcade uses).
- **Does the prettier-key-in-package.json check need to recurse into workspace package.jsons?** A monorepo might have root-level prettier config absent but workspace-level configs present. Driver leans no (root-only check is consistent with how prettier itself resolves config from cwd).

## Work Log

- 2026-05-24T19:10:08.683Z Started: Created ticket 1J6JKP
- 2026-05-24T19:10:30.000Z Drafted: Scope, both fixes, scope-membership note; linked to epic DZ2NM5
