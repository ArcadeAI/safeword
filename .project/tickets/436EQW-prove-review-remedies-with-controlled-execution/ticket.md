---
id: 436EQW
slug: prove-review-remedies-with-controlled-execution
type: feature
phase: plan-implementation
status: in_progress
parent: P0D6S2
epic: trustworthy-advisory-pr-review
blocked_on: [HXT3GW]
phase_skips:
  - "intake: inherited the accepted P0D6S2 intake when the user approved the plan-implementation split"
  - "define-behavior: extracted from the P0D6S2 behavior packet at the documented split restart point"
  - "scenario-gate: inherited the independently approved P0D6S2 scenario gate before narrowing to this child"
scope:
  - Execute same-repository code only for a named evidence-producing command needed to resolve a declared unknown.
  - Record the exact revision, command, outcome, and unknown addressed by every execution.
  - Describe a remedy as verified only when Safeword applies the exact displayed patch and all named relevant checks succeed against it.
out_of_scope:
  - Executing fork code under any authority.
  - Automatically applying remedies to customer branches.
  - Core advisory routing and publication, supplied by HXT3GW.
done_when:
  - Execution eligibility alone never causes customer code to run.
  - Every executed command is named, purpose-bound, sandboxed, and recorded against an exact revision.
  - Failed, errored, partial, or mismatched patch execution remains unverified.
  - A verified-remedy claim identifies the exact applied patch and successful relevant commands.
phase_anchors:
  - "define-behavior: .project/tickets/436EQW-prove-review-remedies-with-controlled-execution/spec.md"
  - "scenario-gate: features/prove-review-remedies-with-controlled-execution.feature"
  - "plan-implementation: features/prove-review-remedies-with-controlled-execution.feature"
created: 2026-08-05T14:38:52.727Z
last_modified: 2026-08-05T14:38:52.727Z
---

# Prove review remedies with controlled execution

**Goal:** Allow narrowly named checks to produce execution evidence and reserve verified-remedy claims for exact tested patches.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-05T14:38:52Z Restarted at plan-implementation from the accepted P0D6S2 split; deliberately deferred because execution expands the security boundary and is not needed for the advisory MVP.
- 2026-08-05T14:38:52.727Z Started: Created ticket 436EQW
