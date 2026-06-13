---
id: XK5N14
slug: ensure-codex-feature-file-coverage
type: task
phase: intake
status: in_progress
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

## Work Log

- 2026-06-13T22:48:56.763Z Started: Created ticket XK5N14
- 2026-06-13 Scoped the ticket around Codex epic feature-file coverage and explicit no-feature-file rationales.
