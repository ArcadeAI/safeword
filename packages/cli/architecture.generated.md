---
generator: safeword-architecture
fingerprint: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922
---

# Architecture

## Modules

### boundary

<!-- reconciled: 775eecda88726a4e3534dd13ba6eb4ffcdcbf5ca42582940435de969ba860f80 -->

`src/boundary`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### cli

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/cli.ts`

No description yet — awaiting prose.

### codex-plugin

<!-- reconciled: 46c36d5f38a649de87c0efdc15506fc108e44f584fdbcd3547d5958a1682bb89 -->

`src/codex-plugin`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### commands

<!-- reconciled: baf84fad13ff152cf8bceed63ef6a6e65c6edbb3dcf8ac0cbf76fc4caa39fe38 -->

`src/commands`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### cursor-wrappers

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/cursor-wrappers.ts`

No description yet — awaiting prose.

### health

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/health.ts`

<!-- seeded-purpose: 6a514346e034c47f263a14d1f352d56fe0f1435fb100f8804a19b9b70aebc139 -->

Config-health verification core (ticket 3293WH).

### index

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/index.ts`

No description yet — awaiting prose.

### learning-sync

<!-- reconciled: baf84fad13ff152cf8bceed63ef6a6e65c6edbb3dcf8ac0cbf76fc4caa39fe38 -->

`src/learning-sync`

<!-- seeded-purpose: b56dcde39a15d17f52892285e891cbc4a384a735d1cac4e9a4440ed6b7c3e6e6 -->

Learning sync — generates `<namespace-root>/learnings/INDEX.md` from the `*.md` files in that folder so agents can navigate learnings via a Karpathy-style LLM Wiki index (plain markdown + grep)…

> ⚠ stale: structure changed since this section was reconciled.

### owned-paths

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/owned-paths.ts`

<!-- seeded-purpose: a7727a2c03309440ca648329be38a5fb0566d597b367b41423d2b09c163d44b0 -->

Derive the set of top-level path prefixes that safeword may write to, sourced from SAFEWORD_SCHEMA at build time.

### packs

<!-- reconciled: baf84fad13ff152cf8bceed63ef6a6e65c6edbb3dcf8ac0cbf76fc4caa39fe38 -->

`src/packs`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### parity

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/parity.ts`

No description yet — awaiting prose.

### presets

<!-- reconciled: baf84fad13ff152cf8bceed63ef6a6e65c6edbb3dcf8ac0cbf76fc4caa39fe38 -->

`src/presets`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### reconcile

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/reconcile.ts`

<!-- seeded-purpose: 76b396197de407a1fbd82d9825006ca749d81e0faf97ee7d8006ae6583373657 -->

Reconciliation Engine

### retro

<!-- reconciled: 3dd53c1fa45850e6d2d4894c1c7556870663b58d05710e8dc248b4424eaf8b62 -->

`src/retro`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### schema

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/schema.ts`

<!-- seeded-purpose: cf6127ae78364456709c16fc16d5bcba85386d254f98d01b24b63dd8a39b9a00 -->

SAFEWORD Schema - Single Source of Truth

### self-report-capture

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/self-report-capture.ts`

<!-- seeded-purpose: 1d6ab8a143a63251557b3fecb492adadece7106155c9cfbf6118f1eb235efe63 -->

CLI-side self-observation producer (ticket 5XXQQZ, issues #345 / #720).

### skills

<!-- reconciled: b3f28d8c3e9bdad22efef89e1925cd740e93bd7b5341a4d45a228b0212a63a12 -->

`src/skills`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### templates

<!-- reconciled: baf84fad13ff152cf8bceed63ef6a6e65c6edbb3dcf8ac0cbf76fc4caa39fe38 -->

`src/templates`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### test-plan

<!-- reconciled: baf84fad13ff152cf8bceed63ef6a6e65c6edbb3dcf8ac0cbf76fc4caa39fe38 -->

`src/test-plan`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### ticket-create

<!-- reconciled: a48bcc3820c9cca4a78184f53ae752117d461b6ed53541d3b3cddaad10d4a349 -->

`src/ticket-create`

<!-- seeded-purpose: cd55e2fe5512344c84b7dd05daf04eeee694ac625fc57c8bb223112f0b3ededb -->

Route `ticket new` between the local-id path and issue-first creation (KKNFZA TB1). provider:none → the local minter (today's behavior, no tracker client built).

> ⚠ stale: structure changed since this section was reconciled.

### ticket-sync

<!-- reconciled: baf84fad13ff152cf8bceed63ef6a6e65c6edbb3dcf8ac0cbf76fc4caa39fe38 -->

`src/ticket-sync`

<!-- seeded-purpose: 5fdae57e79b128bcbf454f6c3fe43a4055247db3add218f54aa2008dc911d08c -->

Ticket sync — generates capability-discovery indexes over the ticket corpus: `<namespace-root>/tickets/INDEX.md` (active tickets, grouped by epic) and `INDEX-completed.md` (the `completed/` archive).

> ⚠ stale: structure changed since this section was reconciled.

### tracker-connect

<!-- reconciled: 5ba924bfe0161fd9d14b96fd8ab887c88c0082bea39062b56d9cd9918c9595ca -->

`src/tracker-connect`

<!-- seeded-purpose: 21d448b7a5545f4c8179c2071ea2bee6d64843126d4ab910e3fd10950e7d449f -->

The connect orchestration (2TK5AD) — the single flow `setup` and `connect` both run.

> ⚠ stale: structure changed since this section was reconciled.

### tracker-sync

<!-- reconciled: 5b032204a124515d544b1fe4e73d3ad3f975d603c0d450c672ecdb5b5bc6bb33 -->

`src/tracker-sync`

<!-- seeded-purpose: 11bf14632c9d632ee25e364801faad3e599320096950805ee110e066eb822838 -->

The sync-tracker orchestrator — the single call site that projects the ticket corpus one-way into the configured tracker (JS5K5G).

> ⚠ stale: structure changed since this section was reconciled.

### upstream-monitor

<!-- reconciled: a269dbaedd84d54c4fa979fcca89547589746c19adc8d03f3b933c0234441ef7 -->

`src/upstream-monitor`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### utils

<!-- reconciled: baf84fad13ff152cf8bceed63ef6a6e65c6edbb3dcf8ac0cbf76fc4caa39fe38 -->

`src/utils`

No description yet — awaiting prose.

> ⚠ stale: structure changed since this section was reconciled.

### version

<!-- reconciled: b5e10ab759c1bd1b8ecbc876dbbc0b76784831cacf5438183665db386a5ed922 -->

`src/version.ts`

No description yet — awaiting prose.
