---
generator: safeword-architecture
fingerprint: 66062644c792f91d7a595d69dbe94e0d8c181d25fefa5a5d1091d7b852c67885
---

# Architecture

## Modules

### boundary

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/boundary`

Evaluates architectural boundary evidence and dependency-policy compliance.

> ⚠ stale: structure changed since this section was reconciled.

### claude-plugin

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/claude-plugin`

Owns native Claude plugin delivery, exact execution proof, historical ownership classification, and non-blocking transactional legacy contraction.

> ⚠ stale: structure changed since this section was reconciled.

### cli

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/cli.ts`

Composes the executable and registers public, compatibility, and hidden hook commands.

> ⚠ stale: structure changed since this section was reconciled.

### cli-protocol

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/cli-protocol`

Defines the typed command catalogue, effect policy, plans, results, rendering, and execution adapters.

> ⚠ stale: structure changed since this section was reconciled.

### codex-plugin

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/codex-plugin`

Owns Codex profile-plugin installation, proof, legacy authority, migration, finalization, and recovery.

> ⚠ stale: structure changed since this section was reconciled.

### commands

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/commands`

Implements domain handlers for removal, project workflows, tickets, Codex, and retrospectives; the install/status/doctor lifecycle lives in `src/lifecycle`.

> ⚠ stale: structure changed since this section was reconciled.

### cursor-wrappers

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/cursor-wrappers.ts`

Generates thin Cursor command and rule wrappers from canonical workflow templates.

> ⚠ stale: structure changed since this section was reconciled.

### health

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/health.ts`

<!-- seeded-purpose: 6a514346e034c47f263a14d1f352d56fe0f1435fb100f8804a19b9b70aebc139 -->

Config-health verification core (ticket 3293WH).

> ⚠ stale: structure changed since this section was reconciled.

### index

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/index.ts`

Exposes the stable library API for version, detection, reconciliation, and ESLint consumers.

> ⚠ stale: structure changed since this section was reconciled.

### learning-sync

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/learning-sync`

<!-- seeded-purpose: b56dcde39a15d17f52892285e891cbc4a384a735d1cac4e9a4440ed6b7c3e6e6 -->

Learning sync — generates `<namespace-root>/learnings/INDEX.md` from the `*.md` files in that folder so agents can navigate learnings via a Karpathy-style LLM Wiki index (plain markdown + grep)…

> ⚠ stale: structure changed since this section was reconciled.

### lifecycle

<!-- reconciled: bef5369473ebec9539c2f462056622feea3b67a26045a1ae4fdde40f687a5c0d -->

`src/lifecycle`

Orchestrates the unified install, plan, status, doctor, and uninstall lifecycle across the project and its selected agent integrations.

> ⚠ stale: structure changed since this section was reconciled.

### owned-paths

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/owned-paths.ts`

<!-- seeded-purpose: a7727a2c03309440ca648329be38a5fb0566d597b367b41423d2b09c163d44b0 -->

Derive the set of top-level path prefixes that safeword may write to, sourced from SAFEWORD_SCHEMA at build time.

> ⚠ stale: structure changed since this section was reconciled.

### packs

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/packs`

Detects supported languages and supplies their files, packages, and setup behavior.

> ⚠ stale: structure changed since this section was reconciled.

### parity

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/parity.ts`

Checks canonical templates, dogfood mirrors, generated catalogues, and one-way content contracts for drift.

> ⚠ stale: structure changed since this section was reconciled.

### pr-review

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/pr-review`

Reviews pull-request evidence, applies conservative routing, and separates model inspection from merge-neutral GitHub publication.

> ⚠ stale: structure changed since this section was reconciled.

### presets

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/presets`

Publishes conditional JavaScript and TypeScript ESLint presets through the package export.

> ⚠ stale: structure changed since this section was reconciled.

### reconcile

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/reconcile.ts`

<!-- seeded-purpose: 76b396197de407a1fbd82d9825006ca749d81e0faf97ee7d8006ae6583373657 -->

Reconciliation Engine

> ⚠ stale: structure changed since this section was reconciled.

### retro

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/retro`

Sanitizes, deduplicates, triages, reconciles, and files retrospective findings.

> ⚠ stale: structure changed since this section was reconciled.

### review

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/review`

Coordinates independent adversarial reviews across Claude and Codex, including runtime discovery, neutral packet construction, policy enforcement, fallback handling, and provenance.

> ⚠ stale: structure changed since this section was reconciled.

### schema

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/schema.ts`

<!-- seeded-purpose: cf6127ae78364456709c16fc16d5bcba85386d254f98d01b24b63dd8a39b9a00 -->

SAFEWORD Schema - Single Source of Truth

> ⚠ stale: structure changed since this section was reconciled.

### self-report-capture

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/self-report-capture.ts`

<!-- seeded-purpose: 1d6ab8a143a63251557b3fecb492adadece7106155c9cfbf6118f1eb235efe63 -->

CLI-side self-observation producer (ticket 5XXQQZ, issues #345 / #720).

> ⚠ stale: structure changed since this section was reconciled.

### skills

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/skills`

Installs optional third-party language coding skills without owning Safe Word workflow skills.

> ⚠ stale: structure changed since this section was reconciled.

### templates

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/templates`

Builds dynamic configuration and legacy-cleanup content consumed by reconciliation.

> ⚠ stale: structure changed since this section was reconciled.

### test-plan

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/test-plan`

Resolves and renders the canonical test, build, typecheck, BDD, and dependency plan for a project.

> ⚠ stale: structure changed since this section was reconciled.

### ticket-create

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/ticket-create`

<!-- seeded-purpose: cd55e2fe5512344c84b7dd05daf04eeee694ac625fc57c8bb223112f0b3ededb -->

Route `ticket new` between the local-id path and issue-first creation (KKNFZA TB1). provider:none → the local minter (today's behavior, no tracker client built).

> ⚠ stale: structure changed since this section was reconciled.

### ticket-sync

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/ticket-sync`

<!-- seeded-purpose: 5fdae57e79b128bcbf454f6c3fe43a4055247db3add218f54aa2008dc911d08c -->

Ticket sync — generates capability-discovery indexes over the ticket corpus: `<namespace-root>/tickets/INDEX.md` (active tickets, grouped by epic) and `INDEX-completed.md` (the `completed/` archive).

> ⚠ stale: structure changed since this section was reconciled.

### tracker-connect

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/tracker-connect`

<!-- seeded-purpose: 21d448b7a5545f4c8179c2071ea2bee6d64843126d4ab910e3fd10950e7d449f -->

The connect orchestration (2TK5AD) — the single flow `setup` and `connect` both run.

> ⚠ stale: structure changed since this section was reconciled.

### tracker-sync

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/tracker-sync`

<!-- seeded-purpose: 11bf14632c9d632ee25e364801faad3e599320096950805ee110e066eb822838 -->

The sync-tracker orchestrator — the single call site that projects the ticket corpus one-way into the configured tracker (JS5K5G).

> ⚠ stale: structure changed since this section was reconciled.

### upstream-monitor

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/upstream-monitor`

Tracks upstream Claude Code, Codex CLI, and Cursor release signals for compatibility review.

> ⚠ stale: structure changed since this section was reconciled.

### utils

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/utils`

Provides shared architecture, manifest, filesystem, Git, path, detection, Gherkin, and ticket primitives.

> ⚠ stale: structure changed since this section was reconciled.

### version

<!-- reconciled: 7322e83c4c9e5deeed49dda69157078d5b9b91b675f4638b8b1793c4913ae671 -->

`src/version.ts`

Reads the Safeword release version from package metadata.

> ⚠ stale: structure changed since this section was reconciled.
