# Work Log: Keep package tests serialized after lock waits

**Anchored to:** `.project/tickets/72WMQ5-keep-package-tests-serialized/ticket.md`

---

## Session: 2026-08-07

- [09:10] Revalidated reported issue #2182 on current `origin/main` (`47e106731`): its former failing relay scenario passes through the canonical BDD command in 6.3 seconds; #2182 is already fixed by merged PR #2110.
- [09:10] Investigated current test-lock contract and related open issues. `run-vitest-with-build-lock.mjs` intentionally proceeds without the global lock after the configurable 20-minute cap, which directly violates the repository's one-Vitest invariant (#2074). A separate FIFO starvation issue remains tracked as #2200.
- [09:10] Decision: make capped lock acquisition fail with owner diagnostics rather than run unprotected. This is the smallest repair that restores the invariant without introducing a cross-process queue protocol.
- [09:20] Wrote the regression first: the capped-lock path previously returned success and invoked build/Vitest. Updated the runner to exit 1 without invoking either command, then updated the integration contract. Focused lock coverage passed 11/11.
- [09:20] Quality-review invocation recorded. Checked the changed code against current Node child-process and Bun test documentation; no dependency or security change is involved. Independent review was requested through the Safeword coordinator.
- [10:00] Diff-scoped audit passed: dependency-cruiser found no violations; no changed agent-config, learning, domain-doc, documentation, or principle-trace issue was found. The updated lock tests use real child processes and fake executable boundaries, asserting the observable exit/error and that neither build nor Vitest started.
- [10:00] Static verification passed: lint, formatting, build, TypeScript typecheck, and `bun audit` (no vulnerabilities). Focused lock coverage is green (11/11). The full Vitest suite had three current-baseline failures (one Cucumber fixture config and two real-git timeouts); the direct BDD lane was stopped after an external worktree held the global test lease, causing its nested proof test to time out. The ticket's targeted BDD scenario had already passed on current main (1 scenario, 43 steps, 6.3 seconds).
