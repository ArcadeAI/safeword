# Test Definitions: One coherent Safe Word command model

Feature source: `packages/cli/features/unified-first-time-install.feature`

test-definitions.md is the R/G/R ledger.

## Rule: unified-first-time-install.TBU1.R1 — One install reconciles the project and installs both native profile plugins

### Scenario: Default install configures core Claude and Codex but not Cursor

- [x] RED 587bb98bb
- [x] GREEN 77a6d027b
- [x] REFACTOR a92237a7f

### Scenario: Offline default install refuses before changing any surface

- [x] RED skip: offline preflight was implemented atomically in 77a6d027b
- [x] GREEN dce2cfd9a
- [x] REFACTOR skip: shared runInstall fixture already isolates the boundary

## Rule: unified-first-time-install.TBU1.R2 — Agent selectors narrow installation to exactly the selected integrations

### Scenario: A valid selector changes only the requested integrations

- [x] RED skip: selector partitioning was implemented atomically in 77a6d027b
- [x] GREEN 75332f63e
- [x] REFACTOR skip: selector assertions already reuse the shared host fixture

### Scenario: An unknown agent selector is rejected before mutation

- [x] RED skip: selector validation was implemented atomically with canonical install
- [x] GREEN 77a6d027b
- [x] REFACTOR skip: all selector failures use parseAgentSelection

### Scenario: Duplicate agent values are normalized to one integration

- [x] RED skip: selector normalization was implemented atomically with canonical install
- [x] GREEN 77a6d027b
- [x] REFACTOR skip: normalization is isolated in the shared parser

### Scenario: Project-only installation works offline

- [x] RED skip: project-only selection was implemented atomically with canonical install
- [x] GREEN f981dd72f
- [x] REFACTOR skip: offline profile policy is isolated in lifecycle preflight

### Scenario: Explicit Cursor installation works offline when core dependencies are satisfied

- [x] RED a796ee390
- [x] GREEN f981dd72f
- [x] REFACTOR skip: lifecycle preflight already isolates profile-network requirements

### Scenario: Non-destructive install can run without input

- [x] RED skip: install is non-destructive by catalogue policy
- [x] GREEN 77a6d027b
- [x] REFACTOR skip: no-input is a global typed invocation policy

### Scenario: None combined with an integration is rejected before mutation

- [x] RED skip: none exclusivity shipped with the shared selector parser
- [x] GREEN 77a6d027b
- [x] REFACTOR skip: all selector failures occur before lifecycle mutation

## Rule: unified-first-time-install.TBU1.R3 — Default installation leaves Cursor configuration untouched

### Scenario: Existing Cursor configuration survives default install byte-for-byte

- [x] RED skip: default schema projection shipped with canonical install
- [x] GREEN 77a6d027b
- [x] REFACTOR skip: Cursor ownership is isolated in schemaForProjectSurfaces

### Scenario: Default install does not create missing Cursor configuration

- [x] RED skip: default schema projection shipped with canonical install
- [x] GREEN 77a6d027b
- [x] REFACTOR skip: missing Cursor directories remain outside the selected schema

## Rule: unified-first-time-install.TBU1.R4 — Cursor configuration is created only when cursor appears in agents

### Scenario: Explicit Cursor install reconciles its project-local assets

- [x] RED skip: explicit Cursor projection shipped with canonical install
- [x] GREEN 77a6d027b
- [x] REFACTOR skip: Cursor reconciliation reuses the schema-owned partition

### Scenario: Explicit Cursor install preserves customer and third-party Cursor content

- [x] RED skip: reconciliation already preserves unowned Cursor entries
- [x] GREEN 77a6d027b
- [x] REFACTOR skip: preservation is enforced by reconciliation ownership

## Rule: unified-first-time-install.TBU1.R5 — Repeated installation converges safely across the selected surfaces

### Scenario: A second identical unified install reports no changes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install repairs drift and completes a partial installation without duplication

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed surface does not roll back successful surfaces

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Targeted retry converges only the surface that previously failed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.TBU2.R1 — Status and doctor are observably different commands

### Scenario: Status gives a concise aggregate while doctor explains causes and coverage

- [x] RED 6821dd77e
- [x] GREEN a26d7be1a
- [x] REFACTOR skip: diagnostic rendering is already isolated in doctor.ts

### Scenario: The catalogue forbids status and doctor from sharing one handler contract

- [x] RED 6821dd77e
- [x] GREEN a26d7be1a
- [x] REFACTOR skip: the catalogue now binds two distinct typed handlers

## Rule: unified-first-time-install.TBU2.R2 — Planning covers every selected lifecycle effect without mutation

### Scenario: Plan declares all effects for the selected lifecycle scope

- [x] RED a11b5098f
- [x] GREEN 2e3f92582
- [x] REFACTOR skip: install and uninstall planning share prepared surface contracts

### Scenario: A lifecycle effect absent from its plan blocks apply

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.TBU2.R3 — Uninstallation reverses only recognized Safe Word-owned state after exact-plan confirmation

### Scenario: Unqualified uninstall previews core Claude and Codex removal

- [x] RED a412d0132
- [x] GREEN 2b891d41a
- [x] REFACTOR skip: plan assembly is isolated from uninstall execution

### Scenario: Confirmed uninstall preserves custom and third-party content

- [x] RED 704c80202
- [x] GREEN c25022a65
- [x] REFACTOR skip: apply orchestration was split before the GREEN commit

### Scenario: A stale uninstall plan is refused

- [x] RED skip: profile preconditions were added atomically with unified apply
- [x] GREEN c25022a65
- [x] REFACTOR skip: exact-plan preparation has one shared precondition builder

### Scenario: No-input uninstall never infers destructive consent

- [x] RED skip: preview-only no-input behavior is the canonical uninstall default
- [x] GREEN c25022a65
- [x] REFACTOR skip: destructive consent is centralized in uninstallLifecycle

## Rule: unified-first-time-install.TBU2.R4 — Canonical architecture options distinguish index input from output staging

### Scenario: Canonical architecture flags independently select input and staging

- [x] RED skip: the prior catalogue rejected both canonical flags
- [x] GREEN 7873ac1da
- [x] REFACTOR skip: input and output mode resolution is isolated

### Scenario: Legacy architecture flags retain their exact behavior

- [x] RED skip: legacy behavior predated the canonical normalization layer
- [x] GREEN 7873ac1da
- [x] REFACTOR skip: legacy options normalize before execution

### Scenario: Canonical architecture flags are differential-tested against legacy behavior

- [x] RED skip: canonical and legacy fixtures were added with the normalization layer
- [x] GREEN 7873ac1da
- [x] REFACTOR skip: both spellings execute the same architecture mode

### Scenario: Stage output without a reproducible input is rejected

- [x] RED skip: --stage-output was previously an unknown option
- [x] GREEN 7873ac1da
- [x] REFACTOR skip: reproducible-input validation is centralized

## Rule: unified-first-time-install.TBU2.R5 — Global JSON is the sole canonical machine-output contract

### Scenario: Every lifecycle command renders one stable JSON envelope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Legacy raw JSON remains compatible but is not advertised as canonical

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.TBU2.R6 — Every shipped alias remains executable but is excluded from the canonical quick path

### Scenario: Existing command and option aliases keep their named canonical behavior indefinitely

- [x] RED 88077dc22
- [x] GREEN 24992e06d
- [x] REFACTOR skip: compatibility metadata already has one catalogue source

### Scenario: Specialized canonical commands remain first-class operations

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Setup yes is accepted and explicitly reported as redundant

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Nontrivial aliases preserve their defined observable contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The exhaustive reference includes review and destructive guidance commands

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ordinary help teaches only canonical routes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.NTB1.R1 — Results identify project Claude and Codex outcomes separately

### Scenario: Unified install reports a per-surface completion summary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A summary never collapses mixed outcomes into success

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-technical builder can act on the summary without knowing the architecture

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A technical builder can inspect evidence and retry only the failed scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.NTB1.R2 — Manual reload or restart requirements remain unfinished activation steps

### Scenario: Install completion reports exact activation actions for both profile plugins

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed plugins are not reported active before host proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.NTB1.R3 — A partial failure names what failed without hiding successful work

### Scenario: Missing Claude leaves core and Codex success visible

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed profile install cannot produce a healthy aggregate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.NTB1.R4 — Destructive commands say what they deactivate preserve back up and recover

### Scenario: Destructive help and plans name deactivation backup and recovery effects

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A destructive operation cannot describe itself as backup-only

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recoverable destructive work can be restored without replacing unrelated content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Cross-scenario refactor

- [ ] cross-scenario
