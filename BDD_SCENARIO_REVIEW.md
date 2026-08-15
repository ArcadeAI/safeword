# BDD Scenario Review

**Status:** Structural and lineage review complete; per-scenario semantic review in progress.

## Scope and method

This report inventories every shipped BDD scenario in `features/` and `packages/cli/features/`. Each scenario was checked for valid Gherkin structure, exactly one `When`, at least one `Then`, and inclusion state (active, `@manual`, or `@wip`). The active Cucumber lane and parser-backed Gherkin lint were also run.

A structural review is not an assertion that every scenario has independently passed the full adversarial semantic rubric. The remaining semantic review applies the vacuous-pass test, AODI, determinism, negative-case, boundary, failure, security, invariant-binding, and end-to-end wiring checks scenario by scenario.

### Upstream sync impact — 2026-08-12

This ledger was created against the pre-0.76 corpus. The `main` sync replaces the 134-scenario `offload-tests-without-blocking-local-work.feature` with sixteen focused `offload-tests-*.feature` sources containing 136 scenarios, and adds `closeout-preview-apply-convergence.feature` and `run-github-live-smokes-without-waiting-for-builds.feature`. Those eighteen new sources, along with the modified existing feature sources, are pending a refreshed structural inventory and semantic review; no historical ledger row is treated as evidence for a new or materially changed scenario.

| New or replaced feature source                                                    | Scenarios | Delivery state                    | Semantic status                                               |
| --------------------------------------------------------------------------------- | --------: | --------------------------------- | ------------------------------------------------------------- |
| `features/closeout-preview-apply-convergence.feature`                             |        26 | Active, `@proof.vitest`           | Direct review complete; independent evidence pending          |
| `packages/cli/features/run-github-live-smokes-without-waiting-for-builds.feature` |         2 | Active, `@wip`                    | Direct review complete; implementation proof pending          |
| `packages/cli/features/offload-tests-authoritative-remote-conclusions.feature`    |         3 | `@wip`                            | Pending — specification only                                  |
| `packages/cli/features/offload-tests-authoritative-remote-results.feature`        |        15 | `@wip`, 2 `@proof.pending-vitest` | Pending — specification only                                  |
| `packages/cli/features/offload-tests-clean-revision-dispatch.feature`             |         6 | `@wip`                            | Pending — specification only                                  |
| `packages/cli/features/offload-tests-clear-request-status.feature`                |         2 | `@wip`                            | Pending — specification only                                  |
| `packages/cli/features/offload-tests-indeterminate-dispatch-recovery.feature`     |         2 | `@wip`                            | Pending — specification only                                  |
| `packages/cli/features/offload-tests-invalid-request-rejection.feature`           |         2 | `@wip`                            | Pending — specification only                                  |
| `packages/cli/features/offload-tests-local-fallback-checkout-consistency.feature` |         7 | `@wip`                            | Pending — specification only                                  |
| `packages/cli/features/offload-tests-project-opt-in.feature`                      |        18 | `@wip`, 1 `@proof.pending-vitest` | Pending — specification only                                  |
| `packages/cli/features/offload-tests-proven-local-fallback.feature`               |         7 | `@wip`                            | Pending — specification only                                  |
| `packages/cli/features/offload-tests-remote-revalidation.feature`                 |         7 | `@wip`, 1 `@proof.pending-vitest` | Pending — specification only                                  |
| `packages/cli/features/offload-tests-resumable-requests.feature`                  |        17 | `@wip`, 1 `@proof.pending-vitest` | Pending — specification only                                  |
| `packages/cli/features/offload-tests-trusted-workflow-evidence.feature`           |         9 | `@wip`                            | Direct semantic review complete; implementation proof pending |
| `packages/cli/features/offload-tests-useful-local-recovery.feature`               |         3 | `@wip`                            | Pending — specification only                                  |
| `packages/cli/features/offload-tests-workflow-reconciliation.feature`             |        11 | `@wip`, 1 `@proof.pending-vitest` | Pending — specification only                                  |
| `packages/cli/features/offload-tests-workflow-security.feature`                   |        23 | `@wip`, 2 `@proof.pending-vitest` | Direct semantic review complete; implementation proof pending |
| `packages/cli/features/offload-tests-zero-config-enablement.feature`              |         2 | `@wip`                            | Pending — specification only                                  |

### Upstream sync impact — 2026-08-13 (Safeword 0.77)

The 0.77 merge expands the corpus from 91 to 110 feature sources. Nine sources
were added or materially changed after their prior ledger entry. Their prior
counts and statuses are historical only: this 227-scenario queue must receive a
fresh semantic pass before it inherits any completion claim.

| Changed or new feature source                                  | Scenarios | Delivery state          | Semantic status                               |
| -------------------------------------------------------------- | --------: | ----------------------- | --------------------------------------------- |
| `features/automatic-claude-migration.feature`                  |        30 | Active                  | Pending refreshed review                      |
| `features/close-completed-sessions-safely.feature`             |        48 | Active                  | Pending refreshed review                      |
| `features/generate-compliant-replies-without-rewrites.feature` |        22 | Active; 3 `@manual`     | Pending refreshed review                      |
| `features/native-claude-plugin.feature`                        |        46 | Active; 6 `@wip`        | Pending refreshed review                      |
| `features/safeword-md-via-hooks.feature`                       |         6 | Active                  | Pending refreshed review                      |
| `features/test-codex-plugin-migration.feature`                 |        24 | Active                  | Pending refreshed review                      |
| `packages/cli/features/codex-plugin-hook-parity.feature`       |        17 | Active; 1 `@manual`     | Pending refreshed review                      |
| `packages/cli/features/durable-independent-review.feature`     |         5 | Active; `@proof.vitest` | Independent review returned changes requested |
| `packages/cli/features/predictable-safeword-cli.feature`       |        29 | Active                  | Pending refreshed review                      |

### Upstream sync impact — 2026-08-14 (Safeword 0.78.1)

The merged 0.78.1 corpus contains 111 tracked feature sources. Five sources
were added or materially changed since the prior ledger snapshot; their 171
scenarios are in the refreshed review queue. This overlaps the 0.77 queue where
an existing source changed again.

| Changed or new feature source                                       | Scenarios | Delivery state          | Semantic status          |
| ------------------------------------------------------------------- | --------: | ----------------------- | ------------------------ |
| `features/automatic-claude-migration.feature`                       |        31 | Active                  | Pending refreshed review |
| `features/close-completed-sessions-safely.feature`                  |        48 | Active                  | Pending refreshed review |
| `features/closeout-preview-apply-convergence.feature`               |        27 | Active; `@proof.vitest` | Pending refreshed review |
| `features/resume-closeout-after-upgrade.feature`                    |        54 | Active; `@proof.vitest` | Pending review           |
| `packages/cli/features/reliable-observable-quality-reviews.feature` |        11 | Active; `@proof.vitest` | Pending review           |

## Evidence

- Gherkin lint: passed.
- Corpus structure: every scenario has exactly one `When` and at least one `Then`.
- Active Cucumber lane: passed before this report was created.
- Focused regression evidence after the structural cleanup: 81 scenarios / 3,522 steps passed.

## Remediated structural findings

- `configure-audit-doc-sources.MA2.AC3`: changed the outcome from an `And` attached to `When` to an explicit `Then`.
- Twelve static contract scenarios: introduced explicit validation actions and updated active step bindings where present.

## Review ledger

| Feature file                                                                 | Scenarios | Manual tags | WIP tags | Review status               |
| ---------------------------------------------------------------------------- | --------: | ----------: | -------: | --------------------------- |
| `features/monorepo-coverage-honesty.feature`                                 |         9 |           0 |        0 | Structural review complete  |
| `features/audit-domain-docs-freshness.feature`                               |        15 |           0 |        1 | Structural review complete  |
| `features/sync-tracker.feature`                                              |        21 |           0 |        1 | Structural review complete  |
| `features/close-completed-sessions-safely.feature`                           |        31 |           1 |        0 | Structural review complete  |
| `features/architecture-python-language-pack.feature`                         |         7 |           0 |        0 | Structural review complete  |
| `features/rule-tier.feature`                                                 |        21 |           0 |        0 | Structural review complete  |
| `features/safeword-recovery-through-dependency-readiness.feature`            |         4 |           0 |        0 | Structural review complete  |
| `features/ticket-deps-schema.feature`                                        |        18 |           0 |        1 | Structural review complete  |
| `features/feature-surfaces-bdd.feature`                                      |         7 |           0 |        0 | Structural review complete  |
| `features/architecture-polyglot-monorepo.feature`                            |         2 |           0 |        0 | Structural review complete  |
| `features/choose-claude-plugin-scope.feature`                                |        21 |           0 |        0 | Structural review complete  |
| `features/phase-work-log-stamp.feature`                                      |        10 |           0 |        1 | Structural review complete  |
| `features/pm-grade-intake-readiness-gate.feature`                            |         8 |           0 |        1 | Structural review complete  |
| `features/architecture-state-docs.feature`                                   |        22 |           0 |        0 | Structural review complete  |
| `features/safeword-md-via-hooks.feature`                                     |         6 |           0 |        0 | Structural review complete  |
| `features/test-codex-plugin-migration.feature`                               |        24 |           0 |        0 | Structural review complete  |
| `features/host-repo-boundary-install.feature`                                |        20 |           0 |        0 | Structural review complete  |
| `features/architecture-staleness-enforcement.feature`                        |         9 |           0 |        0 | Structural review complete  |
| `features/operate-retry-safe-retro-relay.feature`                            |        39 |           0 |        0 | Structural review complete  |
| `features/route-ready-prs-with-a-safe-advisory-review.feature`               |        37 |           0 |        0 | Structural review complete  |
| `features/boundary-reconciliation-gate.feature`                              |        23 |           0 |        0 | Structural review complete  |
| `features/portable-tracker-transport.feature`                                |        23 |           0 |        1 | Structural review complete  |
| `features/plan-implementation-phase.feature`                                 |        54 |           0 |        0 | Structural review complete  |
| `features/safeword-lane.feature`                                             |         1 |           0 |        0 | Structural review complete  |
| `features/keep-advisory-reviews-current-without-repeated-noise.feature`      |         6 |           0 |        1 | Structural review complete  |
| `features/prevent-public-cli-contract-drift.feature`                         |        19 |           0 |        1 | Structural review complete  |
| `features/architecture-unreadable-workspace.feature`                         |         5 |           0 |        0 | Structural review complete  |
| `features/deploy-retro-relay-spike.feature`                                  |        14 |           0 |        0 | Structural review complete  |
| `features/automatic-claude-migration.feature`                                |        25 |           0 |        0 | Structural review complete  |
| `features/architecture-go-language-pack.feature`                             |         7 |           0 |        0 | Structural review complete  |
| `features/python-importlinter-scaffold.feature`                              |        14 |           0 |        0 | Structural review complete  |
| `features/architecture-narrative-blindspots.feature`                         |        13 |           0 |       13 | Structural review complete  |
| `features/phase-provenance.feature`                                          |        32 |           0 |        0 | Structural review complete  |
| `features/artifact-content-phase-anchors.feature`                            |        37 |           0 |        0 | Structural review complete  |
| `features/principles-flow-spike.feature`                                     |        20 |           5 |        0 | Structural review complete  |
| `features/tracker-identity-and-join.feature`                                 |        11 |           0 |        1 | Structural review complete  |
| `features/prove-review-remedies-with-controlled-execution.feature`           |         4 |           0 |        1 | Structural review complete  |
| `features/bash-ledger-write-gate.feature`                                    |        17 |           0 |        1 | Structural review complete  |
| `features/formatter-aware-lint-hook.feature`                                 |         9 |           0 |        2 | Structural review complete  |
| `features/test-plan-resolver.feature`                                        |        20 |           0 |        0 | Structural review complete  |
| `features/migrate-consumers-to-test-plan.feature`                            |        11 |           0 |        2 | Structural review complete  |
| `features/retry-safe-retro-filing.feature`                                   |        12 |           0 |        0 | Structural review complete  |
| `features/honor-host-toolchains.feature`                                     |        16 |           0 |        1 | Structural review complete  |
| `features/tracker-connect-flow.feature`                                      |        13 |           0 |        1 | Structural review complete  |
| `features/architecture-monorepo-hierarchy.feature`                           |        15 |           0 |        0 | Structural review complete  |
| `features/architecture-rust-language-pack.feature`                           |         6 |           0 |        0 | Structural review complete  |
| `features/architecture-prose-persistence.feature`                            |        10 |           0 |        0 | Structural review complete  |
| `features/generate-compliant-replies-without-rewrites.feature`               |        22 |           3 |        0 | Structural review complete  |
| `features/feature-ticket-readiness.feature`                                  |         7 |           0 |        1 | Structural review complete  |
| `features/whole-ticket-quality-refactor.feature`                             |        15 |           0 |        1 | Structural review complete  |
| `features/configure-audit-doc-sources.feature`                               |         6 |           0 |        0 | Structural review complete  |
| `features/add-spike-workflow.feature`                                        |        17 |           0 |        0 | Structural review complete  |
| `features/native-claude-plugin.feature`                                      |        45 |           0 |        5 | Structural review complete  |
| `features/bdd-lane-collision-detection-and-paths.feature`                    |        20 |           0 |        1 | Structural review complete  |
| `packages/cli/features/feature-files-as-source.feature`                      |         6 |           0 |        0 | Structural review complete  |
| `packages/cli/features/retro-recall-delta-rearm.feature`                     |        26 |           1 |        0 | Structural review complete  |
| `packages/cli/features/codex-retro-parity.feature`                           |        10 |           1 |        0 | Structural review complete  |
| `packages/cli/features/learn-from-exceptional-products.feature`              |        28 |           1 |        0 | Structural review complete  |
| `packages/cli/features/prevent-legacy-global-instructions.feature`           |        10 |           1 |        0 | Structural review complete  |
| `packages/cli/features/prevent-retro-duplicate-issues.feature`               |         8 |           1 |        0 | Structural review complete  |
| `packages/cli/features/retro-codex-trigger.feature`                          |        11 |           1 |        0 | Structural review complete  |
| `packages/cli/features/reliable-reviews-for-real-packets.feature`            |        32 |           0 |        0 | Semantic review in progress |
| `packages/cli/features/share-test-capacity-across-parallel-sessions.feature` |        56 |           0 |        1 | Semantic review in progress |
| `packages/cli/features/invisible-retro-claude.feature`                       |        12 |           1 |        0 | Structural review complete  |
| `packages/cli/features/retro-transcript-mining.feature`                      |        21 |           1 |        0 | Structural review complete  |
| `packages/cli/features/retro-cursor-trigger.feature`                         |        13 |           1 |        0 | Structural review complete  |
| `packages/cli/features/canonical-retro-spool-dedupe.feature`                 |        13 |           1 |        0 | Structural review complete  |
| `packages/cli/features/predictable-safeword-cli.feature`                     |        28 |           0 |        0 | Structural review complete  |
| `packages/cli/features/install-codex-plugin-for-new-users.feature`           |        10 |           0 |        0 | Structural review complete  |
| `packages/cli/features/keep-persona-lineage-readable.feature`                |         9 |           0 |        0 | Structural review complete  |
| `packages/cli/features/clarify-review-coverage.feature`                      |        19 |           0 |        0 | Structural review complete  |
| `packages/cli/features/cross-agent-adversarial-reviews.feature`              |        21 |           1 |        0 | Structural review complete  |
| `packages/cli/features/codex-pretooluse-deny-spike.feature`                  |         4 |           0 |        0 | Structural review complete  |
| `packages/cli/features/codex-plugin-next-task-upgrades.feature`              |        14 |           3 |        0 | Structural review complete  |
| `packages/cli/features/migrate-codex-to-plugin.feature`                      |        11 |           0 |        0 | Structural review complete  |
| `packages/cli/features/choose-local-or-remote-test-execution.feature`        |        11 |           0 |        0 | Structural review complete  |
| `packages/cli/features/filer-ack-tripwire.feature`                           |        12 |           1 |        0 | Structural review complete  |
| `packages/cli/features/retro-auto-trigger.feature`                           |         9 |           1 |        0 | Structural review complete  |
| `packages/cli/features/review-with-the-best-available-agent.feature`         |        41 |          11 |        0 | Structural review complete  |
| `packages/cli/features/offload-tests-without-blocking-local-work.feature`    |       134 |           0 |        1 | Semantic review in progress |
| `packages/cli/features/keep-native-plugins-current.feature`                  |        46 |           1 |        0 | Structural review complete  |
| `packages/cli/features/retro-process-surface.feature`                        |        15 |           1 |        0 | Structural review complete  |
| `packages/cli/features/unified-first-time-install.feature`                   |        52 |           0 |        0 | Structural review complete  |
| `packages/cli/features/codify.feature`                                       |         1 |           0 |        0 | Structural review complete  |
| `packages/cli/features/give-codex-users-full-workflow.feature`               |        20 |           2 |        0 | Structural review complete  |
| `packages/cli/features/retro-filing-provenance.feature`                      |        19 |           1 |        0 | Structural review complete  |
| `packages/cli/features/cloud-retro-filing-transport.feature`                 |        17 |           1 |        0 | Structural review complete  |
| `packages/cli/features/epic-child-linker.feature`                            |         5 |           0 |        0 | Structural review complete  |
| `packages/cli/features/keep-codex-protection-continuous.feature`             |        47 |           0 |        0 | Structural review complete  |
| `packages/cli/features/codex-plugin-hook-parity.feature`                     |        17 |           1 |        0 | Structural review complete  |
| `packages/cli/features/codex-done-gate-auto-transition.feature`              |        13 |           1 |        0 | Structural review complete  |

## Semantic-review standard

A scenario may be marked semantically complete only when it has been checked for:

1. A falsifiable outcome that a no-op or constant implementation cannot satisfy.
2. One behavior, observable outcome, deterministic execution, and no scenario-order dependency.
3. Appropriate rejection, boundary, external-failure, and security coverage at the Rule/feature level.
4. A real entry-point proof for behavior crossing a command or module boundary.

## Findings and remediation

### Must fix — resolved

- `configure-audit-doc-sources.MA2.AC3`: the expected fallback-discovery outcome was expressed as an `And` after `When`, leaving no `Then`. It is now an explicit `Then`.
- Twelve static contract scenarios used `Given → Then` without an action. Each now names the installation, inspection, validation, construction, or tripwire action in `When`; active bindings were updated accordingly.
- `codex-retro-parity.SM1.AC2`: the Lane-2 spool scenario inherited both AC2 and AC3. It now carries the single AC2 lineage that the rule it proves requires.
- `predictable-safeword-cli`: all fourteen numbered Rule blocks now carry their matching rule-lineage tags, so every contained scenario and outline row has exactly one criterion reference. The agent-facing machine-contract scenario also carries the missing Claude Code and Cursor surface coverage tags.
- `reliable-reviews-for-real-packets.TBU1.R2`: the configured-deadline scenario had previously only asserted that a review timed out, which a default-only implementation could also satisfy. The merged upstream proof now measures the configured deadline's distinct timeout window, so an ignored configuration fails the scenario.

- `durable-independent-review`: the recovered independent Claude review returned
  `changes_requested`, so the prior direct-pass conclusion is superseded. It
  found that a failed background reviewer can remain pending, cancellation does
  not yet prove worker termination or late-result precedence, and the claimed
  Claude/Codex surface wiring is not made observable. It also identified missing
  positive/out-of-scope source-binding cases, cancellation boundaries, timing
  boundaries, durable-store integrity coverage, and handle usability proof.

  The scenario repair now makes the terminal worker-exit failure, usable pending
  handle, one-invocation collection, unchanged and unrelated-source binding,
  stale reviewed-source rejection, signed-record rejection, cancellation
  termination, late-result precedence, and unknown-ID rejection explicit. The
  feature's unsupported Claude/Codex tags were removed rather than asserted by
  label alone. The earlier focused Vitest proof (33 tests) and Gherkin lint pass.
  A subsequent independent review `b4800890-eac8-4d7f-8575-cad75ce6797e`
  returned changes requested; this repair addresses those findings, but a fresh
  focused CI run and independent review are still required before approval.

### Semantic review in progress

The first review packet covers `reliable-reviews-for-real-packets` (32 scenarios), `share-test-capacity-across-parallel-sessions` (56 scenarios), and the current sixteen-feature offload packet (136 scenarios): 224 scenarios total. Direct review identified a vacuous deadline scenario; the merged upstream proof addresses it. The durable-review coordinator result was later recovered from its persisted job record and contains unresolved changes-requested findings, so that source returns to the active fix-and-rereview queue.

Direct review of the two newly active sources found no additional scenario-gate defect. All 26 closeout scenarios have a named Vitest proof in `TFG4CR`'s proof map; their rejection rows cover mutable transcript boundaries, authenticated identity, spool integrity, filing availability, and cleanup drift. The two GitHub-live-smoke scenarios are explicit `@wip` behavior with an executable command-level proof surface, so they are not counted as completed Cucumber coverage.

The offload refresh has completed its structural pass: each of the sixteen files owns one Rule, all 136 scenarios remain under explicit `@wip`, and every Rule has rejection coverage. No non-claim `Then` matched the vacuous-pass scan. This is not a semantic approval; each specification still needs its scenario-by-scenario adversarial pass before it can leave the pending state.

Direct semantic review of `offload-tests-workflow-security` found no scenario-gate defect. Its 23 scenarios cover redirect handling, durable pending publication and retry, token entropy, hostile filesystem objects, least-privilege workflow identity, credential-channel exclusion, and immutable workflow dependencies. The two `@proof.pending-vitest` rows correctly identify harness-completeness proofs that must exist before delivery rather than claiming current executable coverage.

Direct semantic review of `offload-tests-trusted-workflow-evidence` found no scenario-gate defect. Its nine scenarios distinguish preflight fallback from post-acceptance integrity failure, reject byte normalizations and configuration redefinition, preserve frozen authority across mutable default-branch metadata, and prove that neither direct authorization nor a substituted workflow exposes Safeword credentials.

### Looks good

- Active scenarios run through the Cucumber entry point and passed the full lane.
- Manual scenarios explicitly state why their boundary is exercised in Vitest or a host integration lane, avoiding a false claim of Cucumber proof.
- Each scenario now has exactly one `When` and at least one `Then`; parser-backed Gherkin lint is healthy.

## Current conclusion

The structural and lineage checks are complete and the resolved items above are verified. No claim is made yet about semantic completeness for the whole corpus; that conclusion depends on the in-progress packeted review and evidence recorded for each feature.
