---
id: 04NKDR
slug: check-schema-parity
type: task
phase: implement
status: in_progress
created: 2026-05-28T18:03:05.577Z
last_modified: 2026-05-28T18:31:00.000Z
scope:
  - Add an `orphan-template` check to `runParity` (src/parity.ts) — scan the templates dir recursively (skip `_`-prefixed dirs), flag any file not referenced by an ownedFiles/managedFiles `template:` value.
  - Run the check in BOTH parity modes (always, like contracts) so the existing pre-commit `--mode=contracts-only` hard-blocks an unregistered template.
  - Extend `ParitySchema` with `managedFiles` so personas/glossary templates (referenced via managedFiles, not ownedFiles) are not false-flagged.
  - Tests in `tests/parity.test.ts`.
out_of_scope:
  - A new `bun run check:schema` script — `scripts/parity-check.ts` already exists and runs in pre-commit; extend it instead.
  - Changing how PAIR drift or CONTRACT checks work.
  - Removing the equivalent assertion in `schema.test.ts` (kept as a backstop).
  - Warn-only treatment — decided hard-block (an unregistered template is a ship-but-never-deploy bug, not mid-dev iteration like pair drift).
done_when:
  - `runParity` returns an `orphan-template` failure for a templates/ file with no schema entry, and none when every template is registered.
  - Both `parity-check.ts --mode=all` and `--mode=contracts-only` surface it; a commit adding an unregistered template is hard-blocked by pre-commit.
  - Targeted `tests/parity.test.ts` green; `bun run lint` clean.
---

# bun run check:schema templates-to-schema parity

**Goal (re-scoped after pickup re-validation):** Add the **template→schema** direction (scan `templates/`, flag any file with no `ownedFiles`/`managedFiles` entry) to the existing `scripts/parity-check.ts` / `src/parity.ts` `runParity`, and decide whether it hard-blocks in pre-commit. NOT a new `bun run check:schema` script — `parity-check.ts` already exists and already runs in pre-commit.

**Why:** A template added without a schema entry (e.g. `spec-template.md` in Y2HCNJ slice A) is caught only by `schema.test.ts` (the vitest suite), not by the commit-time parity gate. Catching it at commit time gives fast feedback for a one-line omission. Repo-infra/contributor-experience.

## Work Log

- 2026-05-28T18:03:05.577Z Started: Created ticket 04NKDR
- 2026-05-28T18:25:00.000Z Re-validated on pickup (5JN5E4 practice). Premise HOLDS but solution RE-SCOPED. Findings: (1) no `check:schema`/parity npm script exists. (2) `scripts/parity-check.ts` (modes `all`/`contracts-only`) ALREADY runs in pre-commit (`--mode=contracts-only`) and via `/parity-check` command — a new script would be redundant. (3) `runParity` (src/parity.ts) checks only **schema→template** (each ownedFiles entry's template exists + dogfood matches = PAIR) + contracts; it does NOT scan `templates/` for files lacking an entry. (4) That **template→schema** direction — the one that caught `spec-template.md` — lives ONLY in `schema.test.ts:165`. So: extend `runParity` with the unregistered-template check (new failure kind), expose via `parity-check.ts --mode=all`, and decide pre-commit hard-block. Not a new script.
