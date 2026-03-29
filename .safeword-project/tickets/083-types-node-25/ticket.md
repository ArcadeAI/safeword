---
id: '083'
slug: types-node-25
title: 'Bump @types/node from 20.x to 25.x'
type: Improvement
status: open
---

# Task: Bump @types/node from 20.x to 25.x

**Type:** Improvement

**Scope:** Update `@types/node` from 20.19.27 to 25.x. Dev-only dependency, follows Node.js versioning.

**Out of Scope:** Changing the Node.js engine requirement (currently `>=20`), adopting Node.js 25-specific APIs.

**Context:** Flagged in audit. Currently pinned to 20.x which matches `engines.node >= 20`, but 25.x includes type definitions for newer APIs that may improve type safety. Low risk — dev-only, no runtime impact.

**Done When:**

- [ ] `@types/node` bumped to 25.x
- [ ] `bun run typecheck` passes (or equivalent)
- [ ] No new type errors introduced
