---
id: Q7FN5X
slug: audit-dependency-security-advisories
type: task
phase: done
status: done
created: 2026-06-15T18:44:10.338Z
last_modified: 2026-06-16T04:50:21Z
---

# Resolve dependency security advisories for clean audits

**Goal:** Resolve or explicitly triage the current dependency security advisories so audit output is actionable.

**Why:** Quality review found `bun audit` is not clean, and recurring baseline advisories make it harder to distinguish PR-specific security risk from existing dependency debt.

**Scope:** Investigate the current `@babel/core`, `ws`, `vite`, and `js-yaml` advisories, identify upgrade paths, and update dependencies or document non-runtime exposure where immediate upgrades are not feasible.

**Out of Scope:** Blocking the React plugin migration on unrelated dependency advisories unless one is introduced by the migration itself.

**Done When:**

- [x] `bun audit` is clean, or each remaining advisory has a documented owner, exposure assessment, and upgrade blocker.
- [x] Any required dependency bumps preserve the CLI build, typecheck, lint, and test lanes.
- [x] The audit command output no longer hides new PR-specific advisories behind an unexplained baseline.

## Work Log

- 2026-06-15T18:44:10.338Z Started: Created ticket Q7FN5X
- 2026-06-15T18:44:32Z Intake: `bun audit` reported five advisories across `@babel/core`, `ws`, `vite`, and `js-yaml`; none directly named `@eslint-react/eslint-plugin`, so this is tracked outside the React plugin migration.
- 2026-06-16T04:16:08Z Figure-it-out: Chose targeted patch/minor-compatible dependency updates instead of broad `bun update --latest` or root overrides. Patched versions are available inside the current major lines for `vite` and `ws`.
- 2026-06-16T04:16:08Z Implemented: Updated `eslint-plugin-storybook` to `10.4.5`, `@vitest/coverage-v8` and `vitest` to `^4.1.9`, and `astro` to `^6.4.7`. Regenerated `bun.lock`; the graph now resolves `vite@7.3.5` through Astro/Vitest and `ws@8.21.0` through Storybook.
- 2026-06-16T04:16:08Z Verified: `bun audit --audit-level high` is clean; `bun run --cwd packages/cli build`, `bun run --cwd packages/cli typecheck`, `bun run --cwd packages/cli test:done`, `bun run test:smoke:fast`, `bun run --cwd packages/cli test -- --reporter=dot`, `bun run --cwd packages/website build`, `bun run --cwd packages/website typecheck`, `bun run lint`, `bun run test:bdd`, and `git diff --check` pass.
- 2026-06-16T04:16:08Z Verify note: Codex could not write a session-scoped `/verify` proof because `CLAUDE_SESSION_ID` is unavailable (`Missing session id for skill invocation log`). This is a task ticket, so the feature done-gate proof is not required, and status remains `in_progress` pending explicit user confirmation to mark done.
- 2026-06-16T04:36:56Z Drift decision: Do not add root `overrides` for `vite` or `ws` right now. The resolved graph is clean with normal workspace ownership plus the committed lockfile; root overrides would reduce one future resolver-regression risk but create longer-lived override drift. If `bun audit --audit-level high` regresses on these packages, add narrow overrides then.
- 2026-06-16T04:50:21Z Complete: Added `verify.md` with explicit verification evidence and marked the task done.
