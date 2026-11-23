# Typed CLI Execution and Discovery

[Codex activation result and proof](restart-bound-codex-plugin-activation.md).

**Status:** Accepted
**Date:** 2026-07-28
**Supersedes:** command-specific output and implicit command discovery
**Superseded in part by:** [Next-Task Codex Plugin Activation and Migration Result v2](next-task-codex-plugin-activation-and-migration-result-v2.md) (Codex domain migration result only; the public CLI result envelope remains v1)

**Context.** Safeword commands historically mixed observation, mutation, prompting, output, and process termination. Humans could infer intent from prose, but agents could not reliably discover effects, distinguish drift from failure, or bind destructive consent to an exact preview.

**Decision.** Public commands follow Observe → Plan → Confirm → Apply → Verify → Report. Domain handlers return schema-version-1 `Plan` and `Result` values; the executable adapter alone renders output and maps `healthy`/`changed`/`action_required`/`failed` to exit 0/0/2/1. A declarative command catalog owns canonical leaves, aliases, internal routes, compatibility rewrites, effect/prompt/network policy, schema versions, and deterministic invocation fixtures. The side-effect-free `createCliProgram()` factory assembles the production Commander tree. The contract check walks that tree recursively and compares it with the catalog and its generated files. `Result.effects` records completed effects; proposed effects live in `Plan.effects`. Destructive confirmation binds a plan identity to its precondition digest.

**Consequences.** Running `safeword` without arguments reports status and makes no changes. Every public leaf supports `--json --no-input`; JSON is one snake-case envelope validated against the published v1 JSON Schema, while human output leads with one verdict and at most one next action. `--offline` refuses declared network work, read-only commands cannot report applied effects, and partial failures retain completed effects plus stable recovery. Legacy names remain available indefinitely as hidden, deprecated aliases. Hook helpers remain hidden and keep their latency-oriented direct adapters under stricter no-network/no-lifecycle policy.

**Alternatives.** Capture legacy console output (rejected: prose cannot preserve semantic effect integrity); derive capabilities from Commander (rejected: it lacks effect, consent, compatibility, and fixture metadata); require `--yes` without a plan identity (rejected: consent could apply to changed effects); remove old commands immediately (rejected: breaks scripts and installed integrations).

**Reassess when.** A second JSON schema is needed, Commander cannot preserve global-option placement or `--` semantics, or a host exposes a native typed command/effect protocol that can replace Safeword’s adapter.

**Implementation.** Issue #1574 / ticket K53GQ9 established `packages/cli/src/cli-protocol/`, the schema, catalog, and executable fixtures. Issue #2283 / ticket 6N6M40 adds `cli-protocol/program.ts`, runtime reconciliation, deterministic command-reference generation, terminology checks, `check:cli-contract`, and the dedicated required CI context.

Every public invocation, including compatibility aliases and interactive
commands, executes through its catalog handler and returns the shared typed
result to the renderer. Aliases add a machine-readable deprecation finding to
that same result. Command-specific output schemas and direct console/process
exit paths are not compatibility boundaries; callers migrate through the
versioned result envelope and published aliases instead.

Commands that intentionally emit a shell or code artifact still return a typed
Result. They place the artifact in the Result's raw-presentation field, and the
shared renderer emits it for human mode while JSON mode keeps the common
schema-1 envelope. Both output forms use the same command protocol.

The typed Codex protocol adapters are observation-only unless their catalog
entry explicitly declares mutation. Project SessionStart automation is a
separate, fail-open lifecycle feature across Claude, Cursor, and Codex: it may
wire the committed Git guard, bootstrap missing dependencies, and apply
compatible Safeword upgrades. Codex uses a host-neutral dependency adapter in
its managed project bootstrap; startup remains advisory, while the repo-owned
composed CLI script can require readiness. `safeword install` is the explicit
convergence path.
