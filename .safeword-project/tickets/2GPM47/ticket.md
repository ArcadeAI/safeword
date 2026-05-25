---
id: 2GPM47
slug: setup-wrapper-discoverability
type: task
phase: intake
status: in_progress
created: 2026-05-25T22:50:33.502Z
last_modified: 2026-05-25T22:50:33.502Z
scope:
  - When `safeword setup` creates `.dependency-cruiser.cjs` at the repo root for the first time, emit a one-line explainer that tells the customer (a) what the file is, (b) that it extends the auto-generated rules in `.safeword/depcruise-config.cjs`, and (c) that they can edit it to add custom rules.
  - Trigger only when `syncResult.createdMainConfig === true` (i.e., setup actually created it this run). Skip the explainer when the wrapper already existed — that customer already knows.
  - Test in `packages/cli/tests/commands/setup-architecture.test.ts`: assert the explainer string appears in setup output when wrapper is newly created, absent when wrapper preexists.
out_of_scope:
  - Removing or restructuring the setup-time wrapper write. Validated as correct by /figure-it-out (2026-05-25): industry convention (husky init, eslint --init, prettier --init, biome init, depcruise --init) is that setup commands write configs into customer-owned space. Setup is the right place; the only gap is discoverability.
  - Touching `.safeword/depcruise-config.cjs` reporting. That file lives in safeword-owned space; customers don't need an explainer for it.
  - Adding an interactive prompt or `--no-depcruise` flag. Arch-detection gate already filters out projects where depcruise wouldn't make sense.
  - Reworking the "created files" list output in `printSetupSummary`. The explainer is additive — a new info line, not a restructure.
done_when:
  - On a fresh setup that triggers wrapper creation, setup output contains a clear one-line message explaining what `.dependency-cruiser.cjs` is and how to extend it.
  - On a setup where `.dependency-cruiser.cjs` already exists (customer-customized or prior setup), the explainer does NOT appear (no nag).
  - Test covers both states (newly-created vs preexisting).
  - No change to `safeword sync-config` or `/audit` behavior.
---

# Surface .dependency-cruiser.cjs creation more clearly in setup output

**Goal:** When `safeword setup` creates `.dependency-cruiser.cjs` at the customer's repo root, tell them what it is and how to extend it — so the file isn't a mystery artifact they trip over later.

**Why:** Surfaced via /figure-it-out (2026-05-25) while validating that setup-time writes are convention-correct. The only legitimate concern with the current setup behavior is discoverability: customers who don't read the "created files" list closely may not realize the wrapper appeared, and won't know they can extend it with custom rules. A single info line at creation time closes that gap without changing any architectural decisions.

## Context anchor

- Wrapper creation: [packages/cli/src/commands/setup.ts:324-333](packages/cli/src/commands/setup.ts:324-333) — gated on `hasArchitectureDetected(arch)`, pushes `.dependency-cruiser.cjs` into `archFiles` when `syncResult.createdMainConfig === true`.
- Created-files output: [packages/cli/src/commands/setup.ts:277-282](packages/cli/src/commands/setup.ts:277-282) — `archFiles` flows into the bundled `createdFiles` list that `printCreatedFiles` renders.
- Wrapper generator: [packages/cli/src/utils/depcruise-config.ts:163](packages/cli/src/utils/depcruise-config.ts:163) — content already includes a "// ADD YOUR CUSTOM RULES BELOW:" comment, so the in-file guidance exists; the customer just needs to know the file is there.
- Companion ticket: [6R84DY](.safeword-project/tickets/6R84DY/ticket.md) — the `/audit` no-write fix that motivated this design pass.

## Implementation sketch

In `setupJavaScriptProject` ([setup.ts:316-349](packages/cli/src/commands/setup.ts:316-349)), after the existing `archFiles.push('.dependency-cruiser.cjs')` line (line 330), call a new `info()` with a short message. Something like:

> `info('  ↳ extends rules from .safeword/depcruise-config.cjs — edit .dependency-cruiser.cjs to add your own.')`

Two-space indent so it visually nests under the "created files" line. Verb-led first word so it reads left-to-right.

## Work Log

- 2026-05-25T22:50:33.502Z Started: Created ticket 2GPM47 as follow-up from /figure-it-out validating setup-time wrapper write (option A). Single-file, single-behavior change. Phase: intake — scope/out-of-scope/done-when locked, ready for TDD when picked up.
