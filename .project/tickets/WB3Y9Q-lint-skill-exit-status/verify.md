## Verify Checklist

**Test Suite:** ✓ The focused real-process contract passes all 10 checks; the
full suite passes 377 files and 5,649 tests (5 expected skips).

**Gherkin:** ✓ 499 scenarios and 15,444 steps passed (3 scenarios and 4 steps
skipped by suite tags).

**Build:** ✓ The verify gate rebuilt the CLI successfully before its test suite.

**Lint:** ✓ Repository lint/typecheck, Prettier, and Markdown lint passed.

**Scenarios:** ✓ Both ticket test-definition scenarios have RED, GREEN, and
REFACTOR evidence.

**PR Scope:** ✓ The diff is limited to the optional-Go condition, synchronized
installed surfaces, its contract test, and ticket evidence.

**Dep Drift:** ✓ No dependency changes.

**Parent Epic:** N/A.

**Reconcile:** ✓ `bun scripts/parity-check.ts` reports all 200 pairs and 8
contracts in sync.

**Experience:** ⏭️ N/A — this is internal lint-workflow guidance.

**Evidence limits:** None. Temporary git-repository preflight succeeded, so the
full git-backed integration suite is valid local evidence.

Audit passed — diff-scoped audit found no architecture, configuration,
dependency, domain-document, or code-quality findings. Quality review approved
the completed change with no critical or suggested improvements.

**Next:** Commit the verification artifacts and offer the branch for delivery;
keep #1701 open and the ticket in `verify` / `in_progress` until the user
confirms delivery.
