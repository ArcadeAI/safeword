---
id: '102'
slug: gherkin-executable-specs
title: 'Epic: Executable Gherkin specifications'
type: Epic
status: backlog
priority: low
children: ['102a', '102b', '102c']
---

# Epic: Executable Gherkin Specifications

SafeWord orchestrates BDD but has no executable specs — internally or for customers. This epic adds real Gherkin execution in three stages, each removing one compromise.

## Children

| Ticket   | Scope                   | Step defs              | Runner                  |
| -------- | ----------------------- | ---------------------- | ----------------------- |
| **102a** | TypeScript projects     | TypeScript             | QuickPickle/Vitest      |
| **102b** | Non-TypeScript projects | TypeScript (shell out) | QuickPickle/Vitest      |
| **102c** | Customer choice         | Native language        | godog, pytest-bdd, etc. |

## Progression

**102a** delivers full value for TypeScript projects — SafeWord's own tests and TS customer projects. Same runner, same config, no compromises.

**102b** extends to Go, Rust, Python projects. Step definitions are still TypeScript but shell out to native tooling (`go test`, `cargo test`). Tradeoff: JS tooling in a non-JS repo. Acceptable because SafeWord already requires Node/Bun.

**102c** eliminates that tradeoff. Customers configure `gherkin.stepLanguage` in `.safeword.yml` to write step defs in their project's language. Useful for polyglot repos where a team wants to standardize on one language regardless of project mix.

## Shared Architecture (all tickets)

- `.feature` files are the single source of truth for behavioral scenarios (replaces Given/When/Then in test-definitions.md)
- Gherkin at the **acceptance layer only** — unit/integration tests stay in native frameworks
- Domain-grouped step definitions, thin shared core, grow organically
- Re-evaluate QuickPickle at implementation time (50 stars, solo maintainer as of 2026-04 — architecture is runner-agnostic)
