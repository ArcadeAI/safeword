# Safeword Architecture

Safeword installs and upgrades coding-agent workflows across Claude Code, Cursor, Codex, and OpenCode. The [generated package map](.project/architecture.generated.md) tracks workspace dependencies. The [CLI module map](packages/cli/architecture.generated.md) describes what each module does.

## Table of Contents

[System map](#overview) · [Key decisions](#key-decisions) · [References](#references)

## Overview

The CLI runs under Bun. Language tools run in the project Safeword manages.

[Runtimes and tooling](.project/architecture/overview.md)

### [Tech Stack](.project/architecture/overview.md#tech-stack)

## Monorepo Structure

The CLI owns project configuration. Retrospective collection, transfer, and relay run in separate services with distinct credentials and data ownership.

[Package and service boundaries](.project/architecture/monorepo-structure.md)

### [CLI-side retrospective flow](.project/architecture/monorepo-structure.md#cli-side-retrospective-flow)

### [Public retrospective collector boundary](.project/architecture/monorepo-structure.md#public-retrospective-collector-boundary)

### [Cutover-gated collector transfer worker boundary](.project/architecture/monorepo-structure.md#cutover-gated-collector-transfer-worker-boundary)

### [Retro relay boundary](.project/architecture/monorepo-structure.md#retro-relay-boundary)

## Generated State and Human Decisions

Generated indexes describe the source tree. Maintainers own this overview and the linked decision records, including which decisions replaced earlier ones.

[Who maintains each record](.project/architecture/generated-state-and-human-decisions.md)

### [Reverse-authoring adequacy](.project/architecture/generated-state-and-human-decisions.md#reverse-authoring-adequacy)

## CLI Structure

The command catalogue defines the public CLI contract. Lifecycle commands coordinate registered integrations. Each adapter defines how its host activates the integration and what proves it ran.

[CLI integration registry](.project/architecture/cli-structure.md)

### [Registry-Driven Agent Integrations with Native Trust Boundaries](.project/architecture/cli-structure.md#registry-driven-agent-integrations-with-native-trust-boundaries)

## Language Packs

Bundled packs select language-specific tools, dependencies, and configuration.

[Pack responsibilities](.project/architecture/language-packs.md)

### [Pattern: Modular Language Support](.project/architecture/language-packs.md#pattern-modular-language-support)

### [Pack File Structure](.project/architecture/language-packs.md#pack-file-structure)

### [Config Schema](.project/architecture/language-packs.md#config-schema)

## Language Detection

Detection identifies languages before applying framework-specific configuration.

[Language and framework detection](.project/architecture/language-detection.md)

### [Pattern: Detect Languages Before Framework](.project/architecture/language-detection.md#pattern-detect-languages-before-framework)

### [Data Model](.project/architecture/language-detection.md#data-model)

### [ESLint Plugin Configuration](.project/architecture/language-detection.md#eslint-plugin-configuration)

## Reconciliation Engine

The schema defines managed assets. Reconciliation compares the project with its templates. File ownership determines which changes Safeword applies and which user edits it preserves.

[File ownership and installation](.project/architecture/reconciliation-engine.md)

### [Schema (`src/schema.ts`)](.project/architecture/reconciliation-engine.md#schema-srcschemats)

### [Reconciliation Modes](.project/architecture/reconciliation-engine.md#reconciliation-modes)

### [Install Convergence Flow](.project/architecture/reconciliation-engine.md#install-convergence-flow)

## Dependencies

Package manifests declare runtime, development, and peer dependencies.

[Dependency choices](.project/architecture/dependencies.md)

### [Runtime (`dependencies`)](.project/architecture/dependencies.md#runtime-dependencies)

### [Dev (`devDependencies`)](.project/architecture/dependencies.md#dev-devdependencies)

### [Peer](.project/architecture/dependencies.md#peer)

## Test Structure

CLI tests cover reconciliation, lifecycle behavior, and host contracts. Executable scenarios exercise workflow boundaries.

[Test suites](.project/architecture/test-structure.md)

## Build & Distribution

The CLI and plugin bundles use the same source templates. CI checks that their generated copies match before release.

[Build outputs and release checks](.project/architecture/build--distribution.md)

## Migration & Evolution

Plugin migrations expand support, prove activation, then retire legacy protection. Keep superseded decisions linked to their replacements.

[Migration and compatibility rules](.project/architecture/migration--evolution.md)

## Key Decisions

Planning decisions live in the project-local review ledger. Human approvals bind the ticket, phase, and plan digest. Review evidence records the context used to judge that plan. The ledger retains decision history across host handoffs.

When requesting plan review, pass the relevant decision records as explicit context so the reviewer receives them with the overview.

### [Collector-to-relay ownership transfer](.project/architecture/collector-to-relay-ownership-transfer.md)

### [Settled Decisions (2025-12)](.project/architecture/settled-decisions-2025-12.md)

### [Bundled Language Packs (No External Packages)](.project/architecture/bundled-language-packs-no-external-packages.md)

### [Unified BDD+TDD Workflow (Inline TDD in BDD Skill)](.project/architecture/unified-bddtdd-workflow-inline-tdd-in-bdd-skill.md)

### [Skill Consolidation (Removed Redundant Skills)](.project/architecture/skill-consolidation-removed-redundant-skills.md)

### [Hard Block for Done Phase (Stop `decision: "block"`)](.project/architecture/hard-block-for-done-phase-stop-decision-block.md)

### [Hierarchy Navigation on Ticket Completion](.project/architecture/hierarchy-navigation-on-ticket-completion.md)

### [Continuous Quality Gates (LOC + Phase + TDD)](.project/architecture/continuous-quality-gates-loc--phase--tdd.md)

### [Separate Implementation and Execution Planning Gates](.project/architecture/separate-implementation-and-execution-planning-gates.md)

### [Conformance-Gated Execution Plan Review](.project/architecture/conformance-gated-execution-plan-review.md)

### [Digest-Bound Planning Decisions in the Shared Review Ledger](.project/architecture/digest-bound-planning-decisions-in-the-shared-review-ledger.md)

### [Semantically Projected Planning Review Provenance](.project/architecture/semantically-projected-planning-review-provenance.md)

### [Authenticated Reduced-Independence Planning Review Fallback](.project/architecture/authenticated-reduced-independence-planning-review-fallback.md)

### [Independent Review Never Blocks](.project/architecture/independent-review-never-blocks.md)

### [Frozen Transcript Fixture Testing](.project/architecture/frozen-transcript-fixture-testing.md)

### [Product-Framing Layer in BDD Phase 0 (JTBD / Personas / Rules)](.project/architecture/product-framing-layer-in-bdd-phase-0-jtbd--personas--rules.md)

### [Canonical Persona Codes with Legacy Lineage Compatibility](.project/architecture/canonical-persona-codes-with-legacy-lineage-compatibility.md)

### [BDD as a Solo-Agent Adaptation of the Three-Practice Model (retire `decomposition` phase)](.project/architecture/bdd-as-a-solo-agent-adaptation-of-the-three-practice-model-retire-decomposition-phase.md)

### [plan-implementation: a gated planning phase as the Automation on-ramp](.project/architecture/plan-implementation-a-gated-planning-phase-as-the-automation-on-ramp.md)

### [Architecture Review Gate (evidence + independent design review for features)](.project/architecture/architecture-review-gate-evidence--independent-design-review-for-features.md)

### [Host-owned cross-agent adversarial review coordinator](.project/architecture/host-owned-cross-agent-adversarial-review-coordinator.md)

### [Profile-Scoped Generated Codex Plugin and Staged Hook Migration](.project/architecture/profile-scoped-generated-codex-plugin-and-staged-hook-migration.md)

### [Explicit Project Enrollment for Profile-Scoped Codex Hooks](.project/architecture/explicit-project-enrollment-for-profile-scoped-codex-hooks.md)

### [Typed CLI Execution and Discovery](.project/architecture/typed-cli-execution-and-discovery.md)

### [Next-Task Codex Plugin Activation and Migration Result v2](.project/architecture/next-task-codex-plugin-activation-and-migration-result-v2.md)

### [Generated Native Claude Plugin with Live Proof and Project Contraction](.project/architecture/generated-native-claude-plugin-with-live-proof-and-project-contraction.md)

### [Project-Default Claude Plugin Declarations and Project-Bound Proof](.project/architecture/project-default-claude-plugin-declarations-and-project-bound-proof.md)

### [Proof-Gated Automatic Claude Legacy Contraction](.project/architecture/proof-gated-automatic-claude-legacy-contraction.md)

### [Restart-Bound Codex Plugin Activation](.project/architecture/restart-bound-codex-plugin-activation.md)

### [Advisory PR Review as a Split-Privilege Evidence Pipeline](.project/architecture/advisory-pr-review-as-a-split-privilege-evidence-pipeline.md)

### [Deterministic Readiness Evidence Status](.project/architecture/deterministic-readiness-evidence-status.md)

#### [Local delivery completion extension](.project/architecture/local-delivery-completion.md)

### [Transactional Claude Marketplace Ref Replacement](.project/architecture/transactional-claude-marketplace-ref-replacement.md)

### [Executable Resource Contract for Native Plugin Bundles](.project/architecture/executable-resource-contract-for-native-plugin-bundles.md)

### [One Safeword CLI lookup for every hook](.project/architecture/one-safeword-cli-lookup-for-every-hook.md)

### [Per-file host JavaScript toolchain ownership](.project/architecture/per-file-host-javascript-toolchain-ownership.md)

### [Go lint package loading preserves configuration context](.project/architecture/go-lint-package-loading-preserves-configuration-context.md)

## References

- Language Pack Spec: `packages/cli/src/packs/LANGUAGE_PACK_SPEC.md`
- Ruff docs: https://docs.astral.sh/ruff/
- golangci-lint docs: https://golangci-lint.run/
- SQLFluff docs: https://docs.sqlfluff.com/
- Clippy docs: https://doc.rust-lang.org/stable/clippy/
- rustfmt docs: https://rust-lang.github.io/rustfmt/
- Cargo lints: https://doc.rust-lang.org/cargo/reference/manifest.html#the-lints-section
- PEP 621: https://peps.python.org/pep-0621/
