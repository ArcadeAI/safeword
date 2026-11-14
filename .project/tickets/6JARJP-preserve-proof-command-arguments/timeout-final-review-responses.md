# Lifecycle assertion review responses

Independent review fc395dcf-d148-4ff9-af35-7c814289bd5f approved the updated
Cucumber configuration assertion, current ticket and prerequisite responses,
with no errors. Author: Codex; actual reviewer: Claude Opus; independence:
cross-agent. The normal helper recorded this signed review for the done-phase
exit. This is review evidence, not completion or merge authority.

- **Phase versus status:** `phase: done`, `status: in_progress` is the existing
  normal completion-attempt state. The ticket is explicitly unfinished. The
  Stop adapter runs `evaluateDoneEvidence` before updating status, and the Ready
  guard rejects any ticket whose status is not `done`. No consumer involved in
  promotion treats the phase label alone as permission. Keep that state while
  retrying normal closure; do not hand-write a completed status.
- **120-test count:** this is the historical focused GREEN before the two
  build-failure characterization cases. Those three build/delegation cases
  passed separately. A combined post-addition recheck and final CI remain
  pending at review time; their actual results belong in timeout-results.md.
- **Exact script assertions:** retained as a configuration tripwire, paired
  with real package-manager ordering, once-only execution and failure-path
  integration tests. The string assertions alone are not behavioral proof.
- **Direct CLI BDD invocation:** root prerequisites belong to the root script.
  The resolver plans `bun run test:bdd` at root and the integration test
  verifies it. No claim is made that directly invoking the child runs root
  prerequisites.

Final verification, normal closure, exact-head CI and the authorized merge must
still be observed separately. Historical failed runs are retained.
