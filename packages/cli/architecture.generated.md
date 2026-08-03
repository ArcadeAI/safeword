---
generator: safeword-architecture
fingerprint: a83b61b200bea793945f8b79c23de6e9d19ef0eb5727e27d3904c669a6488407
---

# Architecture

## Modules

### boundary

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/boundary`

Evaluates architectural boundary evidence and dependency-policy compliance.

> ⚠ stale: structure changed since this section was reconciled.

### claude-plugin

<!-- reconciled: 7b62f50941a39aca1254f43d92883de4b80924e4f30f6f7bf933a31a09640c70 -->

`src/claude-plugin`

Selects the project reconciliation schema for native Claude plugin delivery or retained legacy Claude assets.

> ⚠ stale: structure changed since this section was reconciled.

### cli

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/cli.ts`

Composes the executable and registers public, compatibility, and hidden hook commands.

> ⚠ stale: structure changed since this section was reconciled.

### cli-protocol

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/cli-protocol`

Defines the typed command catalogue, effect policy, plans, results, rendering, and execution adapters.

> ⚠ stale: structure changed since this section was reconciled.

### codex-plugin

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/codex-plugin`

Owns Codex profile-plugin installation, proof, legacy authority, migration, finalization, and recovery.

> ⚠ stale: structure changed since this section was reconciled.

### commands

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/commands`

Implements domain handlers for setup, status, removal, project workflows, tickets, Codex, and retrospectives.

> ⚠ stale: structure changed since this section was reconciled.

### cursor-wrappers

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/cursor-wrappers.ts`

Generates thin Cursor command and rule wrappers from canonical workflow templates.

> ⚠ stale: structure changed since this section was reconciled.

### health

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/health.ts`

<!-- seeded-purpose: 6a514346e034c47f263a14d1f352d56fe0f1435fb100f8804a19b9b70aebc139 -->

Config-health verification core (ticket 3293WH).

> ⚠ stale: structure changed since this section was reconciled.

### index

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/index.ts`

Exposes the stable library API for version, detection, reconciliation, and ESLint consumers.

> ⚠ stale: structure changed since this section was reconciled.

### learning-sync

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/learning-sync`

<!-- seeded-purpose: b56dcde39a15d17f52892285e891cbc4a384a735d1cac4e9a4440ed6b7c3e6e6 -->

Learning sync — generates `<namespace-root>/learnings/INDEX.md` from the `*.md` files in that folder so agents can navigate learnings via a Karpathy-style LLM Wiki index (plain markdown + grep)…

> ⚠ stale: structure changed since this section was reconciled.

### owned-paths

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/owned-paths.ts`

<!-- seeded-purpose: a7727a2c03309440ca648329be38a5fb0566d597b367b41423d2b09c163d44b0 -->

Derive the set of top-level path prefixes that safeword may write to, sourced from SAFEWORD_SCHEMA at build time.

> ⚠ stale: structure changed since this section was reconciled.

### packs

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/packs`

Detects supported languages and supplies their files, packages, and setup behavior.

> ⚠ stale: structure changed since this section was reconciled.

### parity

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/parity.ts`

Checks canonical templates, dogfood mirrors, generated catalogues, and one-way content contracts for drift.

> ⚠ stale: structure changed since this section was reconciled.

### presets

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/presets`

Publishes conditional JavaScript and TypeScript ESLint presets through the package export.

> ⚠ stale: structure changed since this section was reconciled.

### reconcile

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/reconcile.ts`

<!-- seeded-purpose: 76b396197de407a1fbd82d9825006ca749d81e0faf97ee7d8006ae6583373657 -->

Reconciliation Engine

> ⚠ stale: structure changed since this section was reconciled.

### retro

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/retro`

Sanitizes, deduplicates, triages, reconciles, and files retrospective findings.

> ⚠ stale: structure changed since this section was reconciled.

### review

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/review`

Coordinates independent adversarial reviews across Claude and Codex, including runtime discovery, neutral packet construction, policy enforcement, fallback handling, and provenance.

> ⚠ stale: structure changed since this section was reconciled.

### schema

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/schema.ts`

<!-- seeded-purpose: cf6127ae78364456709c16fc16d5bcba85386d254f98d01b24b63dd8a39b9a00 -->

SAFEWORD Schema - Single Source of Truth

> ⚠ stale: structure changed since this section was reconciled.

### self-report-capture

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/self-report-capture.ts`

<!-- seeded-purpose: 1d6ab8a143a63251557b3fecb492adadece7106155c9cfbf6118f1eb235efe63 -->

CLI-side self-observation producer (ticket 5XXQQZ, issues #345 / #720).

> ⚠ stale: structure changed since this section was reconciled.

### skills

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/skills`

Installs optional third-party language coding skills without owning Safe Word workflow skills.

> ⚠ stale: structure changed since this section was reconciled.

### templates

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/templates`

Builds dynamic configuration and legacy-cleanup content consumed by reconciliation.

> ⚠ stale: structure changed since this section was reconciled.

### test-plan

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/test-plan`

Resolves and renders the canonical test, build, typecheck, BDD, and dependency plan for a project.

> ⚠ stale: structure changed since this section was reconciled.

### ticket-create

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/ticket-create`

<!-- seeded-purpose: cd55e2fe5512344c84b7dd05daf04eeee694ac625fc57c8bb223112f0b3ededb -->

Route `ticket new` between the local-id path and issue-first creation (KKNFZA TB1). provider:none → the local minter (today's behavior, no tracker client built).

> ⚠ stale: structure changed since this section was reconciled.

### ticket-sync

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/ticket-sync`

<!-- seeded-purpose: 5fdae57e79b128bcbf454f6c3fe43a4055247db3add218f54aa2008dc911d08c -->

Ticket sync — generates capability-discovery indexes over the ticket corpus: `<namespace-root>/tickets/INDEX.md` (active tickets, grouped by epic) and `INDEX-completed.md` (the `completed/` archive).

> ⚠ stale: structure changed since this section was reconciled.

### tracker-connect

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/tracker-connect`

<!-- seeded-purpose: 21d448b7a5545f4c8179c2071ea2bee6d64843126d4ab910e3fd10950e7d449f -->

The connect orchestration (2TK5AD) — the single flow `setup` and `connect` both run.

> ⚠ stale: structure changed since this section was reconciled.

### tracker-sync

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/tracker-sync`

<!-- seeded-purpose: 11bf14632c9d632ee25e364801faad3e599320096950805ee110e066eb822838 -->

The sync-tracker orchestrator — the single call site that projects the ticket corpus one-way into the configured tracker (JS5K5G).

> ⚠ stale: structure changed since this section was reconciled.

### upstream-monitor

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/upstream-monitor`

Tracks upstream Claude Code, Codex CLI, and Cursor release signals for compatibility review.

> ⚠ stale: structure changed since this section was reconciled.

### utils

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/utils`

Provides shared architecture, manifest, filesystem, Git, path, detection, Gherkin, and ticket primitives.

> ⚠ stale: structure changed since this section was reconciled.

### version

<!-- reconciled: 67a495ea58940c34314f766a277c5381dab625e577c2da1e3cd3b54148f9424f -->

`src/version.ts`

Reads the Safeword release version from package metadata.

> ⚠ stale: structure changed since this section was reconciled.
