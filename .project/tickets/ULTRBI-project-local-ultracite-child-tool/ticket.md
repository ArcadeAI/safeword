---
id: ULTRBI
slug: project-local-ultracite-child-tool
type: task
phase: done
status: done
created: 2026-08-26T00:00:00Z
last_modified: 2026-08-27T00:25:00Z
scope:
  - "Keep the validated project-local launcher directory on PATH while Safeword runs a host-owned formatter."
  - "Cover Ultracite invoking its sibling project-local Biome with no usable global Biome."
out_of_scope:
  - "Installing or upgrading host-project dependencies."
  - "Changing formatter ownership or fallback rules."
done_when:
  - "A project-local Ultracite can invoke its sibling project-local Biome through Safeword's sanitized host-toolchain runner."
  - "A PATH-provided global Biome is not used."
  - "Targeted hook tests, generated plugin parity, lint, and typecheck pass."
---

# Keep project-local Ultracite child tools discoverable

**Goal:** Let Safeword run a host project's local Ultracite exactly as installed, including Ultracite's call to the sibling local Biome binary.

## Work Log

- 2026-08-26T00:00:00Z Started: Reproduced `spawnSync biome ENOENT` when Safeword resolves local Ultracite to its package target and launches it without the host project's `.bin` directory on PATH.
- 2026-08-26T23:25:00Z RED: Added a regression test with a symlinked local Ultracite launcher, sibling local Biome, and failing global Biome; current main selected the package target and failed before reaching local Biome.
- 2026-08-26T23:34:00Z GREEN: Retained the validated project-local launcher path and prepended its `.bin` directory only for the host-toolchain child. Targeted tests passed 25/25; hook/schema tests passed 1,785/1,785; parity, lint, and typecheck passed. A local install in Arcade resolved `.bin/ultracite`, reached local Biome, and checked the real dashboard test cleanly. Entered verification; final audit and PR-scope evidence remain.
- 2026-08-27T00:25:00Z Done: Diff audit and PR-scope review passed. Full suite passed twice at 8,503/8,503 tests (7 skipped); builds, per-package typechecks, parity, and dependency scans passed. `verify.md` records unrelated local limits in real-machine review-routing acceptance cases and root mypy experiment fixtures.
