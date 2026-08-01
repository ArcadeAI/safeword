---
id: K53GQ9
slug: predictable-safeword-cli
type: feature
phase: verify
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/K53GQ9-predictable-safeword-cli/spec.md'
  - 'scenario-gate: packages/cli/features/predictable-safeword-cli.feature'
  - 'plan-implementation: packages/cli/features/predictable-safeword-cli.feature'
  - 'implement: .project/tickets/K53GQ9-predictable-safeword-cli/impl-plan.md'
  - 'verify: .project/tickets/K53GQ9-predictable-safeword-cli/test-definitions.md'
phase_skips:
  - 'intake: The CLI created the ticket at intake, but its scaffold was not committed before the approved GitHub issue contract was adopted; ticket.md and spec.md preserve the completed intake evidence.'
  - 'define-behavior: The 14 Rules, dimensions, and 83 scenario instances were authored before the ticket artifact first entered git; spec.md, dimensions.md, and the feature source preserve that evidence.'
  - 'scenario-gate: Three independent adversarial review rounds ended with 0 findings before the ticket artifact first entered git; the corrections and final result are recorded in the work log.'
  - 'plan-implementation: The reviewed design and seven-slice TDD plan were completed before the ticket artifact first entered git; design.md and impl-plan.md preserve the evidence.'
external_issue: https://github.com/ArcadeAI/safeword/issues/1574
scope:
  - Introduce typed Plan and Result contracts shared by public CLI commands.
  - Render every public command through common human and versioned JSON renderers.
  - Make JSON, no-input, cwd, quiet, and offline behavior consistent global options.
  - Make status, plan, and doctor provably read-only, including first-run and error paths.
  - Publish a simplified command hierarchy with status, plan, remove, project, tracker, codex, ticket, and retro families.
  - Keep replaced public commands as deprecated aliases for at least two release lines.
  - Publish a machine-readable capabilities document and stable exit semantics.
  - Keep internal hook and compatibility entrypoints callable while hiding them from normal help.
  - Update architecture documentation to make the execution model the project-wide rule.
out_of_scope:
  - Replacing the CLI with a daemon or MCP-only interface.
  - Removing existing public commands without their compatibility window.
  - Rewriting unrelated template content or Safeword workflow policy.
  - Making read-only commands install, upgrade, repair, or access the network implicitly.
done_when:
  - Public command handlers return typed plans or results instead of owning presentation or process termination.
  - Human output leads with the outcome, states whether anything changed, and gives at most one next action.
  - Every public command accepts deterministic JSON and no-input operation with JSON-only stdout.
  - The JSON envelope is schema version 1 and includes state, changed, findings, effects, and next actions.
  - Exit status is 0 for success, 1 for command failure, and 2 when user action is required.
  - Status, plan, and doctor produce no filesystem, package, or network effects.
  - Capabilities JSON exposes commands, aliases, mutation class, prompts, network use, and supported output schema.
  - Normal help presents the simplified hierarchy and omits internal hook/helper commands.
  - Legacy public names emit a deprecation finding and remain behaviorally compatible.
  - Hook entrypoints remain quiet, offline, non-upgrading, and within their latency budget.
  - Long-running interactive commands emit meaningful progress within 100 milliseconds.
  - Running setup twice converges to unchanged state.
  - Golden fixtures protect human output, JSON envelopes, and error shapes.
  - ARCHITECTURE.md documents the Observe → Plan → Confirm → Apply → Verify → Report model.
created: 2026-07-28T12:05:48.299Z
last_modified: 2026-07-28T21:25:57Z
---

# Give developers and AI agents one predictable Safeword CLI

**Goal:** Give humans and agents one typed, predictable Safeword execution and rendering model.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-28T12:05:48.299Z Started: Created ticket K53GQ9
- 2026-07-28T12:17:00Z Intake: Adopted GitHub issue #1574 as the
  approved product contract and bounded it to the public execution,
  presentation, discovery, and compatibility layers. A daemon/MCP rewrite,
  unrelated template changes, and compatibility-breaking removals remain out
  of scope.
- 2026-07-28T12:36:00Z Define behavior: Derived the full command, renderer,
  effect, interaction, compatibility, and outcome dimensions. Saved 83 scenario
  instances covering all 14 Rules and every public compatibility alias.
- 2026-07-28T12:48:00Z Scenario review requested changes: completed the
  error/recovery wire contract, expanded read-only coverage to the full
  command/state cross-product, specified global option and human-renderer
  semantics, bound confirmation to plan identity, completed the compatibility
  inventory, and replaced output-capturing wrappers with real handler
  migration.
- 2026-07-28T12:58:00Z Scenario gate passed: After two correction rounds,
  independent adversarial review returned 0 must-fix and 0 strengthenings;
  Gherkin and Markdown lint are clean.
- 2026-07-28T13:00:00Z Plan implementation: Chose seven ordered TDD slices,
  beginning with the typed contracts/renderers and a status vertical slice.
  Each public catalog entry must carry a deterministic executable fixture;
  architecture tests forbid presentation and process termination below the
  renderer boundary.
- 2026-07-28T18:31:00Z Implemented: Routed every public invocation through
  the typed Result boundary and shared human/JSON renderers; added the
  declarative command catalog, capabilities document, stable global options
  and exit semantics, exact destructive plans, convergent setup, read-only
  health/planning commands, simplified hierarchy, and compatibility aliases.
  Removed the output-capturing adapter and documented the project-wide
  Observe → Plan → Confirm → Apply → Verify → Report model.
- 2026-07-28T18:57:52Z Verified: Independent quality review approved after
  closing partial-mutation journaling, namespace-migration, package-uninstall,
  raw-rendering, and architecture-staging edge paths. Final gates passed 5,700
  unit/integration tests across 389 files, 678 acceptance scenarios with three
  intentional skips, lint, typecheck, diff check, and dependency audit with no
  vulnerabilities. Ticket remains in verify pending user confirmation.
- 2026-07-28T21:25:57Z Re-verified and audited: The complete suite passed
  5,700 executed tests and 678 executed acceptance scenarios. Audit findings
  drove the shared reconciliation/setup logic below the command layer, aligned
  the CLI reference with the canonical hierarchy, removed stale internal API
  surface and Knip configuration, and applied safe dev-tool patches. No
  unresolved audit errors remain; the ticket stays in verify pending user
  confirmation.
