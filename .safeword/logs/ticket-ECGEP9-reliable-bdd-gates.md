# Work Log: Keep behavior tests reliable for contributors

**Anchored to:** `.project/tickets/ECGEP9-reliable-bdd-gates/ticket.md`

## Session: 2026-08-11

- Audited 91 feature files, 1,721 scenarios, and 6,596 step lines; structural Gherkin lint passed.
- Found an observable proof gap: the local command-override Then step claims project and personal configuration remain unchanged but never compares a before/after snapshot.
- Observed the full Cucumber lane time out in both Node matrix jobs after package and physical-install tests passed.
- Decision: retain package coverage on both Node versions, run the identical Cucumber lane on one matrix entry, and enforce that assignment with a workflow contract test.
- Decision: replace `@wip` used solely for Vitest-proven contracts with an explicit `@proof.vitest` exclusion; leave genuine unfinished `@wip` unchanged.
- RED: `bun run test packages/cli/tests/ci-bdd-workflow.test.ts packages/cli/tests/cucumber-config.test.ts packages/cli/tests/bdd-proof-tags.test.ts` failed with 16 intended assertions: the CI lane had no single-matrix guard, Cucumber did not exclude `@proof.vitest`, and 14 separately proven features still claimed `@wip`.
- GREEN: the three focused Vitest contract files pass 28/28 assertions; the command-override Cucumber feature passes 28/28 scenarios and 1,204/1,204 steps; `bun run lint:gherkin` reports Healthy/unchanged; `git diff --check` is clean.
- Follow-up: filed GitHub issue #2583 to split the 1,646-line offload specification along its 16 existing Rule boundaries, preserving this branch's narrow reliability/provenance scope.
- Verification: repository lint and typecheck pass; dependency audit reports no vulnerabilities; Claude plugin release contract is aligned at 0.75.0; proof provenance now requires an exact existing test-file pointer for every `@proof.vitest` feature.
- CI repair: Node 22 and Node 24 exposed the shipped-template revision guard. Registered the new Cucumber template SHA-256 so Safeword continues recognizing and maintaining its own scaffold instead of misclassifying it as a customer harness.
