---
id: 0PM7H8
slug: preserve-red-evidence-across-reviewer-fallbacks
type: patch
subtype: bug-investigated
phase: intake
status: in_progress
created: 2026-09-16T17:22:23.700Z
last_modified: 2026-09-16T17:22:23.700Z
---

# Preserve executable RED evidence across reviewer fallbacks

**Goal:** Let later independent reviewer routes receive the same trusted executable RED attestation after an earlier route fails.

**Why:** A failed primary reviewer currently causes alternate-model packet preparation to discard valid attestation evidence and abort with a misleading packet error.

## Work Log

- 2026-09-16T17:22:23.700Z Started: Created ticket 0PM7H8
- 2026-09-16T17:24:00.000Z Found: The primary Claude route exited with `process_failed`; the built-in fallback then reconstructed `ReviewRunInput` without `executionAttestation`, so executable-RED packet preparation aborted before the alternate route could run.
- 2026-09-16T17:29:00.000Z Fixed: Propagated `executionAttestation` into the alternate-model route. The new public-command regression passed, all 116 reviewer-routing tests passed, and focused formatting, ESLint, and TypeScript checks passed.

## Root Cause

`runRemainingRoutes` explicitly reconstructs the input passed to
`runAlternateModelRoute` but omits `executionAttestation`. Executable-RED packet
preparation requires that trusted attestation on every route, so a primary
reviewer failure turns into the misleading terminal error “Executable-red
review requires a trusted execution attestation” instead of trying the next
independent route.

Confirmed by the failed review job record: it persisted a complete execution
request, and the single-route diagnostic returned a valid matching
`execution_attestation`; only the built-in alternate-model path lost it.

Ruled out:

- CLI argument parsing—the persisted job contains the exact scenario, command,
  timeout, and expected-failure fields.
- RED execution failure—the attested command exited nonzero without timing out
  and matched the declared missing-behavior literal.
- A missing initial packet attestation—the primary reviewer launched, while the
  error appeared only when the coordinator prepared its later route.

The primary reviewer exit is a separate fail-closed host limitation: executable
RED review runs inside the normal network-restricted sandbox and cannot be
escalated. This patch preserves evidence across fallbacks; it does not weaken
that containment boundary.

## Scope

- Preserve the trusted executable-RED attestation when the coordinator moves
  from a failed primary reviewer to its alternate model.
- Prove the public `review run executable-red` flow reaches and accepts a later
  independent reviewer after the first route fails.

## Out of Scope

- Relaxing the executable-RED sandbox or adding network access.
- Changing reviewer deadlines, credentials, or provider behavior.
- Completing the separate data-architecture guide implementation.

## Failure Modes

- A later route receives no attestation and packet preparation aborts.
- A fallback runs but returns an approval without the original trusted
  execution evidence.
- Ordinary quality-review routing regresses while fixing executable RED.

## Done When

- A regression test fails on the current code for the missing attestation.
- The same test passes after the smallest input-propagation fix.
- Existing focused reviewer-routing tests pass unchanged.

## Open Questions

None. The sandboxed provider exit remains an environmental blocker for the
original live review, not part of this patch.
