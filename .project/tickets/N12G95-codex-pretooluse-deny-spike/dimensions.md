# Dimensions: Codex PreToolUse Deny Spike

| Dimension                 | Partitions                                                                                       | Boundary / Notes                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Intake prerequisite state | Missing ticket/spec/dimensions/AC; complete ticket/spec/dimensions/AC                            | Missing state must deny; complete state must allow.                              |
| Codex denial signal       | JSON `permissionDecision: "deny"`; exit code 2 with stderr                                       | JSON is the primary path; exit 2 proves fallback behavior.                       |
| Tool path coverage        | Supported edit calls (`apply_patch`, `Edit`, `Write` aliases); unsupported/non-intercepted paths | This spike tests supported edit calls and documents unsupported paths as limits. |

## Decisions Baked In

- Reuse the existing safeword phase-gate behavior as the source of truth.
- Keep Codex adapter tests focused; full setup/generation is a later ticket.
- Treat `PreToolUse` as a guardrail, not complete enforcement for every possible Codex action.
