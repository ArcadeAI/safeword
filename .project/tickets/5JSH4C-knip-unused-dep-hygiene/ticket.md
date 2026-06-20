---
id: 5JSH4C
slug: knip-unused-dep-hygiene
type: task
phase: intake
status: in_progress
created: 2026-06-20T01:21:33.492Z
last_modified: 2026-06-20T01:22:00Z
---

# Dependency hygiene: prune knip-flagged unused deps (post-B6MZ4Z)

**Goal:** Verify and prune the dependencies knip flags as unused on `main`, or suppress the genuine false-positives in knip config, so the audit signal stays high.

**Why:** A `knip` scout during the B6MZ4Z epic found a clutch of unused-dependency flags on current `main` — including several **frontend** ESLint plugins carried by a **CLI** repo. Either they're dead weight to drop or knip needs an ignore entry; either way the audit shouldn't stay noisy.

## Important context — original premise is moot

This task replaces an earlier "dead-export cleanup" idea. That is **no longer needed**: the 8 unused _exports_ scouted **pre-merge** were already removed by `main` (knip on the merged tree reports **zero** "Unused exports"). This is a clean example of the staleness issue tracked in [9E6Q4V](../9E6Q4V-staleness-check-vs-origin-main/ticket.md) — a pre-merge scout going stale. Re-scout on current `main` before acting here too.

## Candidates (knip on merged `main`, 2026-06-20)

**Unused dependencies (7)** — `packages/cli/package.json`, all `eslint-plugin-*`: `@next/eslint-plugin-next`, `@tanstack/eslint-plugin-query`, `eslint-plugin-astro`, `eslint-plugin-better-tailwindcss`, `eslint-plugin-playwright`, `eslint-plugin-storybook`, `eslint-plugin-turbo`. None are referenced in the local `eslint.config.ts` — frontend plugins in a CLI package; likely genuinely unused (or pulled by a shared preset).

**Unused devDependencies (3)** — `tsx` (root + `packages/cli`), `turbo` (root). Verify they're not used by a script/turbo pipeline knip can't see before removing.

## Out of scope

- **Unlisted binaries (14)** — `codex`, `rustup`, `golangci-lint`, `ruff`, `mypy`, `rustfmt`, `which`, … These are external CLI tools referenced by name in integration tests, not npm packages. Expected noise; if anything, add to knip's `ignoreBinaries`, don't try to "install" them.
- The unused-exports cleanup (already done by `main`).

## Verify before removing (provenance)

For each dep: confirm it isn't pulled transitively by a shared ESLint preset the repo `extends`, and isn't referenced in a config/script knip doesn't parse. Removing a preset-required plugin breaks lint. Prefer removal only when truly unreferenced; otherwise add a knip `ignoreDependencies` entry with a one-line reason.

## Done when

- Each flagged dep is either removed (genuinely unused) or added to knip's ignore list with a reason.
- `knip` runs clean (or its remaining flags are all deliberately ignored), `bun run lint` still green.
- Re-scouted against current `main` first (not the candidate list above, which may itself go stale).

## Work Log

- 2026-06-20 Filed from the B6MZ4Z epic's refactor-scout follow-up. The originally-intended dead-export cleanup was moot (main already removed those exports); pivoted to the actual current knip finding — unused frontend ESLint plugins in the CLI package. Candidates verified against the merged tree; local eslint.config.ts does not reference them.
