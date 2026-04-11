---
id: '102b'
slug: gherkin-polyglot-ts-steps
title: 'Executable Gherkin specs for non-TS projects via TypeScript step defs'
type: Feature
status: backlog
priority: low
parent: '102'
depends_on: 102a
---

# Feature: Gherkin for Non-TypeScript Projects (TS Step Defs)

**Type:** Feature | **Priority:** Backlog | **Parent:** Epic 102 | **Depends on:** 102a

## Problem

Ticket 102a adds Gherkin execution for TypeScript projects. But SafeWord supports Go, Rust, Python, and SQL projects. A Go developer using SafeWord's BDD workflow gets `.feature` files they can't execute.

## Solution

Extend the 102a QuickPickle setup to non-TypeScript customer projects. The `.feature` files are language-agnostic. The step definitions remain TypeScript but shell out to the customer's native tooling.

```gherkin
# Same .feature file works for any language
When I run "go test ./..."
Then the exit code should be 0
```

```typescript
// TypeScript step definition shells out — language doesn't matter
When('I run {string}', async (world, command) => {
  world.result = await exec(command);
});
```

## Tradeoff: JS Tooling in a Non-JS Repo

This adds `package.json`, `node_modules`, `vitest.config.ts`, and TypeScript step definitions to a Go or Rust project. This is acceptable because:

- SafeWord already requires Node/Bun — the dependency exists
- Acceptance tests test behavior from the outside, not internal functions
- Step definitions are thin glue code, not application logic
- For teams that find this unacceptable, ticket 102c adds native-language step defs

## Customer Non-TS Project Scaffold

```
customer-go-project/
  .safeword.yml                  <- bdd.enabled: true
  go.mod
  main.go
  features/                      <- .feature files (language-agnostic)
    api-health.feature
  steps/                         <- TypeScript step definitions
    index.ts
    world.ts
    shared.steps.ts              <- shell out to go test, cargo test, etc.
  package.json                   <- QuickPickle + Vitest (devDeps only)
  vitest.config.ts               <- QuickPickle plugin
```

## Implementation Steps

### 1. Extend scaffolding for non-TS projects

- Detect non-TS project (no existing `package.json`, or `package.json` without TypeScript)
- Generate minimal `package.json` with only QuickPickle + Vitest as devDeps
- Generate `vitest.config.ts` with QuickPickle plugin
- Add `.safeword.yml` config: `bdd.enabled: true`

### 2. Verify shared step vocabulary works for shell-out pattern

- Shared steps from 102a (`When I run {string}`, `Then the exit code should be {int}`) already work for any language
- No language-specific convenience steps upfront — let them emerge from real usage (thin core principle from 102a)

### 3. Handle .gitignore for JS artifacts

- Append `node_modules/` to `.gitignore` if not already present
- Consider whether `package.json` and `vitest.config.ts` should be gitignored or committed (recommend committed — they're project config)

### 4. Validate with a real non-TS project

- Test scaffolding against a Go project with `go.mod`
- Test scaffolding against a Rust project with `Cargo.toml`
- Verify `bun test` runs `.feature` files that shell out to native tooling
- Verify `safeword check` validates the setup

### 5. Update safeword check for non-TS projects

- Verify `package.json` exists with QuickPickle dep
- Verify `vitest.config.ts` has QuickPickle plugin
- Verify `features/` directory exists
- Verify `steps/` directory has barrel file

## Out of Scope

- Native-language step definitions — see ticket 102c
- Running customer's native test suite directly (SafeWord scaffolds and verifies, customer runs)
- Mixed TS/non-TS project detection (use `.safeword.yml` config)

## References

- Ticket 102a — prerequisite (QuickPickle setup, shared step vocabulary)
- Ticket 102c — follow-on (native-language step definitions)
