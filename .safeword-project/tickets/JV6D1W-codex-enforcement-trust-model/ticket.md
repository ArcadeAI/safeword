---
id: JV6D1W
slug: codex-enforcement-trust-model
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Codex enforcement strength: user-trusted default + documented managed path

**Goal:** Set safeword's Codex enforcement posture.

**Decision (researched 2026-05-31):** Default install = **user-trusted hooks** (the only option for individual CLI users); setup must walk the user through trusting safeword's hooks via `/hooks`. Enterprise hard-enforcement = **managed hooks** via `requirements.toml`, documented as the opt-in for orgs that need ungameable gates.

## Mechanics (verified, /codex/hooks + /codex/enterprise/managed-configuration)

- **User trust:** non-managed hooks require review+trust via `/hooks`; trust is recorded against the hook's **hash**, so any edit re-flags for review. A user can decline → gates don't run. (Setup UX must make trusting obvious.)
- **Managed hooks:** `requirements.toml` `[hooks]` with `managed_dir` / `windows_managed_dir`; trusted by policy, can't be disabled. `allow_managed_hooks_only = true` skips user/project/session/**plugin** hooks but still loads `requirements.toml` ones.
- **Three managed layers:** cloud (chatgpt.com/codex/settings/managed-configs), macOS MDM (`com.openai.codex:requirements_toml_base64`), system files (`/etc/codex/requirements.toml`, `%ProgramData%\OpenAI\Codex\requirements.toml`).
- **Plugin hooks are still trust-gated** ("existing approval settings still apply") — bundling via a plugin (6WJ1RS) does not bypass the trust gate.

## Done when

- Setup flow guides `/hooks` trust on install (user path).
- Docs include a managed `requirements.toml` recipe for enterprises wanting hard enforcement.

## Source

developers.openai.com/codex/hooks, /codex/enterprise/managed-configuration

## Work Log

- 2026-05-31 Created from Codex research.
- 2026-05-31 Read enterprise managed-config doc. RESOLVED: user-trusted default + documented managed path; full mechanics captured.
