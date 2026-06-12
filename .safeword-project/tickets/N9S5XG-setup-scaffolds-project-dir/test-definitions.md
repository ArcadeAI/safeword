# Test Definitions — setup scaffolds .project/

Scenarios for child [N9S5XG](./ticket.md) of epic
[AQJ95G](../AQJ95G-project-namespace-default/spec.md). Lineage
`<jtbd-id>.AC<#>.<scenario_name>`; dimensions in [dimensions.md](./dimensions.md).

## Rule: A fresh repo scaffolds the full namespace at `.project/`

> Rationale: DEV1.AC1 — the default flip at the setup surface. The whole epic
> is moot if a fresh install still lands on the legacy prefix.

### Scenario: setup-scaffolds-project-dir.DEV1.AC1.fresh_setup_creates_project_namespace

Given a clean git repo with no namespace directory
When `safeword setup` runs
Then `.project/learnings/`, `.project/tickets/completed/`, and `.project/tmp/` exist, and `.project/personas.md` and `.project/glossary.md` contain the starter templates

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: setup-scaffolds-project-dir.DEV1.AC1.fresh_setup_creates_no_legacy_dir

Given a clean git repo with no namespace directory
When `safeword setup` runs
Then no `.safeword-project/` directory exists anywhere in the repo

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: An existing `.project/` is adopted, never clobbered

> Rationale: DEV1.AC2 — the arcade-coexistence cell the epic exists for. A
> developer's hand-authored personas must survive setup byte-identical.

### Scenario: setup-scaffolds-project-dir.DEV1.AC2.existing_personas_survive_setup_byte_identical

Given a repo whose `.project/personas.md` contains user-authored persona blocks
When `safeword setup` runs
Then `.project/personas.md` is byte-identical to its pre-setup content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: setup-scaffolds-project-dir.DEV1.AC2.partial_project_dir_gets_missing_pieces

Given a repo whose `.project/` holds only `personas.md` (no tickets/, learnings/, or glossary.md)
When `safeword setup` runs
Then `.project/tickets/`, `.project/learnings/`, and `.project/glossary.md` are created alongside the untouched `personas.md`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A legacy repo stays entirely on `.safeword-project/`

> Rationale: DEV1.AC3 — existing installs upgrade without a flag day; a second
> namespace appearing would be the worst seamlessness failure.

### Scenario: setup-scaffolds-project-dir.DEV1.AC3.legacy_setup_stays_legacy

Given a repo with an existing `.safeword-project/` namespace (tickets present)
When `safeword setup` re-runs
Then namespace content is reconciled under `.safeword-project/` and no `.project/` directory is created

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: setup-scaffolds-project-dir.DEV1.AC3.legacy_upgrade_stays_legacy

Given a repo with an existing `.safeword-project/` namespace
When `safeword upgrade` runs
Then no `.project/` directory is created

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Lifecycle commands agree on the resolved root

> Rationale: DEV1.AC4 — setup, upgrade, diff, and reset reading different
> roots would split-brain the install.

### Scenario: setup-scaffolds-project-dir.DEV1.AC4.configured_root_scaffolds_there

Given a repo whose `.safeword/config.json` sets `paths.projectRoot` to `team-ns` before setup
When `safeword setup` runs
Then the namespace directories and starter files are created under `team-ns/`, and neither `.project/` nor `.safeword-project/` is created

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: setup-scaffolds-project-dir.DEV1.AC4.reset_preserves_namespace_at_resolved_root

Given a fresh-setup repo on `.project/` with a user ticket added
When `safeword reset` runs
Then `.project/tickets/` and its content survive (preserved data), while safeword-owned directories are removed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
