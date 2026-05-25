---
id: 70G298
slug: repo-level-extensibility
title: "Make safeword extensible at the repo/organization level — customer-specific rules, hooks, skills, conventions"
type: feature
phase: intake
status: in_progress
created: 2026-05-24T22:06:51.332Z
last_modified: 2026-05-24T22:07:00.000Z
---

# Make safeword extensible at the repo/organization level

**Goal:** Define and ship a contract for repo-level customer extensions to safeword. Organizations can add their own rules, hooks, skills, and conventions in a known location, with documented composition semantics (precedence, conflict resolution, discovery). Extensions layer on top of safeword without modifying safeword itself.

**Why:** Today, organizations like arcade extend safeword by writing ad-hoc files in `.claude/rules/`, `.claude/hooks/`, `.claude/skills/`. These ARE picked up by Claude Code, but safeword has no opinion about them — no composition rules, no conflict detection, no validation. Result: organizations re-invent the same patterns (PR scope rules, project-specific test conventions, internal terminology) without a shared shape, and safeword can't tell which behaviors are its own vs the organization's. An explicit extension contract gives organizations a sanctioned customization surface and gives safeword a way to compose cleanly with what's there.

**Discovered while:** comparing arcade's local `.claude/rules/` and `.claude/skills/` against safeword's core during the spec-pipeline absorption work. Several arcade rules (pr-scope, persona conventions, glossary patterns) would be cleaner as repo extensions than as one-off duplicates or absorption candidates.

## Scope

### Extension contract

Define what an extension is and where it lives:

- **Location:** `.safeword-project/extensions/` at the repo root. Subdirectories per extension type (`rules/`, `hooks/`, `skills/`, `templates/`).
- **Manifest:** Each extension declares its shape in `extension.json` — name, description, type, version, what safeword core elements it composes with, declared dependencies.
- **Discovery:** Safeword scans this directory at session start and registers extensions per their manifest.
- **Naming convention:** Extension files use a `<org-or-team>.<name>` prefix to avoid collision (e.g., `arcade.pr-scope.md`, `acme.compliance-check.ts`).

### Composition semantics

For each extension type, define composition:

- **Rules** (`.md` in `.claude/rules/` style): purely additive. Multiple rules coexist; no override.
- **Hooks**: ordered by registration. Safeword core hooks run first; repo extension hooks run after. Each hook receives the previous hook's output (or skip marker).
- **Skills**: additive. Repo extensions cannot override core skill names; collisions are an error at registration. Repo extensions can shadow if the manifest explicitly declares `overrides: <core-skill>`.
- **Templates**: per-type override. Repo extension template wins over core if both exist (with a warning at registration).

### Conflict resolution

- Two extensions with the same name → error at registration, agent surfaces the conflict.
- Hook output ordering → predictable per the registration order; configurable per `.safeword-project/extensions/order.json` if needed.
- Skill collision → error unless `overrides:` is explicit in manifest.

### Validation

- `safeword check` validates extension manifests (well-formed JSON, declared dependencies resolvable, no name collisions).
- New CLI subcommand: `safeword extensions list` — show all loaded extensions with their type and source.
- New CLI subcommand: `safeword extensions check` — validate extensions without running the rest of `safeword check`.

### Upgrade safety

- When `safeword upgrade` runs, it does NOT touch `.safeword-project/extensions/`. Repo extensions are user-owned, never overwritten.
- If a safeword upgrade introduces a core element that conflicts with a repo extension, `safeword upgrade` surfaces the conflict in output ("Repo extension `arcade.pr-scope.md` now duplicates new core feature X — review and decide whether to remove").

### Migration aid

`safeword extensions adopt <path>` — helper to convert an existing ad-hoc rule/hook/skill into a properly-manifested repo extension. Used by projects like arcade that already have local customizations they want to formalize.

## Out of scope

- Personal-level extensions — separate ticket (XSDQZ0).
- A marketplace or registry of shared extensions across organizations — out of scope for v1.
- Auto-conflict resolution beyond surfacing errors — humans decide.
- Versioning extensions independently of safeword — defer; v1 extensions are loose files.
- Validating extension hook output schema — defer; trust extension authors for v1.

## Done when

- `.safeword-project/extensions/` is a recognized location with documented contract.
- Manifest format (`extension.json`) is documented with schema.
- Composition semantics are documented per extension type (rules / hooks / skills / templates).
- `safeword check` validates manifests.
- `safeword extensions list` and `safeword extensions check` ship.
- `safeword upgrade` preserves extensions and surfaces new conflicts.
- A worked example shows arcade migrating one local rule (e.g., `pr-scope.md`) to the extension layout.

## Open questions

- **Naming prefix convention** — `<org>.<name>` mandatory or recommended? Driver leans recommended for v1; mandatory if collisions become real.
- **Extension types in v1** — start with rules + hooks + skills + templates, or just rules? Driver leans all four (the framework is the same; per-type composition is the only differentiator).
- **Hook output composition** — each extension hook's output appended to a list, or does it pass through a pipe (each sees previous output)? Driver leans appended-to-list (simpler; matches today's UserPromptSubmit semantics).
- **Skill override mechanism** — explicit `overrides:` manifest field vs file-naming convention? Driver leans manifest field (explicit > implicit).
- **Marketplace / discovery** — out of scope here, but flag for future. A team might want to publish `acme.compliance-check` as an installable extension package.

## Related

- **XSDQZ0** (personal-level extensibility) — sibling ticket. Shares the extension mechanism; XSDQZ0 adds a third precedence layer.
- **SE66TW** (arcade pr-scope compatibility) — pr-scope is a candidate for the first real-world test of this extension contract; resolve SE66TW once 70G298 ships by converting `.claude/rules/pr-scope.md` to a manifested arcade extension.
- **1J6JKP** (lint-hook hygiene) — the biome-scope fix may reshape `.claude/settings.json` template; coordinate so extension hook registration doesn't collide.

## Work Log

- 2026-05-24T22:06:51.332Z Started: Created ticket 70G298
- 2026-05-24T22:07:00.000Z Drafted: Scope (contract + composition + conflict + validation + upgrade safety + migration), 5 open questions, related work
