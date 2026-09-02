# Impl Plan: Make each agent plugin fully self-contained

**Status:** implemented
**Planned on:** 2026-08-30

## Approach

The riskiest assumption is that each native distribution can carry every executable its workflows need while all hosts still share one small project-state contract. The cheapest proof is the Codex audit regression: run the generated Codex skill from an enrolled monorepo with no project-local helper and require real audit output with no install or dependency effects.

Use the existing integration registry as the authority boundary. Each adapter declares its project-owned surfaces and its packaged executable catalogue. `projectLifecycleSchema` becomes a consumer-union reducer: always include enrollment/authored project substrate, include only selected project-delivered host assets, and never infer language tooling unless it was explicitly selected. Codex, Claude, and OpenCode resolve executable helpers inside their packaged distributions; Cursor retains its declared project authority. A small shared project-state module lazily creates only framework-owned state and appends one precise ignore rule when required.

Primary proofs and implemented boundaries:

1. **Packaged workflows (TBU1.R1).** Execute the generated Codex audit entry point from its versioned cache, including complete/partial legacy project payloads and missing-package failure. Execute the generated Claude and installed OpenCode review commands through real subprocesses; only the reviewer and OpenCode package resolver are controlled test boundaries. Source both Codex and installed Cursor audit helpers from Bash and assert populated/empty exports and survival after merge-base failure.
2. **Lazy state (TBU1.R2).** Invoke each host's generated state-writing command. Missing framework state and its precise ignore rule are created without installation. Focused shared-writer tests cover existing state, exact/broader ignore policy, authored content, and enrollment. Lifecycle dispatch remains non-blocking outside enrollment; direct CLI invocation reports enrollment required.
3. **Selected project authority (NTB1.R1).** Inspect all schema path buckets for native-only and Cursor-mixed selection. Use the real project reconciler with profile-manager boundaries substituted to prove Codex removal preserves Cursor and authored project content, and repeated reconciliation does not restore native runtime.
4. **Profile preservation (NTB1.R2).** Install the real generated OpenCode catalogue and verify its complete identity/digest inventory. Upgrade/uninstall change only identity-owned bytes, preserve unrelated content, and reject drift without partial mutation.
5. **Release authority (SWM1.R1).** Validate generated native catalogues, then inject a project-runtime reference separately into Codex, Claude Code, and OpenCode catalogues and require rejection naming the asset. Codex additionally rejects an unpinned entry point; Cursor rejects cross-host execution. Regenerate packaged artifacts and run release/parity checks.
6. **Documentation and verification.** Keep runtime/enrollment guidance aligned with the accepted spec; run targeted tests, both BDD entry points, lint/typecheck, build, release checks, and the final suite.

Surface proof:

- OpenAI Codex: versioned cache and real Bash execution.
- Claude Code: generated plugin command and bundled helper subprocess.
- OpenCode: installed profile command and pinned-package resolver boundary.
- Cursor: installed project wrapper/skill and real Bash execution.
- Safeword CLI: command and lifecycle integration tests, with profile-manager limits stated above.

These are the implemented proof boundaries, not claims of an interactive host UI smoke. Legacy cleanup remains under the existing proof-bound migration contracts. The complete/partial legacy matrix uses Codex as the representative native cache host; shared-writer edge cases are tested once and each host proves its wiring. See `dimensions.md` for explicit exclusions.

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
| Optimize for the NTB without constraining the TBU | Plans explain only selected effects and missing capabilities produce one bounded action without installer jargon; automatic state/ignore edits remain exact, inspectable, and independently invocable | `packages/cli/features/self-contained-agent-plugins.feature` | |
| 1. Structure enforces; instructions suggest | Ownership is enforced by schema validation, generated catalogues, and executable-path tests rather than prose declarations | `packages/cli/tests/codex-plugin/catalogue.test.ts` | |
| 2. Fire at boundaries, not every turn | State initialization runs only when a workflow first needs framework-owned state; ordinary turns and read-only plan/status remain mutation-free | `packages/cli/tests/integration/post-tool-review.test.ts` | |
| 3. Add, never replace | Lazy ignore editing preserves customer bytes; migration removes only proven unedited legacy runtime | `packages/cli/tests/integration/post-tool-review.test.ts` | |
| 5. Correct and safe; then clear; then simple | Add only the ownership declaration and state initializer required to make authority and initialization deterministic; reuse the registry and reconciliation engine | `packages/cli/tests/lifecycle/integrations.test.ts` | |

Architecture decisions updated in place: `ARCHITECTURE.md` — “Registry-Driven Agent Integrations with Native Trust Boundaries” and “Explicit Project Enrollment for Profile-Scoped Codex Hooks.” The first retains the registry but changes aggregate runtime consumers to selected project consumers; the second retains explicit enrollment and fail-open pre-enrollment behavior but permits exact ignore/state initialization at the first workflow boundary. No new ADR is needed.

## Known deviations

Concurrent first-use initialization by multiple host sessions is outside this epic's sequential lifecycle contract. The initializer is idempotent, but atomic multi-process coordination is deferred until observed concurrent mutation justifies it.

“Precise ignore rule” means the narrowest stable rule for the state writer: fixed-name state such as `skill-invocations.log` receives an exact basename rule, while session-keyed `quality-state-<id>.json` receives the single `/quality-state-*.json` family rule required to cover future sessions. Neither form broadens to unrelated namespace content.

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
