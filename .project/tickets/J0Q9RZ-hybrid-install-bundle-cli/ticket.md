---
id: J0Q9RZ
slug: hybrid-install-bundle-cli
type: feature
phase: intake
status: in_progress
relates_to: J611KP
scope:
  - Bundle the built CLI into the plugin (plugin/cli/ JS run via run-bun.sh), generated from one source tree
  - Marker-gated SessionStart sync hook — reconcile on version-marker drift, silent otherwise
  - First-touch notice naming `safeword reset` for the user-global scope case
out_of_scope:
  - Compiled per-arch bin/ binaries (bun build --compile) — later optimization
  - Codex and Cursor install flows — separate tickets
  - Removing the npm-published CLI — stays for CI / non-Claude entry points
done_when:
  - Enabling the plugin scaffolds a fresh project with no user-typed npm/bunx command
  - SessionStart sync is idempotent — re-runs only on version-marker drift
  - User-global enablement on an unrelated repo is recoverable via `safeword reset`
  - Full suite + lint + real parity-check green
created: 2026-06-27T22:33:56.807Z
last_modified: 2026-06-27T22:33:56.807Z
---

# Smooth hybrid install: bundle the CLI in the plugin, auto-scaffold on first session

**Goal:** Collapse "install the plugin" + "separately discover and run `bunx safeword setup`" into one step — enabling the safeword plugin sets the project up by itself, deterministically, with no npm command the user types and no plugin↔CLI version skew.

**Why:** In the hybrid model (plugin ships the agent layer, CLI writes project state), the naive install is a clunky two-step. The CLI can't be a plugin (plugins can't write project files), but a plugin's SessionStart hook and bundled `bin/` CAN run a tool that writes the project. Bundling the CLI into the plugin makes the plugin and the setup tool one versioned artifact — which simultaneously removes the two-step install, the npm-for-the-tool dependency, and the version-skew the J611KP spike had to police with a handshake.

## Intake Brief

- **Who asked:** alex, exploring the plugin distribution direction.
- **Cost of inaction:** the hybrid plugin's install stays a documented two-step; adoption friction undercuts the main reason to ship a plugin.
- **Reversibility:** medium — bundling + an auto-run SessionStart hook is reversible, but it changes first-run behavior for every plugin user; ship behind the version-marker gate so it's contained.

## Decision (from `/figure-it-out`, 2026-06-27)

**Bundle the CLI into the plugin; auto-scaffold/sync deterministically from SessionStart; reversibility (`safeword reset`) is the safety net, not an upfront gate.**

Reframe from the user: **people adopt safeword specifically to mutate their project — enabling the plugin IS consent to scaffold.** There is no separate "adoption gate"; auto-run on first session is the expected behavior. The earlier "first adoption must be an explicit command" idea was ceremony that contradicts what the tool is for — dropped.

What survives is **scope discipline, not consent**: a user-global plugin auto-running on *every* repo (including ones opened only to read) is the one genuinely-unwanted case. Mitigations, cheapest first:

1. **Reversibility over permission.** `safeword reset` already removes owned files and preserves user data — an instant, complete undo beats an upfront prompt.
2. **Scope carries intent.** Project-scope enablement (committed `.claude/settings.json`) = "this repo wants safeword" → auto-scaffold freely. User-global = "my repos generally" → emit a one-line first-touch notice ("safeword set this project up — `safeword reset` to undo") as a courtesy escape hatch, not a gate.

### Why bundling is load-bearing

- **Kills version skew** — plugin and CLI are one artifact at one version, so J611KP's `session-version.ts` min-CLI handshake becomes unnecessary on the bundled path (keep it only as a fallback for an npm CLI).
- **Kills the npm-for-the-tool dependency** — the tool ships with the plugin; network is only needed for the language-pack linters setup installs (inherent to any path).
- **Deterministic + headless-safe** — a SessionStart `command` hook runs the bundled CLI directly, unlike an agent-instruction approach a model might skip (and which has no agent turn in `-p`/CI).

## Evidence (Claude Code plugin mechanics, verified 2026-06-27)

- `bin/` executables join the Bash tool's PATH while the plugin is enabled. ([plugins-reference](https://code.claude.com/docs/en/plugins-reference.md))
- SessionStart `command` hooks run arbitrary programs that may write `${CLAUDE_PROJECT_DIR}`; the read-only-cache limit applies only to the plugin's own bundled files.
- Hook schema supports `async`, `asyncRewake` (implies async; wakes Claude on exit 2), `timeout` (default 600s). ([hooks](https://code.claude.com/docs/en/hooks.md))
- `${CLAUDE_PLUGIN_DATA}` persists across plugin updates — the version-marker home; recommended drift pattern compares bundled manifest to the stored marker and reconciles on mismatch.
- The one-time `Setup` event fires only with `--init-only`/`--init`/`--maintenance` (CI/`-p`), NOT on interactive install — so **SessionStart is the interactive entry point**, marker-gated to avoid re-running every session.

## Implementation sketch

- **Bundle:** ship the built CLI as `plugin/cli/` JS, run via the existing `run-bun.sh` (bun→bunx→npx-tsx). Generated from the same source as the npm CLI — one source tree, parity-checked. Compiled per-arch `bin/` binaries are a later optimization, not v1.
- **Sync hook** (`plugin/hooks/`, SessionStart): read marker from `${CLAUDE_PLUGIN_DATA}`; if it differs from the plugin version (or `.safeword/` is absent), run bundled `safeword setup`/`upgrade` via `run-bun.sh` (`asyncRewake` + a one-line "setting up/syncing safeword…" notice), then write the marker. If matched, silent. Turns J611KP's version-*detection* into version-*reconciliation*.
- **First-touch notice + reset** for the user-global scope case.

## Premortem

Most likely failure at 6 months: **cross-platform packaging** — a bundled CLI that assumes a runtime breaks where neither bun nor node exists, or compiled per-arch binaries balloon plugin size and rot on a new OS/arch. Mitigation: v1 ships bundled JS through `run-bun.sh`; treat compiled binaries as a follow-up. Second risk: an `async` setup failing silently mid-background — use `asyncRewake` so a failure surfaces to Claude rather than leaving a half-scaffolded repo.

## Work Log

- 2026-06-27T22:33:56.807Z Started: Created ticket J0Q9RZ
- 2026-06-27T22:34:00.000Z Captured from a `/figure-it-out` on hybrid install UX (builds on J611KP). Decision: bundle CLI + deterministic marker-gated auto-scaffold from SessionStart; reversibility as the safety net; consent implicit in adopting the tool (per user). Scope/out-of-scope/done-when bounded; cross-platform packaging flagged as premortem risk, deferred to bundled-JS-first.
