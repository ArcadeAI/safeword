# Surfaces

<!--
Safeword dogfoods feature surfaces here. Customer projects receive a starter
surfaces.md from packages/cli/templates/surfaces-template.md and then own it.
-->

## Claude Code

**Kind:** Agent runtime
**Description:** Claude Code run from a terminal on a developer's own machine via the `claude` CLI (or an IDE extension). Operates synchronously against the developer's real filesystem and git checkout, with network/tool access governed by the developer's own OS and permissions.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** `.claude/skills`, `.claude/settings.json`, slash commands, Claude hooks, VS Code / JetBrains IDE extensions
**Coverage notes:** Tag feature scenarios with `@surface.claude-code` when behavior must work through Claude Code's installed files or workflow on a developer's local machine.
**Do not confuse with:** Claude Code Cloud — runs in an ephemeral, Anthropic-managed cloud VM instead of the developer's machine; local-only mechanics (e.g. `claude --resume`, an interactively-authenticated MCP server) don't carry over.

## Claude Code Cloud

**Kind:** Agent runtime
**Description:** Cloud-hosted Claude Code sessions (officially "Claude Code on the web") launched from claude.ai/code, the Claude mobile/desktop app, `claude --cloud` from the terminal, or a scheduled Routine — plus Claude Code GitHub Actions, which runs Claude Code inside a GitHub-hosted CI runner rather than an Anthropic VM. Each cloud session clones the repo into an ephemeral, isolated Anthropic-managed VM governed by the environment's network policy, and is reclaimed when the session ends or after inactivity.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** claude.ai/code web UI, Claude mobile app, `claude --cloud` / `--teleport`, scheduled/event-driven Routines, Claude Code GitHub Actions (`anthropics/claude-code-action`, `@claude` issue/PR triggers), the repository selector below the input box (repos synced via the Claude GitHub App or `/web-setup`), per-environment network policy
**Coverage notes:** Tag feature scenarios with `@surface.claude-code-cloud` when behavior depends on a cloud / off-machine lifecycle (ephemeral VM or CI runner, network policy, GitHub-event triggers) rather than a developer's local setup. Lifecycle hooks (`SessionStart`, `UserPromptSubmit`, etc.) do fire in cloud sessions, but interactively-authenticated MCP servers may be unavailable in headless runs.
**Do not confuse with:** Claude Code — runs on the developer's own persistent machine, not a reclaimed VM.

## OpenAI Codex

**Kind:** Agent runtime
**Description:** OpenAI's Codex CLI run from a terminal on a developer's own machine. Operates synchronously in the user's shell with OS-native sandboxing (macOS Seatbelt, Windows native/WSL2, Linux bubblewrap) and interactive approval prompts when crossing sandbox boundaries.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** `.agents/skills`, `AGENTS.md`, `codex` CLI command, `~/.codex/config.toml`, repo-local `.codex/hooks.json`, sandbox modes (`read-only` / `workspace-write` / `danger-full-access`)
**Coverage notes:** Tag feature scenarios with `@surface.openai-codex` when behavior must work through OpenAI Codex's installed files or workflow on a developer's local machine.
**Do not confuse with:** OpenAI Codex Cloud — runs in an OpenAI-managed container instead of the local CLI; local `~/.codex/hooks.json` and CLI-local extensibility don't apply there.

## OpenAI Codex Cloud

**Kind:** Agent runtime
**Description:** OpenAI's cloud-hosted Codex surface (chatgpt.com/codex), where tasks run inside isolated, OpenAI-managed containers instead of a developer's machine — triggered from ChatGPT web/mobile, by tagging `@codex` on a GitHub issue or PR, or by delegating from the local CLI/IDE.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** chatgpt.com/codex, `@codex` GitHub mentions, "delegate to cloud" from the CLI/IDE extension, per-repo cloud environment config (setup script, base image, allowed tools)
**Coverage notes:** Tag feature scenarios with `@surface.openai-codex-cloud` when behavior depends on the cloud container's two-phase lifecycle (network-open setup, then network-isolated agent run) rather than local CLI mechanics. `AGENTS.md` is still read from the repo checkout.
**Do not confuse with:** OpenAI Codex — runs synchronously on the developer's machine under OS-level sandboxing, not container isolation.

## Cursor

**Kind:** Agent runtime
**Description:** The Cursor desktop IDE running on a developer's own machine, with agent mode, inline edits, and Tab completion operating directly on the local filesystem and git checkout.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** `.cursor/rules`, `.cursor/commands`, `.cursor/hooks.json`, `~/.cursor/hooks.json`, `cursor-agent` CLI, IDE-only hooks (`sessionStart`, `sessionEnd`, `beforeSubmitPrompt`)
**Coverage notes:** Tag feature scenarios with `@surface.cursor` when behavior must work through Cursor's installed files or workflow on a developer's local machine.
**Do not confuse with:** Cursor Cloud Agents — runs in an isolated cloud VM with no home directory, so user-level hooks and IDE-only hook events don't apply.

## Cursor Cloud Agents

**Kind:** Agent runtime
**Description:** Cursor's cloud-based asynchronous agent product (Cloud Agents, formerly "Background Agents"). Each task provisions an isolated cloud VM, clones the repo fresh, works on its own branch, and opens a PR — no developer machine required.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** `.cursor/environment.json` (cloud-only env config), Cursor Web (cursor.com/agents), Slack/GitHub/Linear `@cursor` mentions, `cursor/<task-slug>` branches (customizable prefix)
**Coverage notes:** Tag feature scenarios with `@surface.cursor-cloud-agents` when behavior depends on the cloud VM lifecycle rather than local IDE mechanics. Project-level `.cursor/rules`, `.cursor/commands`, and command-based `.cursor/hooks.json` still apply; user-level hooks and IDE-only events do not.
**Do not confuse with:** Cursor — runs in the IDE on the developer's machine with full local environment access.

## Safeword CLI

**Kind:** CLI
**Description:** The `safeword` command-line tool itself — the harness-agnostic engine that installs and maintains the process layer. Runs setup/upgrade to scaffold and reconcile managed files (personas.md, surfaces.md, glossary.md, hooks, skills), and check/sync-config/test-plan/ticket to validate and drive the workflow. Operates on the project's real filesystem independent of which agent (if any) invokes it.
**Audience:** Technical Builder (TB), Safeword Maintainer (SM)
**Examples:** `safeword setup`, `safeword upgrade`, `safeword check`, `safeword sync-config`, `safeword test-plan`, `safeword ticket new`, the managed-file reconcile contract, generated `INDEX.md`
**Coverage notes:** Tag feature scenarios with `@surface.safeword-cli` when the behavior is the CLI tool's own — file scaffolding/reconciliation, config validation, index generation — rather than something that must work through a specific agent runtime.
**Do not confuse with:** Claude Code / OpenAI Codex / Cursor — the agent runtimes that *invoke* safeword during a session. `@surface.safeword-cli` marks behavior that must hold no matter which agent (or a plain terminal) runs the command.
