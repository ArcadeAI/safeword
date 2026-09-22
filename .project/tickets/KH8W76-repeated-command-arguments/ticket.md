---
id: KH8W76
slug: repeated-command-arguments
type: task
phase: intake
status: in_progress
subtype: bug-investigated
external_issue: https://github.com/ArcadeAI/safeword/issues/4769
scope:
  - Accept repeated nonblank values in command proof argv arrays.
  - Preserve non-empty argv, nonblank arguments, safe cwd, and unique review-receipt targets.
  - Surface the rejected structural field or reason in invalid-output evidence.
out_of_scope:
  - Changing trusted delivery-definition equality or normalized-digest admission.
  - Relaxing identity-bearing uniqueness outside command argv.
done_when:
  - A Cargo proof with repeated --test flags is admitted unchanged.
  - Existing malformed invocation, unsafe cwd, receipt-target, equality, and digest checks remain green.
  - Invalid structural output reports a specific failing field or reason.
created: 2026-09-22T18:04:08.026Z
last_modified: 2026-09-22T20:34:00.000Z
---

# Accept repeated command arguments in plan reviews

**Goal:** Admit exact trusted command proofs with repeated nonblank argv values while preserving structural safety and actionable rejection evidence.

**Why:** Issue #4769 makes valid Cargo delivery definitions impossible to approve and collapses the cause to invalid_output.

## Root Cause

`isValidProofInvocation` reused `uniqueNonblankStrings` for command `argv`. That helper
correctly enforces uniqueness for identity-bearing collections, but process arguments are an
ordered sequence where duplicate flags and values are valid. A copied trusted definition could
therefore satisfy deep equality and digest identity while failing the earlier structural check.

Confirmed by tracing the exact Cargo reproduction to
`delivery_definition.proof_specifications[0].invocation.argv`; the only rejected property is the
second `--test` argument.

Ruled out:

- Trusted-definition mutation: the reproduction copies the definition exactly and the deep-strict
  comparison is reached only after structural validation.
- Digest mismatch: the reproduction supplies the exact normalized digest.
- Unsafe working directory: `apps/guard` passes the existing project-contained path check.

## Work Log

- 2026-09-22T18:04:08.026Z Started: Created ticket KH8W76
- 2026-09-22T18:08:00.000Z Found: Issue #4769 targets the unmerged
  `codex/4200-plan-implementation-gates` line, so this fix is stacked on that branch.
- 2026-09-22T20:34:00.000Z Verified: Repeated Cargo arguments are admitted; empty or
  blank argv entries, unsafe cwd values, duplicate receipt targets, trusted-definition
  mutations, and digest mutations remain rejected with field-specific reasons. Focused
  validator/runtime tests pass (113 passed, 2 skipped). The repository-wide gate remains
  red on pre-existing stacked-branch generated-artifact, Bun-version, and integration-timeout
  failures; GitHub CI is the final environment check for this fix.
