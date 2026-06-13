---
id: K7N2QM
slug: configurable-file-paths
title: 'Configurable paths for personas / glossary / architecture (per-file, not per-folder)'
type: feature
phase: done
status: done
epic: bdd-phase-zero-merge
created: 2026-05-26T14:37:56.704Z
last_modified: 2026-05-27T19:45:12.026Z
scope:
  - Extend `.safeword/config.json` with an optional `paths` object — keys `personas`, `glossary`, `architecture`; all values optional; absent keys fall back to default `.safeword-project/<key>.md` location.
  - Path resolution — relative paths resolve against project root (the directory containing `.safeword/config.json`); absolute paths used verbatim; symlinks followed without special handling; empty-string values treated as unset.
  - Read-API refactor — `validatePersonaReference(cwd, input)` reads `paths.personas` if set, falls back to default. Same pattern for future glossary / architecture lookups. Shared helper `resolveConfiguredPath(cwd, key, default)` keeps lookup DRY.
  - Read-API contract — `validatePersonaReference` returns `{ status: 'unknown' }` for any missing-file case (default OR configured); never throws. Loud failure on configured-but-missing lives at `safeword check`, not the read API.
  - Schema ownership via `configKey` — extend `managedFiles` entries with an optional `configKey` field. When the corresponding `paths.<key>` is set, reconcile uniformly suppresses the entry (setup skips scaffold, reset --full skips removal). Result: one personas.md per project, where the user named it.
  - `safeword check` validation — when override configured and file missing, report `personas-path: <configured>: file not found` with non-zero exit; when present, validate content via existing persona validator; when override set AND legacy `.safeword-project/personas.md` still exists, emit zero-exit advisory naming the orphaned file.
  - Documentation — README / setup docs explain `paths` config block with worked example; `safeword setup` does not prompt or write `paths` by default.
out_of_scope:
  - Auto-discovery via glob patterns (`**/*personas*`) — paths are explicit per file.
  - `.project/` or any other magic-folder convention — replaced by per-file paths.
  - Multi-source merging — one path per file type, single source of truth.
  - Per-feature path overrides — only project-level, not per-ticket.
  - Migrating existing data from default to configured location — user moves files manually (`git mv`).
  - A `safeword config set` CLI command — for v1 the user edits `.safeword/config.json` directly.
  - Cross-tool sync semantics for arcade-overlap users (tracked in P8RJ4M).
  - Cosmiconfig or any config-discovery library — `.safeword/config.json` is the single fixed config location; only the `paths` values it contains are user-configurable.
  - Auto-deleting or auto-migrating legacy default-location files when override is configured — data-loss risk. `safeword check` advisory is the right surface; user owns cleanup.
  - Read-site behavior for glossary and architecture — sibling tickets YR6C49 / M6D315 own those; K7N2QM only reserves schema slots.
done_when:
  - `.safeword/config.json` schema documents an optional `paths` object with `personas` (plus forward-looking slots for `glossary`, `architecture`).
  - `validatePersonaReference(cwd, input)` reads from `paths.personas` if set; falls back to default. Existing 71 unit + I/O tests still pass.
  - Read-API contract preserved — `validatePersonaReference` returns `{ status: 'unknown' }` when the resolved file (default OR configured) is missing; never throws. Documented in code comment.
  - New unit tests cover — config override resolves the configured file, missing configured file returns `unknown` gracefully (same shape as missing-default), absolute path works, relative path resolves against project root, empty-string override falls back to default.
  - `safeword check` reports `personas-path: <configured>: file not found` when configured path is unreachable; passes when configured path is reachable and well-formed.
  - `safeword check` emits zero-exit advisory when override is configured AND `.safeword-project/personas.md` exists (legacy migration trap).
  - Schema ownership — when `paths.personas` is set, `safeword setup` and reconcile do NOT scaffold `.safeword-project/personas.md`; `safeword reset --full` does NOT remove it. Implementation via optional `configKey` field on `managedFiles` entries.
  - New integration tests cover the configured-path-found, configured-path-missing, scaffold-skip, and legacy-advisory branches.
  - README / setup docs updated.
---

# Configurable paths for personas / glossary / architecture

**Goal:** Let users override the default locations of safeword's project-level read targets (personas.md, glossary.md, architecture.md, etc.) by configuring **specific file paths** in `.safeword/config.json`. Path-by-path, not folder-by-folder — no `.project/` auto-discovery; the user names the exact file they want safeword to read.

**Why:** Some developers already maintain personas, glossary, or architecture docs somewhere other than `.safeword-project/`. Forcing duplicate-maintenance under safeword's namespace creates drift. Reading from a configured path keeps a single source of truth wherever the user wants it.

This explicitly replaces the deferred `.project/` fallback model — that one auto-discovered any file under a magic folder; this one requires explicit per-file paths. Trade: less automatic, more predictable. The user is in control; safeword reads only what they've named.

**Parent epic:** [DZ2NM5](../DZ2NM5/ticket.md)

**Depends on:** —

**Sibling tickets:**

- [7YN5QB](../7YN5QB/ticket.md) — personas. Currently hard-codes `.safeword-project/personas.md`. K7N2QM refactors that to read from config.
- [YR6C49](../YR6C49/ticket.md) — glossary. Same shape, when it lands.
- [M6D315](../M6D315/ticket.md) — architecture (Phase 2 epic). Same shape, when it lands.

## Scope

### Config schema

Extend `.safeword/config.json` with an optional `paths` object:

```json
{
  "installedPacks": ["typescript"],
  "paths": {
    "personas": "docs/personas.md",
    "glossary": "docs/glossary.md",
    "architecture": "ARCHITECTURE.md"
  }
}
```

All keys under `paths` are optional. Absent keys fall back to the default location under `.safeword-project/`.

### Path resolution

- Relative paths are resolved against **project root** (the directory containing `.safeword/config.json`). In practice today this collapses to cwd because safeword is always invoked from the project root, but the contract is "project root, not cwd" — future subdirectory invocations or monorepo runners must not change which file gets read.
- Absolute paths are used verbatim.
- Symlinks followed (no special handling).
- Existence is NOT validated at read time — graceful degrade per the per-file API contract (e.g., `validatePersonaReference` returns `unknown` on missing path; `safeword check` reports the missing configured path as an issue).

### Read-API refactor

- `validatePersonaReference(cwd, input)` reads `.safeword/config.json` for `paths.personas`; falls back to `.safeword-project/personas.md` if unset.
- Same pattern for future glossary / architecture lookup functions.
- A small shared helper (`resolveConfiguredPath(cwd, key, default)`) keeps the lookup DRY.
- **Read-API contract on configured-but-missing:** the read API (`validatePersonaReference` and friends) returns `{ status: 'unknown' }` regardless of whether the missing file is the default or a configured override. The loud-failure signal lives at `safeword check`, not at the read API. This split keeps the read API cheap and side-effect-free; a future implementer must not "fix" it to throw on configured-but-missing.

### Schema ownership when override is configured

`SAFEWORD_SCHEMA.managedFiles` currently declares `.safeword-project/personas.md` as a scaffolded file (template-based create-if-missing). When `paths.personas` is configured, safeword must NOT also scaffold the default-location stub — one personas.md per project, where the user named it.

Mechanism: extend the `managedFiles` entry with an optional `configKey` field (e.g. `configKey: 'personas'`). During reconcile, when an entry has a `configKey` AND that key is set in `paths`, skip the default scaffold. The read API + `safeword check` route to the configured path; the schema stays clean of a ghost entry.

Forward-looking: glossary and architecture (when their tickets land) add their own `managedFiles` entry with `configKey: 'glossary'` / `'architecture'`. Same rule applies uniformly.

### Validation in `safeword check`

When a configured path is set:

- If the file exists → validate its contents (existing persona-validation logic applies regardless of location).
- If the file doesn't exist → report `personas-path: <configured>: file not found` as an issue with non-zero exit.

When no path is configured, behavior is unchanged from current default-location reads.

### Documentation

- README or setup docs explain the `paths` config block with a worked example.
- `safeword setup` output mentions the option once for awareness — doesn't prompt or write `paths` by default.

## Out of scope

- Auto-discovery via glob patterns (`**/*personas*`). Path is explicit per file.
- `.project/` or any other magic-folder convention. Replaced by per-file paths.
- Multi-source merging — one path per file type, single source of truth.
- Per-feature path overrides (only project-level, not per-ticket).
- Migrating existing data from default to configured location — user moves files manually.
- A `safeword config set` CLI command — for v1 the user edits `.safeword/config.json` directly.
- Cross-tool sync semantics for arcade-overlap users (tracked in [P8RJ4M](../P8RJ4M/ticket.md) — K7N2QM gives them the mechanism to point safeword at arcade's files, but doesn't auto-detect them).
- **Cosmiconfig (or any config-discovery library).** `.safeword/config.json` is safeword's single fixed config location; only the `paths` values it contains are user-configurable. Cosmiconfig and its peers solve the inverse problem — discovering the tool's OWN config across many filenames and directories — which this ticket explicitly does not need. The implementation is a six-line JSON read with optional `paths.*` lookup; no new dependency required. If a future requirement is "safeword discovers its own config in multiple locations," that's a separate ticket, not K7N2QM scope creep.

## Open questions

- **Config location** — `.safeword/config.json` (existing, plugged into setup/upgrade/reset already) vs a new dedicated config file. Driver lean: extend existing — fewer moving parts, schema gets one more optional field.
- **Validation strength** — `safeword check` validates configured-path-exists; should it also validate the file is well-formed (existing persona/glossary validators apply) or just existence? Driver lean: full validation — the file is the source of truth regardless of location, and well-formed checks shouldn't depend on where the file lives.
- **Path style** — repo-relative only, or accept absolute paths too? Driver lean: accept both; absolute is useful for shared monorepo setups where the file lives outside this project's tree. Relative paths resolve against project root (the directory containing `.safeword/config.json`), not cwd — see Path resolution section.
- **Symlink fallback** — if a user can symlink `.safeword-project/personas.md` to their preferred location, do we still need the config option? Driver lean: yes — symlinks are unfriendly on Windows and surprise users who don't notice the indirection; explicit config is more discoverable.
- **Setup nudge** — should `safeword setup` ask the user if they want to point at an existing file, or stay silent? Driver lean: silent by default; document in README. Asking creates friction for the 80%+ of users who want defaults.
- **Schema ownership when override is configured** — when `paths.personas` is set, should safeword (a) still scaffold the default-location stub at `.safeword-project/personas.md` and read from the override, or (b) skip the default scaffold entirely? Driver lean: (b), via a new optional `configKey` field on `managedFiles` entries. (a) creates ghost files and ambiguous `safeword reset` semantics. See Schema ownership section.
- **Read-API contract on configured-but-missing** — when `paths.personas` is set but the file is missing, should `validatePersonaReference` return `{ status: 'unknown' }` (current contract for default-missing) or throw / log? Driver lean: stay silent at the read API; loud signal lives at `safeword check`. Splits read-API ergonomics from health-check signal cleanly.

## Done when

- `.safeword/config.json` schema documents an optional `paths` object with `personas` (plus forward-looking slots for `glossary`, `architecture`).
- `validatePersonaReference(cwd, input)` reads from `paths.personas` if set; falls back to default. Existing 71 unit + I/O tests still pass.
- **Read-API contract preserved:** `validatePersonaReference` returns `{ status: 'unknown' }` when the resolved file (default OR configured) is missing — never throws. Documented in code comment so a future "fix" doesn't break it.
- New unit tests cover: config override resolves the configured file, missing configured file returns `unknown` gracefully (same shape as missing-default), absolute path works, relative path resolves against project root.
- `safeword check` reports `personas-path: <configured>: file not found` when configured path is unreachable; passes when configured path is reachable and well-formed.
- **Schema ownership:** when `paths.personas` is set, `safeword setup` / reconcile does NOT scaffold `.safeword-project/personas.md`. Implementation via optional `configKey` field on `managedFiles` entries.
- New unit/integration tests cover: scaffold-skip when override configured, scaffold-creates when no override, `safeword reset` doesn't touch the configured-path file.
- New integration tests cover the configured-path-found and configured-path-missing branches at the check command level.
- README / setup docs updated.

## Work Log

- 2026-05-26T14:37:56.704Z Started: Created ticket K7N2QM. Carved out from DZ2NM5/D3 — that decision locked `.safeword-project/` as the default ownership for personas/glossary; this ticket adds the explicit-config override that lets a user point safeword elsewhere without the `.project/` auto-discovery model the user rejected. Architecture file slot is forward-looking — the architecture.md work itself lives in [M6D315](../M6D315/ticket.md).
- 2026-05-26T18:36:34.870Z Out-of-scope addition: cosmiconfig and config-discovery libraries explicitly rejected as scope creep. Surfaced during /quality-review pre-verify on 7YN5QB — the design intent is "single fixed config location with optional path overrides," not "discover config across many locations." The note guards against a future implementer pattern-matching "configurable paths → cosmiconfig" and pulling in the wrong tool.
- 2026-05-27T02:51:13.699Z Clarify pass via /figure-it-out. Stress-tested three architectures (per-file map / logical-FS abstraction / general override layer); landed on per-file map because the logical-FS abstraction's tax doesn't pay back at N=3 files. Three amendments locked: (1) path resolution is "project root," not "cwd" — collapses today but documents the contract for monorepo/subdirectory runners; (2) added schema-ownership open Q with `configKey`-on-managedFiles lean — when `paths.<key>` is set, schema skips its default scaffold (no ghost files, no dual-state); (3) read-API contract pinned in done_when — `validatePersonaReference` returns `{ status: 'unknown' }` for configured-but-missing same as default-missing; loud signal lives at `safeword check`. All five original leans confirmed. Phase → define-behavior; next call is /bdd.
- 2026-05-27T04:29:01.273Z Complete: Phase 3 — 18 scenarios defined across 4 rules (dimensions.md + test-definitions.md saved; recount from earlier "17"). Second /figure-it-out pass on the legacy-default-file question (override configured + `.safeword-project/personas.md` pre-exists) — debated leave-alone-silent / leave-alone-with-advisory / auto-delete; landed on advisory in `safeword check` (zero-exit, non-destructive, catches the migration-trap failure mode without data-loss risk). Two smaller resolutions: empty-string override treated as unset at read API (defensive); `reset --full` skips default-location file uniformly when override is configured (configKey semantics). Frontmatter lifted scope/out_of_scope/done_when into structured fields per phase-gate requirement.
- 2026-05-27T04:30:00.000Z Complete: Phase 4 — Scenarios validated (AODI) + adversarial pass. All 18 scenarios pass Atomic/Observable/Deterministic/Independent. Adversarial pass surfaced 8 candidate gaps (whitespace, non-string value, traversal, symlink, dir-as-path, diff command, missing config file, cross-platform separators); each ruled out as either implementation-defensive or wrong abstraction layer. Happy/failure/edge coverage confirmed across all 4 rules. No new scenarios required.
- 2026-05-27T04:36:49.093Z Complete: Phase 5 — Decomposed into 5 tasks (decomposition.md). Task 1 (config helper + schema slot) unblocks Tasks 2 (read API) and 3 (reconcile suppression); Task 4 (check integration) depends on 1+3; Task 5 (docs) last. Tasks 2 and 3 are independent — can run in parallel. All 18 scenarios allocated. Phase → implement.
- 2026-05-27T05:45:24.965Z Complete: Phase 6 — All 18 scenarios checked off; cross-scenario refactor skipped (no duplication worth extracting). Implementation across 5 source files: configured-paths.ts (new helper), personas.ts (route validatePersonaReference through helper), packs/types.ts (extend ManagedFileDefinition with configKey), schema.ts (tag personas entry with configKey), reconcile.ts (configKey gate at both install scaffold and uninstall-full removal sites), commands/check.ts (loud failure on configured-but-missing + zero-exit legacy-file advisory via new HealthStatus.advisories field). Five tests added: personas-ref-configured-paths.test.ts (6 scenarios), reconcile-configured-paths.test.ts (4 scenarios), check.test.ts K7N2QM block (5 scenarios). Full suite: 119 files, 2110 passed, 0 regressions. README updated with worked example. Phase → verify.
- 2026-05-27T19:45:12.026Z Complete: Phase 7 — /verify written (verify.md) and /audit executed. Audit findings: 0 errors, 1 warning (W001 = ARCHITECTURE.md gap on configKey suppression — closed in c75703d1 with one-paragraph addition near managedFiles description). Architecture: 0 dep violations across 229 modules / 613 deps. Duplication: 0 clones in K7N2QM-touched files. Dead code: 2 pre-existing unused exports from 7YN5QB (not K7N2QM scope). Test quality: 14 new tests pass quality bar — specific value assertions, no arbitrary timeouts, scenario-ID naming, fresh state per test. Outdated packages: 3 (knip patch safe; eslint v10 deferred to 099-eslint-10-migration; eslint-plugin-jsdoc v63 deferred to separate ticket). Phase → done.
