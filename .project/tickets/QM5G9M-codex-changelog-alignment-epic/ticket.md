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

## Feasibility verdict: ENFORCEABLE (researched 2026-05-31; hooks doc re-verified directly)

Codex CLI ships a **programmatic hooks system that can block actions**. The full event set (confirmed on developers.openai.com/codex/hooks): `SessionStart`, `SubagentStart`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, `Stop`.

**Which events actually hard-block (verified):**

- `PreToolUse` → `permissionDecision: "deny"` (or exit code 2 → stderr) stops a Bash command, `apply_patch` edit, or MCP tool call **before it runs**. ← phase/edit gate.
- `PermissionRequest` → `behavior: "deny"`.
- `UserPromptSubmit` → `decision: "block"` **blocks the prompt**. ← the real turn-start chokepoint.
- `PostToolUse` → `decision: "block"` stops result handling (can't undo the side effect already done).

**Correction (was wrong in the first draft):** `Stop` does **not** prevent stopping. `decision: "block"` on `Stop` tells Codex to "continue and automatically create a new continuation prompt" — i.e. auto-continue/nudge, the same family as Cursor's `stop`, not a hard block. So the **done gate cannot hard-block at `Stop`**; enforce it at `UserPromptSubmit` (refuse the next turn until `verify.md` exists) plus a `Stop` continuation nudge. Same architectural conclusion as the Cursor epic (VAX3Z2 / AKNWZK).

Verdict stays **ENFORCEABLE** — `PreToolUse`/`PermissionRequest`/`UserPromptSubmit` give real hard blocks covering the phase and LOC gates and the done gate's upstream chokepoint.

**Caveat — trust gate.** Non-managed hooks require the user to review and trust the exact hook definition (trust recorded against the hook's hash; changed hooks re-flagged) via `/hooks`; a user can decline. Hard enforcement uses **managed hooks** (`requirements.toml` `[hooks]`, MDM, cloud) — trusted by policy, can't be disabled; `allow_managed_hooks_only = true` skips user/project/plugin hooks entirely (mirrors Claude Code's `allowManagedHooksOnly`). See ticket JV6D1W.

## Surfaces (and the safeword need each maps to)

| Codex surface                                                     | Blocks?                   | Safeword use                                                                         |
| ----------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| Hooks: `PreToolUse`, `PermissionRequest`, `UserPromptSubmit`      | **Yes (hard)**            | phase/edit gate, command gate, turn-start + done-gate chokepoint                     |
| Hooks: `PostToolUse`                                              | partial (result-handling) | LOC gate signal                                                                      |
| Hooks: `Stop` / `SubagentStop`                                    | No — auto-continue only   | done-gate **nudge** (not hard block)                                                 |
| Hooks: `SessionStart`                                             | No (inject context)       | bootstrap                                                                            |
| `AGENTS.md` (root + dir walk-up; `project_doc_*` config)          | No (advisory)             | inject SAFEWORD.md/CLAUDE.md equivalent                                              |
| `config.toml` (`~/.codex/` + project `.codex/`; inline `[hooks]`) | Indirect                  | wire hooks, MCP servers, sandbox/approval defaults                                   |
| `.codex/hooks.json` (project) + `~/.codex/hooks.json` (global)    | —                         | hook wiring; all matching layers run (no override)                                   |
| MCP servers                                                       | tool allow/deny           | optional: expose safeword state/commands                                             |
| Skills / custom prompts (`~/.codex/prompts/*.md`)                 | No                        | safeword slash commands — surface TBD (QGHVXZ); deprecation **unverified**, see note |
| Plugins + marketplace (default-enabled plugin hooks)              | via bundled hooks         | distribution path, parity with Cursor (ticket 6WJ1RS)                                |

## Sources

- developers.openai.com/codex/hooks — **re-verified directly**: full event list, deny/block semantics, exit codes, trust model, config precedence, `allow_managed_hooks_only`.
- developers.openai.com/codex — docs index (full nav): dedicated pages exist for Hooks, Skills, Plugins, Subagents, Permissions, Sandboxing, Rules, AGENTS.md, MCP, Non-interactive Mode, SDK, MCP Server, Enterprise Managed Configuration, Feature Maturity.
- developers.openai.com/codex/config-reference, /config-advanced — AGENTS.md loading, config.toml, inline `[hooks]`, project `.codex/hooks.json` (via first research pass).
- developers.openai.com/codex/changelog — official page only shows back to **v0.131.0 (2026-05-18)**; recent entries: AGENTS loading reliability (v0.133.0), richer lifecycle observation incl. subagent start/stop + async approval (v0.133.0), marketplace CLI + default-enabled plugin hooks (v0.133.0), profile-migration docs (v0.134.0).
- releasebot.io/updates/openai/codex, releases.sh/openai — third-party mirrors for the 0.125–0.135 timeline.

**Coverage honesty:** the load-bearing enforcement claims (hook events, deny/block, trust model) are now verified against the live hooks doc. NOT yet read end-to-end: the Skills, Plugins, Subagents, Permissions, Sandboxing, Rules, AGENTS.md, MCP, SDK, and Enterprise Managed Configuration pages — these back the commands-surface (QGHVXZ), generation (5DEJ8V), and distribution (6WJ1RS) tickets and should be confirmed when those are picked up.

**Research gaps:** (1) official changelog page only reaches v0.131.0 (2026-05-18); earlier history is third-party-only — pin the hooks-support floor against `openai/codex` releases (WR4HRA). (2) The "custom prompts deprecated → skills" claim came from the first research pass and was **not** confirmed on the changelog; treat as unverified until the Skills/Slash-Commands docs are read (QGHVXZ).

## Tickets

| ID         | Title                                                      | Note                                   |
| ---------- | ---------------------------------------------------------- | -------------------------------------- |
| **N12G95** | Spike: port one gate to a Codex `PreToolUse` deny hook     | de-risk first                          |
| **HPP49X** | Map safeword lifecycle events → Codex hook events (design) | design doc                             |
| **5DEJ8V** | Generate `AGENTS.md` + `config.toml` hook wiring           | CLI install path                       |
| **QGHVXZ** | Commands surface: skills vs deprecated custom prompts      | `/figure-it-out`                       |
| **JV6D1W** | Enforcement strength: user-trusted vs managed hooks        | value decision                         |
| **WR4HRA** | Pin minimum `codex` CLI version for required hooks         | baseline tracking                      |
| **6WJ1RS** | Package as Codex plugin/marketplace bundle                 | distribution (parity w/ Cursor DXYKJX) |

## Sequencing

Spike (N12G95) first to prove deny-on-edit end-to-end. Then design (HPP49X) → generation (5DEJ8V). QGHVXZ and JV6D1W are decisions that can run in parallel. WR4HRA + 6WJ1RS after the gates work.

## Revalidation + /figure-it-out (2026-06-13)

**Frame:** Decide whether this epic is still the right container for Codex parity after current Codex docs and releases moved past the May 31 research.

**Research domains checked:** Codex hook blocking semantics, Codex skills/plugin distribution, AGENTS.md discovery, managed configuration/trust model, Codex CLI release floor, and safeword's existing Claude/Cursor generator architecture.

**Current evidence:** Official Codex docs still support the epic premise: `UserPromptSubmit` can hard-block prompts, `PreToolUse` can deny supported `Bash` / `apply_patch` / MCP tool calls, `Stop` is only a continuation nudge, skills live in `.agents/skills`, plugins can bundle hooks, plugin hooks still require trust, and managed `requirements.toml` is the enterprise enforcement path. The latest stable Codex CLI release found via `openai/codex` releases is `0.139.0` (2026-06-09); `0.140.0-alpha.17` exists as a prerelease on 2026-06-13.

**Options:**

1. Raw project install first: generate `AGENTS.md`, `.codex/` hook config, and `.agents/skills`, then package later.
2. Plugin first: make plugin packaging the primary install surface before raw setup works.
3. Managed-only: require enterprise managed hooks from day one.

**Recommend:** Keep the epic and sequence, with option 1 as the implementation path. Raw setup proves real parity fastest and matches safeword's existing setup/upgrade model. Plugin-first is better for distribution but depends on the same generated assets. Managed-only is stronger but excludes individual CLI users.

**Next:** Run `N12G95` first, then update `HPP49X` and `5DEJ8V` from the spike result before implementing broad generation.

## Related

- Epic **8R54HV** (Claude Code) — same gate model; reuse its hook contracts where Codex matches.
- Ticket **116** — version-baseline tracking pattern (mirror for `codex-version`).

## Work Log

- 2026-05-31T21:09:47.366Z Started: Created ticket QM5G9M
- 2026-05-31 Placeholder created; no existing Codex integration.
- 2026-05-31 Researched Codex surfaces (live docs). Verdict ENFORCEABLE; filed 6 child tickets.
- 2026-05-31 Re-verified hooks doc directly. Corrected `Stop` claim (auto-continues, does NOT hard-block — done gate moves to `UserPromptSubmit`); added `UserPromptSubmit` block + `allow_managed_hooks_only`; softened unverified custom-prompts-deprecation; added distribution ticket 6WJ1RS. Noted Skills/Plugins/Enterprise docs not yet read end-to-end.
- 2026-06-13T14:37:31Z Revalidated and ran /figure-it-out across the epic. Verdict still stands: Codex parity is enforceable, but implementation must keep the current docs' caveat that `PreToolUse` is a guardrail with incomplete shell interception. Latest stable is 0.139.0; 0.140.0-alpha.17 exists. Keep raw setup first, plugin packaging second, managed enforcement as enterprise path.
