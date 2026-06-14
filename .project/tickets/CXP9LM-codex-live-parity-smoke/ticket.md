---
id: CXP9LM
slug: codex-live-parity-smoke
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
depends_on:
  - 5DEJ8V
  - N12G95
scope:
  - Add a black-box smoke path that installs safeword into a fixture/customer repo using Codex-facing assets.
  - Run or script a real trusted Codex CLI session that confirms `AGENTS.md`, `.codex/config.toml`, `.agents/skills`, and the supported `PreToolUse` deny hook are visible/effective.
  - Record hook trust steps and unsupported or untested Codex execution paths.
out_of_scope:
  - Building new Codex hook adapters beyond the N12G95 edit gate.
  - Plugin packaging.
  - Enterprise managed `requirements.toml` enforcement.
  - Lowering the Codex CLI version baseline.
done_when:
  - Smoke setup starts from an empty fixture/customer repo and installs safeword's Codex assets.
  - Verification proves Codex loads the repo instructions and skills.
  - Verification proves a trusted supported edit path is denied by the `PreToolUse` hook and an allowed path is not denied.
  - Results are captured in `verify.md` with any skipped live step carrying an explicit environment reason.
---

# Prove Codex parity in a trusted customer repo

## Goal

Prove the Codex parity work from this epic behaves in a real safeword customer repo, not only in generator unit tests or local fixture assertions.

## Why

The epic now has generation and hook-spike work, but those are still mostly repository-internal proofs. Codex parity is not credible until a black-box smoke starts from a customer-like repo, installs safeword, trusts the generated hook wiring, and shows Codex can see the same instructions, skills, and deny behavior the code claims to generate.

## Dependencies

- **5DEJ8V** must generate the Codex-facing assets.
- **N12G95** must provide the supported `PreToolUse` deny adapter this smoke validates.
- **JV6D1W** should consume any trust-model gaps found during the live smoke.
- **WR4HRA** should consume any CLI-version gaps found during the live smoke.

## Notes

- Keep this as a final parity gate before calling the epic done or making plugin packaging the primary distribution path.
- Prefer a repeatable fixture-backed smoke, with a live/trusted Codex CLI step clearly separated so CI can skip it when the environment cannot provide trust state.
- Treat unsupported Codex execution paths as findings, not failures of this ticket, unless they contradict the epic's documented support boundary.

## Feature Source

- Source feature: `packages/cli/features/codex-live-parity-smoke.feature`
- Execution note: scenarios are tagged `@live @manual` because they require a real trusted Codex CLI session and hook trust state. Default Cucumber runs exclude them; this ticket owns implementing and documenting the live execution path.

## Work Log

- 2026-06-13 Created from Codex parity review gap: add a real black-box/trusted smoke after 5DEJ8V and N12G95.
