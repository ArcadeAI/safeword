# Verification: Closeout preview and apply convergence

Verified on 2026-08-12 against `origin/main` at `077e50b4d`.

## Acceptance evidence

**PR Scope:** ✅ The diff is limited to closeout transcript convergence, exact Codex task ownership, authenticated retro-filer fallback, generated host parity, and their ticket/BDD evidence for #2431, #1852, and #1826; #1942 remains a verification-only regression contract.

| Contract | Evidence | Result |
| --- | --- | --- |
| Bounded, reusable transcript evidence | `packages/cli/tests/closeout-cleanup.test.ts` | Pass |
| Exact current-task binding and bootstrap recovery | `packages/cli/tests/closeout-cleanup.test.ts` | Pass |
| Authenticated cross-worktree filing and acknowledgement-gated drain | `packages/cli/tests/hooks/retro-filing.test.ts` | Pass |
| Repository and cleanup-target drift fails closed | `packages/cli/tests/closeout-cleanup.test.ts` | Pass |
| Vitest-backed BDD provenance | `packages/cli/tests/bdd-proof-tags.test.ts` | Pass |
| Claude/Codex generated assets and release contracts | generator `--check` commands and Claude plugin release check | Pass |

Focused changed-scope verification passed: 3 files, 121 tests. Every one of the 27 BDD scenarios now has an exact test-file and test-name mapping in `bdd-proof.json`; the proof gate rejects missing scenarios, stale scenario names, missing files, and missing named tests.

Additional boundary proof covers transcript content appended while extraction is running, Codex repository ownership across a real linked worktree versus a separate clone, and byte-preserving rejection of noncanonical fallback spool paths.

The repository-wide run reached 7,516 passing tests (9 skipped) and 1,517 passing BDD scenarios (3 skipped). Its remaining failures reproduce in unchanged review-process tests under this host because reviewer capability probes time out before their fixtures execute; they are outside this ticket's diff and contract. `bun audit` also could not reach the registry audit service (`ConnectionRefused`). Build and both package typechecks passed.

## Persona walk

- NTB: the same merged task can report preview, append transcript progress, reuse or advance bounded retrospective evidence, and apply unchanged cleanup targets.
- TBU: transcript prefix mutation, ambiguous identity, unauthenticated spool selection, and cleanup-target drift remain blocking; acknowledged drafts drain without touching unrelated spools.

## Audit

Audit passed after adding the Closeout Cleanup Guard and Retro Filer surface documentation: 0 errors and 0 warnings. Principle trace, Gherkin lint, ESLint, formatting, and diff whitespace checks passed.

Issue #1942 was not reproduced: the authenticated fallback filed and drained the continuation-named spool across a different worktree/session while preserving unrelated spools. It remains closed.
