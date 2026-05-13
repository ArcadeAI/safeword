---
id: 142
type: task
phase: understand
status: open
created: 2026-05-13T15:55:00Z
last_modified: 2026-05-13T15:55:00Z
---

# Worktree-clean dev loop: import ESLint presets from source

**Goal:** Make a fresh git worktree commit-able after one `bun install` — no pre-build step, no `--no-verify`.

**Why:** Surfaced during ticket #081 audit. After `bun install` in a fresh worktree, `git commit` still fails because `eslint.config.mjs:11` imports safeword presets from `packages/cli/dist/...`, which doesn't exist until you've built. The dance to commit a single line change becomes:

1. `bun install` (legitimate — fresh worktrees have no `node_modules`)
2. `cd packages/cli && bun run build` (illegitimate — lint shouldn't depend on dist)

Step 2 is the real wart. The repo lints itself using the built output of one of its own workspace packages.

## Scope

**In:**

- Change `eslint.config.mjs:11` to import safeword presets from `packages/cli/src/presets/typescript/index.ts` (source) instead of `dist/...index.js` (built).
- Confirm ESLint's flat-config TypeScript loader handles it. ESLint 9.x supports `.ts` config files natively via Node's experimental loader, or via `tsx`/`jiti`. Research the minimum-bloat option.
- If a loader registration is needed, document it in one place (eslint.config.mjs comment).

**Out of Scope:**

- **B.** Fixing `tsup --dts` (the `eslint-plugin-{storybook,turbo}` type errors). That's ticket #140 territory. Once A lands, `tsup --dts` brokenness no longer blocks linting — it only affects published `.d.ts` consumers.
- Switching package manager, restructuring workspaces, or moving away from husky.
- Husky hook path handling — investigated during #081 and found to be working correctly (relative `node_modules/.bin` resolves to the worktree's own bin once `bun install` runs). Earlier hypothesis of "hardcoded path" was wrong.

## Done When

- [ ] Fresh worktree can run `bun install && git commit` (with staged changes) and have the pre-commit hook pass without any pre-build step
- [ ] `eslint.config.mjs` no longer references `dist/`
- [ ] No `packages/cli/dist/` build required for lint to work
- [ ] CI still passes (lint, typecheck, test on the affected workspace)

## References

- Ticket #081 audit notes — surfaced the problem during the `autoUpdate → autoUpgrade` rename commit
- Ticket #140 — overlapping `tsup --dts` failure (intentionally out of scope here)
- Ticket #141 — Claude Code worktree race (related "worktree story" cluster but different root cause)
