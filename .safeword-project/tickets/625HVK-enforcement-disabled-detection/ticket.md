---
id: 625HVK
slug: enforcement-disabled-detection
type: task
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.534Z
last_modified: 2026-05-31T21:05:09.534Z
---

# Detect disabled/managed-only hooks and warn that gates are inactive

**Goal:** When CC is configured to disable project hooks, surface a single clear notice that safeword's gates are inactive — instead of safeword silently doing nothing.

**Why:** Safeword's enforcement IS its project hooks. Under `disableAllHooks` or `allowManagedHooksOnly`, every gate (phase, LOC, done) silently stops firing and the user has no signal that the safety rails are off.

## Findings

- CC `2.1.140`: "Fixed `/goal` hanging with `disableAllHooks` or `allowManagedHooksOnly`" — confirms both settings exist and gate hook execution.
- CC `2.1.139`: `Hook terminal write` fixes + managed-settings work throughout the window; managed/enterprise tiers can force-disable non-managed hooks.

## Evidence in safeword

- All gates run as project `command` hooks in `.claude/settings.json` (SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/Stop/SessionEnd). None are "managed."
- There is no detection today: if hooks are disabled, even the SessionStart bootstrap notice doesn't run, so the user sees nothing.

## Approach

The hooks themselves can't warn if they're disabled (chicken/egg). Detection has to come from a surface that still runs:

- The `safeword` CLI (`setup`/`upgrade`/`doctor`-style command) can read the effective CC settings tier and report "hooks disabled — safeword gates will not fire."
- Consider a `safeword doctor` check (if one exists or as a small addition) that flags `disableAllHooks` / `allowManagedHooksOnly` and explains the consequence.

## Investigation steps

1. Confirm exact setting keys/locations (`disableAllHooks`, `allowManagedHooksOnly`) and how CC resolves them across tiers (user/project/managed) per current docs.
2. Decide the surface: CLI doctor check vs setup-time warning vs both.
3. Keep it advisory only — never try to re-enable hooks against a managed policy.

## Done when

- A non-hook surface (CLI) detects disabled/managed-only hook config and prints a clear one-line consequence.
- Behavior verified against current CC docs for the setting semantics.

## Out of scope

- Working around or overriding managed policy (we respect it; we just make it visible).

## Work Log

- 2026-05-31T21:05:09.534Z Started: Created ticket 625HVK
- 2026-05-31 Confirmed all safeword gates are project hooks with no disabled-state detection.
