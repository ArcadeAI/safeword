# Test Definitions — namespace-root resolver

Scenarios for child [TAGWZ8](./ticket.md) of epic
[AQJ95G](../AQJ95G-project-namespace-default/spec.md). Each `### Scenario:` title
carries the AC it proves (`<jtbd-id>.AC<#>.<scenario_name>`). Dimensions and
partitions live in [dimensions.md](./dimensions.md).

## Rule: The root resolves by precedence — explicit config → `.project/` → legacy `.safeword-project/`

> Rationale: the whole epic hinges on one resolver returning the right root.
> Precedence lets a fresh `.project/` default win while a legacy-only install
> keeps resolving unchanged, with config as the explicit override above both.

### Scenario: namespace-root-resolver.SM1.AC1.config_root_wins_when_set

Given a project whose `.safeword/config.json` sets `paths.projectRoot` to `custom-ns`, and both `.project/` and `.safeword-project/` present on disk
When the resolver computes the namespace root
Then the resolved root is `custom-ns`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.SM1.AC1.project_dir_preferred_over_legacy

Given a project with no `paths.projectRoot` configured and a `.project/` directory present
When the resolver computes the namespace root
Then the resolved root is `.project/`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.DEV1.AC2.legacy_only_resolves_there

Given a project with no `paths.projectRoot` configured and only a `.safeword-project/` directory present
When the resolver computes the namespace root
Then the resolved root is `.safeword-project/`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.SM1.AC1.both_dirs_present_prefers_project

Given a project with no `paths.projectRoot` configured and both `.project/` and `.safeword-project/` present
When the resolver computes the namespace root
Then the resolved root is `.project/`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.SM1.AC1.neither_dir_defaults_to_project

Given a fresh project with no `paths.projectRoot` configured and neither namespace directory present
When the resolver computes the namespace root
Then the resolved root is `.project/`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A configured root resolves like the existing `paths.*` keys

> Rationale: `paths.projectRoot` must match the relative/absolute semantics
> K7N2QM already established for per-file keys, so the config surface stays
> consistent and predictable.

### Scenario: namespace-root-resolver.DEV2.AC1.relative_project_root_resolves_against_cwd

Given `paths.projectRoot` is set to the relative path `shared/ns`
When the resolver computes the namespace root
Then the resolved root is `shared/ns` joined to the project directory (cwd)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.DEV2.AC1.absolute_project_root_used_verbatim

Given `paths.projectRoot` is set to an absolute path
When the resolver computes the namespace root
Then the resolved root is that absolute path verbatim

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Default file locations derive from the resolved root

> Rationale: personas, glossary, and architecture must follow the root so the
> flip to `.project/` moves all three for free — no second hard-coded prefix.

### Scenario: namespace-root-resolver.DEV1.AC1.personas_default_derives_from_root

Given a project whose namespace root resolves to `.project/` and no `paths.personas` override
When the resolver computes the personas default location
Then the personas default is `.project/personas.md`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.DEV1.AC1.glossary_default_derives_from_root

Given a project whose namespace root resolves to `.project/` and no `paths.glossary` override
When the resolver computes the glossary default location
Then the glossary default is `.project/glossary.md`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.DEV1.AC1.architecture_default_derives_from_root

Given a project whose namespace root resolves to `.project/` and no `paths.architecture` override
When the resolver computes the architecture default location
Then the architecture default is `.project/architecture.md`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Per-file overrides win over the root default

> Rationale: existing `paths.personas` / `paths.glossary` / `paths.architecture`
> overrides must keep working and resolve against the root, so adopting the new
> root never silently breaks a customer's redirect.

### Scenario: namespace-root-resolver.DEV2.AC2.per_file_override_wins_for_its_file

Given a project whose namespace root resolves to `.project/` and `paths.personas` set to `team/people.md`
When the resolver computes the personas location
Then the personas location is `team/people.md`, not `.project/personas.md`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.DEV2.AC2.unset_per_file_falls_back_to_root

Given a project whose namespace root resolves to `.project/`, `paths.personas` set, and `paths.glossary` unset
When the resolver computes the glossary location
Then the glossary location is `.project/glossary.md`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A namespace surface reads and writes under the resolved root

> Rationale: SM1.AC2 — the ~48 literals are retired by making surfaces consume
> the resolver. Proven behaviorally through a representative surface (sync-tickets,
> with a decoy in the legacy dir making reads observable); the exhaustive-grep
> done-when is the structural backstop for full coverage. Learnings paths are
> grep-backstopped only — accepted gap, no per-surface scenario.

### Scenario: namespace-root-resolver.SM1.AC2.surface_follows_resolved_root

Given a project whose namespace root resolves to `.project/` with tickets under `.project/tickets/`, and a decoy ticket under `.safeword-project/tickets/`
When `safeword sync-tickets` regenerates the index
Then the regenerated index lists only the `.project/` tickets and everything under `.safeword-project/` is unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Malformed configuration is treated as unset

> Rationale: a typo'd or missing config must never crash resolution — it falls
> through to directory-presence precedence, mirroring K7N2QM's defensive reads.

### Scenario: namespace-root-resolver.SM1.AC1.empty_project_root_treated_as_unset

Given `paths.projectRoot` is set to an empty string and only `.safeword-project/` is present
When the resolver computes the namespace root
Then the empty value is ignored and the resolved root is `.safeword-project/`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.SM1.AC1.missing_config_falls_through_to_precedence

Given a project with no `.safeword/config.json` and a `.project/` directory present
When the resolver computes the namespace root
Then resolution does not error and the resolved root is `.project/`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.SM1.AC1.non_string_project_root_treated_as_unset

Given `paths.projectRoot` is set to a non-string value (e.g. `123`) and only `.safeword-project/` is present
When the resolver computes the namespace root
Then the non-string value is ignored and the resolved root is `.safeword-project/`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: namespace-root-resolver.SM1.AC1.unparseable_config_treated_as_unset

Given a `.safeword/config.json` containing invalid JSON and a `.project/` directory present
When the resolver computes the namespace root
Then resolution does not error and the resolved root is `.project/`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
