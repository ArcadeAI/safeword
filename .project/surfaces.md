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

## Claude Code on the Web

**Kind:** Agent runtime
**Description:** Anthropic's browser-hosted Claude Code surface at `claude.ai/code`. It runs in the same ephemeral, Anthropic-managed cloud environment described by the Claude Code Cloud surface, rather than on the developer's local checkout.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** `claude.ai/code`, repository selection through the Claude GitHub App, web-launched coding tasks
**Coverage notes:** Tag feature scenarios with `@surface.claude-code-on-the-web` when the browser-hosted entry point itself matters. Use `@surface.claude-code-cloud` for behavior common to all Claude Code cloud entry points.
**Do not confuse with:** Claude Code — the local CLI and IDE runtime on a developer machine.

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
**Description:** The `safeword` command-line tool itself — the harness-agnostic engine that installs and maintains the process layer. Runs `install` to scaffold and reconcile managed project files and, by default, configure Claude and Codex; Cursor remains explicit. `status`, `doctor`, `plan`, `uninstall`, and project subcommands validate and drive the workflow. Operates on the project's real filesystem independent of which agent (if any) invokes it.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** `safeword install`, `safeword install --agents=cursor`, `safeword status`, `safeword doctor`, `safeword plan`, `safeword uninstall`, project subcommands, the managed-file reconcile contract, generated `INDEX.md`
**Coverage notes:** Tag feature scenarios with `@surface.safeword-cli` when the behavior is the CLI tool's own — file scaffolding/reconciliation, config validation, index generation — rather than something that must work through a specific agent runtime.
**Do not confuse with:** Claude Code / OpenAI Codex / Cursor — the agent runtimes that *invoke* safeword during a session. `@surface.safeword-cli` marks behavior that must hold no matter which agent (or a plain terminal) runs the command.

## Closeout Cleanup Guard

**Kind:** Destructive-operation guard
**Description:** The installed closeout preview/apply boundary that verifies the exact merged pull request, current-session retrospective evidence, repository state, worktree, and branch targets before cleanup.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** `.safeword/scripts/closeout-cleanup.ts`, preview plan digests, sealed transcript receipts, exact worktree and branch deletion
**Coverage notes:** Tag scenarios with `@surface.closeout-cleanup-guard` when behavior is observable at the preview/apply safety boundary, including convergence and fail-closed target drift.
**Do not confuse with:** Safeword CLI — the general command surface; this guard owns the destructive closeout authorization contract.

## Retro Filer

**Kind:** Recovery workflow
**Description:** The supported authenticated continuation that files sanitized retrospective drafts from the exact session-bound spool and records durable acknowledgements before draining them.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** `safeword:retro-filer`, `.safeword/retro-drafts/<session>.jsonl`, filed-ack ledgers, cross-worktree fallback filing
**Coverage notes:** Tag scenarios with `@surface.retro-filer` when behavior depends on exact spool provenance, acknowledgement-gated drain, or fallback filing from another active worktree/session.
**Do not confuse with:** Retrospective extraction — extraction creates sanitized drafts; the retro filer transports and acknowledges them.

## GitHub Pull Request Conversation

**Kind:** Collaboration surface
**Description:** The ordinary issue-comment timeline on a GitHub pull request, where Safeword maintains one marker-owned advisory receipt without creating a review, approval, check, or status.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** Pull-request Conversation tab, issue comment REST endpoints, the `<!-- safeword:pr-review-receipt:v1 -->` marker
**Coverage notes:** Tag scenarios with `@surface.github-pull-request-conversation` when receipt wording, uniqueness, ownership, or merge-neutral publication is observable in the ordinary conversation.
**Do not confuse with:** GitHub Pull Request Review — inline review comments and approvals use a separate API and can participate in merge policy.

## GitHub Pull Request Review

**Kind:** Collaboration surface
**Description:** GitHub's review/inline-comment surface, including review threads, review states, and approvals. HXT3GW deliberately does not publish through this surface; later finding-lifecycle work owns it.
**Audience:** Technical Builder (TBU), Non-Technical Builder (NTB), Safeword Maintainer (SWM)
**Examples:** Files changed review threads, pending reviews, approve/request-changes states, pull-request review REST endpoints
**Coverage notes:** Tag scenarios with `@surface.github-pull-request-review` when behavior depends on inline location, review lifecycle, or approval semantics, including proof that an advisory workflow does not call this surface.
**Do not confuse with:** GitHub Pull Request Conversation — ordinary comments cannot approve a pull request or satisfy a required review.

## GitHub Actions Execution Sandbox

**Kind:** CI runtime
**Description:** GitHub-hosted workflow jobs, their permissions, environments, secrets, artifacts, concurrency groups, and executable steps. It is the authority boundary for Safeword's split inspection/publication workflow.
**Audience:** Technical Builder (TBU), Safeword Maintainer (SWM)
**Examples:** `pull_request_target`, reusable workflows, job-level `permissions`, GitHub environments, Actions artifacts, scheduled workflows
**Coverage notes:** Tag scenarios with `@surface.github-actions-execution-sandbox` when the guarantee depends on job isolation, secret scope, token permissions, concurrency, checkout absence, or runtime execution behavior.
**Do not confuse with:** GitHub Pull Request Conversation — that is the user-visible comment surface; the Actions sandbox is the runtime that produces and publishes the serialized result.

## Railway Hosted Relay

**Kind:** Hosted service
**Description:** The Railway deployment surface for Safeword's retry-safe retro relay. It runs the transport-independent HTTP API and a single-host SQLite WAL store on a persistent Railway volume; production filing remains disabled until the checked-in readiness manifest passes.
**Audience:** Safeword Maintainer (SWM)
**Examples:** Railway service health checks, persistent volume mounting, relay environment configuration, deployment smoke tests
**Coverage notes:** Tag feature scenarios with `@surface.railway-hosted-relay` when behavior depends on the hosted relay process, its persistent storage, or Railway deployment controls.
**Do not confuse with:** Safeword CLI — the local command that prepares and delivers retro requests. The hosted relay accepts authorized requests and coordinates durable deduplication.

## Railway Public Retro Collector

**Kind:** Hosted service
**Description:** The credentialless public quarantine that durably accepts sanitized local retros without importing, storing, or invoking private GitHub filing authority. It runs as a separate Railway service with its own process, SQLite volume, deployment, and operator-only read credential.
**Audience:** Safeword Maintainer (SWM)
**Examples:** Public intake, raw-body deduplication, opaque receipts, operator reads, isolated persistent volume
**Coverage notes:** Tag feature scenarios with `@surface.railway-public-retro-collector` when behavior depends on public intake, quarantine storage, receipt deduplication, or collector deployment controls.
**Do not confuse with:** Railway Hosted Relay — the existing authenticated private filing service; the public collector cannot reach its GitHub credentials, code paths, or database.
