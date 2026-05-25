---
id: 03ZX7V
slug: prettierignore-textpatch
type: task
phase: implement
status: in_progress
created: 2026-05-25T07:58:41.502Z
last_modified: 2026-05-25T07:58:41.502Z
scope:
  - Add `.prettierignore` entry to `SAFEWORD_SCHEMA.textPatches` in `packages/cli/src/schema.ts`.
  - Operation `append`, content `\n# Safeword\n.safeword/\n.cursor/\n`, marker `# Safeword`.
  - Update `packages/cli/tests/integration/golden-path.test.ts` "config files remain valid" block to assert `.prettierignore` exists post-setup AND contains `.safeword/` and `.cursor/`.
  - TDD: assertion first (RED), schema entry (GREEN).
out_of_scope:
  - `.claude/` exclusions — sharedDirs, customer owns parts of it; blanket-ignore would suppress customer's own skills.
  - Biome/eslint config changes — they already exclude `.safeword/` and don't touch markdown anyway.
  - Authoring `.prettierignore` for the safeword repo itself — happens automatically on next `safeword upgrade` once schema ships; separate dogfood follow-up if needed.
  - Version bump and release — handled separately via /versioning when cutting v0.35.3.
done_when:
  - `safeword setup` on a fresh JS project creates `.prettierignore` containing `.safeword/` and `.cursor/`.
  - Customer with an existing `.prettierignore` keeps their entries; safeword block appended once (marker-gated, idempotent on re-run).
  - Reset cleanly unmerges via the existing text-patch removal path (same as `.gitignore` patch behavior).
  - `golden-path.test.ts` green with the new assertion.
  - Full test suite passes.
---

# Add .prettierignore text-patch to schema

**Goal:** Stop `prettier --write .` from reformatting safeword-owned files in `.safeword/` and `.cursor/` by appending a marker-gated block to the customer's `.prettierignore`.

**Why:** `safeword check` investigation surfaced an unintentional gap: biome and eslint exclude `.safeword/`, but prettier has no equivalent. Customers running `prettier --write .` would reformat safeword's hooks (`.safeword/`) and Cursor rules (`.cursor/`). The owned-file overwrite on upgrade is the only current defense — fragile. Mirrors the proven `.gitignore` text-patch precedent in the same schema.

## Work Log

- 2026-05-25T07:58:41Z Started: Created ticket 03ZX7V
- 2026-05-25T07:59:00Z Filled scope/out_of_scope/done_when; phase → implement. Plan: TDD on golden-path.test.ts assertion first, then schema entry, then full-suite verify.
- 2026-05-25T08:00:00Z RED: added `.prettierignore excludes safeword-owned dirs` test in [golden-path.test.ts](packages/cli/tests/integration/golden-path.test.ts:165) (inside the Idempotency describe block where the other "config files remain valid" assertions live). Confirmed RED — `fileExists(projectDirectory, '.prettierignore')` returns false today.
- 2026-05-25T08:01:00Z GREEN: added `.prettierignore` entry to `SAFEWORD_SCHEMA.textPatches` in [schema.ts:682-691](packages/cli/src/schema.ts:682). Operation `append`, content `\n# Safeword\n.safeword/\n.cursor/\n`, marker `# Safeword`. Verified executeTextPatch ([reconcile.ts](packages/cli/src/reconcile.ts)) creates the file when missing (`readFileSafe ?? ''` then append + write). Verified `shouldSkipForNonGit` only skips husky files — `.prettierignore` is always applied.
- 2026-05-25T08:02:00Z Rebuilt dist (DTS now also clean — earlier storybook error was a stale-worktree artifact). Golden-path 12/12 green; schema + owned-paths + check-reconcile + upgrade-reconcile + setup-python-phase2 = 78/78 green; install-upgrade 6/6 green. Ready to commit GREEN and run /verify.
- 2026-05-25T14:10:00Z Audit + cross-scenario refactor pass surfaced two easy ergonomic wins (no scope drift): (1) marker bumped from generic `# Safeword` to `# Safeword - managed prettier exclusions` to eliminate false-positive skips on customers who have unrelated `# Safeword` comments; (2) closed the W-test edge-case gap with a unit test in [upgrade-reconcile.test.ts:291-326](packages/cli/tests/commands/upgrade-reconcile.test.ts:291) that exercises customer-existing-entries-preserved + idempotent re-run via the fast reconcile path (no E2E bun-install). 24/24 green on upgrade-reconcile + golden-path; lint clean.
