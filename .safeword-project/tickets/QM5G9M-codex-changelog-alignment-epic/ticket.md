---
id: QM5G9M
slug: codex-changelog-alignment-epic
type: feature
phase: intake
status: open
epic: codex-changelog-alignment
created: 2026-05-31T21:09:47.366Z
last_modified: 2026-05-31T21:51:00.000Z
---

# Epic: OpenAI Codex changelog + docs alignment

**Goal:** Bring safeword's gate model to OpenAI Codex (the `codex` CLI), now that research confirms Codex's enforcement surfaces are a clean fit.

**Why:** Codex is a major coding agent with a growing user base and — crucially — a programmatic hooks system that can block actions. Safeword's whole value (enforced phase/LOC/done gates) is expressible there, so this is a real integration, not just instruction files.

## Feasibility verdict: ENFORCEABLE (researched 2026-05-31)

Codex CLI ships a **full programmatic hooks system that can block actions**, directly analogous to Claude Code hooks. Hooks fire at `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, plus `PermissionRequest`, `PreCompact`/`PostCompact`, `SubagentStart`/`SubagentStop`. Blocking is real: `PreToolUse` returns `permissionDecision: "deny"` (or exit code 2 → stderr) to stop a Bash command, `apply_patch` edit, or MCP tool call before it runs; `PostToolUse` supports `decision: "block"`. This covers every event safeword needs.

**Caveat — trust gate.** Non-managed hooks require the user to review and trust the exact hook definition via `/hooks` before they run; a user can decline. For hard enforcement, Codex supports **managed hooks** (`requirements.toml` / MDM / cloud) that are trusted by policy and can't be disabled. So: technically enforceable, with a consumer-CLI trust caveat (see ticket JV6D1W).

## Surfaces (and the safeword need each maps to)

| Codex surface | Blocks? | Safeword use |
| --- | --- | --- |
| Hooks (`PreToolUse`/`PostToolUse`/`Stop`/`SessionStart`/`UserPromptSubmit`/`PermissionRequest`) | Yes | phase gate (PreToolUse on edits), LOC gate (PostToolUse/Stop), done gate (Stop), per-turn reminder (UserPromptSubmit), bootstrap (SessionStart) |
| `AGENTS.md` (root + dir walk-up; `project_doc_*` config) | No (advisory) | inject SAFEWORD.md/CLAUDE.md equivalent |
| `config.toml` (`~/.codex/` + project `.codex/`) | Indirect | wire hooks inline, MCP servers, sandbox/approval defaults |
| MCP servers | tool allow/deny | optional: expose safeword state/commands |
| Custom prompts (`~/.codex/prompts/*.md`) — **deprecated → skills** | No | safeword slash commands; build as skills, not prompts (QGHVXZ) |

## Sources

- developers.openai.com/codex/hooks — events, deny/block semantics, exit codes, trust model
- developers.openai.com/codex/config-reference and /config-advanced — AGENTS.md loading, config.toml, inline `[hooks]`, project-local `.codex/hooks.json`
- developers.openai.com/codex/changelog — Apr–May 2026 entries (hooks enriched w/ conversation history + subagent identity v0.134.0; managed hooks via requirements.toml; custom prompts → skills)
- releasebot.io/updates/openai/codex, releases.sh/openai/openai-codex-changelog — version timeline (0.125–0.135, Apr–May 2026)

**Research gap:** public changelog mirrors didn't expose pre-~Apr-24 (v0.125) entries, so the exact version that first introduced hooks isn't pinned — they were already established by v0.129.0 (May 9). Resolved by ticket WR4HRA against `openai/codex` releases.

## Tickets

| ID | Title | Note |
| --- | --- | --- |
| **N12G95** | Spike: port one gate to a Codex `PreToolUse` deny hook | de-risk first |
| **HPP49X** | Map safeword lifecycle events → Codex hook events (design) | design doc |
| **5DEJ8V** | Generate `AGENTS.md` + `config.toml` hook wiring | CLI install path |
| **QGHVXZ** | Commands surface: skills vs deprecated custom prompts | `/figure-it-out` |
| **JV6D1W** | Enforcement strength: user-trusted vs managed hooks | value decision |
| **WR4HRA** | Pin minimum `codex` CLI version for required hooks | baseline tracking |

## Sequencing

Spike (N12G95) first to prove deny-on-edit end-to-end. Then design (HPP49X) → generation (5DEJ8V). QGHVXZ and JV6D1W are decisions that can run in parallel. WR4HRA is a small baseline task, do alongside.

## Related

- Epic **8R54HV** (Claude Code) — same gate model; reuse its hook contracts where Codex matches.
- Ticket **116** — version-baseline tracking pattern (mirror for `codex-version`).

## Work Log

- 2026-05-31T21:09:47.366Z Started: Created ticket QM5G9M
- 2026-05-31 Placeholder created; no existing Codex integration.
- 2026-05-31 Researched Codex surfaces (live docs). Verdict ENFORCEABLE; filed 6 child tickets.
