---
id: Q7FN5X
slug: audit-dependency-security-advisories
type: task
phase: intake
status: in_progress
created: 2026-06-15T18:44:10.338Z
last_modified: 2026-06-15T18:44:32Z
---

# Resolve dependency security advisories for clean audits

**Goal:** Resolve or explicitly triage the current dependency security advisories so audit output is actionable.

**Why:** Quality review found `bun audit` is not clean, and recurring baseline advisories make it harder to distinguish PR-specific security risk from existing dependency debt.

**Scope:** Investigate the current `@babel/core`, `ws`, `vite`, and `js-yaml` advisories, identify upgrade paths, and update dependencies or document non-runtime exposure where immediate upgrades are not feasible.

**Out of Scope:** Blocking the React plugin migration on unrelated dependency advisories unless one is introduced by the migration itself.

**Done When:**

- [ ] `bun audit` is clean, or each remaining advisory has a documented owner, exposure assessment, and upgrade blocker.
- [ ] Any required dependency bumps preserve the CLI build, typecheck, lint, and test lanes.
- [ ] The audit command output no longer hides new PR-specific advisories behind an unexplained baseline.

## Work Log

- 2026-06-15T18:44:10.338Z Started: Created ticket Q7FN5X
- 2026-06-15T18:44:32Z Intake: `bun audit` reported five advisories across `@babel/core`, `ws`, `vite`, and `js-yaml`; none directly named `@eslint-react/eslint-plugin`, so this is tracked outside the React plugin migration.
