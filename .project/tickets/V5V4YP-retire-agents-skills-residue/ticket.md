---
id: V5V4YP
slug: retire-agents-skills-residue
type: task
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1442
scope:
  - Delete the 25 safeword-owned files under `.agents/skills/` — exactly the set already in SAFEWORD_SCHEMA.deprecatedFiles.
  - Retarget the tests that assert those paths onto the surfaces that remain (templates, .claude, codex-plugin).
  - Add a guard so the retired files cannot silently return.
out_of_scope:
  - Removing the `.agents/skills/` directory itself or ignoring it — the upstream skills CLI installs third-party packs there, and the schema's cleanup is deliberately file-scoped so sibling skills survive.
  - Un-deprecating the surface and re-shipping safeword skills to `.agents/skills/` in customer projects; that is a product decision, not drift repair.
  - `.safeword/hooks/` mirror drift (#1428) — different pair, already auto-healed at commit by #1415.
done_when:
  - No safeword-owned skill file is tracked under `.agents/skills/`.
  - No test asserts a `.agents/skills/` path, and every invariant those tests carried is still asserted on a surviving surface.
  - A regression test fails if any deprecated `.agents/skills/` path reappears in git.
  - Lint, parity, and the full suite are green in CI.
created: 2026-07-25T23:35:32.378Z
last_modified: 2026-07-25T23:35:32.378Z
---

# Retire the .agents/skills dogfood residue

**Goal:** Stop tracking the 25 safeword skill files the schema already deletes from customer projects

**Why:** parity:fix cannot sync .agents/skills because it is not an owned pair; the schema deprecates those exact 25 paths, so the dogfood repo is carrying files upgrade removes from every customer (#1442)

## Work Log

- 2026-07-25T23:35:32.378Z Started: Created ticket V5V4YP
