# Impl Plan: Give OpenCode builders full Safeword protection

**Status:** implemented under the ticket's approved historical-evidence waiver;
the feature remains `@wip` until a complete executable proof manifest can replace that waiver.
**Planned on:** 2026-08-26

## Approach

The riskiest assumption is that stable OpenCode 1.18.23 actually loads a
profile plugin, routes a real tool call through `tool.execute.before`, and
propagates a thrown denial before the tool side effect. The cheapest decisive
slice is a disposable hand-written fixture proving only that the native hook
fires and a thrown error prevents the sentinel side effect, paired with its
disarmed positive control. It is not acceptance proof. Slice 4 must repoint the
same fixture at the generated plugin and real dispatcher before TBU1.R4 turns
green.

Component interfaces and evidence flow are fixed in [design.md](./design.md).
The installed testing skill applies to every scenario group: E2E for the real
host boundary, CLI/filesystem integration for wiring and ownership, and unit
tables only for pure mapping, parsing, and projection. No TypeScript-specific
component skill is installed, so implementation follows the repository's
TypeScript 5.9.3 and Vitest 4.1.10 conventions without introducing a new style.

| Scenario group                                                                                                                                                                                                        | Owner                                                                                              | Primary proof                                                                                                                                                                                       | Supporting proof                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| TBU1.R4 real-process catalogue, no-side-effect denial/control, invalid executable boundaries, shell-free isolation, CI failure, and bounded evidence                                                                  | `src/opencode/conformance.ts` plus a loopback fixture                                              | E2E against `opencode-ai@1.18.23`, replacing only the external provider with loopback                                                                                                               | Unit evidence-schema and redaction matrices                                                                     |
| TBU1.R2 exact tool mapping, multi-target patches, shell-free transport, allow/deny/fail-closed, inert unmarked projects, lifecycle observations, hashed identity, marker uncertainty, and missing dispatcher recovery | generated stable-1.x profile plugin plus its package-internal dispatcher entry point               | Real child processes prove shell-free transport and exit 0/2; generated-plugin integration injects process/filesystem ports only for spawn, timeout, unexpected-exit, parse, and persistence faults | Table-driven pure cases for tool/input shapes, profile-error clearing, and evidence bindings                    |
| TBU1.R1 explicit non-persisted selection, plural catalogue paths, declarative-only project delivery, shared skills, fresh/cross-platform config roots, retired paths, plan effects, and user config preservation      | registry selection, OpenCode schema filter, canonical command/agent inventories, profile installer | CLI wiring through literal install/plan entry points                                                                                                                                                | Schema/parity inventory, resolver, symlink, and fresh-root matrices                                             |
| TBU1.R3 reconciliation, collisions, drift, upgrade, uninstall scope, evidence cleanup, read-only health, atomicity, and locking                                                                                       | OpenCode profile transaction plus selected-surface project schema                                  | Filesystem integration with injected config roots/access recorder and concurrent processes, plus pinned real-process discovery after production-plugin replacement                                  | Unit identity/hash and effect-plan tests                                                                        |
| NTB1.R1–R3 four health dimensions, action precedence, version/platform bindings, exact freshness boundaries, and conformance invalidation                                                                             | registry status projector fed by OpenCode evidence inputs                                          | Literal `status --agents=opencode` CLI wiring                                                                                                                                                       | Pure projector truth-table tests with injected clocks                                                           |
| SWM1.R1–R3 adapter completeness, generic conformance, plan/effects selection, shared ownership, literal ordering, sentinel iteration, and legacy-host regression                                                      | `src/lifecycle/integrations.ts` registry and coordinator                                           | Contract integration over all adapters                                                                                                                                                              | Immutable canonicalized origin/main fixtures for Claude, Codex, and Cursor using injected project/profile roots |

Scenario IDs below are their one-based ordinal within the named Rule in
`test-definitions.md`; outlines keep one ID across their example rows. A slice
must close at least its listed IDs. Incidental earlier passes are not ledger
GREEN until the scenario's stated primary boundary exists and is targeted.

| Slice | Scenario IDs closed in this slice                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1     | No acceptance scenarios; disposable host-contract proof only                                                                     |
| 2     | SWM1.R1.S02-S03; SWM1.R3.S04, S07-S08                                                                                            |
| 3     | TBU1.R1.S08; TBU1.R3.S04                                                                                                         |
| 4     | TBU1.R1.S07; TBU1.R2.S01-S09, S11-S12, S14-S25; TBU1.R3.S05, S10, S17                                                            |
| 5     | TBU1.R1.S01-S06, S11-S12, S14-S19; TBU1.R3.S01-S03, S08-S09, S11-S13, S15                                                        |
| 6a    | TBU1.R4.S06; SWM1.R1.S06-S07                                                                                                     |
| 6b    | TBU1.R1.S09-S10, S13; TBU1.R2.S10, S13; TBU1.R3.S06-S07, S14; TBU1.R4.S08-S10; NTB1.R1.S01-S02; NTB1.R2.S01-S05; NTB1.R3.S01-S03 |
| 6c    | SWM1.R1.S01, S04-S05; SWM1.R2.S01-S03; SWM1.R3.S01-S03, S05-S06                                                                  |
| 7     | TBU1.R3.S16; TBU1.R4.S01-S05, S07; residual step wiring, docs, CI promotion, and full regression                                 |

Build order:

1. Vendor the minimal MIT-attributed loopback protocol fixture for a disposable
   local OpenCode 1.18.23 proof. Observe native `bash`, `edit`, `write`, and
   `apply_patch` calls reaching `tool.execute.before` with the approved input
   keys across OpenCode's non-GPT and GPT-family tool branches. Keep `shell` and
   `patch` as standardized adapter aliases proved at the pure plugin boundary;
   stable 1.18.23 does not expose those names. Verify a hand-written plural
   command/agent plus skill entry are discovered and the pinned executable
   reports exactly `1.18.23`. In one decisive run the loaded plugin spawns and
   awaits a Node/Bun-compatible fixture
   dispatcher through the installer's absolute `process.execPath`, observes its
   exit/stdout, then throws; the armed sentinel must remain absent. Also record
   the actually dispatched session/prompt/pre-tool/post-tool/stop hook set
   under an injected profile root. Adapter capability declarations must follow
   this observed set; return to scenario-gate if it contradicts the approved
   matrix. Retain the MIT notice and stop if the host contract fails.
2. Capture immutable, canonicalized origin/main lifecycle fixtures and their
   committed digest manifest; introduce
   the typed integration registry and migrate Claude, Codex, and Cursor behind
   it with literal ordering. Contract tests inject a conforming sentinel only
   into a test registry; it is never registered in production. Land the slice-2
   scenario IDs RED first and close only when those IDs and the existing host
   suites are green. OpenCode-dependent SWM scenarios carry to slices 5-6.
3. Register the OpenCode adapter and explicit parser value for lifecycle calls,
   then implement versioned identity, activation, conformance, and bounded
   profile-error schemas; one config-root resolver; and one atomic profile
   transaction/lock. This slice closes only resolver rejection and profile
   collision; later slices exercise the same mechanisms
   with canonical plugin bytes, catalogue reconciliation, and status. It adds no
   second persistence framework. Platform/config-root cases inject a named
   `PlatformEnvironment` port so native-Windows precedence is exercised on the
   required Ubuntu lane without pretending the runner is Windows. Non-canonical
   plugin bytes without valid identity are a collision, never repairable managed
   drift. Land the slice-3 scenario IDs RED first.
4. Generate the stable profile plugin and canonical dispatcher transport. It
   is inert and writes no evidence outside marked projects; inside one it maps
   every covered input exactly, spawns without a shell, preserves exit 0/2,
   denies malformed/unexpected failures closed, and writes bounded evidence
   without changing the guard decision when persistence fails. Marker lookup
   itself is bounded and fail-open on error before any project marker is found,
   with injected permission/error/timeout proofs so unrelated projects cannot
   be stalled or denied. A confirmed marked project with an unavailable bound
   dispatcher denies with the single reinstall action. Repoint slice 1 at this
   production boundary and prove interrupted replacement exposes only the
   previous complete production plugin locally. The dispatcher module and its
   hidden hook-helper catalogue route both land here. Installation records the
   installer's absolute `process.execPath` plus the profile-owned dispatcher
   path and hash. Copying the dispatcher into the managed config root keeps a
   `bunx` cache prune from invalidating an otherwise healthy installation. The
   generated dispatcher stays Node/Bun-compatible; hooks spawn only the recorded
   paths, never their own runtime, `bunx`, a shell, or network resolution. Either
   path missing or mismatched is one unavailable dispatcher binding: status keeps
   `installed=true` while setting activation and conformance false, and a confirmed project denies with the approved reinstall
   action. TBU1.R2.S12's three rows remain literal dispatcher cases; one
   additional integration case removes the recorded runtime and proves the same
   single unavailable-binding state. The stable plugin client does not expose
   v2's `global.health()` method, so hook dispatch never performs version I/O;
   exact host version belongs to conformance/status evidence. Marker lookup is
   re-run per event with a 50 ms fail-open deadline. The allow arm reuses the
   repointed slice-1 real-host fixture for all five covered tool kinds. The warm direct-dispatch plus evidence-write
   budget is a 250 ms per-iteration maximum across 20 warm runs on the
   development baseline.
   Policy denial always carries a non-empty sanitized
   reason. Land the slice-4 scenario IDs RED first. This slice is a necessary
   production-boundary proof; TBU1.R4 is not green yet.
5. Add explicit OpenCode selection and generate only plural
   `.opencode/commands` and `.opencode/agents` declarative stubs from canonical
   inventories. Reuse `.claude/skills`, prohibit project plugins, retire stale
   managed stubs, and keep `.agents/skills` retired. One preflight validates the
   profile destination before either surface commits; a profile preflight failure
   changes neither surface. Project assets then follow the existing per-file
   reconciliation rules: a colliding user file is preserved, non-colliding stubs
   still reconcile, and the project result reports the conflict. If catalogue
   commit fails after the profile commits, retain the machine-wide profile guard
   and never roll back protection used by other projects. The project result is
   ordered before adapter results. Extend the canonical subagent inventory with
   one procedure target per entry while origin-main fixtures keep Claude/Cursor
   generated bytes identical. Reuse the Codex durable-write/lock primitives via
   the smallest shared helper only after slice-2 fixtures protect their behavior.
   Catalogue conflict is an install/uninstall
   result and does not enter
   the frozen status-precedence list. Generated-frontmatter parsing covers the
   complete inventory from the one shared template. Project catalogue effects
   join the already-accepted explicit parser value here; published help/docs and
   the generic four-adapter contract wait for slice 6a. Upgrade is
   install-over-existing and lands with
   this same path. Land the slice-5 scenario IDs RED first.
6. Finish the production boundary in two independently green checkpoints:
   **6a** productionizes the slice-1 loopback fixture into the shell-free
   conformance runner with isolated
   HOME/config/project setup, conformance evidence writer, and invalid-executable
   remediation. Register the public `conformance` leaf through `cli-protocol` with schema-v1 JSON,
   `--json --no-input`, deterministic invocation fixtures, generated command
   reference, `mutate`/`never`/`never` effect-prompt-network policy, and the exact
   four-agent value set. It performs no external
   network work: offline mode may use an already-installed pinned executable and
   loopback, but never downloads one. The isolated profile uses byte-identical
   managed plugin bytes and matching identity hash; armed/disarmed policy lives
   only in separate temporary fixture projects. Land the 6a scenario IDs RED first.
   **6b** wires generic lifecycle/status coordination and deterministic
   health/action precedence. **6c** adds plan effects, shared-consumer
   reconciliation, and repository-wide compatibility sweeping through the same
   injected-registry coordinator. Existing `doctor` continues
   through the shared observer and gains no separate contract. Desktop remains
   documentation-only unsupported; CLI/TUI support is earned by the same pinned
   process boundary. Land each checkpoint's scenario IDs RED first.
7. Add only residual cross-cutting Cucumber wiring, promote the repointed
   production conformance fixture into the single required Ubuntu CI lane,
   prove interrupted replacement, the real catalogue/denial boundary, and
   persisted-evidence privacy there; turn TBU1.R3.S16 and TBU1.R4.S01-S05/S07 green,
   update customer/project docs and the MIT notice,
   then run full BDD and
   repository verification. The disposable slice-1-only fixture does not remain
   as a second CI gate.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| [OpenCode stable plugin contract](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/plugin/src/index.ts) | 2026-08-26 | 1.18.23 commit ef2880f | 1.18.23 | Defines the exact `tool.execute.before`, `tool.execute.after`, and `shell.env` inputs used by the adapter | Adapt to native lifecycle events and declare their real strength | MIT upstream; no source copied; throwing is verified by the real-process fixture rather than assumed |
| [OpenCode config loader](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/config/config.ts) | 2026-08-26 | 1.18.23 commit ef2880f | 1.18.23 | Shows global and custom directories plus auto-discovered plugin/catalogue loading | Install executable trust at profile scope without editing user config | Loader behavior is version-bound and conformance-gated |
| [OpenCode test provider](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/test/lib/test-provider.ts) | 2026-08-26 | 1.18.23 commit ef2880f | 1.18.23 | Demonstrates a credential-free OpenAI-compatible loopback provider for real CLI tool calls | Prove the runtime boundary with deterministic protocol fixtures | Vendor only the minimal protocol shape under MIT attribution; never execute retrieved code |
| [OpenCode generated SDK](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/sdk/js/src/gen/sdk.gen.ts) | 2026-08-26 | 1.18.23 commit ef2880f | 1.18.23 | Exposes `client.global.health()` with the running server version | Read version once after confirmed enrollment under a fail-open deadline | Local SDK call only; unmarked projects never call it and the value never becomes a support claim |
| [OpenCode external plugin loader](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/plugin/index.ts#L106-L225) | 2026-08-26 | 1.18.23 commit ef2880f | stable 1.x profile plugin | `PluginInput` carries no runtime version, while external module/load initialization errors are caught and skipped | Keep the generated module top-level inert and use exact-version conformance, not an unavailable in-plugin version gate | MIT upstream; hook-time failures still follow Safeword's approved covered/uncovered and deny-closed contract |

**Decision impact:** changed: use stable native hooks plus a profile plugin and
credential-free conformance instead of the earlier project-plugin/IPC design.
**Decision informed:** Use a stable OpenCode profile plugin with pinned real-process conformance

### Recorded Decisions

| Decision                                                                  | Choice                                                                                                                                                         | Alternatives considered                                                                                               | Rejected because                                                                                                                                          |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use a stable OpenCode profile plugin with pinned real-process conformance | Generate one managed global plugin for stable 1.x and guarantee exactly 1.18.23 until another exact version passes                                             | Project plugin; beta V2; prose-only integration                                                                       | Project executable trust is too implicit, V2 is not stable, and prose cannot enforce a tool boundary                                                      |
| Coordinate integrations through a typed registry                          | One adapter declares project surfaces, profile operations, capabilities, evidence, and conformance; the project surface remains first                          | Add OpenCode `if` branches; replace host-native modules                                                               | More branching repeats current drift; replacing native modules risks migrations and trust behavior                                                        |
| Store bounded hashed observations                                         | Versioned identity, activation, and conformance records with hashes and a seven-day activation boundary                                                        | Live IPC; raw IDs/logs; installed-only status                                                                         | IPC is unnecessary for the initial boundary, raw data leaks context, and presence is not execution proof                                                  |
| Standardize proof behind generic lifecycle surfaces                       | Add `conformance --agents=<integration>` and adapter-declared plan effects/status dimensions                                                                   | OpenCode-only commands; host-name coordinator branches                                                                | A host-specific API recreates the drift this feature is meant to remove                                                                                   |
| Protect legacy behavior with immutable normalized fixtures                | Canonicalize sorted results/trees, relative paths, fixed clocks, and version placeholders from origin/main                                                     | Raw snapshots; regenerate-on-change snapshots; unit-only migration tests                                              | Raw fixtures are flaky and mutable fixtures cannot detect adapter regressions                                                                             |
| Reuse existing filesystem primitives                                      | Build the OpenCode profile transaction from the Codex durable-write/profile-lock patterns with OpenCode-specific ownership rules                               | New transaction library; ad hoc writes in each command                                                                | A new abstraction or dependency adds risk without behavior the approved scenarios require; ad hoc writes lose atomicity and consistent collision handling |
| Gate support by exact-version conformance                                 | The profile plugin uses only the stable hook surface and has no top-level side effects; status calls a version supported only after exact-boundary conformance | Read an unavailable runtime version inside `PluginInput`; reject all future versions; guess compatibility from semver | The pinned API exposes no runtime version to plugins, the host isolates external load failures, and semver alone cannot prove tool mapping or denial      |

## Design alignment

| Principle                                         | Consequence                                                                                                                                                                                                                                                                               | Proof                                                                                   | Conflict                                                                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Optimize for the NTB without constraining the TBU | Status derives one plain summary/action from independent technical dimensions while retaining machine-readable evidence                                                                                                                                                                   | `packages/cli/features/opencode-parity.feature` NTB1 rules                              |                                                                                                                                                        |
| 1. Structure enforces; instructions suggest       | Covered calls use a blockable native pre-tool hook and real-process no-side-effect proof                                                                                                                                                                                                  | `packages/cli/features/opencode-parity.feature` TBU1.R2/R4                              |                                                                                                                                                        |
| 2. Fire at boundaries, not every turn             | Only native lifecycle boundaries run plugin logic; no conversational polling or exact-call IPC                                                                                                                                                                                            | profile plugin hook inventory and adapter capability tests                              |                                                                                                                                                        |
| 3. Add, never replace                             | Install never edits `opencode.json`; reconciliation preserves unknown and shared content                                                                                                                                                                                                  | TBU1.R1/R3 scenarios                                                                    |                                                                                                                                                        |
| 5. Correct and safe; then clear; then simple      | Keep the behavior-required registry, four independently invalidated records, native plugin, reused transaction/lock, and real-process conformance; fold mapping, catalogue, and health into ordinary modules and add no IPC, persistence framework, project plugin, or runtime dependency | Scenario ownership map, exact evidence invalidation, and existing filesystem primitives | The unified 99-scenario feature exceeds the split heuristic; the user retained one feature, so seven prerequisite-correct slices contain the coupling. |

Architecture decisions honored: schema-as-authority reconciliation,
project-default Claude plugin declarations, Codex packaged-plugin migration,
and host-native proof boundaries in `ARCHITECTURE.md`. This plan retains the
“Registry-Driven Agent Integrations with Native Trust Boundaries” decision.

## Known deviations

OpenCode Desktop is unsupported in the initial release because stable 1.x does
not expose a reliable runtime-kind signal and current Desktop can register
local plugins without dispatching hooks. CLI/TUI 1.18.23 on Ubuntu CI is the
supported blocking boundary.

The generated profile plugin cannot gate on host version at load because the
stable `PluginInput` does not expose one. It therefore keeps top-level loading
side-effect-free and relies on OpenCode's isolated external-plugin loader;
Safeword status never calls a non-baseline boundary supported until exact-version
conformance passes. Unknown tool identifiers remain observational and cannot be
presented as covered blocking protection.

Native-Windows root precedence is proven through the injected platform port,
not a Windows filesystem. Drive-letter, case-insensitive collision, rename, and
fsync behavior remain outside the initial Ubuntu-supported conformance boundary.

A project-catalogue I/O failure after the profile commit retains the machine-wide
guard and reports the project reconciliation failure. This preserves protection
for other projects but can leave the current project's catalogue incomplete;
the approved contract covers preflight/collision behavior, not this late I/O arm.

The approved feature has 99 scenarios and more than five major components,
which crosses Safeword's suggested split checkpoint. Alex explicitly said
“Go” after approving the unified contract, so delivery remains one feature
with seven independently verified slices rather than restarting child tickets.

## Doc impact

- `README.md`: add OpenCode selection, parity matrix, support boundary, and
  repair/status examples, including that explicit profile uninstall removes the
  machine-wide guard used by other projects under that config root.
- `packages/website/src/content/docs`: add installation, lifecycle capability,
  evidence, version, Desktop caveat, machine-wide uninstall documentation, and
  regenerated CLI command reference.
- `ARCHITECTURE.md`: retain the registry/native-boundary decision and add the implemented OpenCode module map.
- `.project/surfaces.md`: mark OpenCode and CLI delivery as implemented.
- `.project/personas.md`: include OpenCode in the local-agent examples.
- Project glossary (`paths.glossary`): define the durable integration, catalogue,
  lifecycle, activation, conformance, and truthful-parity terms used in public docs.
- `THIRD_PARTY_NOTICES.md`: retain the OpenCode MIT notice for the minimal
  loopback protocol fixture.

## Assessment triggers

Revisit when marker lookup exceeds its 50 ms deadline or any of 20 warm
direct-dispatch plus evidence-write runs exceeds 250 ms in the slice-4 fixture
environment recorded in the work log, OpenCode V2 is stable, Desktop proves hook dispatch, stable 1.x
changes plugin loading/tool identifiers/config roots, a second consumer needs
live call receipts, the seven-day boundary produces false status, or the
registry cannot represent a future integration without host-name branching.
