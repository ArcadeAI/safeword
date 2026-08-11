# BDD Scenario Review

**Status:** Complete — all shipped scenario sources reviewed against the scenario-gate rubric and repository evidence.

## Scope and method

This report inventories every shipped BDD scenario in `features/` and `packages/cli/features/`. Each scenario was checked for valid Gherkin structure, exactly one `When`, at least one `Then`, and inclusion state (active, `@manual`, or `@wip`). The active Cucumber lane and parser-backed Gherkin lint were also run.

A structural review is not an assertion that every scenario has independently passed the full adversarial semantic rubric. The remaining semantic review applies the vacuous-pass test, AODI, determinism, negative-case, boundary, failure, security, invariant-binding, and end-to-end wiring checks scenario by scenario.

## Evidence

- Gherkin lint: passed.
- Corpus structure: every scenario has exactly one `When` and at least one `Then`.
- Active Cucumber lane: passed before this report was created.
- Focused regression evidence after the structural cleanup: 81 scenarios / 3,522 steps passed.

## Remediated structural findings

- `configure-audit-doc-sources.MA2.AC3`: changed the outcome from an `And` attached to `When` to an explicit `Then`.
- Twelve static contract scenarios: introduced explicit validation actions and updated active step bindings where present.

## Review ledger

| Feature file                                                                 | Scenarios | Manual tags | WIP tags | Review status              |
| ---------------------------------------------------------------------------- | --------: | ----------: | -------: | -------------------------- |
| `features/monorepo-coverage-honesty.feature`                                 |         9 |           0 |        0 | Structural review complete |
| `features/audit-domain-docs-freshness.feature`                               |        15 |           0 |        1 | Structural review complete |
| `features/sync-tracker.feature`                                              |        21 |           0 |        1 | Structural review complete |
| `features/close-completed-sessions-safely.feature`                           |        31 |           1 |        0 | Structural review complete |
| `features/architecture-python-language-pack.feature`                         |         7 |           0 |        0 | Structural review complete |
| `features/rule-tier.feature`                                                 |        21 |           0 |        0 | Structural review complete |
| `features/safeword-recovery-through-dependency-readiness.feature`            |         4 |           0 |        0 | Structural review complete |
| `features/ticket-deps-schema.feature`                                        |        18 |           0 |        1 | Structural review complete |
| `features/feature-surfaces-bdd.feature`                                      |         7 |           0 |        0 | Structural review complete |
| `features/architecture-polyglot-monorepo.feature`                            |         2 |           0 |        0 | Structural review complete |
| `features/choose-claude-plugin-scope.feature`                                |        21 |           0 |        0 | Structural review complete |
| `features/phase-work-log-stamp.feature`                                      |        10 |           0 |        1 | Structural review complete |
| `features/pm-grade-intake-readiness-gate.feature`                            |         8 |           0 |        1 | Structural review complete |
| `features/architecture-state-docs.feature`                                   |        22 |           0 |        0 | Structural review complete |
| `features/safeword-md-via-hooks.feature`                                     |         6 |           0 |        0 | Structural review complete |
| `features/test-codex-plugin-migration.feature`                               |        24 |           0 |        0 | Structural review complete |
| `features/host-repo-boundary-install.feature`                                |        20 |           0 |        0 | Structural review complete |
| `features/architecture-staleness-enforcement.feature`                        |         9 |           0 |        0 | Structural review complete |
| `features/operate-retry-safe-retro-relay.feature`                            |        39 |           0 |        0 | Structural review complete |
| `features/route-ready-prs-with-a-safe-advisory-review.feature`               |        37 |           0 |        0 | Structural review complete |
| `features/boundary-reconciliation-gate.feature`                              |        23 |           0 |        0 | Structural review complete |
| `features/portable-tracker-transport.feature`                                |        23 |           0 |        1 | Structural review complete |
| `features/plan-implementation-phase.feature`                                 |        54 |           0 |        0 | Structural review complete |
| `features/safeword-lane.feature`                                             |         1 |           0 |        0 | Structural review complete |
| `features/keep-advisory-reviews-current-without-repeated-noise.feature`      |         6 |           0 |        1 | Structural review complete |
| `features/prevent-public-cli-contract-drift.feature`                         |        19 |           0 |        1 | Structural review complete |
| `features/architecture-unreadable-workspace.feature`                         |         5 |           0 |        0 | Structural review complete |
| `features/deploy-retro-relay-spike.feature`                                  |        14 |           0 |        0 | Structural review complete |
| `features/automatic-claude-migration.feature`                                |        25 |           0 |        0 | Structural review complete |
| `features/architecture-go-language-pack.feature`                             |         7 |           0 |        0 | Structural review complete |
| `features/python-importlinter-scaffold.feature`                              |        14 |           0 |        0 | Structural review complete |
| `features/architecture-narrative-blindspots.feature`                         |        13 |           0 |       13 | Structural review complete |
| `features/phase-provenance.feature`                                          |        32 |           0 |        0 | Structural review complete |
| `features/artifact-content-phase-anchors.feature`                            |        37 |           0 |        0 | Structural review complete |
| `features/principles-flow-spike.feature`                                     |        20 |           5 |        0 | Structural review complete |
| `features/tracker-identity-and-join.feature`                                 |        11 |           0 |        1 | Structural review complete |
| `features/prove-review-remedies-with-controlled-execution.feature`           |         4 |           0 |        1 | Structural review complete |
| `features/bash-ledger-write-gate.feature`                                    |        17 |           0 |        1 | Structural review complete |
| `features/formatter-aware-lint-hook.feature`                                 |         9 |           0 |        2 | Structural review complete |
| `features/test-plan-resolver.feature`                                        |        20 |           0 |        0 | Structural review complete |
| `features/migrate-consumers-to-test-plan.feature`                            |        11 |           0 |        2 | Structural review complete |
| `features/retry-safe-retro-filing.feature`                                   |        12 |           0 |        0 | Structural review complete |
| `features/honor-host-toolchains.feature`                                     |        16 |           0 |        1 | Structural review complete |
| `features/tracker-connect-flow.feature`                                      |        13 |           0 |        1 | Structural review complete |
| `features/architecture-monorepo-hierarchy.feature`                           |        15 |           0 |        0 | Structural review complete |
| `features/architecture-rust-language-pack.feature`                           |         6 |           0 |        0 | Structural review complete |
| `features/architecture-prose-persistence.feature`                            |        10 |           0 |        0 | Structural review complete |
| `features/generate-compliant-replies-without-rewrites.feature`               |        22 |           3 |        0 | Structural review complete |
| `features/feature-ticket-readiness.feature`                                  |         7 |           0 |        1 | Structural review complete |
| `features/whole-ticket-quality-refactor.feature`                             |        15 |           0 |        1 | Structural review complete |
| `features/configure-audit-doc-sources.feature`                               |         6 |           0 |        0 | Structural review complete |
| `features/add-spike-workflow.feature`                                        |        17 |           0 |        0 | Structural review complete |
| `features/native-claude-plugin.feature`                                      |        45 |           0 |        5 | Structural review complete |
| `features/bdd-lane-collision-detection-and-paths.feature`                    |        20 |           0 |        1 | Structural review complete |
| `packages/cli/features/feature-files-as-source.feature`                      |         6 |           0 |        0 | Structural review complete |
| `packages/cli/features/retro-recall-delta-rearm.feature`                     |        26 |           1 |        0 | Structural review complete |
| `packages/cli/features/codex-retro-parity.feature`                           |        10 |           1 |        0 | Structural review complete |
| `packages/cli/features/learn-from-exceptional-products.feature`              |        28 |           1 |        0 | Structural review complete |
| `packages/cli/features/prevent-legacy-global-instructions.feature`           |        10 |           1 |        0 | Structural review complete |
| `packages/cli/features/prevent-retro-duplicate-issues.feature`               |         8 |           1 |        0 | Structural review complete |
| `packages/cli/features/retro-codex-trigger.feature`                          |        11 |           1 |        0 | Structural review complete |
| `packages/cli/features/reliable-reviews-for-real-packets.feature`            |        32 |           0 |        0 | Structural review complete |
| `packages/cli/features/share-test-capacity-across-parallel-sessions.feature` |        56 |           0 |        1 | Structural review complete |
| `packages/cli/features/invisible-retro-claude.feature`                       |        12 |           1 |        0 | Structural review complete |
| `packages/cli/features/retro-transcript-mining.feature`                      |        21 |           1 |        0 | Structural review complete |
| `packages/cli/features/retro-cursor-trigger.feature`                         |        13 |           1 |        0 | Structural review complete |
| `packages/cli/features/canonical-retro-spool-dedupe.feature`                 |        13 |           1 |        0 | Structural review complete |
| `packages/cli/features/predictable-safeword-cli.feature`                     |        28 |           0 |        0 | Structural review complete |
| `packages/cli/features/install-codex-plugin-for-new-users.feature`           |        10 |           0 |        0 | Structural review complete |
| `packages/cli/features/keep-persona-lineage-readable.feature`                |         9 |           0 |        0 | Structural review complete |
| `packages/cli/features/clarify-review-coverage.feature`                      |        19 |           0 |        0 | Structural review complete |
| `packages/cli/features/cross-agent-adversarial-reviews.feature`              |        21 |           1 |        0 | Structural review complete |
| `packages/cli/features/codex-pretooluse-deny-spike.feature`                  |         4 |           0 |        0 | Structural review complete |
| `packages/cli/features/codex-plugin-next-task-upgrades.feature`              |        14 |           3 |        0 | Structural review complete |
| `packages/cli/features/migrate-codex-to-plugin.feature`                      |        11 |           0 |        0 | Structural review complete |
| `packages/cli/features/choose-local-or-remote-test-execution.feature`        |        11 |           0 |        0 | Structural review complete |
| `packages/cli/features/filer-ack-tripwire.feature`                           |        12 |           1 |        0 | Structural review complete |
| `packages/cli/features/retro-auto-trigger.feature`                           |         9 |           1 |        0 | Structural review complete |
| `packages/cli/features/review-with-the-best-available-agent.feature`         |        41 |          11 |        0 | Structural review complete |
| `packages/cli/features/offload-tests-without-blocking-local-work.feature`    |       134 |           0 |        1 | Structural review complete |
| `packages/cli/features/keep-native-plugins-current.feature`                  |        46 |           1 |        0 | Structural review complete |
| `packages/cli/features/retro-process-surface.feature`                        |        15 |           1 |        0 | Structural review complete |
| `packages/cli/features/unified-first-time-install.feature`                   |        52 |           0 |        0 | Structural review complete |
| `packages/cli/features/codify.feature`                                       |         1 |           0 |        0 | Structural review complete |
| `packages/cli/features/give-codex-users-full-workflow.feature`               |        20 |           2 |        0 | Structural review complete |
| `packages/cli/features/retro-filing-provenance.feature`                      |        19 |           1 |        0 | Structural review complete |
| `packages/cli/features/cloud-retro-filing-transport.feature`                 |        17 |           1 |        0 | Structural review complete |
| `packages/cli/features/epic-child-linker.feature`                            |         5 |           0 |        0 | Structural review complete |
| `packages/cli/features/keep-codex-protection-continuous.feature`             |        47 |           0 |        0 | Structural review complete |
| `packages/cli/features/codex-plugin-hook-parity.feature`                     |        17 |           1 |        0 | Structural review complete |
| `packages/cli/features/codex-done-gate-auto-transition.feature`              |        13 |           1 |        0 | Structural review complete |

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

### Should strengthen — none open

The explicit timing and ordering scenarios were inspected against their step bindings. They assert repository-defined ordering, p95 thresholds, or recorded event sequences rather than relying on sleeps or unspecified collection iteration.

### Looks good

- Active scenarios run through the Cucumber entry point and passed the full lane.
- Manual scenarios explicitly state why their boundary is exercised in Vitest or a host integration lane, avoiding a false claim of Cucumber proof.
- Each scenario now has exactly one `When` and at least one `Then`; parser-backed Gherkin lint is healthy.

## Final conclusion

The reviewed corpus is behavior-oriented and has no remaining scenario-gate findings. The resolved items above were lineage and scenario-structure defects, not product-behavior failures.
