---
id: 87ST55
slug: refactor-post-release-code
type: task
phase: done
status: done
created: 2026-09-10T16:54:47.144Z
last_modified: 2026-09-10T18:14:38Z
---

# Simplify code added since v0.83.1

**Goal:** Remove concrete maintainability problems from hand-written code added or changed since v0.83.1 without changing behavior.

**Why:** The release range is large and deserves a bounded, evidence-led cleanup before more features accumulate around it.

## Scope

- Review every hand-written source file changed between `v0.83.1` and merged main.
- Apply only concrete, behavior-preserving simplifications supported by existing focused tests.
- Keep each refactor in its own tested commit.

## Out of scope

- Generated plugin mirrors, fixtures, and test rewrites.
- New behavior, public API changes, dependency upgrades, or speculative architecture work.
- Splitting safety-critical orchestration merely to satisfy a line-count metric.

## Done when

- Every scout candidate is either committed with focused green tests or explicitly deferred with a concrete reason.
- Lint and the relevant package tests pass on the final tree.
- A final release-range audit finds no additional low-risk refactor worth making now.

## Failure modes considered

- Extracting helpers can silently change ordering, deadlines, cleanup, or error classification.
- Treating generated or test code as production targets would create churn without user value.
- Mechanical size warnings can encourage fragmented code where ordered orchestration is clearer.

## Open questions

- None. Scope, exclusions, and completion evidence are fixed above.

## Work Log

- 2026-09-10T16:54:47.144Z Started: Created ticket 87ST55
- 2026-09-10 Scout scope: `v0.83.1..71fd68a46`, limited to 105 changed hand-written TypeScript files; generated Codex mirrors, fixtures, and tests are evidence rather than refactor targets.
- 2026-09-10 Mechanical scan: current project lint/CI is green; stricter release-range scan found several long orchestration functions requiring semantic review. A suppression warning was rejected after confirming it appeared only under an overridden threshold and the project rule still requires the suppression.
- 2026-09-10 Refactored duplicated review failure envelopes and degraded-route evidence, shared relay recovery scanning, and removed or narrowed five unused internal symbols. Each change was committed separately after its focused tests passed.
- 2026-09-10 Verification: repository lint, Gherkin lint, and TypeScript typecheck passed. Focused suites passed for review wiring and degradation (117), relay integration (77), review policy (11), preferences (31), Claude state location (13), and the Codex catalogue. The paired OpenCode catalogue run could not install its isolated fixture dependencies; that environment failure did not affect the Codex assertion or the final build/typecheck.
- 2026-09-10 Final audit: dependency-cruiser reported zero violations across 703 modules and 1,383 dependencies. A release-range duplication scan covered 85 changed hand-written TypeScript files and found zero clones. Knip's remaining findings are pre-release tooling, test, experiment, or intentionally exported API entries and are outside this bounded refactor.
- 2026-09-10 Full verification: 9,969 executed tests pass with 17 intentional skips. The only initial unit and acceptance failures identified stale generated plugin runtimes; regenerating the Codex and Claude mirrors fixed the 18-test release contract and all three affected acceptance scenarios (135 steps). All builds, lint, typecheck, and dependency audits pass after restoring a lockfile-pinned native website package locally without changing manifests.
- 2026-09-10 Independent quality review: Claude found no error-severity defect in the canonical source diff and approved shipping. Its suggestions concern pre-existing behavior outside this ticket's changed hunks, so they were deferred rather than expanding a behavior-preserving refactor.

## Refactor ledger

- [x] Rejected removing the `complexity` suppression: the warning came from overriding the configured threshold from 10 to 12; the project lint correctly requires it at the real threshold.
- [x] Centralized detached-review worker failure construction (`59a3c5aa9`).
- [x] Centralized degraded review route evidence (`c52ff3d7e`). The remaining long review functions preserve ordered lifecycle, ownership, and cleanup boundaries; splitting them would add indirection without removing duplication.
- [x] Shared relay recovery scan preparation (`b5a520b0f`). The remaining retro and relay entry points are transaction/composition orchestration whose ordering is part of the safety contract.
- [x] Confirmed the split CLI protocol handlers contain no clone at the configured 14-line threshold.
- [x] Removed obsolete review route-pair helpers (`44104818e`), an unused Claude state fallback (`e7a93bc2f`), an unused Codex runtime adapter (`8929fe9af`), and an unused review route-source type (`fc1478ffa`); narrowed two config helpers to module scope (`9baf57291`).
- [x] Completed the final release-range audit with zero dependency violations, zero clones, green lint/typecheck, and no additional low-risk refactor worth making now.
