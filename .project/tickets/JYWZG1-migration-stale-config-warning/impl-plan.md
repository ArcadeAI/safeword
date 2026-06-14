# Impl Plan: Warn on stale tooling-config namespace refs after migration

**Status:** implemented

## Approach

Build order, each step green before the next:

1. **Pure scanner** — new `packages/cli/src/utils/stale-config-scan.ts`:
   `scanStaleNamespaceConfigs(cwd): string[]` returns the repo-relative paths of
   curated tooling configs that still reference the legacy namespace. Glob the
   curated set at the repo root (workflows one level deep), read each file,
   match the legacy literal at a path boundary (`.safeword-project/` with the
   trailing slash — kills the `.safeword-projectile` near-miss), and for
   `.prettierignore` skip lines inside the `# Safeword - managed prettier
exclusions` block (marker from schema.ts:796) while still flagging raw lines
   elsewhere. Never reads under `.project/` or `.safeword/`. **Unit layer** —
   covers all 7 AC1/AC3 scanner scenarios.
2. **Upgrade wiring** — in `maybeMigrateNamespace` (upgrade.ts), after a
   _successful_ `executeNamespaceMigration` (the only path that moved), call the
   scanner and, if non-empty, print a one-shot warning naming each file + the
   `.safeword-project/` → `.project/` mapping, via the existing `warn`/`listItem`
   output helpers. Gated on the move having happened — no scan on
   decline/both-dirs/custom-root/already-current. **Integration layer** — the
   AC1 e2e (names file / shows mapping), AC2 byte-identical, AC4 outline.
3. **Full suite + fresh build.**

## Decisions

| Decision                | Choice                                         | Alternatives considered              | Rejected because                                                                                                           |
| ----------------------- | ---------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Detect vs auto-edit     | Warn only                                      | Auto-rewrite with backup             | /figure-it-out: routine upgrade ≠ codemod consent; blind replace corrupts the intentional both-roots .prettierignore block |
| Match shape             | Path-boundary literal `.safeword-project/`     | Bare `includes('.safeword-project')` | `.safeword-projectile/` false-positive — the bug the naive impl ships with                                                 |
| File set                | Curated, extensible glob list                  | Blanket repo grep                    | 159 documentary refs under .project/ would drown the signal; only functional configs matter                                |
| prettierignore handling | Skip only lines inside the managed block       | Skip the whole file                  | A customer's own stale .safeword-project/ line elsewhere in the file must still flag                                       |
| Where it fires          | Inline after the move in maybeMigrateNamespace | Separate safeword check advisory     | The both-dirs check advisory (9MMWS7) already owns the persistent-state path; this is the one-shot in-context complement   |

## Arch alignment

Consulted `ARCHITECTURE.md` (resolved `paths.architecture` → `ARCHITECTURE.md`):

- **Warn-don't-edit, self-quiescing precedent** — models the vendored-ignores nudge (`utils/vendored-ignores-nudge.ts`): detect a config condition, inform, never silently mutate.
- **Migration stays a one-time consensual mutation** — the warning is a read-only diagnostic appended to the move, not part of idempotent reconcile.

## Known deviations

Recorded at reconciliation (implement-phase exit):

- **Integration fixture uses `tsconfig.json`, not `eslint.config.ts`** — the vendored-ignores auto-patch (ticket 154) edits and names the eslint config during upgrade, which contaminated both the byte-identical (AC2) and silence (AC4) assertions. tsconfig is a config nothing else in upgrade touches; assertions key off the warning's distinctive phrase, not the bare filename.
- **No-move outline trimmed to 2 of 4 classes** — custom-root and already-current return from `maybeMigrateNamespace` before the scan by construction; covered by 9MMWS7's plan-classification tests rather than re-proven in slow integration runs.
- Otherwise as planned: pure `scanStaleNamespaceConfigs` + a `warnStaleToolingConfigs` call on the successful-move path.

## Assessment triggers

- If the curated config set needs per-project extension, promote it to a config key rather than growing the hard-coded list.
- If a second surface needs the same scan (e.g. a check advisory after all), extract the literal/curated-set constants so the two can't drift.
