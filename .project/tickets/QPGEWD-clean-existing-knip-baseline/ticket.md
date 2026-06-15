---
id: QPGEWD
slug: clean-existing-knip-baseline
type: task
phase: intake
status: in_progress
created: 2026-06-15T13:52:20.284Z
last_modified: 2026-06-15T13:52:44Z
---

# Clean existing knip baseline

**Goal:** Reduce the existing `knip` baseline until dead-code/dependency audit output is actionable.

**Why:** The current report mixes unused dependencies, unlisted binaries, unresolved test imports, and unused exports, making new dependency regressions easy to miss.

**Scope:** Triage each current `knip` category, remove genuinely unused entries, configure intentional test/tooling exceptions, and keep generated-template exports visible where they matter.

**Out of Scope:** Removing dependencies needed only for downstream customer installs without replacing their coverage.

**Done When:**

- [ ] `bun run knip` either passes or reports only documented intentional exceptions.
- [ ] Any retained ignores include a short reason.
- [ ] The audit output no longer buries new dependency changes under the old baseline.

## Work Log

- 2026-06-15T13:52:20.284Z Started: Created ticket QPGEWD
- 2026-06-15T13:52:44Z Intake: Audit reported 7 unused dependencies, 3 unused devDependencies, 11 unlisted binaries, 11 unresolved imports, 11 unused exports, and 5 unused exported types.
