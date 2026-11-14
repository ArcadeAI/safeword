# Completion timeout prerequisite

**Historical first attempt.** Deduplication and diagnostic repairs remain, but
the eight-minute allowance below was insufficient on the loaded host. The
corrected shipping policy is recorded in timeout-final-budget.md; the configured
600-second host budget was not an immutable platform ceiling.

User authorized this bounded prerequisite on 2026-10-17, then retrying the
previously authorized admin merge of PR #5897. Original proof-command behavior,
test filters, scenario corpus, review policy and conservative resolver rules stay
unchanged.

## Diagnosis and change

- A clean passing CLI BDD run took 303.131 seconds. The old per-BDD cap was
  300 seconds; the latest keep-awake completion attempt also failed at that cap.
- The root script placed CLI delegation behind build commands joined by `&&`.
  The resolver correctly retained a separately discovered CLI lane because it
  does not assume arbitrary conditions execute. Moving the same builds into
  root `pretest:bdd` makes root `test:bdd` an explicit unconditional delegation.
  Both required builds still run, fail closed, and precede acceptance.
- BDD now receives 480 seconds, below the unchanged 600-second Codex Stop cap.
  This leaves 120 seconds outside the single BDD command for fast lanes and host
  work. It is not a guarantee for arbitrary larger multi-language workspaces;
  the host's outer bound remains authoritative.
- Pinned Bun 1.3.14 and Node 24.18.1 synchronous timeout probes expose
  `code: ETIMEDOUT` without `killed`. The runner now recognizes that code while
  retaining its existing killed-error handling.
- Failure output is repeated at the end of the bounded report so subsequent
  successful progress does not erase the diagnostic. Existing unavailable-tool
  recovery remains visible. The report remains bounded; it is not a raw log.

Competing explanations and detailed prior evidence are in closure-timeout.md.
No process-tree cleanup redesign or claimed guarantee was added.

## TDD and test scope

Integration tests use the real planner and package-manager lifecycle with marker
programs at the expensive build/BDD boundary. They read the actual root script
definitions, so a future root configuration regression executes BDD twice and
fails the test. Both build-failure branches assert that BDD never executes.

Runner tests use real resolver/subprocess wiring for verbose output and normal
failure cases. Only suite execution is mocked for the long timeout case; the
error is captured from an actual short native synchronous timeout, not a
handwritten approximation of its shape.

- RED 1: 2 failed / 14 passed: old budget and duplicate BDD execution.
- RED 2: 4 failed / 14 passed: added native timeout recognition and diagnostic loss.
- GREEN: 120 CLI tests passed across runner and resolver suites before adding
  the two build-failure characterization cases. Final verification is pending.

Raw development logs: `/tmp/6jarjp-timeout-red-1.log`,
`/tmp/6jarjp-timeout-red-2.log`, `/tmp/6jarjp-timeout-green.log`.

## Quality review plan and current sources

Review execution semantics (pre-script ordering and build failure), bounded
timeout policy (no test omission or widened host timeout), failure diagnosis,
and generated delivery parity. No dependency or version changes are required.

Current primary sources checked on 2026-10-17:

- [Bun runtime scripts](https://bun.com/docs/runtime): pre/post hooks run around
  named scripts; a failed pre-script prevents the main script. The marker tests
  additionally exercise the repository-pinned Bun rather than assuming latest
  documentation matches it.
- [Node 24.18.1 child process docs](https://github.com/nodejs/node/blob/v24.18.1/doc/api/child_process.md):
  synchronous execution times out and waits for child exit after sending its
  kill signal. The native short-timeout test verifies the observed error code.

The original code/profile and semantic-bank reviews remain applicable by
unchanged source bytes. This prerequisite receives its own independent review;
approval does not replace normal closure or fresh exact-head CI.
