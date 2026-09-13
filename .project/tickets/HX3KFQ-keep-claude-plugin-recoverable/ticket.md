---
id: HX3KFQ
slug: keep-claude-plugin-recoverable
type: task
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/4519
created: 2026-09-13T04:03:46.412Z
last_modified: 2026-09-13T04:03:46.412Z
---

# Keep the Claude plugin installable and recoverable

**Goal:** Make published Claude plugin resources executable by the bundled CLI and keep cache-integrity failures recoverable from inside a session.

**Why:** The 1.0.0-rc.3 package cannot install or create tickets, and an ordinary troubleshooting file can make every mutating tool unavailable.

**Type:** Bug

**Scope:** Make both native plugin payloads carry the canonical template tree expected by the
bundled CLI. When Claude plugin integrity cannot be established, require explicit user approval
for mutating tools instead of denying every repair attempt.

**Out of Scope:** Changing npm-package template resolution, weakening normal Safeword gates when
the plugin is healthy, auto-deleting unexpected cache files, or trusting unverified plugin code.

**Done When:**

- [ ] A generated Claude plugin and a generated Codex plugin can create a feature ticket and run
      setup from their bundled CLI without source-repository files.
- [ ] Release checks fail if a native plugin payload no longer satisfies the bundled CLI's
      resource contract.
- [ ] A damaged Claude plugin cache makes PreToolUse ask the user rather than permanently deny the
      tool, while healthy caches retain current decisions.
- [ ] Missing, modified, and unlisted assets remain visible as integrity failures and no unverified
      Safeword hook executes.

**Tests:**

- [ ] Release integration: generated Claude payload runs `ticket new` and `setup` in a clean repo.
- [ ] Release integration: generated Codex payload runs `ticket new` and `setup` in a clean repo.
- [ ] Dispatcher: an unlisted asset returns a structured PreToolUse `ask` decision with a repair
      explanation and does not execute configured hooks.
- [ ] Dispatcher: missing or modified required assets use the same recoverable degraded mode.
- [ ] Dispatcher: UserPromptSubmit remains advisory and healthy PreToolUse behavior is unchanged.

## Root Cause

The standalone CLI bundle retains the npm package's flat `templates/` filesystem contract, but the
native plugin generators ship only partial, host-shaped resource trees. Claude ships handbook and
document templates under `resources/` while skills and hooks live elsewhere; Codex ships only the
handbook and hooks under `templates/`. The generated inventories prove only that emitted files are
untampered, not that the bundled CLI can resolve every resource it consumes. Direct execution from
both checked-in plugin payloads reproduced the failure.

The second failure is independent: dispatcher startup treats every non-prompt integrity error as
exit 2. Claude defines exit 2 on PreToolUse as an unconditional denial, so Bash/Edit/Write cannot
repair or disable the damaged plugin. Returning a structured `ask` decision is the host-supported
degraded mode: it preserves explicit human authorization without executing unverified Safeword
hooks.

Ruled out: a single missing template (both payloads lack broad portions of the flat contract); an
incorrect `import.meta.dirname` calculation (it resolves to `runtime/` as designed); inventory
corruption (the inventories match the shipped trees); and downgrading only unlisted extras (skills
are host-discovered, so an unlisted skill is behaviorally active and must remain an integrity
failure).

Related issue: https://github.com/ArcadeAI/safeword/issues/4520

## Work Log

- 2026-09-13T04:03:46.412Z Started: Created ticket HX3KFQ
- 2026-09-13T04:18:00Z Investigated: reproduced Claude `Templates directory not found` and
  Codex missing `spec-template.md`; confirmed the generator/runtime contract mismatch.
- 2026-09-13T04:18:00Z Decided: package the canonical flat template tree in both native plugins
  and add executable payload checks. Degrade integrity-failed PreToolUse to an explicit user prompt,
  never execution of unverified hooks.
