# Verification: Project knowledge throughout feature delivery

## Verify Checklist

**Test Suite:** ✓ 6152/6152 tests pass (5 skipped; 410/410 files)
**Gherkin:** ✅ Acceptance lane passes (743 passed, 3 skipped; 25,077 steps passed, 4 skipped)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 20 scenarios marked complete (72 executable examples)
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked the Non-Technical Builder through request → behavior/design → independent review → evidence; worst step = waiting for review while the agent works; new steps vs before = 0.
**Evidence limits:** ⚠️ Installed workflow tests prove source delivery and resolver instructions, not that a host model obeys soft guidance or makes a wise semantic judgment.

Audit passed — the diff-scoped architecture, dependency-boundary, trace,
documentation, domain-reference, and changed-test checks are clean.

## Review records

### Installed review-source delivery

**Review stage:** Spec, scenario, implementation-plan, and quality review
**Host surface:** Claude Code, Cursor, and OpenAI Codex
**Resolved sources:** `PRINCIPLES.md`, `.project/personas.md`, and `.project/surfaces.md`, with configured-path fixtures for all three
**Claim:** Every supported host's four review procedures can resolve the current configured project knowledge instead of relying on labels or intake memory.
**Evidence:** `packages/cli/tests/integration/project-knowledge-review-entrypoints.test.ts` derives Claude and Cursor rows from `SAFEWORD_SCHEMA`, generates Codex assets through the production catalogue, follows each procedure's installed resolver instruction, and captures current content for all 12 rows. The full acceptance lane executes the matching host-stage outline.
**Verdict:** Supported for artifact delivery and current-source resolution.
**Limitations:** The harness does not launch a live model. Skill instructions are soft guidance, so this is not evidence that every model invocation will comply.

### Objective principle-trace audit

**Review stage:** Audit
**Host surface:** Safeword CLI
**Resolved sources:** Configured principles plus each active ticket's `impl-plan.md`, `Known deviations`, and local proof target
**Claim:** Audit reports broken source references, incomplete mappings, dead files or Markdown fragments, malformed conflict markers, and unrecorded explicit conflicts without grading principle wisdom.
**Evidence:** `packages/cli/tests/hooks/principle-trace.test.ts`, the executable feature's E010 examples, and a clean run of `.safeword/hooks/audit-principle-trace.ts` against this ticket.
**Verdict:** Supported for objective trace integrity.
**Limitations:** Audit deliberately cannot decide whether a principle applies or whether its consequence is a good interpretation.

### Persona experience and evidence boundary

**Review stage:** Quality review
**Host surface:** Cross-host workflow
**Resolved sources:** Non-Technical Builder, Safeword Maintainer, and the Claude Code, Cursor, OpenAI Codex, and Safeword CLI surface definitions
**Claim:** Project knowledge changes the agent's work without adding a user-facing checklist or setup step.
**Evidence:** The applicability examples omit non-applicable principles; setup remains automatic; the walkthrough above records zero new user steps; review guidance distinguishes experiential, per-surface, and objective evidence.
**Verdict:** The no-new-step mechanism is supported; actual delight is not claimed.
**Limitations:** No real-user study or live multi-host usability session was run.

## Verification commands

- `bun run test -- --maxWorkers=2` from `packages/cli`: 410 files passed; 6,152 tests passed; 5 skipped.
- `bun run test:bdd`: 746 scenarios; 743 passed and 3 skipped; 25,077 steps passed and 4 skipped.
- `bun run lint`: ESLint, Gherkin lint, and TypeScript passed.
- `bun run --cwd packages/cli build`: build and declaration output passed.
- Focused project-knowledge suite: 10 files and 121 tests passed.
- Diff audit: no architecture, dependency-boundary, principle-trace, domain-reference, documentation, or changed-test finding.

The unconstrained full Vitest run saturated local CPU and produced seven
startup/time-limit failures. Each failed file passed alone; the complete
two-worker run then passed all 410 files. The worker limit changes scheduling,
not test selection.
