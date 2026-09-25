---
generator: safeword-architecture
fingerprint: b0d812365fe70b1317ced7d3eb216a3c67f6d1a467053eac66370478efc3537d
---

# Architecture

## Modules

### boundary

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/boundary`

Evaluates architectural boundary evidence and dependency-policy compliance.

> ⚠ stale: structure changed since this section was reconciled.

### claude-plugin

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/claude-plugin`

Owns native Claude plugin delivery, exact execution proof, historical ownership classification, and non-blocking transactional legacy contraction.

> ⚠ stale: structure changed since this section was reconciled.

### cli

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/cli.ts`

Composes the executable and registers public, compatibility, and hidden hook commands.

> ⚠ stale: structure changed since this section was reconciled.

### cli-protocol

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/cli-protocol`

Defines the typed command catalogue, effect policy, plans, results, rendering, and execution adapters.

> ⚠ stale: structure changed since this section was reconciled.

### codex-plugin

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/codex-plugin`

Owns Codex profile-plugin installation, proof, legacy authority, migration, finalization, and recovery.

> ⚠ stale: structure changed since this section was reconciled.

### commands

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/commands`

Implements domain handlers for removal, project workflows, tickets, Codex, and retrospectives; the install/status/doctor lifecycle lives in `src/lifecycle`.

> ⚠ stale: structure changed since this section was reconciled.

### cursor-wrappers

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/cursor-wrappers.ts`

Generates thin Cursor command and rule wrappers from canonical workflow templates.

> ⚠ stale: structure changed since this section was reconciled.

### execution-plan

<!-- reconciled: b0d812365fe70b1317ced7d3eb216a3c67f6d1a467053eac66370478efc3537d -->

`src/execution-plan`

No description yet — awaiting prose.

### health

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/health.ts`

<!-- seeded-purpose: 6a514346e034c47f263a14d1f352d56fe0f1435fb100f8804a19b9b70aebc139 -->

Config-health verification core (ticket 3293WH).

> ⚠ stale: structure changed since this section was reconciled.

### index

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/index.ts`

Exposes the stable library API for version, detection, reconciliation, and ESLint consumers.

> ⚠ stale: structure changed since this section was reconciled.

### learning-sync

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/learning-sync`

<!-- seeded-purpose: b56dcde39a15d17f52892285e891cbc4a384a735d1cac4e9a4440ed6b7c3e6e6 -->

Learning sync — generates `<namespace-root>/learnings/INDEX.md` from the `*.md` files in that folder so agents can navigate learnings via a Karpathy-style LLM Wiki index (plain markdown + grep)…

> ⚠ stale: structure changed since this section was reconciled.

### lifecycle

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/lifecycle`

Orchestrates the unified install, plan, status, doctor, and uninstall lifecycle across the project and its selected agent integrations.

> ⚠ stale: structure changed since this section was reconciled.

### opencode

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/opencode`

Owns OpenCode profile discovery, bounded evidence records, and collision-safe reconciliation.

> ⚠ stale: structure changed since this section was reconciled.

### owned-paths

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/owned-paths.ts`

<!-- seeded-purpose: a7727a2c03309440ca648329be38a5fb0566d597b367b41423d2b09c163d44b0 -->

Derive the set of top-level path prefixes that safeword may write to, sourced from SAFEWORD_SCHEMA at build time.

> ⚠ stale: structure changed since this section was reconciled.

### packs

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/packs`

Detects supported languages and supplies their files, packages, and setup behavior.

> ⚠ stale: structure changed since this section was reconciled.

### parity

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/parity.ts`

Checks canonical templates, dogfood mirrors, generated catalogues, and one-way content contracts for drift.

> ⚠ stale: structure changed since this section was reconciled.

### plugin-bundle

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/plugin-bundle.ts`

Normalizes generated plugin JavaScript so machine-specific Bun install paths do not change bundle
bytes or integrity hashes.

> ⚠ stale: structure changed since this section was reconciled.

### plugin-runtime-authority

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/plugin-runtime-authority.ts`

<!-- seeded-purpose: d664e608378a545926fba12aeedbc4f2be570d04d049717415b17971f1f8c125 -->

Enforces packaged-runtime authority for native plugin workflow assets.

> ⚠ stale: structure changed since this section was reconciled.

### pr-review

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/pr-review`

Reviews pull-request evidence, applies conservative routing, and separates model inspection from merge-neutral GitHub publication.

> ⚠ stale: structure changed since this section was reconciled.

### presets

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/presets`

Publishes conditional JavaScript and TypeScript ESLint presets through the package export.

> ⚠ stale: structure changed since this section was reconciled.

### project-runtime-helpers

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/project-runtime-helpers.ts`

<!-- seeded-purpose: acaaa3d22a68f19f7903a8d9a6cae85015257f5360180608cc12afe268780e76 -->

Dependency-free inventory of helpers the packaged project runtime may execute.

> ⚠ stale: structure changed since this section was reconciled.

### project-state

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/project-state.ts`

<!-- seeded-purpose: 4465ec9ae17dbbf1256d87b2df1b8a6dfd5a9f7b4e2152babdf8f58cdb8146c3 -->

Exposes lazy transient-state ignore management to the packaged CLI runtime.

> ⚠ stale: structure changed since this section was reconciled.

### reconcile

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/reconcile.ts`

<!-- seeded-purpose: 76b396197de407a1fbd82d9825006ca749d81e0faf97ee7d8006ae6583373657 -->

Reconciliation Engine

> ⚠ stale: structure changed since this section was reconciled.

### retro

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/retro`

Sanitizes, deduplicates, triages, reconciles, and files retrospective findings.

> ⚠ stale: structure changed since this section was reconciled.

### review

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/review`

Coordinates independent adversarial reviews across Claude and Codex, including runtime discovery, neutral packet construction, policy enforcement, fallback handling, and provenance.

> ⚠ stale: structure changed since this section was reconciled.

### schema

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/schema.ts`

<!-- seeded-purpose: cf6127ae78364456709c16fc16d5bcba85386d254f98d01b24b63dd8a39b9a00 -->

SAFEWORD Schema - Single Source of Truth

> ⚠ stale: structure changed since this section was reconciled.

### self-report-capture

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/self-report-capture.ts`

<!-- seeded-purpose: 1d6ab8a143a63251557b3fecb492adadece7106155c9cfbf6118f1eb235efe63 -->

CLI-side self-observation producer (ticket 5XXQQZ, issues #345 / #720).

> ⚠ stale: structure changed since this section was reconciled.

### skills

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/skills`

Installs optional third-party language coding skills without owning Safeword workflow skills.

> ⚠ stale: structure changed since this section was reconciled.

### templates

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/templates`

Builds dynamic configuration and legacy-cleanup content consumed by reconciliation.

> ⚠ stale: structure changed since this section was reconciled.

### test-execution

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/test-execution`

<!-- seeded-purpose: adb4a0800f07492701f258275f7c107d407e1c2d8d2a3b56c0d7d6c55ffd531c -->

Resolves Safeword's local versus remote-preferred test-execution choice, including private worktree configuration and its fail-closed validation.

> ⚠ stale: structure changed since this section was reconciled.

### test-plan

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/test-plan`

Resolves and renders the canonical test, build, typecheck, BDD, and dependency plan for a project.

> ⚠ stale: structure changed since this section was reconciled.

### ticket-create

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/ticket-create`

<!-- seeded-purpose: cd55e2fe5512344c84b7dd05daf04eeee694ac625fc57c8bb223112f0b3ededb -->

Route `ticket new` between the local-id path and issue-first creation (KKNFZA TB1). provider:none → the local minter (today's behavior, no tracker client built).

> ⚠ stale: structure changed since this section was reconciled.

### ticket-sync

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/ticket-sync`

<!-- seeded-purpose: 5fdae57e79b128bcbf454f6c3fe43a4055247db3add218f54aa2008dc911d08c -->

Ticket sync — generates capability-discovery indexes over the ticket corpus: `<namespace-root>/tickets/INDEX.md` (active tickets, grouped by epic) and `INDEX-completed.md` (the `completed/` archive).

> ⚠ stale: structure changed since this section was reconciled.

### tracker-connect

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/tracker-connect`

<!-- seeded-purpose: 21d448b7a5545f4c8179c2071ea2bee6d64843126d4ab910e3fd10950e7d449f -->

The connect orchestration (2TK5AD) — the single flow `setup` and `connect` both run.

> ⚠ stale: structure changed since this section was reconciled.

### tracker-sync

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/tracker-sync`

<!-- seeded-purpose: 11bf14632c9d632ee25e364801faad3e599320096950805ee110e066eb822838 -->

The sync-tracker orchestrator — the single call site that projects the ticket corpus one-way into the configured tracker (JS5K5G).

> ⚠ stale: structure changed since this section was reconciled.

### upstream-monitor

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/upstream-monitor`

Tracks upstream Claude Code, Codex CLI, and Cursor release signals for compatibility review.

> ⚠ stale: structure changed since this section was reconciled.

### utils

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/utils`

Provides shared architecture, manifest, filesystem, Git, path, detection, Gherkin, and ticket primitives.

> ⚠ stale: structure changed since this section was reconciled.

### version

<!-- reconciled: a97ee766ef9e4f188f5393c3425b709efcc920df410cb2a6b35a06a0b836f34e -->

`src/version.ts`

Reads the Safeword release version from package metadata.

> ⚠ stale: structure changed since this section was reconciled.
