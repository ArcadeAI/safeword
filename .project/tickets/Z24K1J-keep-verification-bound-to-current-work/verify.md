# Verification: Keep verification bound to the current work

## Verify Checklist

**Test Suite:** ✓ 7,651/7,651 tests pass across relay and CLI (167 relay + 7,484 CLI); 6 intentional skips.
**Gherkin:** ✅ Acceptance lane passes — 1,467 scenarios (1,464 passed, 3 skipped) and 64,330 steps (64,326 passed, 4 skipped).
**Build:** ✅ Success — relay and CLI production builds completed.
**Lint:** ✅ Clean — ESLint, Prettier, Gherkin lint, parity, and both TypeScript typechecks pass.
**Scenarios:** All 28 resolver and installed-surface scenarios marked complete.
**PR Scope:** ✅ Diff matches ticket scope: current-work ticket resolution, verification failure aggregation, generated host surfaces, regression proof, and the BDD proof-tag correction exposed by full verification.
**Dep Drift:** ✅ Clean — no dependency changes; `bun audit` reports no vulnerabilities.
**Parent Epic:** N/A
**Reconcile:** ✅ Canonical templates, dogfood copies, Claude plugin, and Codex plugin are regenerated; 254 pairs and 8 contracts are synchronized.
**Experience:** ⏭️ N/A — internal verification plumbing.
**Surface Evidence:** ✅ All affected command, helper, generated-host, and installed surfaces have recorded proof.
**Evidence limits:** The proof-heavy retry-safe retro-relay feature is intentionally excluded from contributor Cucumber because its adapter launches nested Vitest. Its executable assertions remain in the full green Vitest lane and its provenance is enforced by `bdd-proof-tags.test.ts`.

Audit passed for this ticket: configuration is healthy, dependency boundaries are clean, and changed learning/domain documentation checks emit no ticket-specific finding. The repository-wide principle checker still reports one pre-existing trace in unrelated ticket `0XZAYA`.

## Surface Evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Canonical verify workflow | `packages/cli/tests/verify-skill.test.ts` | Resolves current-work tickets and preserves the first failed verification lane |
| Resolver helper | `packages/cli/tests/hooks/resolve-verify-ticket.test.ts` | Real Git/session fixtures cover committed, staged, unstaged, unborn, nested-root, stale, ambiguous, explicit, and missing-base behavior |
| Installed helper | `packages/cli/tests/smoke/resolve-verify-ticket.test.ts` | Exact template parity plus explicit and committed-branch command smoke proof |
| Claude/Codex/plugin mirrors | parity, schema, and surface tests | 254 pairs and 8 contracts synchronized; generated workflows execute the shared helper |
| Contributor BDD lane | `packages/cli/tests/bdd-proof-tags.test.ts` and full Cucumber lane | Nested-Vitest proof feature is inventoried and excluded; 1,467 scenarios complete without timeout |

## Review, Audit, and Refactor

- **Quality review:** Every finding was applied: relative Git paths below repository roots, stale-session handling, strict unknown-option parsing, fail-closed ambiguity for every distinct changed ticket, hermetic committed-branch smoke coverage, exact installed/template parity, and refreshed evidence.
- **Audit:** Diff-scoped configuration and dependency checks are clean. No ticket-owned learning or domain-doc drift exists. The unrelated `0XZAYA` principle trace was preserved rather than modified.
- **Refactor:** Shared path parsing, changed-ticket filtering, Git path accumulation, and usage text are centralized. The obsolete preexisting-path classification was removed after ambiguity became strictly fail-closed. The ordered Git evidence collector remains cohesive because its failure precedence is behaviorally significant.
- **BDD brittleness:** Real Git fixtures and exact observable outputs make the resolver tests low-brittleness. The full run exposed a separate feature-wide nested-Vitest adapter; adding `@proof.vitest` and manifest coverage removed global-lock timing from contributor BDD without weakening executable proof.

## Authoritative Final Run

- Relay: 167 passed, 1 skipped.
- CLI: 488 files; 7,484 passed, 5 skipped.
- BDD: 1,464 passed, 3 skipped; 64,326 steps passed, 4 skipped.
- Builds: relay and CLI green.
- TypeScript: both workspaces green.
- Dependencies: no vulnerabilities.
- Aggregate command exit: 0.

**Next:** publish the branch update and let PR CI confirm the same snapshot.
