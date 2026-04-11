---
id: '102c'
slug: native-language-step-defs
title: 'Customer choice of native-language Gherkin step definitions'
type: Feature
status: backlog
priority: low
parent: '102'
depends_on: 102b
---

# Feature: Native-Language Step Definitions

**Type:** Feature | **Priority:** Backlog | **Parent:** Epic 102 | **Depends on:** 102b

## Problem

Ticket 102b puts TypeScript step definitions in non-TS projects. This works but means a Go developer sees `package.json`, `node_modules`, and TypeScript files in their repo. Some teams want step definitions in their project's native language so they can:

- Call internal functions directly (not just shell out)
- Keep their test toolchain in one language
- Use existing test infrastructure (Go's `testing.T`, Python's `pytest` fixtures)
- Remove Node/Bun as a test dependency

## Solution

Let customers configure `gherkin.stepLanguage` in `.safeword.yml`. SafeWord scaffolds step definitions and wires up the runner for the chosen language. The `.feature` files stay the same — only the glue code and runner change.

## Configuration

```yaml
# .safeword.yml
bdd:
  enabled: true
  stepLanguage: go # typescript (default) | go | python | rust
```

This is especially useful for **polyglot projects** — a Go+Python monorepo can standardize on one step definition language regardless of project mix.

When omitted, defaults to `typescript` (102b behavior).

## Supported Runners

| stepLanguage | Runner                       | Step definition location                 | Test command                                     |
| ------------ | ---------------------------- | ---------------------------------------- | ------------------------------------------------ |
| typescript   | QuickPickle/Vitest (default) | `steps/*.steps.ts`                       | `bunx vitest --run features/`                    |
| go           | godog                        | godog convention (validate at impl time) | `godog run features/` or `go test` with TestMain |
| python       | pytest-bdd                   | `conftest.py` auto-discovery             | `pytest`                                         |
| rust         | cucumber-rs                  | binary target (validate at impl time)    | `cargo test`                                     |

**Note:** Exact runner commands and conventions must be validated at implementation time. The runners listed are the current best candidates per language — re-evaluate if the landscape has changed.

## Implementation Steps

### 1. Research and validate runners

- Verify godog, pytest-bdd, cucumber-rs are actively maintained at implementation time
- Confirm each consumes standard `.feature` files without modification
- Document exact step definition conventions per runner
- Test that SafeWord's hook system can invoke each runner

### 2. Add stepLanguage config

- Add `bdd.stepLanguage` to `.safeword.yml` schema
- Default to `typescript` when omitted (backward compatible with 102a/102b)
- Validate against supported values

### 3. Scaffold per language

- Step definition templates for each language (same shared vocabulary: temp dirs, run commands, assert output)
- Runner config files where needed (`conftest.py` for pytest-bdd, `Cargo.toml` test targets for cucumber-rs)
- Dependency installation: `go get` for godog, `pip install` for pytest-bdd, `cargo add --dev` for cucumber-rs

### 4. Remove JS artifacts for non-TS choice

- When `stepLanguage` is not `typescript`, do NOT scaffold `package.json`, `vitest.config.ts`, or `node_modules`
- Clean up 102b artifacts if customer switches from TS to native (or document migration path)

### 5. Adapt safeword check

- `safeword check` reads `bdd.stepLanguage` and validates the correct runner is installed
- Verify step definition files exist in the expected locations per runner convention

### 6. Adapt hooks

- Pre-commit/pre-push hooks invoke the correct test command based on `stepLanguage`
- SafeWord generates the hook command, customer can override

## Out of Scope

- Multiple runners in the same project (pick one via config)
- Languages beyond Go, Python, Rust (add later)
- Converting step definitions between languages (not portable)
- SafeWord owning test execution (scaffolds and verifies, customer runs)

## References

- Ticket 102a — QuickPickle setup, shared step vocabulary
- Ticket 102b — prerequisite (TS step defs for non-TS projects)
- [godog](https://github.com/cucumber/godog) — official Cucumber for Go
- [pytest-bdd](https://github.com/pytest-dev/pytest-bdd) — BDD plugin for pytest
- [cucumber-rs](https://github.com/cucumber-rs/cucumber) — Cucumber for Rust
