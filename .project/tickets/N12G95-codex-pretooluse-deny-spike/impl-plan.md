# Impl Plan: Codex PreToolUse Deny Spike

**Status:** implemented

## Approach

Implement this as a narrow hook-process adapter, covered by integration tests that spawn the template hook with Codex-shaped input.

| Scenario                                                                                     | Layer       | Implementation path                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codex-pretooluse-deny-spike.SM1.AC1.missing_intake_state_denies_test_definitions_creation`  | Integration | Spawn the Codex adapter with an `apply_patch` Add File payload targeting `.project/tickets/<id>/test-definitions.md`; assert the adapter returns the existing safeword JSON deny reason. |
| `codex-pretooluse-deny-spike.SM1.AC2.complete_intake_state_allows_test_definitions_creation` | Integration | Build the same fixture with scope, out_of_scope, done_when, dimensions, personas, JTBD, and AC present; assert the same Codex edit call exits cleanly without a deny payload.            |
| `codex-pretooluse-deny-spike.SM1.AC3.exit_code_two_reports_the_block_reason`                 | Integration | Run the failing fixture with a fallback-mode environment variable; assert exit code 2 and stderr contains the same blocking reason.                                                      |

Build order: write the failing integration tests first, add the Codex adapter script, register the new template in the schema, then copy the installed dogfood hook path so this repo can use the same hook shape locally.

## Decisions

| Decision             | Choice                                                                    | Alternatives considered                             | Rejected because                                                                                                |
| -------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Gate source of truth | Delegate to `pre-tool-quality.ts` after translating Codex input           | Reimplement the phase gate in a Codex-specific hook | Duplication would make the spike pass while creating long-term drift from the Claude gate.                      |
| Supported edit shape | Parse `apply_patch` hunks and map Add to `Write`, Update/Delete to `Edit` | Require Codex to expose `file_path` directly        | Current Codex edit calls can arrive as patch commands, so the spike must prove the path safeword actually uses. |
| Deny signaling       | Preserve JSON deny by default and add env-driven exit-code-2 fallback     | Use exit-code-2 only                                | JSON deny is the current structured contract; exit code 2 is still worth proving as fallback compatibility.     |
| Unsupported paths    | Allow unsupported/unparseable shapes and document that limit              | Fail closed on unknown Codex input                  | A spike should avoid bricking unrelated tool calls until HPP49X maps lifecycle/tool coverage.                   |

## Arch alignment

- Honors "Schema as Single Source of Truth" by registering the new template in `packages/cli/src/schema.ts`.
- Honors "Reconciliation Over Copy" by adding the adapter under `packages/cli/templates/` and installing it through the managed `.safeword/hooks/` path.
- Honors the hooks guidance that blocking hooks must be fast, deterministic, and produce clear denial messages.

## Known deviations

- This does not generate `.codex/config.toml` or wire a project Codex hook configuration; that belongs to `5DEJ8V`.
- This does not claim complete enforcement for all Codex execution paths; it proves the supported edit-call path and records the guardrail limit.

## Assessment triggers

- Revisit input translation if Codex exposes structured edited-file paths for `apply_patch` or changes its hook payload shape.
- Revisit fallback behavior if Codex removes or changes either JSON deny or exit-code-2 blocking semantics.
- Revisit fail-open behavior once `HPP49X` finishes lifecycle and tool-path mapping.
- Revisit installation shape when `5DEJ8V` wires Codex config generation.

## Reconciliation

- Decisions updated: 0.
- Deviations recorded: 0.
- Implementation matched the planned adapter shape and test-layer assignment.
