# Verify: Surface reply format before Claude responds (K8D3M4)

Verified 2026-07-27 after revalidating GitHub issue #1524, completing the
task's RED → GREEN → REFACTOR cycle, and addressing the shared-constant and
active-TDD review remediation.

## Verify Checklist

**Test Suite:** ✓ 5,551 passed (373 files; 5 skipped). The real-installed hook
integration and shared quality-contract tests are included; their focused run
passed 163/163 tests.

**Gherkin:** ✅ 505 passed, 3 skipped (15,645 passed steps; 4 skipped).

**Build:** ✅ tsup ESM and DTS build completed as part of the test run.

**Lint:** ✅ `bun run lint`, `bun run typecheck`, `bun run knip`, and
`git diff --check` passed.

**Scenarios:** All six task test-definition rows are complete: the original
hook output was shown absent; the installed hook now emits the concise reminder;
the formatting contract is shared without duplicating the Stop template; and an
active implement/TDD state keeps only the answer-first cue.

**PR Scope:** ✅ Diff is limited to the reply-format change: the prompt hook and
shared-quality template sources with their synced dogfood mirrors, schema and
integration contracts, the K8D3M4 ticket, the related long-session learning,
and the narrow 5ARWDG coordination record.

**Dep Drift:** ✅ No dependencies changed. `bun run deps:validate` reported one
pre-existing `no-orphans` warning on `packages/cli/src/codex-plugin/hooks.ts`,
outside this ticket's diff.

**Reconcile:** ✅ Template and dogfood hook copies were synchronized with
`bun run parity:fix`; existing Stop-hook validation and non-Claude adapters are
unchanged.

**Quality review:** ✅ Independent review approved after the remediation. The
chosen `UserPromptSubmit` timing is correct for #1524; its active-TDD condition
matches the Stop hook's quiet condition; and the test executes the installed
hook in a real temporary Safeword project.

**Refactor:** ✅ The dedicated refactor pass moved both reply-format variants
into `hooks/lib/quality.ts`, preventing vocabulary drift between the prompt and
Stop hooks. The real-installed-hook suite passed 163/163, lint/typecheck and
template parity are clean, and the one-item ledger is complete.

**Audit:** ✅ Passed with non-blocking repository observations. Config sync,
dependency-cruiser (0 violations across 666 modules and 2,179 dependencies),
Knip, and Go checks were clean. `jscpd` recorded 506 clones (8.92%) across the
repository excluding generated and Safeword/ticket mirrors; the diff adds no
new clone pattern. `bun outdated` found one low-risk dev-only patch update
(`markdownlint-cli2` 0.23.1 → 0.23.2), deferred as out of scope. Python
dead-code/import checks remain unavailable in an unrelated experiment because
their tools are not installed.

**Evidence limits:** ✅ None for this task. The ticket intentionally remains
`in_progress` pending user confirmation before it is marked done.
