---
id: 149
type: task
phase: understand
status: open
created: 2026-05-13T22:21:00Z
last_modified: 2026-05-13T22:21:00Z
---

# Derive safeword-managed path list from SAFEWORD_SCHEMA at build time

**Goal:** Replace the hardcoded `safewordPaths` array in `session-auto-upgrade.ts` with a build-time-derived list sourced from `SAFEWORD_SCHEMA.ownedFiles`, so it can't drift from the schema's source of truth.

**Why:** Today, `session-auto-upgrade.ts` hardcodes the prefix list used to filter what gets auto-committed after an upgrade:

```typescript
const safewordPaths = [
  '.safeword/',
  '.claude/',
  '.cursor/',
  '.mcp.json',
  '.gitignore',
  'AGENTS.md',
  'CLAUDE.md',
];
```

The schema (`packages/cli/src/schema.ts`) already knows every safeword-owned file. If a new pack adds files under a new top-level prefix (say `.vscode/` for an IDE pack), the schema gets updated but this hardcoded list doesn't. The auto-upgrade hook will then silently leave those files untracked after upgrade — exactly the failure mode the filter is supposed to prevent.

## Scope

**In:**

- Compute the set of unique top-level path prefixes from `SAFEWORD_SCHEMA.ownedFiles` keys at build time (when the CLI is built, not at install time).
- Embed the resulting list as a generated constant in the shipped hook template — either via a template variable substitution during `safeword setup`/`safeword upgrade`, or via a generated `hooks/lib/owned-paths.ts` module that the hook imports.
- Add a build-time check that fails the CI if a schema entry's top-level prefix isn't in the generated list (catches the template-processor breaking silently).

**Out of Scope:**

- Reading the schema at hook runtime — the hook ships standalone to customer projects, where the safeword package source isn't available. Build-time generation is the only architecturally sound option.
- Changing what the filter actually filters (still: stage only safeword-managed paths). This ticket is about the _source_ of the path list, not its semantics.

## Done When

- [ ] `safewordPaths` literal removed from `session-auto-upgrade.ts`
- [ ] Hook gets the list from a generated source (template substitution or generated module)
- [ ] Adding a new top-level prefix to `SAFEWORD_SCHEMA.ownedFiles` automatically propagates to the hook on next CLI build
- [ ] CI check catches drift if the generator ever misses a prefix
- [ ] Smoke test: verify auto-upgrade still commits the expected files

## References

- PR #81 ([safeword#81](https://github.com/ArcadeAI/safeword/pull/81)) — auto-upgrade implementation; refactor pass identified this drift hazard but deferred fix because of build-system scope
- `packages/cli/src/schema.ts` — `SAFEWORD_SCHEMA.ownedFiles`, the source of truth
- `packages/cli/templates/hooks/session-auto-upgrade.ts` — where `safewordPaths` currently lives
