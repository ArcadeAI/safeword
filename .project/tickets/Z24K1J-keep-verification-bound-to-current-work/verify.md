# Verification: Keep verification bound to the current work

## Verify Checklist

**Test Suite:** ❌ 36 unrelated shared-worktree failures; 7,588 tests pass and 6 skip across relay + CLI. The focused #2083 lane passes 102/102, and relay passes 167/167 with 1 skipped.
**Gherkin:** ❌ Failed in unrelated active feature work; #2083 uses two inline resolver contracts rather than a Gherkin lane.
**Build:** ✅ Success — relay and CLI package builds completed.
**Lint:** ❌ 1 unrelated Python mypy error (`experiments/python-skill-eval/control/*/solution.py` duplicate module). ESLint, Prettier, and both TypeScript typechecks pass.
**Scenarios:** All 2 inline scenarios marked complete.
**PR Scope:** ✅ #2083 changes match ticket scope — canonical helper/verify skill, generated and dogfood mirrors, schema registration, behavioral/static regression coverage, and ticket evidence. The shared branch also contains unrelated work owned elsewhere.
**Dep Drift:** ✅ Clean — no dependencies changed.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — canonical template remains the source; parity sync and Codex catalogue generation produced the mirrors.
**Experience:** ⏭️ N/A — internal verification plumbing.
**Surface Evidence:** ✅ 5/5 affected surfaces have recorded proof.
**Evidence limits:** ⚠️ The shared dirty checkout contains multiple concurrent tickets. Full-suite, BDD, plugin-integrity, and Python failures are not #2083 product evidence. Clean-branch replay passed relay, parity, formatting, ESLint, builds, and TypeScript typechecks; its focused CLI runner timed out after 20 minutes without starting because another worktree held the global lock, so the 102/102 resolver result comes from the identical caught-up source immediately before isolation.

Audit passed — diff-scoped configuration, dependency boundaries, learnings, principle trace, domain docs, and #2083 test quality have no ticket-specific findings.

## Surface Evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Canonical verify template | `packages/cli/tests/verify-skill.test.ts` | Current-work helper contract passes after both main catch-ups |
| Dogfood Claude verify skill | parity check + focused contract | In sync; resolver contract passes |
| Generated Codex verify skill | catalogue generation + focused contract | Generated; resolver contract passes |
| Installed resolver helper | `packages/cli/tests/hooks/resolve-verify-ticket.test.ts` | Real Git/session fixtures pass for session, diff, conflict, ambiguity, explicit CLI, and unborn-repository behavior |
| Managed-file schema | `packages/cli/tests/schema.test.ts` + parity check | Registered as a non-lifecycle helper; all 253 pairs and 8 contracts are synchronized |

## Review, Audit, and Refactor

- **Quality review:** Re-run after the final main catch-up. Current Git 2.55, Node, and Bun primary documentation supports the merge-base/three-dot, NUL-delimited, unborn-repository, and shell-free subprocess choices. Claude timed out, so the Codex fallback was not independent. It found no #2083 resolver defect and repeated the known pre-existing aggregate-exit issue.
- **Audit:** Re-run at merge base `47ca53037` for the final state. Configuration drift is healthy; dependency-cruiser reports no violations across 459 modules and 832 dependencies; learning, principle-trace, and domain-doc checks emit no findings.
- **Refactor:** Re-scouted after catch-up. The prior extraction already resolved duplicated inline logic, wrong abstraction, and static-only coverage. The remaining Git-selection branches are cohesive and protected by real repositories, so further extraction would add indirection without reducing behavior or duplication.

## Full-suite failures outside ticket scope

The final shared-tree run has 36 failures across five CLI files in active Claude-plugin/review work, plus unrelated BDD failures led by automatic Claude migration. Python mypy also rejects duplicate experiment module names. None of those paths implements or tests current-ticket resolution. The #2083 resolver contract, schema registration, generated surfaces, parity, builds, and TypeScript checks are green.

The authoritative verification shell exited 0 after these earlier failures because its last dependency lane succeeded. This reproduces the previously deferred aggregate-exit defect and is not treated as a green full-suite result.

**Next:** obtain user confirmation before marking ticket Z24K1J done. Track the unrelated verify-lane exit aggregation and Python/typecheck failures with their owning work.
