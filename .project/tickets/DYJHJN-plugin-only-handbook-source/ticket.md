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
- 2026-11-12T17:10:00Z tdd-review: swapped merge-base implementation under the new tests; 6 new-behavior tests failed for the missing behavior, regression guards passed. Gap found and closed: OpenCode and legacy Codex checks now cover both markers (718156c21).
- 2026-11-12T17:15:00Z refactor: handbook path named once in configured-paths (e55d2de7f); Codex project marker reuses the constant (14a45c3da). Declined: hook-side and OpenCode-string copies (deliberate standalone duplicates), schema literal keys (regex-read), Codex fallback message (different failure, would add a cross-boundary import).
- 2026-11-12T17:40:00Z quality-review pass 1 (cross-agent, Codex gpt-6.1-sol): error — Codex bridge exited 0 silently when the bundled handbook was empty. Fixed with a public-CLI test (054226aa7).
- 2026-11-12T17:55:00Z quality-review pass 2 (cross-agent, Codex): error — packageRunnerIsAvailable uses lstat, so a symlinked npx reads as unavailable. Declined for this PR: pre-existing code this diff does not change; it cannot retire a read handbook copy (package hooks read the published CLI's bundled handbook; script hooks are detected by their script file). Proposed as a follow-up.
