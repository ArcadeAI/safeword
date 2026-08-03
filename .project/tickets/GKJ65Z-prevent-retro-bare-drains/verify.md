# Verification: Prevent retro findings from draining without acknowledgements

## Verify Checklist

**Test Suite:** ✓ 6258/6258 tests pass (5 skipped)
**Gherkin:** ✅ Acceptance lane passes (768/768 runnable scenarios; 3 skipped)
**Build:** ⏭️ Skipped — no build step
**Lint:** ✅ Clean
**Scenarios:** All 0 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked the Non-Technical Builder through the queued-finding nudge and guarded filing flow; worst step = understanding why an unacknowledged finding remains queued for a deduplicated retry; new steps vs before = 0
**Surface Evidence:** ⚠️ 3 unproven/limited (live Claude, Cursor, and Codex compliance); 3/3 code-owned surfaces have recorded proof
**Evidence limits:** ⚠️ Claude/Cursor/Codex prompt compliance is not exercised by a live agent run. The guarded drain is structural for supported callers, but an agent with unrestricted filesystem authority can still bypass it; the Stop tripwire detects that after the fact.

Audit passed with no diff-scoped findings.

## Surface Evidence

| Affected surface | Proof command or manual check | Result |
| --- | --- | --- |
| Safeword CLI retro triage → spool drain | `packages/cli/tests/commands/retro.test.ts` and `packages/cli/src/retro/triage.test.ts` | Destination issues are acknowledged; failed acknowledgement writes retain drafts |
| Guarded agent drain helper | `packages/cli/tests/hooks/retro-filing.test.ts` | Real Bun subprocess removes only drafts with reader-visible destination acknowledgements |
| UserPromptSubmit nudge | `packages/cli/tests/integration/prompt-retro-nudge.test.ts` | Real Bun subprocess emits time-bounded observed state through the hook adapter |
| Claude Code filer | `packages/cli/tests/hooks/retro-filer-agent-defs.test.ts`; no live-agent run | Installed agent and skill invoke the guarded helper; runtime compliance remains limited |
| Cursor filer | `packages/cli/tests/hooks/retro-filer-agent-defs.test.ts`; no live-agent run | Installed agent invokes the guarded helper; runtime compliance remains limited |
| OpenAI Codex filer | `packages/cli/tests/hooks/retro-filer-agent-defs.test.ts`; no live-agent run | Shipped skill invokes the guarded helper; runtime compliance remains limited |

## Current-run evidence

- `$safeword:verify` invocation proof: recorded for the current run.
- Generated verify plan: 413 test files passed; 6,258 tests passed; 5 skipped.
- Gherkin lane: 768 runnable scenarios passed; 3 skipped; 26,695 steps passed; 4 skipped.
- Typecheck: `tsc --noEmit` passed.
- Dependency audit: no vulnerabilities found.
- Lint workflow: ESLint, Prettier, and TypeScript completed without changes or errors.
- Dependency drift: runtime architectural dependencies are documented in `ARCHITECTURE.md`; no dependency manifests changed in this PR.
- PR scope: all branch-only files implement, test, document, or verify GitHub issue #1805.
- CI: replacement run `30783115580` passed dogfood parity, lint, Node 24, and Node 22.22.3 after the branch incorporated the newer native-plugin contract and regenerated its mirrors.
