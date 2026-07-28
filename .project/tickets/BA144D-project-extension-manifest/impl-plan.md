# Impl Plan: Let Projects Extend Safeword Guardrails Without Forking Safeword

**Status:** planned

## Approach

Riskiest assumption: one normalized extension manifest can feed `safeword check`, setup/upgrade/reset reconciliation, and Claude/Codex/Cursor adapter exposure without copying customer source content or adding a parallel skill registry. The cheapest slice that proves it is `Check reports unsafe hook declarations before installation`, because it forces config parsing, path resolution, safety validation, and actionable diagnostics before any adapter can hide bad data.

Process boundary: integration tests should fake only subprocess/package-install behavior. File-system, config parsing, schema/reconcile planning, and adapter generation should use real collaborators in temp projects.

Build order:

1. **Manifest parser and validator** — add a typed `extensions` reader near existing `.safeword/config.json` helpers, resolving project-root-relative paths and returning normalized empty lists for absent/empty config. Test layer: unit tests for absent/empty/populated/malformed config, duplicate same-kind and cross-kind names, path boundaries, hook safety partitions, and unsupported mappings; one `safeword check --offline` integration test for diagnostics.
2. **Compatibility matrix and skill inventory expansion** — define the Claude/Codex/Cursor support matrix and route skill extensions through the neutral skill manifest work from `Y06KJS`. Test layer: unit tests for every supported/unsupported matrix row, plus an integration-style inventory test proving framework and customer skills appear in one inventory.
3. **Adapter reconciliation for setup/upgrade/reset** — extend schema/reconcile planning with safeword-owned adapter outputs or merge pointers while treating customer extension sources as read-only inputs. Test layer: integration tests over temp projects for setup, upgrade, and reset, asserting customer source file hashes are unchanged, adapters are created/refreshed/removed, and source content is not copied into templates.
4. **Hook composition across agents** — add hook-extension expansion into the existing Claude settings, Codex config, and Cursor hook config merge paths, preserving existing customer hooks including same-event Cursor hooks. Test layer: integration tests using real JSON/TOML merge paths; fake only subprocess execution.
5. **Docs and worked example** — document the manifest, compatibility matrix, validation failures, and v2 team-pack future scope. Test layer: focused docs/schema checks plus `lint:gherkin`; final verification should include `safeword check --offline` once the existing missing Python pack warning is handled or documented as pre-existing.

Scenario coverage by layer:

| Rule | Scenarios | Primary layer |
| --- | --- | --- |
| Extension inventory is explicit and project-owned | Missing/empty no-op; populated inventory | Unit parser plus check integration |
| Lifecycle commands preserve customer source files | Setup/upgrade preserve source; reset preserves source | Reconcile integration |
| Supported adapters expose requested extensions | Supported matrix; upgrade adapter refresh; shared skill inventory | Matrix unit plus adapter/inventory integration |
| Invalid extension manifests fail before an agent depends on them | Missing paths; duplicate names; unsafe paths; unsafe hooks; unsupported mappings | Validator unit plus check integration |
| Hooks compose safely across agent surfaces | Setup/upgrade hook preservation; accepted/rejected hook extensions; allowed runtime target | Hook merge unit plus cross-agent integration |

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Extension entry point | Add `extensions` to `.safeword/config.json` and parse it through typed helpers | Per-agent config files; auto-discovered folders | Per-agent config creates drift; auto-discovery makes ownership and reset safety ambiguous |
| Adapter ownership | Generate or merge only safeword-owned adapters/pointers; never copy extension source content into templates | Copy extension content into `.safeword` or native agent folders | Copying makes upgrade/reset ownership unclear and violates the customer-owned source guarantee |
| Skill handling | Reuse the neutral skill manifest expansion path from `Y06KJS` | Add a separate project-extension skill registry | A second registry would duplicate behavior and weaken parity across agents |
| Hook safety | Require structured hook declarations with command/args, timeout, blocking mode, matcher, target agent/event, and project-local script target | Accept free-form shell strings or remote command URLs | Free-form/remote commands are hard to validate and unsafe to install automatically |
| V2 distribution | Keep plugin/team-pack distribution out of v1 | Ship project extensions as plugins now | Official agent docs position plugins/packs as reusable distribution; this ticket is project-local customization |

Research trace: Claude documents hooks as deterministic lifecycle commands and project/plugin skills as distinct surfaces; Codex documents project-local config/hooks with trust review and skills as a shared authoring format; Cursor documents project rules and hooks as native project surfaces.

## Arch alignment

Honors `ARCHITECTURE.md`:

- **Schema (`src/schema.ts`)** — managed/generated surfaces must enter through schema/reconcile rather than ad hoc writes.
- **Reconciliation Engine** — setup/upgrade/reset should compute plans and preserve user-owned content.
- **Config Schema** — extend `.safeword/config.json` defensively, preserving existing `installedPacks`, `paths`, and `docs` behavior.
- **Test Structure** — keep fast parser/matrix coverage in Vitest and behavior coverage in the Gherkin acceptance lane.

## Known deviations

skip: no deviations planned

## Assessment triggers

- Extension source paths need non-local or remote sources.
- Team-pack/plugin distribution becomes part of v1 scope instead of future scope.
- The compatibility matrix grows agent-specific exceptions that no longer fit one manifest model.
- Hook declaration safety needs policy beyond local file targets and allowed runtimes.
- `Y06KJS` changes the neutral skill manifest shape before this feature lands.
