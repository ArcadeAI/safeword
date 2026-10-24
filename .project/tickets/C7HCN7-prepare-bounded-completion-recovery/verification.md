# Planning verification

## Current source characterization

Source baseline: f211c4c30fdb40e7fc5f342eaf981143c750db7b. Branch:
codex/t3e4ns-recovery-plan. No production, template, shared gate, original ticket
or qualification input changed.

The installed Gherkin parser/compiler and inventory.mjs produced 14 scenario
blocks, 37 compiled cases, 42 unchecked R/G/R entries and one unchecked
cross-scenario entry. All scenario names match the ledger and declared proof map.
All 33 historical deferred objects and their owner totals match immutable
recovery commit d593765c059a5d9ed975fbd1b9d4f1b55222fdca. A second inventory run
was byte-identical. This checks the inventory, not execution or certification.

One focused Vitest process ran through the pinned launcher from packages/cli:

```sh
../../scripts/dev bun run test \
  tests/bdd-proof-tags.test.ts \
  tests/integration/planning-scope-review.test.ts \
  tests/integration/planning-evidence-boundary.test.ts \
  tests/integration/installed-planning-copy-admission.test.ts \
  tests/integration/execution-upstream-planning-context.test.ts \
  tests/integration/planning-review-route-order.test.ts \
  tests/integration/execution-plan-checkpoint.test.ts \
  tests/review/execution-plan-conformance.test.ts \
  tests/review/execution-plan-contract-identity.test.ts \
  tests/claude-plugin/catalogue.test.ts \
  tests/codex-plugin-version.test.ts \
  tests/integration/planning-documentation.test.ts \
  --reporter=json \
  --outputFile=../../.project/tickets/C7HCN7-prepare-bounded-completion-recovery/evidence/current-proof-tests.json
```

Result: exit 0; 257 tests passed, zero failed/pending, 12 files. That includes
52 registration/proof-map tests and 205 tests in the 11 mapped files. Complete
assertion-level JSON and build/test log are retained under evidence/.

The first preparation command used the package working directory for a
root-relative copy and failed before Vitest started. Only its empty directories
were removed. The corrected invocation above is the sole Vitest process; no
tests, assertions or toolchain pins were changed to obtain its result.

## Evidence limits

This is current characterization of unchanged behavior. These 257 tests are
not 257 recovery cases; the target has 37 compiled cases. No authenticated
recovery observation, independent typed certificate, historical RED, completion
receipt, live qualification or installed-host closing is claimed. Full suite,
release checks, fresh CI and paid qualification were not run for this planning
task. The future production change requires its own final verification.

The inventory's substring check merely confirms that declared titles still
exist. The normal proof-map gate supplies stronger registration checks. Neither
substitutes for the semantic case-to-assertion certification proposed in the plan.

## Review and coordination

The proposal and proof map were submitted to the existing quality-review
coordinator with the current delivery spec, closure blocker, exact inventory,
CKWE2D restriction and project principles as context. Actual result and assurance
level are retained in evidence/plan-review.json when terminal. A pending review
is not an approval.

Both review passes are now terminal approved, with no errors. Final review:
1166e6bf-6c97-42c1-b538-a8a678153c80, actual reviewer Claude, reported model opus,
typed cross-agent independence. Its remaining nonblocking warnings are answered
in review-responses.md. No exact serving-model identity or recovery certificate
is inferred. The reviewed proposal/map bytes were not edited afterward.

The ownership split was sent to 1AHFZS's existing chat. The proposal reserves
branch coverage/freshness for that feature and leaves recovery closing
integration separate. Confirmation is pending; no shared files were edited on
its branch and no agreement is claimed from message delivery alone.

At the latest read, 1AHFZS's chat reports a separate implementation blocker:
the repository CLI accepts its plan review, while the trusted installed 1.2.0
runtime calls it stale. Its supported migration attempt made no change, and it
did not advance the plan gate. This is that chat's reported observation, not a
new reproduction here. No shared runtime repair is imported into this task.

Final static checks pass: all preserved source hashes still match, all 14 map
rows sum to 37 cases, the inventory reproduces byte-for-byte, tracked main files
are unchanged, diff whitespace is clean and all six authored files pass Prettier.
Two full proposal review rounds completed; warnings are preserved and answered.
The planning artifacts remain local on codex/t3e4ns-recovery-plan. No original
ticket or this task has been marked done; no PR, merge or deployment is claimed.
