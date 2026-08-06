# Refactor ledger — updated PR review

Reviewed the post-`5ac00a4de` changes and the complete review-runtime diff
against current `main`.

## Resolved

- **Public-boundary proof:** `retry-command.test.ts` inspected a recovery string
  without passing the flag-shaped target through Commander. Added a built-CLI
  regression proving `--help` remains a filename after the end-of-options marker.
- **Deadline naming:** `runBoundMs()` was described as a whole-run ceiling even
  though packet preparation starts before it and final integrity/cleanup work may
  finish afterward. Renamed the comment's concept to an absolute reviewer-work
  deadline and aligned the spec.
- **Timing proof contract:** the spec still required controlled clocks everywhere
  after the implemented plan deliberately chose pure arithmetic tests plus real
  process-effect tests. Reconciled the constraint to the shipped proof strategy.
- **Observable completion boundary:** the plan promised callback-order-independent
  handling of an answer complete at the exact deadline, but the process API only
  exposes a trustworthy complete answer after successful process close. Narrowed
  the contract to that observable boundary instead of preserving an unprovable
  tie claim.
- **Acceptance fixture fidelity:** the descendant-cleanup and late-answer steps
  both used a reviewer that merely slept. The scenarios now create a real grouped
  descendant and emit a valid answer from the termination trap, then observe that
  the descendant is gone and the late output cannot change the timeout result.

## Deliberately retained

- **Elapsed-time guards:** two public/process wiring tests use generous elapsed
  caps around shortened configured deadlines. They are not production timing
  proofs; they catch a command that never settles. Process disappearance and
  route results remain the behavioral assertions.
- **Module size:** `coordinator.ts` and `runtime.ts` are long, but their current
  functions already separate packet, policy, route, candidate, and supervisor
  responsibilities. Extracting files in this pass would move code without
  reducing duplicated intent or changing the dependency boundary.
