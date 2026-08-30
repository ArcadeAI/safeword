---
generator: safeword-architecture
fingerprint: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11
---

# Architecture

## Modules

### boundary

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/boundary`

Evaluates architectural boundary evidence and dependency-policy compliance.

### claude-plugin

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/claude-plugin`

Owns native Claude plugin delivery, exact execution proof, historical ownership classification, and non-blocking transactional legacy contraction.

### cli

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/cli.ts`

Composes the executable and registers public, compatibility, and hidden hook commands.

### cli-protocol

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/cli-protocol`

Defines the typed command catalogue, effect policy, plans, results, rendering, and execution adapters.

### codex-plugin

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/codex-plugin`

Owns Codex profile-plugin installation, proof, legacy authority, migration, finalization, and recovery.

### commands

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/commands`

Implements domain handlers for removal, project workflows, tickets, Codex, and retrospectives; the install/status/doctor lifecycle lives in `src/lifecycle`.

### cursor-wrappers

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/cursor-wrappers.ts`

Generates thin Cursor command and rule wrappers from canonical workflow templates.

### health

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/health.ts`

<!-- seeded-purpose: 6a514346e034c47f263a14d1f352d56fe0f1435fb100f8804a19b9b70aebc139 -->

Config-health verification core (ticket 3293WH).

### index

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/index.ts`

Exposes the stable library API for version, detection, reconciliation, and ESLint consumers.

### learning-sync

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/learning-sync`

<!-- seeded-purpose: b56dcde39a15d17f52892285e891cbc4a384a735d1cac4e9a4440ed6b7c3e6e6 -->

Learning sync — generates `<namespace-root>/learnings/INDEX.md` from the `*.md` files in that folder so agents can navigate learnings via a Karpathy-style LLM Wiki index (plain markdown + grep)…

### lifecycle

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/lifecycle`

Orchestrates the unified install, plan, status, doctor, and uninstall lifecycle across the project and its selected agent integrations.

### opencode

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/opencode`

Owns OpenCode profile discovery, bounded evidence records, and collision-safe reconciliation.

### owned-paths

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/owned-paths.ts`

<!-- seeded-purpose: a7727a2c03309440ca648329be38a5fb0566d597b367b41423d2b09c163d44b0 -->

Derive the set of top-level path prefixes that safeword may write to, sourced from SAFEWORD_SCHEMA at build time.

### packs

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/packs`

Detects supported languages and supplies their files, packages, and setup behavior.

### parity

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/parity.ts`

Checks canonical templates, dogfood mirrors, generated catalogues, and one-way content contracts for drift.

### pr-review

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/pr-review`

Reviews pull-request evidence, applies conservative routing, and separates model inspection from merge-neutral GitHub publication.

### presets

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/presets`

Publishes conditional JavaScript and TypeScript ESLint presets through the package export.

### reconcile

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/reconcile.ts`

<!-- seeded-purpose: 76b396197de407a1fbd82d9825006ca749d81e0faf97ee7d8006ae6583373657 -->

Reconciliation Engine

### retro

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/retro`

Sanitizes, deduplicates, triages, reconciles, and files retrospective findings.

### review

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/review`

Coordinates independent adversarial reviews across Claude and Codex, including runtime discovery, neutral packet construction, policy enforcement, fallback handling, and provenance.

### schema

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/schema.ts`

<!-- seeded-purpose: cf6127ae78364456709c16fc16d5bcba85386d254f98d01b24b63dd8a39b9a00 -->

SAFEWORD Schema - Single Source of Truth

### self-report-capture

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/self-report-capture.ts`

<!-- seeded-purpose: 1d6ab8a143a63251557b3fecb492adadece7106155c9cfbf6118f1eb235efe63 -->

CLI-side self-observation producer (ticket 5XXQQZ, issues #345 / #720).

### skills

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/skills`

Installs optional third-party language coding skills without owning Safeword workflow skills.

### templates

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/templates`

Builds dynamic configuration and legacy-cleanup content consumed by reconciliation.

### test-execution

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/test-execution`

<!-- seeded-purpose: adb4a0800f07492701f258275f7c107d407e1c2d8d2a3b56c0d7d6c55ffd531c -->

Resolves Safeword's local versus remote-preferred test-execution choice, including private worktree configuration and its fail-closed validation.

### test-plan

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/test-plan`

Resolves and renders the canonical test, build, typecheck, BDD, and dependency plan for a project.

### ticket-create

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/ticket-create`

<!-- seeded-purpose: cd55e2fe5512344c84b7dd05daf04eeee694ac625fc57c8bb223112f0b3ededb -->

Route `ticket new` between the local-id path and issue-first creation (KKNFZA TB1). provider:none → the local minter (today's behavior, no tracker client built).

### ticket-sync

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/ticket-sync`

<!-- seeded-purpose: 5fdae57e79b128bcbf454f6c3fe43a4055247db3add218f54aa2008dc911d08c -->

Ticket sync — generates capability-discovery indexes over the ticket corpus: `<namespace-root>/tickets/INDEX.md` (active tickets, grouped by epic) and `INDEX-completed.md` (the `completed/` archive).

### tracker-connect

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/tracker-connect`

<!-- seeded-purpose: 21d448b7a5545f4c8179c2071ea2bee6d64843126d4ab910e3fd10950e7d449f -->

The connect orchestration (2TK5AD) — the single flow `setup` and `connect` both run.

### tracker-sync

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/tracker-sync`

<!-- seeded-purpose: 11bf14632c9d632ee25e364801faad3e599320096950805ee110e066eb822838 -->

The sync-tracker orchestrator — the single call site that projects the ticket corpus one-way into the configured tracker (JS5K5G).

### upstream-monitor

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/upstream-monitor`

Tracks upstream Claude Code, Codex CLI, and Cursor release signals for compatibility review.

### utils

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/utils`

Provides shared architecture, manifest, filesystem, Git, path, detection, Gherkin, and ticket primitives.

### version

<!-- reconciled: 54d13654ee4af2e2ae9e7548eac973756bac82951f4d82a04864e50752b46c11 -->

`src/version.ts`

Reads the Safeword release version from package metadata.

### plugin-cli-bundle

<!-- reconciled: c6f28b66b6a8bda5f5f50c4ca0107c98b71804261987a7865c6ae476284f88b4 -->

> ⚠ orphaned: this section describes a module that no longer exists.

No description yet — awaiting prose.
