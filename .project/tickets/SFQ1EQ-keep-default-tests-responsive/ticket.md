---
id: SFQ1EQ
slug: keep-default-tests-responsive
type: task
phase: intake
status: in_progress
parent: S3T6JA
epic: agent-surface-refactor
scope:
  - Identify default-suite tests that spawn real package-manager installs.
  - Move or gate slow setup/golden-path install coverage so `bun run test` stays responsive.
  - Preserve explicit coverage for real install flows in a documented slow or release lane.
  - Update Vitest config/script comments so the default/slow split matches reality.
out_of_scope:
  - Removing real install coverage entirely.
  - Weakening assertions in setup or golden-path tests.
  - Changing production setup behavior.
done_when:
  - `bun run test` no longer spends long quiet periods in real `npm install` subprocesses.
  - Slow install-backed coverage still runs through a named script.
  - Documentation/comments identify which lane maintainers should use for default, smoke, slow, and release validation.
created: 2026-06-15T14:11:50.893Z
last_modified: 2026-06-15T14:12:02Z
---

# Keep default tests responsive for maintainers

**Goal:** Keep the default Vitest suite fast and observable while retaining explicit coverage for real setup installs.

**Why:** The default suite currently includes setup/golden-path tests that spawn real `npm install` subprocesses, making `bun run test` look idle and run long even when the focused change path is unrelated.

## Work Log

- 2026-06-15T14:11:50.893Z Started: Created ticket SFQ1EQ
- 2026-06-15T14:12:02Z Scoped: Created from quality-review/Vitest investigation on `codex/skill-invocation-log-helper`; verbose full-suite output showed older setup/golden-path tests advancing slowly while package-manager subprocesses ran under Vitest workers.
