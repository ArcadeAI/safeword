---
id: 8VG20K
slug: one-cli-lookup
type: task
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/5807
scope:
  - One shared module (templates/hooks/lib/safeword-cli.ts) owns how hooks run the Safeword CLI, with two entry points — a trusted lookup for trust checks and a working lookup for plain actions.
  - Trusted lookup (GREEN receipt guard, retrospective gate, review receipt verification) never returns a CLI the project can edit — the plugin's bundled copy (outside the project), the Codex plugin cache for the project's pinned version, else `bunx safeword@<.safeword/version>` run from the home directory.
  - Working lookup (architecture stage and heal, learnings sync, retro extraction on Claude and Codex, lint, test runner) — the plugin's bundled copy, else this repo's source when developing Safeword, else the project's installed package, else `bunx safeword@<.safeword/version>`.
  - No hook runs an unpinned `bunx safeword` or `safeword@latest`; the Claude plugin generator's `@latest` rewrite is removed.
out_of_scope:
  - Auto-upgrade, which deliberately runs the newest version.
  - Removing the bundled CLI from the Claude or Codex plugins.
  - A Cursor plugin.
done_when:
  - Unit tests prove each lookup's order, version pinning, and that the trusted lookup refuses project-writable paths.
  - A real GREEN-guard hook process outside a plugin verifies a receipt through pinned bunx (PATH-stubbed at the process boundary).
  - No hook template contains `safeword@latest` (outside auto-upgrade) or an unpinned `bunx safeword`; generated surfaces regenerated; full suite green.
created: 2026-10-13T06:02:39.412Z
last_modified: 2026-10-13T06:02:39.412Z
---

# Run the same Safeword CLI from every hook on every host

**Goal:** Every hook finds the Safeword CLI through one shared lookup: the plugin's bundled copy on Claude Code and Codex, pinned `bunx safeword@<version>` elsewhere.

**Why:** Nine hooks resolve the CLI their own way. The GREEN guard and retrospective gate cannot find it outside a plugin (#5807, #5026), and several action hooks run an unpinned `@latest` that can differ from the installed hooks.

## Work Log

- 2026-10-13T06:02:39.412Z Started: Created ticket 8VG20K
- 2026-10-13T06:10Z Scope agreed with user ("unify"): one shared lookup; bundled copy on plugin hosts, pinned bunx elsewhere; Cursor plugin and dropping the bundles are out of scope.
