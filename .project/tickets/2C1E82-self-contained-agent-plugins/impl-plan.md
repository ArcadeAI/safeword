# Impl Plan: Make each agent plugin fully self-contained

**Status:** implemented
**Planned on:** 2026-08-30

## Approach

The riskiest assumption is that each native distribution can carry every executable its workflows need while all hosts still share one small project-state contract. The cheapest proof is the Codex audit regression: run the generated Codex skill from an enrolled monorepo with no project-local helper and require real audit output with no install or dependency effects.

Use the existing integration registry as the authority boundary. Each adapter declares its project-owned surfaces and its packaged executable catalogue. `projectLifecycleSchema` becomes a consumer-union reducer: always include enrollment/authored project substrate, include only selected project-delivered host assets, and never infer language tooling unless it was explicitly selected. Codex, Claude, and OpenCode resolve executable helpers inside their packaged distributions; Cursor retains its declared project authority. A small shared project-state module lazily creates only framework-owned state and appends one precise ignore rule when required.

Primary proofs and build order:

1. **Codex packaged workflow runtime — integration/E2E.** Prove the load-bearing sourced-shell assumption first: extend the generated Codex plugin catalogue and CLI entry points for every remaining helper, including the sourced audit-scope shell contract. Run generated-skill tests and disposable real-process audit smokes from (a) a runtime-free enrolled monorepo and (b) one containing a complete legacy runtime; both must resolve inside the Codex plugin and the latter must prove no legacy executable ran. This proves TBU1.R1-R2 and NTB1.R3 for Codex before the wider catalogue refactor depends on the approach.
2. **Delivery catalogue and selected-agent schema — integration.** Add table-driven ownership/selection tests plus lifecycle plan/apply wiring tests for single agents, every pair, order independence, repeated reconciliation, optional-tooling decline, upgrade, and uninstall. Add schema-validation tests that reject an unclassified executable reference and a multiply classified asset while naming both conflicting classes. A single-agent plan containing an unselected host asset must fail validation before apply and name the catalogue repair. CLI protocol assertions cover exact monorepo workspace/dependency effects, user-facing labels that omit internal lifecycle taxonomy, plans that leave lazy-state policy byte-identical with no state effects, and upgrades that stop selecting optional tooling without deleting the previously installed user-visible files. This proves NTB1.R1-R2 and SWM1.R1-R2/R4 without mocking internal seams.
3. **Claude and OpenCode packaged runtime parity — integration.** Preserve Claude's existing plugin-root runtime. Move OpenCode workflow skills into its profile plugin/runtime catalogue and retire `.claude/skills` from OpenCode authority; a fresh OpenCode-only install plan and real adapter invocation must touch no `.claude` project path. Real-process tests for Claude and OpenCode run both without legacy runtime and with a complete legacy runtime present, always resolving inside the selected plugin and proving no legacy executable ran. Update the registry record's compatibility-reuse clause accordingly. This proves the equivalent Claude/OpenCode rows and prevents cross-host borrowing.
4. **Cursor authority and shared lazy state — integration.** Keep Cursor's project delivery explicit and add a real wrapper invocation test that records the resolved executable path, rejects every Claude/Codex/OpenCode path, covers Cursor alone and each mixed-host direction, and asserts the bounded missing-authority failure. Add one host-neutral state initializer used by all real adapters. It first determines whether existing gitignore patterns already cover the exact transient path; if not, it writes the exact ignore rule successfully before creating state. It preserves broader customer rules and all existing bytes, reopens existing state byte-for-byte, and leaves state absent when the ignore write fails. Explicit workflow invocation reports a bounded failure naming the path and recovery; lifecycle/session-start dispatch records the same failure but remains advisory and non-blocking. Table tests cover exact and broader existing rules, missing and unwritable ignore/state paths, enrolled/unenrolled behavior for all four hosts, malformed enrollment preservation with one repair action, missing authored knowledge remaining absent while framework state is created, and successful initialization producing no setup prompt/message. Per-host real session-start tests assert unwritable paths continue the session, create no state, and propose no installation. This proves every Cursor row in TBU1.R1, TBU1.R3-R5, and NTB1.R4 without allowing workflow invocation to enroll a project.
5. **Migration, architecture records, child reconciliation, and release contract — integration/release.** The migration component alone may inspect and remove recognized legacy OpenCode `.claude/skills`, and only after its OpenCode profile replacement is proven; ordinary OpenCode plans/invocations never touch `.claude`. Classify all recognized legacy copies, preserve authored/ambiguous/shared content, and reject cross-authority or version-skewed executable references. Update the accepted enrollment and registry records in place to reflect lazy state initialization and selected-consumer reconciliation. Map V2AH4B/KDED4X/SF0RS0/GJB22B/JNZ2H5/1DZ9W8 to the shipped catalogue entries, merge duplicate acceptance evidence into this epic, and close only slices whose remaining scope is fully subsumed. Regenerate plugin artifacts and run release/parity tests. This proves SWM1.R3-R4.
6. **Documentation and full verification.** Update README, `.project/surfaces.md`, and website installation/runtime-authority guidance, then run targeted tests, BDD, typecheck/lint, release tests, and the full suite once.

Surface proof:

- OpenAI Codex: generated-catalogue integration tests and disposable real-process workflow smoke.
- Claude Code: plugin inventory/runtime tests and lifecycle adapter integration tests.
- OpenCode: profile-plugin real-process conformance and lifecycle adapter tests.
- Cursor: real wrapper execution resolving only Cursor-owned paths, in isolation and every mixed-host direction, plus shared-state adapter wiring.
- Safeword CLI: public `plan`, `install`, `upgrade`, and `uninstall` protocol tests asserting exact effects.

The plan has six implementation components and reuses the epic's existing child tickets as slices; no further split is warranted because the slices share one delivery contract and one reconciliation change.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://code.visualstudio.com/api/working-with-extensions/bundling-extension | 2026-08-30 | Current VS Code Extension API | Safeword 0.82.1 | Official guidance recommends bundling extension runtime so installation works without external source files | Package executable runtime with the host delivery; exclude tests/source-only material | Architectural analogy only; no source reuse and VS Code's web constraints do not apply |

**Decision impact:** changed: native-agent execution becomes package-owned and project reconciliation becomes an explicit selected-consumer union; the existing registry and reconciliation engine are retained.
**Decision informed:** Package native runtime; reduce project effects by declared consumers

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Package native runtime; reduce project effects by declared consumers | Bundle every native host's executable helpers with its distribution; derive project effects from shared substrate plus selected project consumers | Keep project runtime for all hosts; invoke a pinned CLI subprocess for every helper | Project runtime recreates the reported install explosion and split authority; subprocess-only cannot preserve sourced-shell behavior |
| Centralize lazy framework state | One shared state initializer called through each real host adapter, with exact idempotent ignore editing | Per-host copies; invoke lifecycle install when state is absent | Copies drift; installation is broader than state initialization and violates the accepted behavior |
| Respect broader customer ignore rules | Evaluate whether existing gitignore patterns already cover the exact transient path; append the precise rule only when coverage is absent | Exact-line matching only; always append the precise rule | Exact-line matching creates redundant narrower rules; unconditional append changes customer files unnecessarily |
| Keep lifecycle selection in the integration registry and validate native runtime authority separately | Continue deriving project delivery from each selected integration's declared project assets; use one narrow validator for packaged native catalogues | Add runtime-authority fields to every integration; create a second delivery registry; add host-name branches in lifecycle commands | Runtime authority is a release property of packaged catalogues, while the integration registry already owns project delivery. Combining them would widen the lifecycle model without improving the selection boundary. |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Plans explain only selected effects and missing capabilities produce one bounded action without installer jargon; automatic state/ignore edits remain exact, inspectable, and independently invocable | `packages/cli/features/self-contained-agent-plugins.feature` NTB1 rules, TBU1.R3-R5, and CLI protocol tests | |
| Structure enforces; instructions suggest | Ownership is enforced by schema validation, generated catalogues, and executable-path tests rather than prose declarations | Validation rejection tests, release/parity tests, and real host invocation tests | |
| Fire at boundaries, not every turn | State initialization runs only when a workflow first needs framework-owned state; ordinary turns and read-only plan/status remain mutation-free | TBU1.R3-R5 adapter and CLI protocol tests | |
| Add, never replace | Lazy ignore editing preserves customer bytes; migration removes only proven unedited legacy runtime | TBU1.R5/SWM1.R4 scenarios and reconciliation integration tests | |
| Correct and safe; then clear; then simple | Add only the ownership declaration and state initializer required to make authority and initialization deterministic; reuse the registry and reconciliation engine | Real execution/failure tests first, user-facing plan wording assertions second, whole-ticket quality review last | |

Architecture decisions updated in place: `ARCHITECTURE.md` — “Registry-Driven Agent Integrations with Native Trust Boundaries” and “Explicit Project Enrollment for Profile-Scoped Codex Hooks.” The first retains the registry but changes aggregate runtime consumers to selected project consumers; the second retains explicit enrollment and fail-open pre-enrollment behavior but permits exact ignore/state initialization at the first workflow boundary. No new ADR is needed.

## Known deviations

Concurrent first-use initialization by multiple host sessions is outside this epic's sequential lifecycle contract. The initializer is idempotent, but atomic multi-process coordination is deferred until observed concurrent mutation justifies it.

OpenCode's installed dispatcher can be copied away from its profile directory, so it embeds the two canonical guard closures rather than resolving sibling source files at runtime. The build derives those closures from the canonical hook templates and copied-dispatcher tests execute them after relocation.

The epic's scenarios use the repository's `@proof.vitest` manifest lane instead of duplicating existing command and lifecycle integration coverage as Cucumber glue. Both repository-root and package-local `test:bdd` entry points now execute the manifest-provenance gate, closing the package-local false-green that verification exposed.

## Doc impact

- `README.md`: explain that native plugins are self-contained and `--agents` bounds project effects.
- `.project/surfaces.md`: replace OpenCode's obsolete `.claude/skills` compatibility-discovery contract with its profile-plugin authority.
- `packages/website/src/content/docs`: update install/agent guidance, lazy-state behavior, and migration expectations.

Both updates ship in build-order step 6 after behavior is green.

## Assessment triggers

- A host gains or loses a native profile-plugin/runtime mechanism.
- A workflow needs an executable that cannot be packaged or expressed as a version-pinned entry point.
- Evidence of concurrent mutation of the same project-state or ignore file; that would justify an atomic state writer rather than the current sequential contract.
- The integration registry cannot express a new ownership class without host-name branching.
