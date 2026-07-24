# Quality review: Close Codex tickets when evidence passes

## Verdict

**APPROVE for a draft PR.** The change is small, correctly sequenced, and
covered by real adapter tests. It must remain an in-progress feature ticket
until a Codex session with a run identity logs the required skill proofs.

## Findings

- **Correctness:** The Stop hook only considers the session-bound ticket, uses
  the shared `evaluateDoneEvidence` predicate, and writes `done` only after
  successful evidence. Failed evidence returns its remediation continuation
  before architecture or filing advice.
- **Ordering:** Retro extraction remains before transition. Architecture advice
  is calculated before mutation and is returned before retro filing after a
  successful transition. The global advisory-only fallback remains unchanged.
- **Ownership:** No hook Git staging, commit, PR, or issue-close behavior was
  added. The focused test proves the transition changes only ticket state.
- **Wiring:** Both the shipped template and dogfood hook were changed together;
  real subprocess/filesystem fixtures cover the adapter instead of a mocked
  reimplementation.
- **Documentation:** The README and website reference pages were corrected to
  describe evidence-gated Codex Stop completion and its deliberate lack of Git
  ownership.
- **Refactor:** No behavior-preserving extraction is warranted: the helper is
  a deliberately linear sequencing operation, and template/dogfood duplication
  is the repository's managed parity model.

## Currency check

The implementation uses stable Node `child_process` behavior and does not
introduce runtime API assumptions beyond the project baseline. Sources checked:

- https://nodejs.org/docs/latest/api/child_process.html
- https://bun.sh/docs/runtime/bun-apis
- https://git-scm.com/docs/githooks

## Evidence

- `bun run lint` — pass
- `bun run format:check` — pass
- `bun scripts/parity-check.ts --mode=all` — pass (192 pairs, 8 contracts)
- `bun run test tests/integration/codex-stop-retro.test.ts` — pass (30 tests)
- `bun run test tests/parity.test.ts` — pass (25 tests)

The feature-gate invocation helper reported `no run identity` in this Codex
desktop session. This report is not a substitute for its signed current-run
proof, and the ticket was intentionally not moved to `done`.
