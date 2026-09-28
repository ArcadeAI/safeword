---
generator: safeword-architecture
fingerprint: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9
---

# Architecture

## Modules

### boundary

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/boundary`

Evaluates architectural boundary evidence and dependency-policy compliance.

### claude-plugin

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/claude-plugin`

Owns native Claude plugin delivery, exact execution proof, historical ownership classification, and non-blocking transactional legacy contraction.

### cli

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/cli.ts`

Composes the executable and registers public, compatibility, and hidden hook commands.

### cli-protocol

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/cli-protocol`

Defines the typed command catalogue, effect policy, plans, results, rendering, and execution adapters.

### codex-plugin

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/codex-plugin`

Owns Codex profile-plugin installation, proof, legacy authority, migration, finalization, and recovery.

### commands

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/commands`

Implements domain handlers for removal, project workflows, tickets, Codex, and retrospectives; the install/status/doctor lifecycle lives in `src/lifecycle`.

### cursor-wrappers

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/cursor-wrappers.ts`

Generates thin Cursor command and rule wrappers from canonical workflow templates.

### execution-plan

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/execution-plan`

Defines Execution Plan delivery obligations, checklist state, and coding prerequisites.

### health

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/health.ts`

<!-- seeded-purpose: 6a514346e034c47f263a14d1f352d56fe0f1435fb100f8804a19b9b70aebc139 -->

Config-health verification core (ticket 3293WH).

### index

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/index.ts`

Exposes the stable library API for version, detection, reconciliation, and ESLint consumers.

### learning-sync

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/learning-sync`

<!-- seeded-purpose: b56dcde39a15d17f52892285e891cbc4a384a735d1cac4e9a4440ed6b7c3e6e6 -->

Learning sync — generates `<namespace-root>/learnings/INDEX.md` from the `*.md` files in that folder so agents can navigate learnings via a Karpathy-style LLM Wiki index (plain markdown + grep)…

### lifecycle

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/lifecycle`

Orchestrates the unified install, plan, status, doctor, and uninstall lifecycle across the project and its selected agent integrations.

### opencode

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/opencode`

Owns OpenCode profile discovery, bounded evidence records, and collision-safe reconciliation.

### owned-paths

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/owned-paths.ts`

<!-- seeded-purpose: a7727a2c03309440ca648329be38a5fb0566d597b367b41423d2b09c163d44b0 -->

Derive the set of top-level path prefixes that safeword may write to, sourced from SAFEWORD_SCHEMA at build time.

### packs

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/packs`

Detects supported languages and supplies their files, packages, and setup behavior.

### parity

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/parity.ts`

Checks canonical templates, dogfood mirrors, generated catalogues, and one-way content contracts for drift.

### planning

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/planning`

Defines the canonical shared and phase-specific planning contracts, their generated identities, and shared-clause integrity checks.

### plugin-runtime-authority

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/plugin-runtime-authority.ts`

<!-- seeded-purpose: d664e608378a545926fba12aeedbc4f2be570d04d049717415b17971f1f8c125 -->

Enforces packaged-runtime authority for native plugin workflow assets.

### pr-review

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/pr-review`

Reviews pull-request evidence, applies conservative routing, and separates model inspection from merge-neutral GitHub publication.

### presets

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/presets`

Publishes conditional JavaScript and TypeScript ESLint presets through the package export.

### project-runtime-helpers

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/project-runtime-helpers.ts`

<!-- seeded-purpose: acaaa3d22a68f19f7903a8d9a6cae85015257f5360180608cc12afe268780e76 -->

Dependency-free inventory of helpers the packaged project runtime may execute.

### project-state

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/project-state.ts`

<!-- seeded-purpose: 4465ec9ae17dbbf1256d87b2df1b8a6dfd5a9f7b4e2152babdf8f58cdb8146c3 -->

Exposes lazy transient-state ignore management to the packaged CLI runtime.

### reconcile

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/reconcile.ts`

<!-- seeded-purpose: 76b396197de407a1fbd82d9825006ca749d81e0faf97ee7d8006ae6583373657 -->

Reconciliation Engine

### retro

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/retro`

Sanitizes, deduplicates, triages, reconciles, and files retrospective findings.

### review

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/review`

Coordinates independent adversarial reviews across Claude and Codex, including runtime discovery, neutral packet construction, policy enforcement, fallback handling, and provenance.

### schema

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/schema.ts`

<!-- seeded-purpose: cf6127ae78364456709c16fc16d5bcba85386d254f98d01b24b63dd8a39b9a00 -->

SAFEWORD Schema - Single Source of Truth

### self-report-capture

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/self-report-capture.ts`

<!-- seeded-purpose: 1d6ab8a143a63251557b3fecb492adadece7106155c9cfbf6118f1eb235efe63 -->

CLI-side self-observation producer (ticket 5XXQQZ, issues #345 / #720).

### skills

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/skills`

Installs optional third-party language coding skills without owning Safeword workflow skills.

### templates

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/templates`

Builds dynamic configuration and legacy-cleanup content consumed by reconciliation.

### test-execution

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/test-execution`

<!-- seeded-purpose: adb4a0800f07492701f258275f7c107d407e1c2d8d2a3b56c0d7d6c55ffd531c -->

Resolves Safeword's local versus remote-preferred test-execution choice, including private worktree configuration and its fail-closed validation.

### test-plan

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/test-plan`

Resolves and renders the canonical test, build, typecheck, BDD, and dependency plan for a project.

### ticket-create

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/ticket-create`

<!-- seeded-purpose: cd55e2fe5512344c84b7dd05daf04eeee694ac625fc57c8bb223112f0b3ededb -->

Route `ticket new` between the local-id path and issue-first creation (KKNFZA TB1). provider:none → the local minter (today's behavior, no tracker client built).

### ticket-sync

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/ticket-sync`

<!-- seeded-purpose: 5fdae57e79b128bcbf454f6c3fe43a4055247db3add218f54aa2008dc911d08c -->

Ticket sync — generates capability-discovery indexes over the ticket corpus: `<namespace-root>/tickets/INDEX.md` (active tickets, grouped by epic) and `INDEX-completed.md` (the `completed/` archive).

### tracker-connect

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/tracker-connect`

<!-- seeded-purpose: 21d448b7a5545f4c8179c2071ea2bee6d64843126d4ab910e3fd10950e7d449f -->

The connect orchestration (2TK5AD) — the single flow `setup` and `connect` both run.

### tracker-sync

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/tracker-sync`

<!-- seeded-purpose: 11bf14632c9d632ee25e364801faad3e599320096950805ee110e066eb822838 -->

The sync-tracker orchestrator — the single call site that projects the ticket corpus one-way into the configured tracker (JS5K5G).

### upstream-monitor

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/upstream-monitor`

Tracks upstream Claude Code, Codex CLI, and Cursor release signals for compatibility review.

### utils

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/utils`

Provides shared architecture, manifest, filesystem, Git, path, detection, Gherkin, and ticket primitives.

### version

<!-- reconciled: e4449a0c7763be12366d1bd361b9fd9ed48f383f1d0b1b43244a16d8522070b9 -->

`src/version.ts`

Reads the Safeword release version from package metadata.
