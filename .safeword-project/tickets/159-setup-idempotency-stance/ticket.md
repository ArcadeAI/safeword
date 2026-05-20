---
id: 159
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:26:00Z
last_modified: 2026-05-18T05:26:00Z
scope: |
  Decide and implement the project's stance on `safeword setup` idempotency.
  Current behavior: second invocation rejects with "Already configured. Run
  `safeword upgrade` to update." (exit 1). This forces tests to either swallow
  the exit code (which masks real failures — see ticket 152) or run `upgrade`
  on the second call (which changes test intent).
  Three options to evaluate:
  (a) Keep current rejection — document the "use upgrade for re-run" contract
      loudly; update the 4 "Setup Idempotency" tests to assert exit 1 + message
      rather than silently allowing failure
  (b) Make setup truly idempotent — second invocation noops if already configured
      (or delegates to upgrade); tests get simpler
  (c) Add `safeword setup --force` flag that runs idempotently for tests/scripts
      while keeping the conservative default for humans
out_of_scope: |
  - Re-architecting setup vs upgrade boundary
  - Changing what `setup` does on a fresh install (only the re-invocation case)
  - Test infrastructure beyond the 4 idempotency tests
done_when: |
  - Stance decided and recorded in ARCHITECTURE.md (or an ADR)
  - CLI behavior matches stance
  - The 4 "Setup Idempotency" tests reflect the decided behavior (either testing
    the rejection contract or genuine idempotency)
  - User docs (README, planning-guide if relevant) updated
---

# Decide stance on `safeword setup` idempotency

**Goal:** Resolve the ambiguity: is `safeword setup` supposed to be idempotent, or is `upgrade` the only re-run path? Pick one and align CLI + tests + docs.

**Why:** Ticket 152's `setupOrThrow` surfaced that 4 "Setup Idempotency" tests were silently asserting the wrong thing — they ran setup twice expecting success, but the second call was failing with "Already configured" and being swallowed. The tests were passing on file state alone. Either the tests are wrong (and `setup` deliberately rejects re-run, in which case the tests should test for that) or the CLI is wrong (and `setup` should be idempotent). Both can't be right.

## Work Log

- 2026-05-18T05:26:00Z Started: ticket created from 152 audit follow-up
