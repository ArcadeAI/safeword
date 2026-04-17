---
id: '116'
title: Review Claude Code changelog for Safeword-relevant changes
type: task
phase: intake
created: 2026-04-11
---

## Goal

Establish Claude Code version tracking for Safeword and do a one-time changelog review to surface breaking changes, opportunities, and action items.

## Context

Safeword v0.27.0 ships as a Claude Code plugin. Claude Code's public changelog lives at `anthropics/claude-code` on GitHub (`CHANGELOG.md`). **We do not currently track which Claude Code version we build against.** This ticket establishes that tracking and does the initial review.

## Steps

### 1. Establish version tracking

We have no record of which Claude Code version Safeword 0.27.0 was built against. To bootstrap:

- Check git history around the 0.27.0 release for clues (dependency pins, commit messages, Claude Code version mentions)
- If no record exists, determine the Claude Code version that was current at release time (use changelog dates + our release date)
- **Introduce a `claude-code-version` field** — candidate locations:
  - `marketplace.json` (co-located with plugin version, single source of truth for compatibility)
  - `.safeword/claude-code-version` (standalone file, easy to read from scripts)
- Record the baseline version there. Going forward, bump this field as part of Safeword releases.

### 2. Fetch and diff the changelog

- Pull the raw changelog from `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`
- Identify all entries between the baseline version and current HEAD
- Group by version

### 3. Triage for Safeword relevance

Flag any entry that touches:

- **Hook lifecycle** — SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SubagentStop, etc.
- **Plugin system** — `.claude-plugin/`, marketplace.json schema, plugin loading, relative-path plugins
- **Settings schema** — settings.json structure, new/removed/renamed keys
- **CLI flags or behavior** — changes to `claude` invocation, `--dangerously-skip-permissions`, permission model
- **MCP integration** — MCP server handling, tool routing
- **Model changes** — new default models, model ID changes, context window changes
- **Slash commands / skills** — new built-in commands that might collide with Safeword commands

### 4. Produce action items

For each relevant entry, classify as:

- **Breaking** — Safeword code must change or it will fail
- **Opportunity** — new capability Safeword could leverage
- **Watch** — no action now, but could affect us in a future release

### 5. Update the baseline

After review, bump the tracked Claude Code version to the latest reviewed.

## Acceptance criteria

- [ ] Claude Code version tracking introduced (field + location decided)
- [ ] Baseline Claude Code version identified and recorded
- [ ] All changelog entries between baseline and current reviewed
- [ ] Safeword-relevant items triaged (breaking / opportunity / watch)
- [ ] Action items filed as sub-tickets or noted in existing tickets
- [ ] Baseline bumped to current after review

## Preliminary findings (from quality review scan, 2026-04-11)

Claude Code is at v2.1.101 as of April 10, 2026. Scanning v2.1.92–v2.1.101 surfaced these Safeword-relevant items:

### Breaking / verify we're not hitting

| Version    | Item                                                                                    | Safeword impact                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2.1.97/98 | Fixed prompt-type Stop/SubagentStop hooks failing on long sessions                      | Directly affects `stop-quality.ts` — our core quality gate. Verify users on older Claude Code versions aren't silently losing stop hook enforcement. |
| v2.1.94    | Fixed plugin skill hooks defined in YAML frontmatter being silently ignored             | Could explain reports of skills not triggering.                                                                                                      |
| v2.1.94    | Fixed plugin hooks failing when `CLAUDE_PLUGIN_ROOT` not set                            | Affects fresh installs.                                                                                                                              |
| v2.1.101   | Fixed `permissions.deny` not overriding a PreToolUse hook's `permissionDecision: "ask"` | If Safeword ever uses `permissionDecision` in hooks, deny rules now correctly win.                                                                   |

### Opportunities

| Version  | Item                                                                      | Safeword impact                                                                                         |
| -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| v2.1.101 | Unrecognized hook event names no longer break entire settings.json        | Safeword can be more forward-compatible — adding new hook types won't break users on older Claude Code. |
| v2.1.101 | Skills now honor `context: fork` and `agent` frontmatter fields           | May enable skill isolation patterns (e.g., forking context for audit skill).                            |
| v2.1.94  | Plugin skill naming uses frontmatter `name` instead of directory basename | Verify Safeword skills are named correctly under new behavior.                                          |
| v2.1.98  | `/reload-plugins` picks up skills without restart                         | Better dev experience for Safeword contributors.                                                        |
| v2.1.94  | `keep-coding-instructions` frontmatter field for plugin output styles     | Could shape how Safeword hook output is displayed.                                                      |

### Watch

| Version  | Item                                                                                     | Safeword impact                                                      |
| -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| v2.1.101 | Fixed memory leak in long sessions (virtual scroller retained historical message copies) | Users on older versions may hit this; no Safeword action needed.     |
| v2.1.98  | Added `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` and `CLAUDE_CODE_SCRIPT_CAPS`                   | New security knobs — could be relevant for hardened deployments.     |
| v2.1.94  | Default effort level changed from medium to high                                         | May affect how thoroughly Claude follows Safeword hook instructions. |
