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

- [x] RED 11ee15a7a
- [x] GREEN 66e5cd7f8
- [x] REFACTOR skip: native delivery projections are isolated before reconciliation

### Scenario: Install repairs drift and completes a partial installation without duplication

- [x] RED 11ee15a7a
- [x] GREEN 66e5cd7f8
- [x] REFACTOR skip: all selected surfaces reuse the shared convergence boundary

### Scenario: A failed surface does not roll back successful surfaces

- [x] RED 11ee15a7a
- [x] GREEN 66e5cd7f8
- [x] REFACTOR skip: retry normalization is scoped by the recorded surface result

### Scenario: Targeted retry converges only the surface that previously failed

- [x] RED 11ee15a7a
- [x] GREEN 66e5cd7f8
- [x] REFACTOR skip: canonical retry selectors reuse install's existing surface partition

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

- [x] RED skip: exact-plan binding shipped atomically with unified uninstall apply
- [x] GREEN c25022a65
- [x] REFACTOR skip: stale and expanded plans share one precondition comparison

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

- [x] RED skip: the versioned global envelope predates unified lifecycle commands
- [x] GREEN 97ee66679
- [x] REFACTOR skip: every public command reports through the shared result renderer

### Scenario: Legacy raw JSON remains compatible but is not advertised as canonical

- [x] RED 442ce7aec
- [x] GREEN 441650544
- [x] REFACTOR skip: both raw formats share one compatibility finding helper

## Rule: unified-first-time-install.TBU2.R6 — Every shipped alias remains executable but is excluded from the canonical quick path

### Scenario: Existing command and option aliases keep their named canonical behavior indefinitely

- [x] RED 88077dc22
- [x] GREEN 24992e06d
- [x] REFACTOR skip: compatibility metadata already has one catalogue source

### Scenario: Specialized canonical commands remain first-class operations

- [x] RED 587bb98bb7
- [x] GREEN d1748ef02
- [x] REFACTOR skip: specialized policy and alias classification share the executable catalogue

### Scenario: Setup yes is accepted and explicitly reported as redundant

- [x] RED 109ec6162
- [x] GREEN 291d19f42
- [x] REFACTOR skip: compatibility option guidance is declarative catalogue metadata

### Scenario: Nontrivial aliases preserve their defined observable contract

- [x] RED 587bb98bb7
- [x] GREEN d1748ef02
- [x] REFACTOR skip: each fixture exercises the shared lifecycle handler selected by the catalogue

### Scenario: The exhaustive reference includes review and destructive guidance commands

- [x] RED 587bb98bb7
- [x] GREEN d1748ef02
- [x] REFACTOR skip: help and capabilities derive from the same command definitions

### Scenario: Ordinary help teaches only canonical routes

- [x] RED 587bb98bb7
- [x] GREEN d1748ef02
- [x] REFACTOR skip: the compatibility section is rendered from the retained-route inventory

## Rule: unified-first-time-install.NTB1.R1 — Results identify project Claude and Codex outcomes separately

### Scenario: Unified install reports a per-surface completion summary

- [x] RED cc1cd00ca
- [x] GREEN f9c274962
- [x] REFACTOR skip: surface labels and outcome vocabulary are centralized in the renderer

### Scenario: A summary never collapses mixed outcomes into success

- [x] RED skip: mixed-state aggregation was implemented with the first surface renderer
- [x] GREEN f9c274962
- [x] REFACTOR skip: aggregate severity and per-surface rendering remain separate helpers

### Scenario: A non-technical builder can act on the summary without knowing the architecture

- [x] RED skip: plain-language surface rendering shipped with the first summary scenario
- [x] GREEN f9c274962
- [x] REFACTOR skip: the same renderer serves technical and non-technical detail levels

### Scenario: A technical builder can inspect evidence and retry only the failed scope

- [x] RED skip: JSON surface evidence and targeted retries shipped in prior lifecycle slices
- [x] GREEN 66e5cd7f8
- [x] REFACTOR skip: structured evidence is emitted from the same surface result records

## Rule: unified-first-time-install.NTB1.R2 — Manual reload or restart requirements remain unfinished activation steps

### Scenario: Install completion reports exact activation actions for both profile plugins

- [x] RED 519477c33
- [x] GREEN 2a70553b6
- [x] REFACTOR skip: activation actions are structured once and rendered generically

### Scenario: Installed plugins are not reported active before host proof

- [x] RED skip: pending Codex proof already produced action-required status
- [x] GREEN 2a70553b6
- [x] REFACTOR skip: profile activation state remains owned by each host adapter

## Rule: unified-first-time-install.NTB1.R3 — A partial failure names what failed without hiding successful work

### Scenario: Missing Claude leaves core and Codex success visible

- [x] RED skip: partial-surface aggregation shipped with canonical targeted retry guidance
- [x] GREEN 66e5cd7f8
- [x] REFACTOR skip: host failure stays isolated in the Claude surface result

### Scenario: A failed profile install cannot produce a healthy aggregate

- [x] RED skip: lifecycleState already prioritizes failed surface outcomes
- [x] GREEN 66e5cd7f8
- [x] REFACTOR skip: aggregate precedence remains centralized in lifecycleState

## Rule: unified-first-time-install.NTB1.R4 — Destructive commands say what they deactivate preserve back up and recover

### Scenario: Destructive help and plans name deactivation backup and recovery effects

- [x] RED 587bb98bb7
- [x] GREEN ffb3f7e06
- [x] REFACTOR skip: catalogue descriptions and structured plans keep separate presentation and effect concerns

### Scenario: A destructive operation cannot describe itself as backup-only

- [x] RED 587bb98bb7
- [x] GREEN ffb3f7e06
- [x] REFACTOR skip: the shared result renderer exposes destructive effects alongside the recovery backup

### Scenario: Recoverable destructive work can be restored without replacing unrelated content

- [x] RED 587bb98bb7
- [x] GREEN ffb3f7e06
- [x] REFACTOR skip: recovery targets the recognized moved artifact and leaves unrelated paths untouched

## Cross-scenario refactor

- [x] cross-scenario 7c13e5ddc
