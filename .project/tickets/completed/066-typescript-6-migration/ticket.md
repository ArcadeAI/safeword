---
id: 066
slug: typescript-6-migration
type: task
status: superseded
phase: research
superseded_by: '091'
---

# Task: Evaluate TypeScript 6 migration

**Type:** Improvement

**Scope:** TypeScript 6.0.2 is latest stable. We're on 5.9.3. Major version — need to research breaking changes and impact on safeword's codebase and customer projects.

**Out of Scope:** ESLint 10 (ticket 051), plugin migrations (ticket 065).

**Research Needed:**

- TypeScript 6 changelog and breaking changes
- Impact on tsup build, vitest, typescript-eslint compatibility
- Impact on customer projects (safeword generates tsconfig settings)

**Done When:**

- [ ] Breaking changes documented
- [ ] Migration plan created
- [ ] Upgraded and tests pass

## Work Log

- 2026-03-28 Created from dep bump audit. Current: 5.9.3, latest: 6.0.2.
