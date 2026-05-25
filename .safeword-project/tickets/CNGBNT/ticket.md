---
id: CNGBNT
slug: harness-availability-check
title: "Test-harness availability check with graceful degradation to existing service test patterns"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-two-merge
paired_with: SXNV8N
created: 2026-05-24T21:37:59.876Z
last_modified: 2026-05-24T21:39:00.000Z
---

# Test-harness availability check with graceful degradation

**Goal:** Add a Phase 6 (implement) entry check that detects whether the project's test harness is available — and if not, gracefully degrades the TDD loop to "use the service's existing test patterns" with a clear follow-up file for harness setup. Today safeword assumes the harness exists; this absorbs arcade's graceful-degradation path.

**Why:** Real codebases often don't have a behavioral testing harness wired up yet (Python services without pytest-bdd, TypeScript services without playwright-bdd, freshly bootstrapped projects). Today safeword assumes the harness is there and instructs the agent to follow the R/G/R loop assuming it can run tests. Result: the agent either fakes execution or stalls. Arcade's `/implement-spec` step 1 checks for the harness explicitly and degrades to existing service test patterns. Without this: agents pretend tests run when they don't.

**Parent epic:** M6D315
**Paired with:** SXNV8N in arcade
**Depends on:** —

## Scope

### Harness availability check (Phase 6 entry)

At entry to Phase 6, run a project-conventional check for harness presence. Examples:

- Python: `ls tests/features/ 2>/dev/null` or check for `pytest-bdd` in `pyproject.toml` dependencies.
- TypeScript: check for `playwright-bdd` or `@cucumber/cucumber` in `package.json` dependencies.
- Go: check for a `*_test.go` file under a designated behavioral-test directory.
- Configurable per project via `.safeword/config.json` field: `"harnessCheck": "<command>"` or `"harnessPath": "<path>"`.

Default: probe the conventional location for the detected language; configurable override.

### Two branches

**Branch A: harness present.** Standard Phase 6 TDD loop — RED/GREEN/REFACTOR per scenario, hook-parsed checkboxes, evidence-before-claims, all today's discipline.

**Branch B: harness absent.** Switch to graceful-degradation copy in TDD.md:

> **Behavioral tests are not yet executable for this project.** The standard TDD loop assumes a behavioral test harness; for now, implement using the service's existing test patterns (unit tests, integration tests, whatever the project uses). Use the same RED/GREEN/REFACTOR discipline and checkbox tracking. File a follow-up ticket to wire the behavioral harness once the implementation lands.

Also: scaffold a follow-up ticket (or surface a recommendation to create one) titled `Wire behavioral test harness for {project-or-service}`.

### Hook integration

- The Phase 6 entry hook checks for harness presence using the configured probe.
- If absent, the hook annotates the active ticket's work log: `- {timestamp} Harness absent; using existing service test patterns. Follow-up: wire behavioral harness.`
- No phase-block on harness absence — degradation is the intended path.

## Out of scope

- Implementing harness scaffolding for languages — separate ticket per language if desired.
- Forcing the team to set up the harness — degradation is the polite path.
- Auto-creating the follow-up ticket — surface the recommendation; let the user invoke `safeword ticket new` if they want it.

## Done when

- `.safeword/config.json` schema includes `harnessCheck` / `harnessPath` fields.
- TDD.md documents both branches (harness present, harness absent) with copy for the degraded path.
- Hook detects harness presence and routes appropriately.
- Worked example shows a project without a harness implementing a scenario via existing test patterns.

## Open questions

- **What's the canonical probe per language?** Need a default list — Python uses pytest-bdd, TS uses ??? (playwright-bdd vs Cucumber.js), Go uses ??? (godog? bare \*\_test.go?). Driver leans configurable-with-defaults and let users override.
- **Follow-up ticket auto-creation** — silent (mention in work log), prompt (ask user), or auto (mint via CLI)? Driver leans prompt.

## Work Log

- 2026-05-24T21:37:59.876Z Started: Created ticket CNGBNT
- 2026-05-24T21:39:00.000Z Drafted: Scope (probe, two branches, hook integration); linked to epic M6D315
