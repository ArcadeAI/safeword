# Verification: Prevent retro findings from draining without acknowledgements

## Verify Checklist

**Test Suite:** ✓ 6245/6245 tests pass (5 skipped)
**Gherkin:** ✅ Acceptance lane passes (768 runnable root scenarios; 3 skipped; 278/278 package scenarios)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 0 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⚠️ Nudge wording is pinned and exercised through the real Bun hook boundary; no live NTB/TBU walkthrough was run
**Surface Evidence:** ✅ 3/3 affected code-owned surfaces have recorded proof
**Evidence limits:** ⚠️ Claude/Cursor/Codex prompt compliance is not exercised by a live agent run. The shipped guarded drain is structural, but an agent with unrestricted filesystem authority can still bypass it; the Stop tripwire detects that after the fact.

## Surface Evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| CLI retro triage → spool drain | `packages/cli/tests/commands/retro.test.ts` and `packages/cli/src/retro/triage.test.ts` | Destination issues are acknowledged; failed ack writes retain drafts |
| Guarded agent drain helper | `packages/cli/tests/hooks/retro-filing.test.ts` | Real Bun subprocess removes only drafts with reader-visible destination acknowledgements |
| UserPromptSubmit nudge | `packages/cli/tests/integration/prompt-retro-nudge.test.ts` | Real Bun subprocess emits time-bounded observed state through the hook adapter |

Dependency audit passed with no vulnerabilities.

Post-review hardening: 132/132 focused tests pass across CLI filing, guarded
agent draining, shipped filer definitions, nudge behavior, real Bun subprocess
boundaries, and schema registration. Full package lint (ESLint, Gherkin lint,
and TypeScript) passes after the final changes.
