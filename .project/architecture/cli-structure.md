# CLI Structure

## Registry-Driven Agent Integrations with Native Trust Boundaries

**Status:** Accepted
**Date:** 2026-08-25

**Context.** Claude, Codex, Cursor, and OpenCode expose different project assets, profile operations, lifecycle events, and execution proof. Previously, each new host required changes to host-name branches in the lifecycle coordinator.

**Decision.** A typed integration registry declares each agent's project surfaces, profile operations, lifecycle capabilities, activation evidence, and conformance policy. The coordinator reconciles project files first, then runs the selected adapters in registry order. Native adapter modules retain host-specific trust, migration, and proof semantics. Codex, Claude, and OpenCode own their executable workflows in profile deliveries; OpenCode's managed catalogue includes its plugin, commands, agents, and skills and is proven by exact-version real-process conformance. Cursor retains its declared project authority.

**Consequences.** Coordinator logic becomes integration-neutral and contract tests can reject missing dimensions, capability overstatement, duplicate identity, skipped registry entries, and native workflows that borrow project runtime. Each project keeps its shared enrollment and authored files, plus files for the selected integrations that run from the project. Adding an adapter does not imply equal native enforcement: unsupported or observational boundaries remain explicit in status.

**Alternatives.** Add OpenCode branches to each lifecycle command: rejected because ownership and status logic would keep drifting. Flatten all hosts into one runtime: rejected because it would erase native trust and migration guarantees. Restore `.agents/skills`: rejected because Safeword-owned project copies were deliberately retired for Codex.

**Reassess when.** A host exposes a common signed plugin/evidence protocol, OpenCode V2 becomes stable, or the registry cannot express a new integration without host-name branching.

**Implementation.** Ticket `ZM38A2`; `packages/cli/src/lifecycle/integrations.ts`, native plugin modules, schema filters, adapter contract tests, and `packages/cli/features/opencode-parity.feature`.

For module responsibilities see the [generated CLI map](../../packages/cli/architecture.generated.md).
