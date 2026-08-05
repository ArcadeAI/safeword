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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Duplicate agent values are normalized to one integration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Project-only installation works offline

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Explicit Cursor installation works offline when core dependencies are satisfied

- [x] RED a796ee390
- [x] GREEN f981dd72f
- [x] REFACTOR skip: lifecycle preflight already isolates profile-network requirements

### Scenario: Non-destructive install can run without input

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: None combined with an integration is rejected before mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.TBU1.R3 — Default installation leaves Cursor configuration untouched

### Scenario: Existing Cursor configuration survives default install byte-for-byte

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Default install does not create missing Cursor configuration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.TBU1.R4 — Cursor configuration is created only when cursor appears in agents

### Scenario: Explicit Cursor install reconciles its project-local assets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Explicit Cursor install preserves customer and third-party Cursor content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A stale uninstall plan is refused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No-input uninstall never infers destructive consent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.TBU2.R4 — Canonical architecture options distinguish index input from output staging

### Scenario: Canonical architecture flags independently select input and staging

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Legacy architecture flags retain their exact behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Canonical architecture flags are differential-tested against legacy behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Stage output without a reproducible input is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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
