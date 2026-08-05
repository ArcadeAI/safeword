# Impl Plan: One coherent Safe Word command model

**Status:** planned

## Approach

The riskiest assumption is that project reconciliation and both external profile managers can be composed behind one plan without preview/apply drift. The cheapest proof is the first scenario, “Default install configures core Claude and Codex but not Cursor,” exercised through the real CLI with a temporary project and only the Claude/Codex subprocess boundaries stubbed. It must fail before implementation because `install` does not exist and current `setup` changes Cursor-owned state while handing profile installation back to the user.

The implementation follows `design.md`: a shared agent-selection parser, schema-owned core/Cursor projections, one lifecycle planner/executor, catalogue compatibility normalization, and a per-surface aggregate renderer. Existing `convergeSetup`, reconciliation, Claude profile, Codex migration/profile, health, and architecture collaborators are reused; they are not copied into the orchestrator.

### Proof plan

Every scenario inherits the primary proof listed for its Rule; scenario-specific boundaries and supporting proofs are named in the same row.

| Rule | Primary proof | Supporting proof and boundary |
| --- | --- | --- |
| TBU1.R1 default/offline install | CLI E2E wiring | Real catalogue → parser → planner → project reconciliation → profile adapters; stub only Claude/Codex subprocesses. Offline assertion snapshots the whole temp project before/after. |
| TBU1.R2 selectors | CLI integration | Pure table-driven parser unit proof for valid, duplicate, unknown, `none`, offline, and no-input partitions; CLI proof verifies no mutation on rejection. |
| TBU1.R3 default Cursor exclusion | filesystem integration | Real selected schema and reconciliation against missing/existing `.cursor` trees; exact byte snapshots. |
| TBU1.R4 explicit Cursor | filesystem integration | Real core + Cursor schema projections; preserve third-party JSON/rules/commands while reconciling Safe Word entries. |
| TBU1.R5 convergence/retry | CLI E2E wiring | Two-run temp-project proof plus boundary-controlled Claude failure/Codex success and targeted retry. |
| TBU2.R1 status vs doctor | CLI integration | Distinct catalogue fixtures and real health/profile observers; targeted assertions on concise versus causal output. |
| TBU2.R2 complete planning | CLI integration | Table-drive every operation/selection through `plan`; pure plan-authorization unit proof injects an undeclared effect and expects refusal. |
| TBU2.R3 uninstall safety | CLI E2E wiring | Real exact-plan/precondition digest and project reconciliation; stub supported host uninstall subprocesses; stale/no-input/custom-content/recovery cases. |
| TBU2.R4 architecture flags | existing integration lane | Extend `architecture-stage.test.ts` with canonical/legacy differential fixtures and rejection before staging. |
| TBU2.R5 machine output | executable catalogue fixture | Run each lifecycle command with global `--json`; validate one schema-v1 envelope/no prose. Preserve raw JSON fixtures for the two named legacy commands. |
| TBU2.R6 aliases/reference/help | catalogue + CLI integration | Exhaustive declarative translation table, executable fixtures, hidden ordinary help, compatibility reference, and indefinite-retention metadata. |
| NTB1.R1 per-surface results | renderer unit + CLI wiring | Exact human summary assertions plus JSON `data.surfaces`; mixed outcome can never aggregate healthy. |
| NTB1.R2 activation | profile integration | Real status adapters over stubbed host/profile observations prove installed is not active; exact Claude/Codex actions remain separate. |
| NTB1.R3 partial failure | CLI E2E wiring | Claude unavailable at subprocess boundary while project and Codex complete; assert completed effects and Claude-only retry. |
| NTB1.R4 destructive language/recovery | catalogue + integration | Plans/help name deactivation, preservation, backup, recovery; existing conflict-safe project/profile recovery collaborators preserve unrelated content. |

### Surface proof

- **Safeword CLI:** `packages/cli/tests/cli-protocol/unified-lifecycle-wiring.test.ts` runs the registered production command and shared renderer.
- **Claude Code:** `packages/cli/tests/claude-plugin/lifecycle.test.ts` uses the real profile adapter and stubs only the `claude` subprocess. Live-host verification records `skip: Claude CLI unavailable or unauthenticated` when it cannot run.
- **OpenAI Codex:** `packages/cli/tests/codex-plugin/lifecycle.test.ts` uses the real marketplace/profile adapter and stubs only the `codex` subprocess and host process observation. Live-host verification records `skip: Codex CLI unavailable or unauthenticated` when it cannot run.
- **Cursor:** `packages/cli/tests/commands/lifecycle-cursor.test.ts` uses the real schema/reconciliation engine on temporary filesystems with customer content.
- **Experience:** CLI integration fixtures capture one NTB human walkthrough and one TBU verbose/JSON targeted-retry walkthrough.

The installed TypeScript pack applies to every new source/test file. The installed `testing` skill governs behavior assertions, highest practical scope, one test at a time, and process-boundary-only mocks. No narrower installed TypeScript component skill applies.

### Build order

1. **Load-bearing default install RED:** add one production-CLI wiring test proving project + Claude + Codex and byte-for-byte Cursor exclusion. Proof: `bun run test packages/cli/tests/cli-protocol/unified-lifecycle-wiring.test.ts`.
2. **Selection and schema ownership:** implement the pure selector and schema partitions, then cover every selector/Cursor boundary. Proof: `bun run test packages/cli/tests/cli-protocol/agent-selection.test.ts packages/cli/tests/commands/lifecycle-cursor.test.ts`.
3. **Lifecycle planner and install executor:** compose project/Claude/Codex/Cursor adapters, offline preflight, effect authorization, aggregation, convergence, and retry. Proof: `bun run test packages/cli/tests/cli-protocol/unified-lifecycle-wiring.test.ts packages/cli/tests/cli-protocol/lifecycle-plan.test.ts`.
4. **Profile uninstall adapters and exact lifecycle uninstall:** add supported Claude/Codex removal boundaries, selected ownership removal, stale/no-input rules, and recovery reporting. Proof: `bun run test packages/cli/tests/claude-plugin/lifecycle.test.ts packages/cli/tests/codex-plugin/lifecycle.test.ts packages/cli/tests/cli-protocol/lifecycle-uninstall.test.ts`.
5. **Status/doctor and aggregate rendering:** separate observers and expose concise human versus diagnostic/JSON detail. Proof: `bun run test packages/cli/tests/cli-protocol/lifecycle-status.test.ts packages/cli/tests/cli-protocol/result.test.ts`.
6. **Compatibility normalization:** make `install`, `uninstall`, and canonical architecture options authoritative; translate every retained command/option alias with indefinite metadata. Proof: `bun run test packages/cli/tests/cli-protocol/catalog.test.ts packages/cli/tests/cli-protocol/help-aliases.test.ts packages/cli/tests/commands/architecture-stage.test.ts`.
7. **Machine contract and capabilities:** cover global JSON, legacy raw output, public fixtures, effect policy, and exhaustive reference metadata. Proof: `bun run test packages/cli/tests/cli-protocol/machine-contract.test.ts packages/cli/tests/cli-protocol/documentation.test.ts packages/cli/tests/cli-protocol/catalog.test.ts`.
8. **Customer documentation:** update README quick start, website quick start/lifecycle/reference pages, and one compatibility table. Proof: `bun run test packages/cli/tests/cli-protocol/documentation.test.ts`.
9. **Executable behavior lane:** implement step definitions for all 48 approved scenarios by routing them through the same production helpers/CLI fixtures, not parallel test-only behavior. Proof: `bun run test:bdd`.
10. **Integrated verification:** run targeted lifecycle suites, typecheck/lint, full Vitest once, BDD, surface live proofs or named skips, and NTB/TBU walkthroughs. Proof: `bun run test:all && bun run lint` plus the live-host commands recorded in `verify.md`.

The plan has ten slices and does not cross the plan-phase `>20 tasks` split trigger. The earlier `>15 scenarios` split suggestion was explicitly declined when the user asked to keep the audited CLI cleanup in the unified ticket; do not re-suggest it in this session.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Lifecycle source of truth | One typed request/plan/executor over surface adapters | Sequentially call existing handlers; command-specific handlers | Both allow preview/apply, selection, and retry semantics to drift. Evidence: `ARCHITECTURE.md` “Typed CLI Execution and Discovery” and `packages/cli/src/cli-protocol/reconciliation.ts`. |
| Compatibility | Catalogue-owned command/option normalization before dispatch, retained indefinitely | Handler delegation; separate legacy implementations; Commander aliases alone | Semantic translations need injected/ignored options and machine capability metadata that handler delegation or Commander alone does not own. Evidence: [Commander 15.0.0](https://github.com/tj/commander.js/blob/v15.0.0/Readme.md) and `catalog.ts`. |
| Cursor exclusion | Schema-owned core/Cursor partitions | Skip only `.cursor/**`; command-local filters | Cursor runtime assets also live under `.safeword/**`, and scattered path filters violate schema-as-source-of-truth. Evidence: `schema.ts` `CURSOR_SHARED_SKILL_*` and Cursor hook registrations. |
| Failure semantics | Continue independent surfaces, retain completed effects, targeted retry; no private-state rollback | Fail-fast; synthetic rollback of host profiles | Required scenarios demand partial success, while profile managers are external non-transactional authorities. Evidence: Claude/Codex delivery decisions in `ARCHITECTURE.md`. |
| Plan identity | Hash selected effects plus project/profile precondition observations | Confirmation boolean; project-only digest | Exact consent must become stale when any selected surface changes. Evidence: accepted typed-CLI ADR and current `createPlan`/`preconditionDigest`. |
| Plan syntax | `plan [install\|uninstall] --agents=…`, defaulting to install | `--operation`; separate plan subcommands | The positional operation is short, composable, and keeps one plan command; the selector remains identical across lifecycle commands. [CLI Guidelines](https://clig.dev/) favors guessable consistent commands and explicit dry runs. |
| Agent selection persistence | Invocation-scoped; omitted always means Claude + Codex | Persist last selection in config | Persistence would make the same command mean different things across projects and is not required by the scenarios. |
| Architecture record | Extend the existing Typed CLI decision and architecture narrative; no new ADR | New standalone ADR | This feature applies the accepted pattern rather than replacing it; feature-specific component detail belongs in `design.md`. |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | One default install and one actionable summary; `--agents`, verbose, JSON, plan identity, and targeted retry remain available. | `packages/cli/tests/cli-protocol/unified-lifecycle-wiring.test.ts`; NTB/TBU walkthroughs in `verify.md` | |
| 1. Structure enforces; instructions suggest | Planner artifact, exact digest, schema partition, and catalogue translation make skipped effects/aliases mechanically visible. | `packages/cli/tests/cli-protocol/lifecycle-plan.test.ts`; `packages/cli/tests/cli-protocol/catalog.test.ts` | |
| 2. Fire at boundaries, not every turn | Validation occurs at parse, pre-apply, destructive confirmation, and verification boundaries only. | `packages/cli/tests/cli-protocol/lifecycle-uninstall.test.ts` | |
| 3. Add, never replace | Reconciliation owns only Safe Word entries and preserves customer/third-party Cursor and profile content. | `packages/cli/tests/commands/lifecycle-cursor.test.ts`; lifecycle uninstall integration tests | |
| 5. Clarity before correctness | Canonical vocabulary is install/status/doctor/plan/uninstall; compatibility is hidden and documented once. | `packages/cli/tests/cli-protocol/help-aliases.test.ts`; CLI reference contract | |

Architecture decisions honored: `ARCHITECTURE.md` “Typed CLI Execution and Discovery,” “Profile-Scoped Generated Codex Plugin and Staged Hook Migration,” “Restart-Bound Codex Plugin Activation,” the current Claude native-plugin delivery contract, and the reconciliation ownership model. The Typed CLI entry will be updated to replace its obsolete 0.71 alias-removal window with indefinite compatibility and the unified lifecycle vocabulary.

## Known deviations

- The feature remains one ticket despite 48 scenarios and several clusters. The user explicitly asked to amend one unified CLI ticket and declined deletion/splitting of aliases; the work log records that choice. The ten-slice build order stays below the plan-phase split trigger and each slice has an objective proof command.
- No project principle conflict is planned.

## Doc impact

- `README.md`: replace the first-time quick start with `safeword install`, default Claude + Codex behavior, explicit Cursor example, and activation follow-ups.
- `packages/website/src/content/docs`: update quick start, CLI lifecycle/reference material, machine-output guidance, destructive semantics, and a single exhaustive compatibility table.
- `ARCHITECTURE.md`: update CLI evolution and the Typed CLI decision’s compatibility/lifecycle consequences; do not add a detached ADR.
- CLI `--help` and `capabilities`: generated from the catalogue and tested as product documentation.

These updates are build-order slices 6–8 so documentation is derived from executable catalogue behavior rather than drafted against an unstable interface.

## Assessment triggers

- Claude or Codex changes supported plugin install/remove/list JSON or activation proof semantics.
- Cursor gains a profile-scoped plugin boundary that can replace project materialization.
- A second machine envelope schema is required or schema-v1 cannot express manual activation cleanly.
- Users need a persisted non-default agent selection rather than invocation-scoped control.
- Surface count or cross-host failure frequency makes sequential continuation too slow or calls for a resumable transaction journal.
- A collaborator repeatedly produces effects that the planner cannot predict at useful granularity; revisit adapter contracts before weakening effect authorization.
