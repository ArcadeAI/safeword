---
id: XK5N14
slug: ensure-codex-feature-file-coverage
type: task
phase: done
status: done
epic: codex-changelog-alignment
relates_to: QM5G9M
created: 2026-06-13T22:48:56.763Z
last_modified: 2026-06-13T22:48:56.763Z
scope:
  - Audit every child ticket in the Codex parity epic for executable behavior coverage.
  - Backfill source `.feature` files under `packages/cli/features/` for Codex tickets that define executable behavior.
  - Update each affected ticket's `test-definitions.md` or notes so the feature file is the source of truth.
  - Record an explicit no-feature-file rationale for pure design, decision, packaging, or epic container tickets.
out_of_scope:
  - Implementing the Codex parity behavior itself.
  - Expanding the epic beyond its existing child-ticket set.
  - Creating live Codex smoke coverage beyond the dedicated CXP9LM ticket.
done_when:
  - Every Codex parity child ticket has either a linked source `.feature` file or an explicit no-feature-file rationale.
  - Existing started Codex implementation tickets have their scenarios moved or mirrored into executable Gherkin files.
  - The epic records the resulting feature-file coverage state.
  - Gherkin lint and the relevant Cucumber smoke pass, or any skipped live-only case is documented with a reason.
---

# Ensure feature files cover Codex parity tickets

**Goal:** Make the Codex parity epic comply with safeword's feature-files-as-source workflow.

**Why:** Several Codex parity tickets were started before the `.feature` source workflow landed, leaving scenarios in test-definition docs instead of executable Gherkin files.

## Coverage Target

Audit the Codex epic children:

- `5DEJ8V-codex-agents-config-generation`
- `N12G95-codex-pretooluse-deny-spike`
- `HPP49X-codex-lifecycle-hook-mapping`
- `QGHVXZ-codex-commands-skills-vs-prompts`
- `JV6D1W-codex-enforcement-trust-model`
- `WR4HRA-codex-min-version-baseline`
- `6WJ1RS-codex-plugin-marketplace-packaging`
- `CXP9LM-codex-live-parity-smoke`

## Notes

- Backfill feature files for tickets with observable CLI, hook, or packaging behavior.
- Design-only or decision-only tickets can be marked as not needing executable Gherkin, but the reason should live in the ticket so future agents do not repeat the audit.
- Use the existing `packages/cli/features/feature-files-as-source.feature` conventions as the placement and linting reference.

## Audit Result

- `5DEJ8V-codex-agents-config-generation`: backfilled `packages/cli/features/codex-agents-config-generation.feature` and converted `test-definitions.md` back to a ledger that points at the source.
- `N12G95-codex-pretooluse-deny-spike`: backfilled `packages/cli/features/codex-pretooluse-deny-spike.feature` and converted `test-definitions.md` back to a ledger that points at the source.
- `CXP9LM-codex-live-parity-smoke`: added `packages/cli/features/codex-live-parity-smoke.feature` as the live/manual source feature; default Cucumber excludes it until the ticket implements trusted Codex execution.
- `HPP49X-codex-lifecycle-hook-mapping`: no source feature required; design task.
- `QGHVXZ-codex-commands-skills-vs-prompts`: no source feature required; command-surface decision.
- `JV6D1W-codex-enforcement-trust-model`: no source feature required; trust-model decision and documentation.
- `WR4HRA-codex-min-version-baseline`: no source feature required yet; version-floor research and future setup-warning implementation deferred.
- `6WJ1RS-codex-plugin-marketplace-packaging`: no source feature required yet; packaging strategy and manifest-shape decision.

## Work Log

- 2026-06-13T22:48:56.763Z Started: Created ticket XK5N14
- 2026-06-13 Scoped the ticket around Codex epic feature-file coverage and explicit no-feature-file rationales.
- 2026-06-13T23:05:55Z Backfilled Codex source features for `5DEJ8V`, `N12G95`, and live/manual `CXP9LM`; recorded no-feature-file rationales for the remaining design/decision/baseline/packaging tickets.
- 2026-06-13T23:27:35Z Verify: `bun run format:check`, `bun run lint:gherkin`, `bunx eslint packages/cli/features/steps/codex.steps.ts`, and `bun run --cwd packages/cli test:bdd` all passed. Added `verify.md`; ticket remains in progress because the Claude-specific `/verify` invocation stamp is unavailable in this Codex session.
- 2026-06-13T23:46:54Z Complete: marked done after user confirmed closing all non-live-smoke-blocked Codex tickets. Existing `verify.md` records the feature coverage audit evidence. Phase -> done.
