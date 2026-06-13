# Design: Codex Lifecycle Hook Mapping

**Related:** Epic `.project/tickets/QM5G9M-codex-changelog-alignment-epic/ticket.md` | Spike `.project/tickets/N12G95-codex-pretooluse-deny-spike/ticket.md`

**Sources:** [Codex hooks docs](https://developers.openai.com/codex/hooks.md) and Codex configuration docs, revalidated 2026-06-13.

## Architecture

Codex support should be an adapter layer over safeword's existing hook logic, not a fork of the gates. The existing Claude hooks remain the reference implementation for gate behavior; Codex-specific hook scripts translate Codex payload shape and event semantics into the closest existing hook contract.

The main divergence is enforcement placement. Claude Code can use `Stop` as a hard done gate. Codex `Stop` is a continuation/nudge point, so hard done and phase enforcement must move to `UserPromptSubmit`, with `PreToolUse` still providing fast edit-time denial for supported tool paths.

```text
Codex event/config
  -> .safeword/hooks/codex/<adapter>.ts
    -> existing .safeword/hooks/<gate>.ts where semantics match
    -> Codex-specific gate only where event semantics diverge
```

## Gate Mapping

| Safeword gate moment                                                      | Claude Code placement today                          | Codex placement                                                                                    | Codex signal                                                          | Reuse vs divergence                                                                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Session bootstrap, version, lint-config status, re-entry context          | `SessionStart`                                       | `SessionStart`                                                                                     | Context/additional output, non-blocking                               | Reuse scripts where Codex passes equivalent environment and stdin; otherwise add thin adapters.                |
| Prompt timestamp and pre-work reminders                                   | `UserPromptSubmit`                                   | `UserPromptSubmit`                                                                                 | Additional context for reminders                                      | Reuse reminder content. Codex can also use this event for hard blocks.                                         |
| Done gate and invalid phase transition backstop                           | `Stop` hard block                                    | `UserPromptSubmit` hard block plus `Stop` nudge                                                    | `decision: "block"` at prompt submit; continuation prompt at stop     | Diverges. Codex `Stop` cannot be the only hard gate because it continues rather than preventing the bad state. |
| Scenario/artifact prerequisite gate before creating `test-definitions.md` | `PreToolUse` on edit tools                           | `PreToolUse` for supported edit calls                                                              | `hookSpecificOutput.permissionDecision: "deny"`; exit-code-2 fallback | Reuse through Codex adapter proven by N12G95.                                                                  |
| Config guard before editing protected config                              | `PreToolUse` on edit tools                           | `PreToolUse` for supported edit calls; consider `PermissionRequest` for approval-time denial       | `permissionDecision: "deny"` or permission denial                     | Mostly reuse, but HPP49X should not claim complete coverage until tool interception is mapped.                 |
| Git commit REFACTOR gate                                                  | `PreToolUse` on `Bash(git commit *)`                 | `PreToolUse` for supported shell paths; `PermissionRequest` fallback where Codex asks for approval | Deny before command where intercepted                                 | Reuse command parser, but record shell interception gaps.                                                      |
| Post-edit lint and quality review context                                 | `PostToolUse`                                        | `PostToolUse`                                                                                      | Additional context / advisory output                                  | Reuse as observer only. Side effects already happened, so do not classify this as enforcement.                 |
| LOC and quality-state bookkeeping                                         | `PostToolUse` observer plus `PreToolUse` enforcement | `PostToolUse` state update plus `UserPromptSubmit`/`PreToolUse` enforcement                        | Advisory at post-tool; block at prompt/edit                           | Split observer from hard block deliberately.                                                                   |
| Stop-time re-entry and next-turn coaching                                 | `Stop`                                               | `Stop`                                                                                             | Continuation/nudge                                                    | Reuse as guidance. Do not rely on it as the enforcement boundary.                                              |
| Session cleanup                                                           | `SessionEnd`                                         | `SessionEnd` if available in Codex runtime                                                         | Non-blocking cleanup                                                  | Reuse where supported.                                                                                         |

## Components

### Component 1: Codex Hook Adapters

**What:** Translate Codex event payloads into existing safeword hook inputs where the gate behavior is already correct.

**Where:** `.safeword/hooks/codex/*.ts` and `packages/cli/templates/hooks/codex/*.ts`

**Interface:**

```typescript
interface CodexHookAdapter {
  readCodexInput(): unknown;
  translate(): ClaudeLikeHookInput | undefined;
  runExistingGate(): HookResult;
  renderCodexResult(): void;
}
```

**Dependencies:** Existing safeword hook scripts, Bun runtime, Codex hook payloads.

**Tests:** Adapter tests should spawn the hook process with Codex-shaped stdin and assert stdout/stderr/exit status. N12G95 is the first example.

### Component 2: Prompt-Submit Enforcement Gate

**What:** Enforce done/phase preconditions at the start of the next Codex turn.

**Where:** Future `.safeword/hooks/codex/prompt-quality.ts`

**Interface:**

```typescript
interface PromptGateResult {
  decision?: 'block';
  reason?: string;
  additionalContext?: string;
}
```

**Dependencies:** Ticket phase lookup, scenario completion checks, verify/audit invocation log checks, existing stop-quality helper logic where it can be extracted without hook-runtime coupling.

**Tests:** Fixture tickets in invalid done/phase states should block prompt submit; valid states should allow.

### Component 3: Codex Config Generator

**What:** Generate Codex hook configuration after this mapping is stable.

**Where:** Future work in `5DEJ8V`.

**Dependencies:** This design, N12G95 adapter proof, HPP49X event map.

**Tests:** Config-generation tests should assert event wiring, command paths, matchers, and documented unsupported paths.

## Key Decisions

### Decision 1: Use mixed mapping instead of Claude mirroring

**What:** Use `UserPromptSubmit` for hard done/phase preconditions, `PreToolUse` for edit-time denial, `PermissionRequest` for approval-time fallback, `PostToolUse` for observation, and `Stop` only for nudges.

**Why:** Revalidation found Codex `Stop` is not equivalent to Claude Code's hard Stop block. Mirroring Claude would make done enforcement look present while relying on the wrong event.

**Trade-off:** Codex and Claude configs will not be symmetrical. The design is more explicit, but prevents false parity.

### Decision 2: Treat PreToolUse as a supported-path guardrail

**What:** Use `PreToolUse` for `apply_patch`, `Edit`, `Write`, and supported shell paths, while documenting non-intercepted tool paths.

**Why:** N12G95 proves the supported edit path can deny before execution. Current Codex docs still warn that hook interception is incomplete for some shell/non-MCP paths.

**Trade-off:** Safeword must pair tool hooks with prompt-submit checks and managed policy surfaces before claiming strong enforcement.

### Decision 3: Keep PostToolUse advisory

**What:** Use `PostToolUse` for lint results, quality review context, and bookkeeping, not for primary enforcement.

**Why:** A post-tool hook runs after the side effect. It can warn, update state, or request follow-up, but cannot undo an unsafe edit.

**Trade-off:** Some Claude post-tool behaviors need a second hard-blocking gate at prompt submit or pre-tool time.

## Implementation Notes

**Constraints:**

- Do not generate Codex config from this ticket; `5DEJ8V` owns that.
- Do not duplicate core phase/scenario/done checks unless event semantics force a Codex-only path.
- Every shipped Codex hook template needs schema registration.
- Every Codex enforcement claim must say whether it is hard block, advisory, continuation, or unsupported.

**Gotchas:**

- `Stop` wording is dangerous: "block" in a stop event is not the same as "prevent completion" for Codex.
- `PostToolUse` cannot be described as preventing the action that already happened.
- `PreToolUse` is valuable but not comprehensive. Unsupported paths must stay visible in docs and tickets.

**Open Questions:**

- Which Codex hook events and matchers are available in managed enterprise policy versus local config?
- Can Codex expose structured edited-file metadata for `apply_patch`, removing the need for patch text parsing?
- Which shell paths remain outside `PreToolUse` interception in the target Codex version baseline?

## References

- `.project/tickets/N12G95-codex-pretooluse-deny-spike/ticket.md`
- `.project/tickets/5DEJ8V-codex-agents-config-generation/ticket.md`
- `.project/tickets/JV6D1W-codex-enforcement-trust-model/ticket.md`
- `packages/cli/src/templates/config.ts`
- `packages/cli/templates/hooks/pre-tool-quality.ts`
- `packages/cli/templates/hooks/stop-quality.ts`
