# Impl Plan: Keep Stop Reviews Quiet Until a New User Prompt

**Status:** implemented

## Approach

| Scenario | Test layer | Implementation path |
| --- | --- | --- |
| An idle repeated Stop does not repeat a generic review | Installed-hook integration | Persist a session marker immediately before the generic review soft-block, then return silently when a later Stop observes it. |
| A real prompt permits a new generic review | Installed-hook integration + prompt-hook integration | Clear the session marker synchronously in `UserPromptSubmit` before prompt advice is composed. |
| The first malformed-boundary Stop stays fail-closed | Installed-hook integration | Leave the bounded edit-tool fallback unchanged when no marker has been recorded. |
| Verification gates remain authoritative | Installed-hook integration | Check the marker only after hard done-phase verification and other non-generic gates have been considered. |

Build order: extend persisted quality state, write the generic-review marker, clear it on a user prompt, then cover the Stop-to-prompt-to-Stop lifecycle and the done-phase control.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Marker scope | Session-scoped persisted quality state | Process-global state, transcript-only detection | The hook process is short-lived and transcript boundaries can be absent. |
| Re-arm event | `UserPromptSubmit` | A later assistant response, elapsed time | A submitted user prompt is the reliable start of meaningful new work. |
| Generic-review boundary | Mark only the generic soft-block | Mark every Stop block | Hard verification and workflow gates must not be suppressible. |
| State helper design | Existing read/write helpers remain explicit | New generic mutation helper | Independently running hooks should not hide read-modify-write behavior behind an abstraction. |

## Arch alignment

Honors the project’s hook architecture: the template source remains the installed configuration’s source of truth, and session-specific quality state remains under the project-owned quality-state files. The dogfood hook copy is kept in parity with the template.

## Known deviations

skip: the canonical package suite is queued behind shared Vitest runner contention; focused installed-hook coverage, lint/typecheck, parity, and diff checks are recorded instead.

## Assessment triggers

- If Claude changes the Stop or UserPromptSubmit hook lifecycle, revalidate that a user prompt remains the correct re-arm boundary.
- If quality-state writes become concurrently observable, reassess the explicit read/write pattern and introduce safe coordination only if evidence requires it.
- If more than one Stop soft-block needs consumption semantics, extract a named state model rather than overloading this boolean.
