---
generator: safeword-architecture
fingerprint: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f
fingerprint: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845
---

# Architecture

## Modules

### boundary

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/boundary`

Evaluates architectural boundary evidence and dependency-policy compliance.

### claude-plugin

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/claude-plugin`

Owns native Claude plugin delivery, exact execution proof, historical ownership classification, and non-blocking transactional legacy contraction.

### cli

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/cli.ts`

Composes the executable and registers public, compatibility, and hidden hook commands.

### cli-protocol

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/cli-protocol`

Defines the typed command catalogue, effect policy, plans, results, rendering, and execution adapters.

### codex-plugin

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/codex-plugin`

Owns Codex profile-plugin installation, proof, legacy authority, migration, finalization, and recovery.

### commands

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/commands`

Implements domain handlers for setup, status, removal, project workflows, tickets, Codex, and retrospectives.

### cursor-wrappers

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/cursor-wrappers.ts`

Generates thin Cursor command and rule wrappers from canonical workflow templates.

### health

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/health.ts`

<!-- seeded-purpose: 6a514346e034c47f263a14d1f352d56fe0f1435fb100f8804a19b9b70aebc139 -->

Config-health verification core (ticket 3293WH).

### index

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/index.ts`

Exposes the stable library API for version, detection, reconciliation, and ESLint consumers.

### learning-sync

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/learning-sync`

<!-- seeded-purpose: b56dcde39a15d17f52892285e891cbc4a384a735d1cac4e9a4440ed6b7c3e6e6 -->

Learning sync — generates `<namespace-root>/learnings/INDEX.md` from the `*.md` files in that folder so agents can navigate learnings via a Karpathy-style LLM Wiki index (plain markdown + grep)…

### owned-paths

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/owned-paths.ts`

<!-- seeded-purpose: a7727a2c03309440ca648329be38a5fb0566d597b367b41423d2b09c163d44b0 -->

Derive the set of top-level path prefixes that safeword may write to, sourced from SAFEWORD_SCHEMA at build time.

### packs

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/packs`

Detects supported languages and supplies their files, packages, and setup behavior.

### parity

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/parity.ts`

Checks canonical templates, dogfood mirrors, generated catalogues, and one-way content contracts for drift.

### pr-review

<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/pr-review`

Reviews pull-request evidence, applies conservative routing, and separates model inspection from merge-neutral GitHub publication.

### presets

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/presets`

Publishes conditional JavaScript and TypeScript ESLint presets through the package export.

### reconcile

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/reconcile.ts`

<!-- seeded-purpose: 76b396197de407a1fbd82d9825006ca749d81e0faf97ee7d8006ae6583373657 -->

Reconciliation Engine

### retro

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/retro`

Sanitizes, deduplicates, triages, reconciles, and files retrospective findings.

### review

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/review`

Coordinates independent adversarial reviews across Claude and Codex, including runtime discovery, neutral packet construction, policy enforcement, fallback handling, and provenance.

### schema

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/schema.ts`

<!-- seeded-purpose: cf6127ae78364456709c16fc16d5bcba85386d254f98d01b24b63dd8a39b9a00 -->

SAFEWORD Schema - Single Source of Truth

### self-report-capture

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/self-report-capture.ts`

<!-- seeded-purpose: 1d6ab8a143a63251557b3fecb492adadece7106155c9cfbf6118f1eb235efe63 -->

CLI-side self-observation producer (ticket 5XXQQZ, issues #345 / #720).

### skills

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/skills`

Installs optional third-party language coding skills without owning Safe Word workflow skills.

### templates

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/templates`

Builds dynamic configuration and legacy-cleanup content consumed by reconciliation.

### test-plan

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/test-plan`

Resolves and renders the canonical test, build, typecheck, BDD, and dependency plan for a project.

### ticket-create

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/ticket-create`

<!-- seeded-purpose: cd55e2fe5512344c84b7dd05daf04eeee694ac625fc57c8bb223112f0b3ededb -->

Route `ticket new` between the local-id path and issue-first creation (KKNFZA TB1). provider:none → the local minter (today's behavior, no tracker client built).

### ticket-sync

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/ticket-sync`

<!-- seeded-purpose: 5fdae57e79b128bcbf454f6c3fe43a4055247db3add218f54aa2008dc911d08c -->

Ticket sync — generates capability-discovery indexes over the ticket corpus: `<namespace-root>/tickets/INDEX.md` (active tickets, grouped by epic) and `INDEX-completed.md` (the `completed/` archive).

### tracker-connect

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/tracker-connect`

<!-- seeded-purpose: 21d448b7a5545f4c8179c2071ea2bee6d64843126d4ab910e3fd10950e7d449f -->

The connect orchestration (2TK5AD) — the single flow `setup` and `connect` both run.

### tracker-sync

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/tracker-sync`

<!-- seeded-purpose: 11bf14632c9d632ee25e364801faad3e599320096950805ee110e066eb822838 -->

The sync-tracker orchestrator — the single call site that projects the ticket corpus one-way into the configured tracker (JS5K5G).

### upstream-monitor

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/upstream-monitor`

Tracks upstream Claude Code, Codex CLI, and Cursor release signals for compatibility review.

### utils

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/utils`

Provides shared architecture, manifest, filesystem, Git, path, detection, Gherkin, and ticket primitives.

### version

<!-- reconciled: e9a4ab83e04395188f89718c824b77a5ac59bbdb924a475d6c3a324c1de1e83f -->
<!-- reconciled: 8fa574959001fc7962211fc33b7c2cc18ffcdc911e1eaff33a250a27129dd845 -->

`src/version.ts`

Reads the Safeword release version from package metadata.
