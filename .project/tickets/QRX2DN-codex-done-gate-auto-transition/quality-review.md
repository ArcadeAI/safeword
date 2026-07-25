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

## 2026-07-25 Desktop fallback re-review

**Currency:** ✓ No dependency was added or changed. The use of inherited
process environment is stable Node behavior.

**Sources:** ✓ Node documents `process.env` as the child process environment
interface; the Codex-specific durable identity contract is implemented by the
project's shared `resolveRunIdentity` helper and its current #1411 regression
tests.

**Correct:** ✓ Codex PostToolUse now resolves the same runtime-scoped identity
as Codex Stop. When Desktop omits `session_id`, both address the
`CODEX_THREAD_ID` state key; when a hook supplies `session_id`, it remains the
precedence-preserving key.

**Elegant:** ✓ The state writer has one narrowly scoped Codex branch. Cursor
and Claude retain their existing translated raw-id paths.

**No-bloat:** ✓ No new helper, state format, or adapter interface was added.

**Wiring:** ✓ The real filesystem/subprocess integration test runs Codex
PostToolUse with an omitted payload id and then runs Codex Stop. It asserts the
persisted binding and the observable ticket transition; no internal collaborator
is mocked.

**Verdict:** APPROVE

**Critical issues:** None

**Suggested improvements:** None

**Provenance:**

- (verified: https://nodejs.org/api/process.html) — `process.env` provides the
  process environment used by the spawned hook.
- (verified: `packages/cli/tests/integration/codex-stop-retro.test.ts`) — the
  Desktop fallback contract is exercised through both deployed Codex adapters.

**Next:** Run the ticket verification lane and wait for refreshed PR CI.
