---
id: K7N2QM
slug: configurable-file-paths
title: 'Configurable paths for personas / glossary / architecture (per-file, not per-folder)'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
created: 2026-05-26T14:37:56.704Z
last_modified: 2026-05-26T14:37:56.704Z
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

- Relative paths are resolved against project root (cwd).
- Absolute paths are used verbatim.
- Symlinks followed (no special handling).
- Existence is NOT validated at read time — graceful degrade per the per-file API contract (e.g., `validatePersonaReference` returns `unknown` on missing path; `safeword check` reports the missing configured path as an issue).

### Read-API refactor

- `validatePersonaReference(cwd, input)` reads `.safeword/config.json` for `paths.personas`; falls back to `.safeword-project/personas.md` if unset.
- Same pattern for future glossary / architecture lookup functions.
- A small shared helper (`resolveConfiguredPath(cwd, key, default)`) keeps the lookup DRY.

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
- **Path style** — repo-relative only, or accept absolute paths too? Driver lean: accept both; absolute is useful for shared monorepo setups where the file lives outside this project's tree.
- **Symlink fallback** — if a user can symlink `.safeword-project/personas.md` to their preferred location, do we still need the config option? Driver lean: yes — symlinks are unfriendly on Windows and surprise users who don't notice the indirection; explicit config is more discoverable.
- **Setup nudge** — should `safeword setup` ask the user if they want to point at an existing file, or stay silent? Driver lean: silent by default; document in README. Asking creates friction for the 80%+ of users who want defaults.

## Done when

- `.safeword/config.json` schema documents an optional `paths` object with `personas` (plus forward-looking slots for `glossary`, `architecture`).
- `validatePersonaReference(cwd, input)` reads from `paths.personas` if set; falls back to default. Existing 71 unit + I/O tests still pass.
- New unit tests cover: config override resolves the configured file, missing configured file returns `unknown` gracefully, absolute path works, relative path resolves against cwd.
- `safeword check` reports `personas-path: <configured>: file not found` when configured path is unreachable; passes when configured path is reachable and well-formed.
- New integration tests cover the configured-path-found and configured-path-missing branches at the check command level.
- README / setup docs updated.

## Work Log

- 2026-05-26T14:37:56.704Z Started: Created ticket K7N2QM. Carved out from DZ2NM5/D3 — that decision locked `.safeword-project/` as the default ownership for personas/glossary; this ticket adds the explicit-config override that lets a user point safeword elsewhere without the `.project/` auto-discovery model the user rejected. Architecture file slot is forward-looking — the architecture.md work itself lives in [M6D315](../M6D315/ticket.md).
- 2026-05-26T18:36:34.870Z Out-of-scope addition: cosmiconfig and config-discovery libraries explicitly rejected as scope creep. Surfaced during /quality-review pre-verify on 7YN5QB — the design intent is "single fixed config location with optional path overrides," not "discover config across many locations." The note guards against a future implementer pattern-matching "configurable paths → cosmiconfig" and pulling in the wrong tool.
