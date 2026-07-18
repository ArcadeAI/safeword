# Impl Plan: Give Codex users the full Safe Word workflow

**Status:** implemented

## Approach

**Riskiest assumption:** a complete generated skill catalogue can be delivered
from the installed Codex cache, rather than the checkout, a marketplace source,
or a project copy. The cheapest proof is a release contract that compares every
committed plugin file with a pure generator result, then creates a real
`bun pm pack` tarball, installs from its extracted `codex-plugin/`, deletes all
source copies, and starts a new isolated Codex session from the cache.

| Scenario / surface                                        | Primary proof          | Supporting proof and reason                                                                                                                                  |
| --------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TBU1.R1` complete skills and references | Release + live acceptance | Generate from canonical files, compare the complete entry/reference inventory and transformed content, then invoke `$safeword:bdd` in the cache-only plugin to obtain an unguessable phase-reference fixture marker. |
| `TBU1.R1` missing phase material | Release | Mutate a generated/committed asset fixture and require the package and cache contract to fail after marketplace/extraction removal. |
| `TBU1.R2` fresh setup boundary | Integration | Run public `setup` in a fixture; assert migration guidance and no workflow tree in `.agents`, `.codex`, or `.safeword`. |
| `TBU1.R2` project output rejection | Integration | Make the package/cache integration helper reject any Safe Word workflow tree that appears in the target project, including after initial migration. |
| `TBU1.R3` initial migration | Integration | Drive public CLI against fake Bun/Codex executables, preserve exact config bytes, and assert `/hooks` plus explicit cleanup guidance. |
| `TBU1.R3` cleanup, no-cleanup, and failed install | Integration | Exercise `--remove-legacy-hooks`, custom/parent-group preservation, malformed TOML, backup semantics, and all failed process boundaries with real helpers. |
| `TBU1.R4` new untrusted hook | Opt-in live + manual acceptance | Automated no-bypass `codex exec --json` proves marker absence; required interactive TUI acceptance records the visible review screen and `/hooks` route. |
| `TBU1.R4` changed hook | Manual live acceptance | Trust through `/hooks`, edit the actual returned `installedPath` cache hook definition, restart, and record the renewed review screen and absent marker. |
| `SWM1.R1` deterministic transform and 8,000-character cap | Unit/release | Table-driven transformer tests for allowed rewrites, malformed/unknown metadata, drift, over-budget inventory, and the direct persona-lineage policy. |
| `SWM1.R2` packed package completeness | Release | `bun pm pack` a real tarball, extract it, and compare its plugin inventory against the dynamic catalogue; omit each class of required asset in a fixture. |
| `SWM1.R3` cache-only installation | Opt-in live | Parse `plugin add --json`, require `installedPath` to realpath beneath isolated `CODEX_HOME/plugins/cache/` and not link to extraction, then delete marketplace/extraction before cache inventory, scoped invocation, and missing-cache failure. |
| `SWM1.R4` Bunx-only safe hooks | Release | Dynamically inspect every hook for exact `bunx --bun safeword@<package version>` form; reject npx, unpinned version, and trust-bypass independently. |
| Feature-source wiring | Cucumber integration | Refactor the one overlapping migration phrase to a shared fixture helper; add only non-conflicting real-action steps and run Cucumber dry-run plus full lane. |
| OpenAI Codex                                              | Release + live E2E     | Source/package/cache proof chain plus no-bypass session covers the runtime.                                                                                  |
| Safeword CLI                                              | Integration            | Public setup/migrate tests cover the CLI surface.                                                                                                            |

The `.feature` file remains the behavior source. The first RED starts with
`test:bdd --dry-run`: the existing `When the builder migrates Codex to the
plugin` is registered once and will be refactored behind a shared fixture
helper. The new step file registers only phrases not already in the global
registry; it has no boolean placeholder steps. It will also replace the
existing package booleans in `migrate-codex-plugin.steps.ts` with real helper
calls, because the new scenarios cover those same release paths. The two
interactive-warning scenarios are tagged `@live @manual`; ordinary BDD stays
deterministic. The separate automated `@live` Vitest lane is opt-in acceptance
evidence, not a CI-required release gate, until CI provisions authenticated
Codex credentials.

The final command model is exact: root `test:bdd` becomes
`cucumber-js --tags 'not @wip and not @manual and not @live'`; root
`test:bdd:live` is `cucumber-js --profile live`; package `test:bdd` becomes
`cucumber-js --tags 'not @wip and not @manual and not @live'`; and package
`test:bdd:live` is `cucumber-js --tags '@live and not @manual'`. This prevents
the root script from overriding its config's safe default with `not @wip` alone.
Real cache-session scenarios receive `@live`; the two interactive warning
scenarios receive `@live @manual`. Manual scenarios are release-checklist work
described in `tests/smoke/codex-plugin-manual-acceptance.md`, never a passing CI
substitute.

The following is the binding contract for the Cucumber step file. It must call
these shared real helpers and their observable assertions, never set or inspect
test-only booleans. The existing migration phrase is registered once and calls
`migrationFixture.migrate`; all other phrases are new and unique in the global
registry.

| Feature scenario | Concrete helper and assertion | Lane |
| --- | --- | --- |
| Complete profile plugin exposes every workflow entry and phase reference | `catalogueContract.assertComplete()` and `cacheProbe.assertScopedReference(marker)` | release + `@live` |
| Missing phase material rejects the plugin release | `catalogueContract.assertMissingReferenceRejected()` | release |
| Fresh setup keeps workflow material out of the project | `setupFixture.run()`, `assertCodexMigrationGuidance()`, and `assertNoProjectWorkflowTree()` | integration |
| Project-local workflow output rejects the integration | `assertNoProjectWorkflowTree()` with an injected target write | integration |
| Initial plugin migration preserves legacy hooks and explains the handoff | `migrationFixture.migrate()`, `assertExactOriginalBytes()`, and `assertHandoffGuidance('/hooks', '--remove-legacy-hooks')` | integration |
| Completed handoff removes only legacy Safe Word hooks | `migrationFixture.cleanup()`, `assertNoOwnedHandlers()`, and `assertCustomBytesUnchanged()` | integration |
| Initial migration does not clean up hooks without an explicit handoff request | `migrationFixture.migrate()`, `assertExactOriginalBytes()`, and `assertHandoffGuidance('/hooks', '--remove-legacy-hooks')` | integration |
| Failed plugin installation retains legacy hooks | `migrationFixture.installFails()`, `assertExactOriginalBytes()`, and `assertRemediationMessage()` | integration |
| New plugin hooks require review before they run | `manualHookTrustAcceptance.newDefinition().assertReviewScreenAndMarkerAbsent()` plus `liveHookProbe.assertMarkerAbsent('new')` | `@live @manual` + opt-in live |
| Changed plugin hooks require review again | `manualHookTrustAcceptance.changedDefinition().assertReviewScreenAndMarkerAbsent()` plus `liveHookProbe.assertMarkerAbsent('changed')` | `@live @manual` + opt-in live |
| Allowed adaptations preserve workflow meaning | `catalogueContract.assertAllowedTransform()` | unit/release |
| Generated skill metadata fits Codex's documented fallback discovery budget | `catalogueContract.assertMetadataBudget()` | unit/release |
| Over-budget skill metadata rejects the plugin release | `catalogueContract.assertOverBudgetRejected()` | unit/release |
| Unexpected workflow drift rejects generation | `catalogueContract.assertUnexpectedDiffRejected()` | unit/release |
| Packed package contains the complete generated plugin | `packContract.assertTarballInventory()` | release |
| Missing packed plugin asset rejects publication | `packContract.assertOmittedAssetRejected()` | release |
| Cached installation exposes scoped workflow skills without project files | `cacheProbe.installFromTarballAndAssertCacheOnly()` | `@live` |
| Project copies cannot mask a missing cached plugin asset | `cacheProbe.assertMissingCacheAssetRejectedDespiteProjectCopy()` | release + `@live` |
| Plugin hooks invoke the pinned Safe Word CLI through Bunx | `hookManifestContract.assertPinnedBunx(readPackageVersion())` and dynamic Bunx shim | release |
| Unsafe hook path: npx execution | `hookManifestContract.assertViolationRejected('npx execution')` | release |
| Unsafe hook path: unpinned CLI version | `hookManifestContract.assertViolationRejected('unpinned CLI version')` | release |
| Unsafe hook path: hook-trust bypass flag | `hookManifestContract.assertViolationRejected('hook-trust bypass flag')` | release |

The first migration RED protects the highest-risk current mismatch:
`migrateCodexPlugin()` currently removes legacy hooks on its initial path with
regex-style deletion and a best-effort backup. Its first GREEN must reverse
that behavior before any cleanup implementation is considered complete.

Build order:

1. **ADR before TDD.** Immediately after the reviewed ticket transitions to
   `implement`, append the accepted ADR described below to `ARCHITECTURE.md`.
   This is documentation-only; no application or test code may change before
   it lands.
2. **Cucumber wiring: RED.** Add the shared fixture/process helpers and the
   matrix's real assertions, replace every existing boolean placeholder, tag
   actual-session scenarios, and make both BDD scripts exclude `@live` and
   `@manual`. Prove the red state with `test:bdd --dry-run` and focused
   scenarios that fail on real contracts, not absent phrases.
3. **Cucumber wiring: GREEN then REFACTOR.** Implement only the fixture and
   registration seam until `test:bdd --dry-run` has no undefined or ambiguous
   registrations. The full BDD lane remains intentionally red while later
   helper contracts are still absent. After each following slice, run its Rule
   tag plus matching Vitest tests to green and check off only that scenario's
   ledger entries; require full `test:bdd` green only after the final slice.
4. **Catalogue: RED.** Add failing pure/release contracts for full inventory,
   allowlisted transformation, malformed metadata/path, reference drift,
   metadata budget, and the direct persona-lineage rule. Update
   `tests/persona-code-policy.test.ts` to expect generated BDD references.
5. **Catalogue: GREEN then REFACTOR.** Implement the pure catalogue and writer,
   generate the full checked-in skill/reference tree, make the red contracts
   pass, then isolate shared transform parsing without changing output bytes.
6. **Package/cache: RED.** Add a failing `bun pm pack` extraction contract and
   failing cache fixture. It parses `installedPath`, validates `realpath` is a
   non-symlink child of isolated `CODEX_HOME/plugins/cache/`, removes the local
   extraction and marketplace, and then expects cache inventory, scoped
   reference invocation, no project tree, and a missing-cache failure despite a
   copied project asset.
7. **Package/cache: GREEN then REFACTOR.** Implement the tarball/cache helpers
   until those package and opt-in live assertions pass; refactor only after the
   source/deletion boundary remains observable. `prepublishOnly` continues to
   run the deterministic release suite without Codex credentials; authenticated
   `test:smoke:live` stays opt-in acceptance evidence.
8. **Migration cleanup: RED.** Add failing public CLI tests for initial
   retention, explicit cleanup, no-cleanup, failed/missing/disabled plugin,
   help text, malformed TOML, comment-marker false positives, CRLF/no-final
   newline, quoted and multiline strings, mixed event groups, backup races,
   and injected backup/write/rename failures.
9. **Migration cleanup: GREEN then REFACTOR.** Add `smol-toml`, the fail-closed
   structural scanner, `--remove-legacy-hooks`, exclusive backup, and atomic
   replace until every migration test passes. Extract the narrow scanner and
   filesystem seams only after tests are green. The initial migration path must
   preserve every legacy hook in its first GREEN: no intermediate GREEN may
   retain today's automatic cleanup behavior.
10. **Trust/docs: RED, GREEN, REFACTOR.** First add the no-bypass marker test and
   the manual acceptance document; then make the automation pass and record a
   successful interactive new/changed-hook run. Update README, CLI reference,
   hooks/skills reference, quick start, and FAQ. Run release,
   integration, BDD, lint, typecheck, opt-in live acceptance, audit, quality
   review, and refactor at feature exit, checking off each scenario's existing
   RED/GREEN/REFACTOR ledger entries as its slice completes.

The Cucumber RED also supersedes the completed `YH2ZRN` migration acceptance
contract that currently says verified initial migration removes hooks. Update
`packages/cli/features/migrate-codex-to-plugin.feature` Rule `TB1.R2` and its verified
migration scenario to say initial migration verifies/enables the plugin,
preserves legacy Safe Word handlers, and prints `/hooks` plus
`--remove-legacy-hooks` handoff guidance. Update its `TB1.R3` mixed-config
scenario to assert both custom bytes and legacy handler retention; keep its
failure cases unchanged. Add a short supersession note to the historical
`YH2ZRN` spec/test-definition artifacts pointing to `MZH9QH`, while this
ticket's feature remains the authoritative cleanup behavior. The shared step
helper and command tests must drive that updated contract, not leave the old
automatic-cleanup scenario green by accident.

The manual record uses only the cache path returned by `plugin add --json` after
the marketplace/extraction are deleted. It records `codex --version`, captures
the new-hook `Hooks need review` screen, chooses continue-without-trusting, and
proves the unique marker is absent. It then trusts the hook through `/hooks`,
changes only the cached hook `statusMessage` to a unique new string, starts a
new session, captures the renewed one-hook review screen, chooses
continue-without-trusting again, and proves the marker is still absent. That
matches the current interactive behavior without using a trust bypass or private
trust storage.

This is four coupled implementation components: generator, release/cache proof,
migration, and documentation. Cucumber glue is test wiring rather than a
separate product component. The work remains one ticket because the
migration-safety promise depends on the generated artifact and its tests
shipping together.

### Cache Proof Contract

`packContract` runs `bun pm pack --destination <temp> --quiet` from
`packages/cli`, extracts the one tarball, and creates a temporary marketplace
whose sole Safe Word plugin source is `<extract>/package/codex-plugin`. It
parses the successful `codex plugin add ... --json` response, resolves
`installedPath` with `realpath`, and fails unless that path is a non-symlink
descendant of `<isolated-CODEX_HOME>/plugins/cache/`. It then deletes the
tarball, extracted package, and marketplace source before every cache assertion
or Codex session. The test explicitly proves that the retained cache path still
contains the dynamic catalogue and the BDD reference marker.

For the negative case, the fixture adds a byte-identical project copy of a
required reference, deletes the corresponding file from the verified cache,
and calls `cacheProbe.assertInstalledCacheMatchesCatalogue()`. The expected
result is a named missing-cache-asset error before any skill invocation; the
project copy, deleted extraction, and deleted marketplace cannot satisfy it.

### Cleanup Scanner Contract

`smol-toml.parse` first validates the entire original document. The raw-range
scanner is deliberately narrower than TOML: it only recognizes complete,
unquoted `[[hooks.<known-event>]]` and `[[hooks.<known-event>.hooks]]` headers
on their own line, where `<known-event>` is one of `SessionStart`,
`SubagentStart`, `PreToolUse`, `PermissionRequest`, `PostToolUse`,
`PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, or `Stop`.
Within a nested handler it recognizes one bare `command = <single-line TOML
string>` assignment, decodes that literal with `smol-toml`, and tests the
decoded command against the exact Safe Word marker set. Comments and other
assignments cannot make a handler owned.

Any candidate hook group using quoted/dotted keys, inline tables, an unclosed
or multiline command literal, duplicate command assignments, unrecognized
interleaving, or an unexpected header fails closed with no file mutation. The
scanner deletes only the selected handler byte ranges. It removes a now-empty
parent group only when its complete non-comment content matches the known Safe
Word scaffold; otherwise it retains the parent and every non-deleted byte
exactly, including CRLF, comments, and no-final-newline input.

Before replacing config, cleanup writes original bytes to a same-directory temp
file, `fsync`s it, and creates the backup with an exclusive same-filesystem
link. Existing backup or link-race failure aborts before config mutation. It
writes the cleaned bytes to another same-directory temp file with the original
mode, `fsync`s it, and renames it over config. Injectable filesystem seams prove
parse, scanner, backup, write, and rename failures leave the config unchanged;
after a post-backup write/rename failure, the valid backup contains exactly the
original bytes and temporary files are removed.

### Persona And ADR Contract

Add a lineage contract that parses the feature and spec: every executable
scenario has exactly one direct Rule tag, each tag resolves to its declared
`TBU1` or `SWM1` Rule and persona, and the test-definition heading carries the
same Rule prefix. Separately, `persona-code-policy.test.ts` must verify BDD
persona examples from generated plugin references, not a repository-local Codex
workflow tree.

The first documentation-only action after the `implement` transition appends
this accepted ADR to `ARCHITECTURE.md`: **Profile-scoped generated Codex plugin
and staged hook migration**. Its context is cross-agent parity without
repository workflow files; its decision is canonical generation, package-cache
proof, and explicit post-review cleanup; its alternatives are manual plugin
copies, runtime generation, and one-step hook deletion; its consequences are
generated-artifact maintenance, an opt-in live lane, and manual interactive
trust acceptance. It links the cache, plugin, and trust-API reassessment
triggers below.

## Decisions

| Decision                | Choice                                                                 | Alternatives considered                                           | Rejected because                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue delivery      | Pure generator plus checked-in package artifact                        | Manually maintain Codex skills; generate at customer runtime      | Manual copies already drifted to three skills; runtime generation cannot prove installed-cache behavior and adds customer-time failure modes. [Build plugins](https://learn.chatgpt.com/docs/build-plugins) |
| Transformation boundary | Strict allowlist and failure on unfamiliar metadata/reference forms    | Copy raw Markdown; broad regex rewriting                          | Raw source has non-Codex metadata and sibling paths; broad rewriting could silently alter workflow meaning. [Build skills](https://learn.chatgpt.com/docs/build-skills)                                     |
| Migration handoff       | `migrate codex-plugin` then `--remove-legacy-hooks`                    | Remove hooks once plugin is enabled; infer trust from Codex files | Enablement is not trust and trust storage is undocumented. Explicit cleanup protects legacy gates. [Hooks](https://learn.chatgpt.com/docs/hooks)                                                            |
| Trust verification      | Automated no-bypass marker check plus interactive new/changed-hook acceptance | `--dangerously-bypass-hook-trust`; private trust-state fixture | Codex documents an interactive review warning, but `codex exec --json` does not expose it; bypass proves dispatch, not trust; private state is unsupported and brittle. [Hooks](https://learn.chatgpt.com/docs/hooks) |
| Legacy cleanup          | TOML validation plus raw byte-preserving structural scanner and atomic replace | regex block deletion; parsed TOML reserialization | Regexes can match comments or cross group boundaries; serialization discards user formatting/comments. `smol-toml` validates TOML v1 without becoming the writer. [smol-toml](https://github.com/squirrelchat/smol-toml) |
| Package archive command | `bun pm pack` for release fixtures and Bunx for user hook execution | `npm pack`; any `npx` path | The ticket's Bun-only boundary covers both packaging tooling and executable hooks. Bun ships `pm pack`; `npx` is never an accepted Safe Word path. |
| Test layers             | Dynamic release contracts plus one isolated live smoke                 | Unit-only; live-only                                              | Unit-only misses package/cache wiring; live-only is slow and cannot diagnose every missing generated file. [Plugins](https://learn.chatgpt.com/docs/plugins)                                                |

## Arch alignment

- Honors **Schema as Single Source of Truth** by leaving customer template and
  reconciliation ownership unchanged; the Codex plugin is a separately packaged
  profile artifact, not a project-installed template.
- Honors **Reconciliation Over Copy** by preserving raw user-owned Codex config
  and removing only structurally recognized Safe Word handlers during explicit
  cleanup.
- Honors **IDE Parity** by deriving Codex workflow content from the same
  canonical source while retaining each runtime's delivery mechanism.
- Honors **Dogfooding** through release package contracts and an isolated profile
  smoke.

This changes the durable public delivery and migration architecture across
plugin packaging, CLI behavior, cache proof, and user configuration. The lean
ADR appended to `ARCHITECTURE.md` records that difficult-to-reverse boundary;
implementation details remain in this plan and the related design.

## Known deviations

- Codex receives generated plugin files rather than byte-identical Claude skill
  files because Codex requires plugin-scoped skills and references.
- The new and changed interactive-warning paths are manual until Codex provides
  an interactive trust-automation interface. The automated no-bypass marker
  check is opt-in live acceptance evidence, not a hard release gate, because
  CI currently has no authenticated Codex job.

## Doc impact

- `README.md`: explain the complete profile plugin catalogue and both migration
  commands.
- `packages/website/src/content/docs/reference/cli.mdx`: document
  `--remove-legacy-hooks` and its explicit-review requirement.
- `packages/website/src/content/docs/reference/hooks-and-skills.mdx`: document
  scoped skills, references, `/hooks` warning/skip behavior, and Bunx-only
  hooks.
- `packages/website/src/content/docs/getting-started/quick-start.mdx` and
  `faq.mdx`: replace one-step language with install, review, then cleanup.
- `ARCHITECTURE.md`: document the canonical-to-generated catalogue and staged
  migration boundary and the ADR.
- `packages/cli/tests/smoke/codex-plugin-manual-acceptance.md`: release-owner
  procedure for recording the interactive new/changed-hook trust behavior with
  exact Codex version and cache path.

## Assessment triggers

- Codex adds a supported trust-status or trust-approval API.
- Codex changes plugin cache, marketplace, skill metadata, or hook schema.
- A new canonical skill uses metadata or a reference form outside the adapter's
  allowlist.
- Codex exposes project-scoped plugins or hooks that change the profile versus
  repository boundary.
