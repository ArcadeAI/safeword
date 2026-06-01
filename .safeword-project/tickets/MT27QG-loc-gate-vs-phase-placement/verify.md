# Verify — MT27QG (git-operation-aware LOC gate)

## Verify Checklist

**Test Suite:** ✓ 2358/2358 tests pass (1 skipped) — full `bun run test` (146 files); +8 from this ticket (6 detector `git-operation` + 2 integration `loc-gate-merge`). The subsequent un-export refactor is behavior-preserving (detector 6/6 + typecheck).
**Build:** ✅ Success (`bun run build`)
**Lint:** ✅ Clean (`eslint src tests`)
**Scenarios:** All 8 scenarios marked complete (RED 999be3ed / GREEN 5795409f across AC1–AC2; cross-scenario refactor skipped)
**Dep Drift:** ✅ Clean — no dependencies added (detector imports only `node:*`)
**Parent Epic:** M7AZY3 (workflow-gate-hygiene) — siblings: 1GGD28 done, 2JMQMX done (3/3 with MT27QG)

## Audit

- **Decision recorded:** KEEP the LOC trigger (phase-agnostic coverage), not relocate to phase/step — the un-phased majority has no step boundary; the TDD ledger already gates the phased path.
- **Dead code:** `isGitOperationInProgress` used by both hook copies + test; `OPERATION_MARKERS` was exported-but-internal → un-exported (commit 477ad4ea).
- **Duplication:** 0 clones (jscpd) across the new lib + tests.
- **Architecture:** `lib/git-operation.ts` is a leaf — imports only `node:child_process`/`fs`/`path`; consumed by post-tool + pre-tool as a guard.
- **Test quality:** 6 detector scenarios assert true/false against real markers in isolated temp repos; 2 integration tests assert the armed/not-armed state with a real >400-LOC change ± a MERGE_HEAD marker; not-a-repo case proves no-throw.

Audit passed.

## Done-when evidence

- `isGitOperationInProgress` returns true under merge/rebase/cherry-pick/revert markers, false otherwise (incl. non-repo). ✓
- The LOC gate does not arm or block during a git operation (integration: >400 LOC + MERGE_HEAD → gate not 'loc'); with no operation, >400 LOC still arms (integration + existing quality-gates suite green). ✓
- Template + installed hook copies in sync (parity check green); new lib registered in schema.ts.

**Next:** mark MT27QG done; close the M7AZY3 epic (3/3 children done + #178 triage + overwrite-check recorded).
