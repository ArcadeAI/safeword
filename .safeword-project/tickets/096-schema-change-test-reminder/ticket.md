---
id: 096
type: task
phase: intake
status: backlog
created: 2026-03-30T02:19:00Z
last_modified: 2026-03-30T02:19:00Z
---

# Schema Change → Test Drift Reminder

**Goal:** When schema.ts is modified, remind the agent to run `/verify` before pushing to catch test drift.

**Why:** Ticket 038 changed schema.ts (moved commands to deprecated) but pushed without running the full test suite. 3 tests in separate files broke silently — caught only in CI after push. schema.ts is a single source of truth that many integration tests depend on implicitly.

## Context

`packages/cli/src/schema.ts` defines all managed files, directories, and packages. Tests across multiple suites reference the schema's output (file existence, directory structure, command presence). When schema changes, those tests can break without any direct file dependency linking them.

**Incident (2026-03-29):** Other session moved 4 commands to `deprecatedFiles` in schema.ts. Tests in `setup-hooks.test.ts`, `reset-reconcile.test.ts`, and `skills-commands-validation.test.ts` still expected the old command layout. CI failed on 3 tests.

## Options Explored

| Option                                        | Approach                             | Verdict                         |
| --------------------------------------------- | ------------------------------------ | ------------------------------- |
| Pre-push hook with full test suite            | Blocks push for 10+ min              | Too slow for solo dev           |
| Dependency-aware test runner                  | Run tests affected by changed file   | Complex, vitest lacks this      |
| Branch protection + PR required               | CI must pass before merge            | Correct long-term, friction now |
| **Stop hook reminder when schema.ts changed** | Hint: "Schema changed — run /verify" | Lightweight, right moment       |
| Post-tool gate on schema change               | Force test run before commit         | Too aggressive                  |

## Proposed Implementation

In `post-tool-quality.ts`, when the edited file path contains `schema.ts`:

- Add an `additionalContext` note in the stop hook output: "schema.ts was modified this session — run `/verify` before pushing to check for test drift"
- OR: set a `schemaChanged` flag in the session state, and have the stop hook include a schema-specific reminder

**Key files that depend on schema.ts:**

- `tests/schema.test.ts` (direct)
- `tests/commands/setup-hooks.test.ts` (installs via schema)
- `tests/commands/reset-reconcile.test.ts` (uninstalls via schema)
- `tests/integration/golden-path.test.ts` (end-to-end setup)
- `tests/integration/skills-commands-validation.test.ts` (parity checks)

## Work Log

- 2026-03-30T02:19:00Z Created: from CI failure investigation — schema change in other session broke 3 tests

---
