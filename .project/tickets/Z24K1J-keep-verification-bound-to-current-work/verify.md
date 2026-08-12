# Verification: Keep verification bound to the current work

## Verify Checklist

**Test Suite:** ✓ 7,651/7,651 tests pass across relay and CLI (167 relay + 7,484 CLI); 6 intentional skips.
**Gherkin:** ✅ Acceptance lane passes — 1,467 scenarios (1,464 passed, 3 skipped) and 64,330 steps (64,326 passed, 4 skipped).
**Build:** ✅ Success — relay and CLI production builds completed.
**Lint:** ✅ Clean — ESLint, Prettier, Gherkin lint, parity, and both TypeScript typechecks pass.
**Scenarios:** Resolver, installed-surface, and retry-safe relay proof scenarios are complete.
**PR Scope:** ✅ Diff matches ticket scope: current-work ticket resolution, verification failure aggregation, generated host surfaces, regression proof, and the BDD proof-tag correction exposed by full verification.
**Dep Drift:** ✅ Clean — no dependency changes; `bun audit` reports no vulnerabilities.
**Parent Epic:** N/A
**Reconcile:** ✅ Canonical templates, dogfood copies, Claude plugin, and Codex plugin are regenerated; 254 pairs and 8 contracts are synchronized.
**Experience:** ⏭️ N/A — internal verification plumbing.
**Surface Evidence:** ✅ Canonical helpers and checked-in Claude, Codex, and Cursor instruction chains have executable boundary proof; generated copies have parity proof.
**Evidence limits:** ⚠️ The local smoke suite does not launch the Claude, Codex, or Cursor applications themselves. It follows each checked-in host instruction chain and executes the installed helper with its real dependency graph. Separate relay integration tests execute all six harness adapters plus the compiled process, SQLite, HTTP authentication, and GitHub boundary.

Audit passed for this ticket: configuration is healthy, dependency boundaries are clean, and learning, principle-trace, and domain-documentation checks emit no finding.

## Surface Evidence

| Affected surface            | Proof                                                              | Result                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical verify workflow   | `packages/cli/tests/verify-skill.test.ts`                          | Resolves current-work tickets and preserves the first failed verification lane                                                          |
| Resolver helper             | `packages/cli/tests/hooks/resolve-verify-ticket.test.ts`           | Real Git/session fixtures cover committed, staged, unstaged, unborn, nested-root, stale, ambiguous, explicit, and missing-base behavior |
| Installed helper            | `packages/cli/tests/smoke/resolve-verify-ticket.test.ts`           | Exact template parity plus explicit and committed-branch command smoke proof                                                            |
| Claude/Codex/Cursor instructions | `packages/cli/tests/smoke/resolve-verify-ticket.test.ts`       | Each checked-in instruction chain resolves and executes the installed helper; host applications are outside local-test scope            |
| Generated mirrors               | parity and schema tests                                             | 254 pairs and 8 contracts synchronized                                                                                                  |
| Retry-safe relay BDD proof      | `bun run test:bdd:proof`                                             | Every scenario owns a unique Vitest selector; the dedicated lane executes each selector outside the contributor Vitest process           |
| Contributor BDD lane            | `packages/cli/tests/bdd-proof-tags.test.ts` and full Cucumber lane   | Proof registration loads without nested Vitest; ordinary contributor scenarios remain isolated from global test-lock contention          |

## Review, Audit, and Refactor

- **Quality review:** Every finding was applied: relative Git paths below repository roots, stale-session handling, strict unknown-option parsing, fail-closed ambiguity (including deleted ticket evidence), executable host instruction-chain smoke coverage, unique executable BDD proof selectors, exact installed/template parity, and bounded evidence claims.
- **Audit:** Diff-scoped configuration and dependency checks are clean. No ticket-owned learning or domain-doc drift exists. The unrelated `0XZAYA` principle trace was preserved rather than modified.
- **Refactor:** Shared path parsing, changed-ticket filtering, Git path accumulation, and usage text are centralized. The obsolete preexisting-path classification was removed after ambiguity became strictly fail-closed. The ordered Git evidence collector remains cohesive because its failure precedence is behaviorally significant.
- **BDD brittleness:** Real Git fixtures and observable outputs keep the resolver tests low-brittleness. The proof-heavy relay feature is isolated from contributor Vitest lock contention, while `test:bdd:proof` executes every unique scenario selector with a fresh temporary runtime. Registry validation fails on missing scenarios, duplicate selectors, missing files, and stale source patterns.

## Authoritative Final Run

- Relay: 167 passed, 1 skipped.
- CLI: 488 files; 7,484 passed, 5 skipped.
- BDD: 1,464 passed, 3 skipped; 64,326 steps passed, 4 skipped.
- Builds: relay and CLI green.
- TypeScript: both workspaces green.
- Dependencies: no vulnerabilities.
- Aggregate command exit: 0.

**Next:** publish the branch update and let PR CI confirm the same snapshot.
