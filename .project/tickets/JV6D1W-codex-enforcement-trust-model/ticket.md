---
id: JV6D1W
slug: codex-enforcement-trust-model
type: task
phase: done
status: done
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

Revalidation note: current docs also say administrators can enforce command rules from `requirements.toml` with `[rules]`, and the most restrictive decision wins. Because `PreToolUse` is documented as incomplete for some shell paths, the enterprise recipe should pair managed hooks with managed command rules or permission restrictions for destructive escape paths.

## Done when

- Setup flow guides `/hooks` trust on install (user path).
- Docs include a managed `requirements.toml` recipe for enterprises wanting hard enforcement.

## Source

developers.openai.com/codex/hooks, /codex/enterprise/managed-configuration

## Managed requirements.toml recipe

For individual users, safeword's generated `.codex/config.toml` remains the default path and tells the user to review/trust project hooks before assuming gates run.

For enterprises that need policy-trusted enforcement, manage Codex with a `requirements.toml` that enables hooks, points at an administrator-owned hook directory, and pairs hooks with restrictive rules for paths `PreToolUse` may not intercept yet:

```toml
[features]
hooks = true

[hooks]
managed_dir = "/opt/safeword/codex/hooks"
windows_managed_dir = "C:\\ProgramData\\Safeword\\Codex\\hooks"

[rules]
"rm -rf *" = "deny"
"git reset --hard" = "deny"
"git checkout -- *" = "deny"
```

The managed directory should contain the same safeword hook definitions generated for project-local Codex config, with commands rewritten to administrator-owned absolute paths. Admins that need managed-only execution can also set `allow_managed_hooks_only = true`, accepting that user/project/plugin hooks are skipped.

## Feature File Coverage

No source `.feature` file is required for this ticket. This is a trust-model decision and documentation ticket: it defines the user-trusted default and enterprise managed-hook path. The executable setup behavior is covered by `5DEJ8V`, and any future managed-config generator should carry its own source feature.

## Revalidation + /figure-it-out (2026-06-13)

**Frame:** Decide the honest enforcement posture for individual users and enterprises now that Codex's trust and hook limits are clearer.

**Research domains checked:** Codex hook trust, managed requirements, `allow_managed_hooks_only`, plugin-hook trust, command rules, and safeword's user-vs-org install story.

**Options:**

1. User-trusted default with explicit `/hooks` trust setup.
2. Managed-hooks-only default.
3. Hybrid: user-trusted by default; enterprise docs for managed hooks plus managed rules/permissions.

**Recommend:** Use option 3. Individual users need the normal project setup path, but safeword should not call that ungameable. Enterprise parity requires `requirements.toml` managed hooks and, for unsupported tool paths, restrictive rules or permission requirements.

**Next:** Add setup trust guidance in `5DEJ8V`, then document a managed `requirements.toml` recipe with `[features].hooks = true`, `[hooks]`, and `[rules]` examples.

## Work Log

- 2026-05-31 Created from Codex research.
- 2026-05-31 Read enterprise managed-config doc. RESOLVED: user-trusted default + documented managed path; full mechanics captured.
- 2026-06-13T14:37:31Z Revalidated and ran /figure-it-out. Decision remains user-trusted default plus managed enterprise path. Add managed rules/permissions to the enterprise recipe because hooks alone are documented as incomplete for some tool paths.
- 2026-06-13T23:49:39Z Complete: documented the managed `requirements.toml` recipe and verified user-trust guidance is present in the generated Codex config. Focused Codex/setup/schema tests, typecheck, and gherkin lint passed. Phase -> done.
