# Impl Plan: Ship Safeword as a native Claude Code plugin

**Status:** planned

## Approach

The riskiest assumption is that a generated plugin can execute entirely from
Claude's installed cache, record proof from that exact cache root, and switch
from proof-only to functional authority in the current task after legacy
settings disappear. The cheapest load-bearing slice packages the identity,
minimal proof writer, and dispatcher entrypoint; installs it into an isolated
Claude profile; renames the marketplace source checkout while retaining both
marketplace registration and the installed cache; runs SessionStart through
`--init-only`; and asserts the proof's version, manifest hash, and canonical
root. UserPromptSubmit is proved through the real entrypoint integration in
this slice and through the authenticated opt-in live prompt lane later—
`--init-only` does not submit a prompt. Build this first; it invalidates the
architecture cheaply if Claude's cache boundary behaves differently.

Build order and proof:

1. **Generated plugin vertical slice.** Add failing catalogue, package-content,
   duplicate-name, transitive-reference, identity, and isolated cache execution
   integration tests; implement the Claude catalogue compiler,
   `generate:claude-plugin`, immutable identity validation, minimal proof
   writer, and proof-only hook entrypoint. The cache smoke asserts the source
   checkout is unavailable, marketplace registration remains present, and the
   installed cache remains present before launching Claude. Primary proof:
   integration, because the contract is the emitted filesystem bundle and
   Claude's cache loader. Supporting unit tests cover deterministic
   transformations and validation errors. Bind the corresponding SWM1.R1/R4,
   TBU1.R3, and live-proof Gherkin groups in this slice.
2. **Proof-aware hook dispatch.** Add failing hook integration tests for
   SessionStart/UserPromptSubmit proof, identity mismatch, per-event viable
   legacy suppression, no-legacy functional execution, and same-task authority
   after settings cleanup. Implement the per-event authority resolver using
   schema inventory, extending the minimal proof writer rather than introducing
   it here. Primary proof: integration through real hook entrypoints; unit proof
   covers the viability matrix. Bind NTB1.R1 and TBU1.R5 Gherkin groups as they
   turn green.
3. **Typed profile lifecycle and status.** First run a real Claude 2.1.170
   isolated-profile contract lane for current JSON shapes, tagged-source
   resolution, scope behavior, enable/update semantics, and partial failure
   effects. Add public CLI integration tests with an isolated fake Claude
   executable/profile for supported-version install, missing/disabled/old
   convergence, unofficial marketplace refusal, idempotence, command
   failures/effect journaling, and the complete status precedence/exit-code
   table. Implement the profile adapter, observer, state derivation, command
   catalogue, handlers, and registration. The exact source algorithm maps CLI
   `VERSION` to `https://github.com/ArcadeAI/safeword.git#v${VERSION}`, fails
   closed on a different repository, rebinds an official different ref only
   when version convergence requires it, and verifies the installed cache
   reports that exact enabled version. Every possible preflight read occurs
   before mutation; mandatory postcondition reads follow it and report the
   completed-effect journal if observation fails. Each successful command is
   journaled in `Result.effects`, because empirical add/remove on an isolated
   real profile did not restore byte-identical private files. Primary proof:
   public CLI integration; unit tests cover pure state
   precedence. An opt-in slow real-Claude lane covers missing, exact, older, and
   newer official revisions plus at least one post-mutation failure. Bind
   TBU1.R1/R4 and NTB1.R2 Gherkin groups in this slice.
4. **Recoverable project cleanup.** First characterize existing Codex
   finalization/recovery behavior. Extract the host-neutral transaction without
   changing those tests, then add failing Claude cleanup/recovery integration
   tests for current/historical fingerprints, structural settings removal,
   custom preservation, confirmation/plan identity, stale or invalid proof,
   interruption, concurrent edit, symlink/path escape, no-op, and deterministic
   recovery. Primary proof: filesystem integration; supporting unit tests cover
   fingerprint classification and mutation planning. The immutable registry
   initially covers project-local Claude materializations from v0.70.0 and the
   building CLI's exact `SAFEWORD_SCHEMA.version` (currently 0.71.0-rc.0),
   captured before plugin-path transformations; every registered asset and the
   adjacent unsupported v0.69.0 are fixtures. Bind TBU1.R2 and NTB1.R3/R4
   Gherkin groups in this slice.
5. **Fresh/legacy/plugin-mode reconciliation.** Add failing setup integration
   tests for fresh-native suppression, existing-legacy preservation, complete
   profile non-mutation, plugin-mode non-recreation, and shared Cursor runtime
   retention. Implement one-time delivery-mode detection in `ProjectContext`,
   `SAFEWORD_SCHEMA.claudeMigration`, and conditional Claude-only file/settings
   definitions. Primary proof: setup integration against full reconciliation.
   Bind the fresh, legacy-upgrade, and plugin-mode setup Gherkin groups here.
6. **Release, parity, and documentation contracts.** Add/extend release tests
   for marketplace/package version alignment, generated-tree drift, schema
   registration, package contents, hook/skill/command/agent completeness, and
   behavioral parity with documented host exceptions. The installed artifact is
   the committed root `plugin/` referenced by the root marketplace in the
   official Git tag, not a second npm copy. Wire
   `generate:claude-plugin --check`, `claude plugin validate`, tag/version
   alignment, and a tag-checkout cache smoke into CI/release before npm publish.
   Update `README.md`, the configured website docs, plugin README, and maintainer
   generation/release instructions. Primary proof: release and integration
   suites; documentation examples are exercised through public command fixtures
   where practical. Bind the SWM1.R2/R3 release and parity Gherkin groups here.
7. **Cross-slice final verification.** Complete only the explicit
   interactive-trust and authenticated `/reload-plugins` acceptance report as
   `@manual`/opt-in `@live`; all automatable Gherkin groups were bound in their
   implementation slices. Run targeted suites after each green slice, then one
   full suite, typecheck, lint, Gherkin lint, build, release tests, and the
   non-interactive BDD lane.

This remains one ticket despite the breadth: the four implementation components
share one status precedence, proof identity, schema inventory, and cleanup
transaction. Splitting them into independently releasable tickets would create
intermediate states that either materialize an unusable plugin or expose cleanup
without verified authority. The seven slices are stacked development commits
behind one merge and release gate. The shipped root bootstrap plugin is not
replaced until the full migration contract and release checks are green, so no
partial slice can be published.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Plugin contents | Deterministically generate a complete cache-local `plugin/` tree from canonical templates | Hand-maintain plugin copies; dispatch to project `.safeword`; fetch runtime at hook execution | Copies drift; project dispatch defeats native delivery; runtime network access breaks reproducibility |
| Proof store | Exact version/hash/root proof under `${CLAUDE_PLUGIN_DATA}` | Treat `plugin list` as proof; store proof in each project | Listing proves configuration, not execution; project proof cannot establish profile cache identity |
| Migration safety | Extract host-neutral durable transaction with Codex and Claude adapters | Copy Codex finalization; call Codex-named implementation directly | Copying forks destructive safety logic; direct reuse leaks Codex policy into Claude |
| Reconciliation | Compute `fresh-native`, `legacy`, or `plugin-mode` once in project context | Check files independently in each generator; always stop writing Claude assets | Independent checks can disagree; unconditional suppression breaks existing protected projects |
| Profile mutation | Public Claude commands, read-only preflight, and exact completed-effect journaling | Edit private profile JSON; claim byte-identical compensation | Private storage is unsupported; Claude 2.1.170 add/remove empirically leaves profile bytes changed, so a rollback claim would be false |
| Release source | Official Git tag with committed root marketplace and generated `plugin/`; npm carries the lifecycle CLI | Duplicate plugin inside npm; install from moving default branch | Claude already caches the tagged relative source; duplication can drift and an unpinned branch cannot guarantee CLI-version equality |
| Activation | User runs `/reload-plugins`; next UserPromptSubmit records proof | Restart required; automate interactive reload | Supported reload meets the live-task goal; Safeword cannot safely drive interactive task commands/trust |
| Workflow names | Skills canonical; emit flat commands only without a same-name skill | Preserve every legacy command alias | Claude namespaces plugin skills and duplicate invocation names are ambiguous |

The detailed interfaces and state flows are in [design.md](./design.md).
Marketplace tag/ref and cache behavior follow the current
[Claude marketplace documentation](https://code.claude.com/docs/en/plugin-marketplaces)
and [plugin discovery documentation](https://code.claude.com/docs/en/discover-plugins).

## Arch alignment

- **Schema as Single Source of Truth** — Claude migration paths, events,
  fingerprints, and markers are registered centrally.
- **Reconciliation Over Copy** — setup derives a delivery mode and converges
  only the assets appropriate to that mode.
- **Agent Parity** — canonical workflow IDs map across Claude, Cursor, and Codex
  with explicit host exceptions.
- **Profile-Scoped Generated Codex Plugin and Staged Hook Migration** — Claude
  adopts the same Expand -> Prove -> Contract safety shape while keeping its
  host policy separate.
- **Typed CLI Execution and Discovery** — all four public commands use the v1
  result envelope, catalogued options, deterministic exit codes, and public
  registration.
- **Explicit Project Enrollment** — profile installation never creates project
  state; setup/cleanup remain explicit project operations.
- **Continuous Quality Gates** — plugin hooks preserve event semantics and
  project-owned workflow evidence rather than bypassing phase enforcement.

## Known deviations

skip: no deviations planned. Claude-specific reload, trust, namespace, matcher,
and cache semantics are documented host adapters, not departures from the
shared architectural contracts.

## Doc impact

- `README.md`: installation, fresh setup, migration, live reload, status states,
  cleanup/recovery, architecture, FAQ, and maintainer generation instructions.
- `packages/website/src/content/docs/`: equivalent end-user setup, upgrade, and
  troubleshooting guidance wherever Claude/project-local delivery is described.
- `plugin/README.md`: replace bootstrap-only/new-session guidance with the
  generated native bundle, CLI lifecycle, `/reload-plugins`, coexistence, and
  cleanup boundaries.
- `.claude-plugin/marketplace.json`: continue as the Claude plugin version
  authority and document release alignment through tests, not a duplicate
  version in the relative plugin manifest.
- `ARCHITECTURE.md`: update the existing plugin migration decision family to
  record the shared host-neutral transaction and Claude's same-task reload/proof
  boundary once implementation proves the design.

These updates are task 6 and must land with the behavior they describe.

## Assessment triggers

- Claude exposes a supported non-interactive reload/trust API or changes the
  UserPromptSubmit ordering guarantee.
- Claude changes plugin cache layout, `${CLAUDE_PLUGIN_ROOT}`,
  `${CLAUDE_PLUGIN_DATA}`, marketplace identity, or `plugin list --json` shape.
- A second host needs the same catalogue transformation, prompting a fully
  host-neutral workflow compiler rather than shared traversal helpers.
- Historical fingerprint inventory grows beyond a small release-bounded list,
  prompting signed manifests or a migration registry.
- Cursor gains a native plugin boundary and no longer needs shared materialized
  `.safeword` runtime assets.
- Setup delivery-mode detection encounters an ambiguous legacy project class
  that cannot be resolved from positive schema-owned evidence.
