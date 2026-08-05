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
- [ ] GREEN
- [ ] REFACTOR

## Rule: unified-first-time-install.TBU1.R2 — Agent selectors narrow installation to exactly the selected integrations

### Scenario: A valid selector changes only the requested integrations

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The catalogue forbids status and doctor from sharing one handler contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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
