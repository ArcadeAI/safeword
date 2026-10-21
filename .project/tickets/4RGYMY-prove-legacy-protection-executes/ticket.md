---
id: 4RGYMY
slug: prove-legacy-protection-executes
type: task
phase: implement
status: in_progress
created: 2026-10-21T15:55:30.471Z
last_modified: 2026-10-21T15:55:30.471Z
---

# Prove legacy protection executes for Claude users

**Goal:** Replace M1 setup echoes with actual legacy hook execution and discriminating assertions

**Why:** Three passing BDD examples currently claim functional legacy authority without executing it

## Work Log

- 2026-10-21T15:55:30.471Z Started: Created ticket 4RGYMY
- RED: all five expanded examples failed after replacing setup echoes with an executed-guard assertion.
- GREEN: all five execute the registered, unmodified config guard and return a real ESLint approval request.
- Fault probes: removing execution fails 5/5; returning no protection response fails 5/5; duplicating plugin work fails the coexistence case.
- Full acceptance: 597 scenarios, 11,140 steps, and 51 proof-tag tests passed. Independent Claude Opus review approved both changed source files without blocking findings.
- Package typecheck passes. A separate strict check of this previously excluded step file reproduces the same 41 baseline diagnostics; no new primary diagnostics were introduced.
- The implement-exit stamp was refused because its branch-wide coverage check includes earlier ticket work outside the M1 review. The phase was not advanced or marked done; the actual scoped review and its receipt are retained in evidence.

## Scope

Repair M1 only: coexistence, failed sibling, and damaged-cache legacy authority
examples in the existing native Claude BDD lane. Execute the exact accepted
legacy config guard against an ESLint configuration edit, retain the plugin
failure/suppression and proof assertions, and require its actual approval response.

The three definitions expand to five cases: one coexistence, one failed sibling,
and three damaged-cache rows. The hook is the unmodified
`packages/cli/templates/hooks/pre-tool-config-guard.ts`, copied to its accepted
legacy project path and invoked through its registered command. The required
response is JSON with `permissionDecision: ask`, an ESLint config reason, and
the exact target file path. Empty output or exit zero alone cannot pass.

Out of scope: M2/M3 and the eight other assessment findings, production hooks,
runtime behavior, original feature scope, and release actions.

## Root Cause

The coexistence fixture prewrites its expected legacy effect; the other two
fixtures create a sentinel that the assertion simply rereads. Their process
actions execute only the plugin. No legacy hook response is observed.

## Tests

- RED: require one actual legacy config-guard response; existing fixtures must fail.
- GREEN: register and execute the unmodified accepted hook and require an ESLint approval response.
- Removing legacy execution must fail all five expanded examples.
- Plugin duplicates must remain detectable and prior proof must remain unchanged.
- Full native feature lane and applicable static checks pass.
