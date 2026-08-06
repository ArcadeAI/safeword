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
- **Cleanup outcome:** process-group cleanup previously returned normally after
  its forced-kill budget even when the group still existed. Cleanup now returns
  an observed stopped/abandoned outcome, and abandonment becomes a classified
  route failure that cannot be hidden by a later successful candidate.
- **Acceptance observations:** deadline, oversized-packet, route-order, and
  author-fallback steps previously inferred behavior from broad result fields.
  Reviewer launch logs now prove whether a process started, which route order ran,
  and that a shortened public deadline changes the outcome.
- **Loaded cleanup margin:** the original 25-millisecond POSIX grace periods
  could classify an ordinary process exit as abandoned under full-suite load.
  Raised each TERM/KILL observation window to 250 milliseconds; the bound stays
  below Windows' one-second tree cleanup while preserving the explicit abandoned
  outcome when a group truly survives.
- **Windows close observation:** successful `taskkill` completion previously
  ended cleanup before the retained child handle proved that inherited pipes
  closed. Windows cleanup now requires both a successful tree kill and the
  child's `close` observation within the one-second budget.
- **Ticket/index drift:** reconciled the ticket's stale size-aware scope wording
  to the delivered flat evidence-based deadline, corrected the POSIX overrun to
  500 milliseconds, and removed the duplicate ticket-count heading introduced
  by index reconciliation.

## Deliberately retained

- **Elapsed-time guards:** two public/process wiring tests use generous elapsed
  caps around shortened configured deadlines. They are not production timing
  proofs; they catch a command that never settles. Process disappearance and
  route results remain the behavioral assertions.
- **Module size:** `coordinator.ts` and `runtime.ts` are long, but their current
  functions already separate packet, policy, route, candidate, and supervisor
  responsibilities. Extracting files in this pass would move code without
  reducing duplicated intent or changing the dependency boundary.
