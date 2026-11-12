---
id: DYJHJN
slug: plugin-only-handbook-source
type: task
phase: implement
status: in_progress
created: 2026-11-12T16:23:02.870Z
last_modified: 2026-11-12T16:23:02.870Z
external_prs: [https://github.com/ArcadeAI/safeword/pull/7220]
---

# Make the plugin the only Safeword handbook source

**Goal:** Plugin-mode sessions read only the plugin's handbook, fail loudly when it is missing, and projects stop keeping handbook copies nothing reads.

**Why:** Agents now reliably open whatever handbook path the bootstrap names, so a stale project copy would silently become authority.

## Scope

- Plugin mode (Claude dispatch, Codex bridge) reads only `SAFEWORD_PACKAGED_CONTEXT_PATH`; a missing or empty packaged handbook fails loudly and never names the project copy.
- Legacy project-hook installs (no packaged path) keep reading `.safeword/SAFEWORD.md`.
- Dedicated enrollment marker `.safeword/enrolled`; every enrollment check also accepts the legacy handbook copy, so no existing project becomes unenrolled.
- Install and upgrade retire `.safeword/SAFEWORD.md` only when no host reads it (no Cursor, no legacy Claude, no viable legacy Codex session hook).

**Out of scope:** the in-session automatic Claude migration (its cleanup transaction only proves `.claude/` ownership); the `frontmatterHasField` empty-scope bug.

## Tests

- [x] Plugin mode, missing or empty packaged handbook: loud error naming the plugin path, never the project path (hook unit, Codex bundle, Claude dispatch)
- [x] Legacy install keeps the project path
- [x] Project with only `SAFEWORD.md` is still enrolled (CLI, hook copy, findProjectDir)
- [x] Upgrade after the move to the plugin writes the marker and removes the copy
- [x] Legacy Claude and installed Cursor keep the copy; uninstall planning unchanged

## Work Log

- 2026-11-12T16:23:02.870Z Started: Created ticket DYJHJN
- 2026-11-12T16:25:00Z Implemented: b96ee2af7 (packaged handbook only), c731fadcf (enrollment marker + retirement), 8188776f6 and 00d3f42c7 (tests that used SAFEWORD.md as install evidence)
- 2026-11-12T16:25:00Z Started: quality pass (tdd-review, refactor, quality-review, audit, verify)
