# Impl Plan: Let new Codex users install Safe Word without a migration

**Status:** implemented

## Approach

**Riskiest assumption:** An installation command invoked from a project can
remain strictly profile-scoped. The cheapest proof is an integration fixture
with no `.codex` directory: after `safeword codex install`, the fake Codex
profile reports the plugin enabled and the fixture still has no project Codex
configuration.

| Scenario / surface | Primary proof | Supporting proof |
| --- | --- | --- |
| Setup and upgrade direct builders to install | Integration | Public CLI tests assert the shared Codex next-step message. |
| Profile installation changes no project config | Integration | Fake Bun/Codex executables record marketplace, install, and verification calls while the fixture has no `.codex` directory. |
| Explicit cleanup preserves custom hooks | Integration | Mixed TOML fixture runs `codex migrate --remove-legacy-hooks` and asserts only Safe Word entries disappear. |
| Cleanup without confirmation is refused | Integration | Public command exits before calling the fake Codex binary or writing project configuration. |
| Legacy command remains compatible | Integration | Existing `migrate codex-plugin` route still adds, enables, and verifies the plugin. |

Build order:

1. Split profile install/verification from legacy-hook cleanup in the existing
   migration module, retaining the public compatibility function.
2. Register `safeword codex install` and explicit `safeword codex migrate
   --remove-legacy-hooks` routes.
3. Add focused command tests and Cucumber step definitions, then make the new
   feature lane green.
4. Replace setup, upgrade, and README guidance with the install command; keep
   legacy migration only in compatibility documentation.
5. Run focused integration, BDD, type, lint, formatting, schema/parity, and
   release-contract validation; record any unrelated suite failure separately.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| New-user route | `safeword codex install` | Continue teaching `migrate codex-plugin`; make setup install automatically | “Migrate” is false for new users; automatic profile changes violate explicit trust. |
| Legacy route | `safeword codex migrate --remove-legacy-hooks` | Cleanup inside install; ordinary setup/upgrade cleanup | Cleanup changes project config and must remain an explicit, reviewed action. |
| Compatibility | Keep `safeword migrate codex-plugin` with current behavior | Remove or repurpose it | Existing user scripts may rely on it; removal creates needless breakage. |
| Implementation | Reuse the existing verification and TOML cleanup module | Duplicate commands or new module | One shared ownership-aware implementation prevents divergent safety checks. |

## Arch alignment

Honors the existing Codex plugin boundary: plugins are profile-scoped, normal
setup and upgrade never modify a profile, and project cleanup preserves user
configuration. No new data model, package, or system-wide pattern is needed.

## Known deviations

skip: no deviations planned

## Doc impact

- `README.md`: quick start, Codex overview, setup/upgrade explanations, and
  parity documentation must teach `codex install` and separate legacy cleanup.
- Shared CLI next-step text must make setup and upgrade point to the new route.
- CLI help must distinguish installation from migration cleanup.

## Assessment triggers

Revisit if Codex adds a project-scoped plugin installation, changes plugin
verification output, or Safe Word drops support for the legacy migration route.
