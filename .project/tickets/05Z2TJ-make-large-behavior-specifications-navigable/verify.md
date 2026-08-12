# Verification: Make large behavior specifications navigable for maintainers

Verified on the merged branch at `origin/main` commit `03b7a49bb` plus this ticket's changes.

## Verify Checklist

**Test Suite:** ✅ Applicable proof passes: 8/8 focused CLI tests and 167/167 retro-relay tests (1 intentional skip).
**Gherkin:** ✅ `project lint-gherkin` reports healthy; all 16 split files parse and retain `@wip`.
**Build:** ✅ CLI and retro-relay ESM/DTS builds succeed.
**Lint:** ✅ Focused ESLint, full Prettier, and CLI TypeScript typecheck are clean.
**Scenarios:** All 0 ticket scenarios marked complete — this task has no `test-definitions.md`; its executable contract is the preservation test.
**PR Scope:** ✅ The diff contains only the ticket/log, the Rule-aligned feature split, and its maintainability regression test.
**Dep Drift:** ✅ No dependencies changed; `bun audit` reports no vulnerabilities.
**Parent Epic:** N/A — standalone GitHub issue #2583.
**Reconcile:** ✅ No pattern deviation — executable feature discovery reuses the production `collectExecutableFeatureFiles` resolver.
**Experience:** N/A — internal maintainer navigation refactor with no user-visible runtime behavior.
**Surface Evidence:** ✅ 2/2 affected maintainer surfaces have recorded proof.
**Evidence limits:** ⚠️ The prescribed broad repository lanes completed but were not globally green because of environment/concurrency failures unrelated to this diff; details below.

Audit passed — no errors or warnings attributable to the diff. Dependency-cruiser found no violations, configuration reconciliation was healthy, and manual test-quality review found no behavior loss.

## Surface evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Offload behavior specifications | Immutable baseline comparison against pre-split commit `1f8056ed8`: 16 Rule bodies, 134 declarations, 79 Examples blocks, and 624 expanded cases | Passed |
| Repository BDD maintainability | Shared feature resolver, 1,000-line high-water guard, fail-closed reviewed exceptions, unique Feature/header checks | Passed |

## Verification evidence

- `bun run test tests/bdd-feature-maintainability.test.ts tests/utils/feature-source.test.ts` — CLI 8/8 passed; retro-relay 167 passed, 1 skipped.
- `bun run lint:gherkin` — healthy, unchanged.
- Focused ESLint and full Prettier — clean.
- `bun run --cwd packages/cli typecheck` — passed.
- `bun run build` — CLI and retro-relay builds passed.
- `bun audit` — no vulnerabilities.
- Independent quality-review coordinator — approved with no remaining findings. The preferred Claude reviewer timed out; the completed review came from a separate headless Codex reviewer, so reviewer provenance was degraded but independence was retained.

## Broad-lane limits

The complete verification script was allowed to finish instead of being stopped at the first failure:

- Full CLI Vitest: 476 files and 7,490 tests passed; 12 files/15 tests failed. Failures were in unrelated setup, generated-project, Codex activation, and review-runner tests. Evidence included `ENOTFOUND registry.npmjs.org`, test/hook timeouts under contention, resolver processes unable to find a review-capable CLI, and temporary generated dependency corruption. No failure referenced an offload feature or `bdd-feature-maintainability.test.ts`.
- Full Cucumber: 1,497 scenarios and 66,487 steps passed; 17 scenarios/steps failed. Failures were unrelated package-install DNS failures, multi-minute shared-machine timeouts, review-runner state, and a concurrent `dist` cleanup/rebuild race that temporarily removed a CLI chunk. The subsequent serialized CLI build and focused post-merge proof passed.
- The first audit request failed with a network refusal; the post-merge retry succeeded and found no vulnerabilities.

These limits prevent claiming the whole repository was green on this shared machine. They do not weaken the exact behavioral preservation proof for this refactor.
