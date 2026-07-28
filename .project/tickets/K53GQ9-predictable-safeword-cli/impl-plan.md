# Implementation Plan: One predictable Safeword CLI (K53GQ9)

**Status:** planned

## Approach

### Riskiest assumption

Existing commands can be migrated behind a typed result boundary without a
flag-day rewrite. The cheapest proof is a vertical slice through `status`:
typed observation, both renderers, exit 0/2, bare invocation, and deprecated
`check` alias. If that slice cannot preserve current health behavior, the
catalog design is wrong before mutating commands are touched.

### Ordered TDD slices

1. **Contracts and renderers** — add Plan/Result types, constructors, exit
   mapping, human/JSON renderers, schema fixtures, and architecture tests.
2. **Catalog and capabilities** — declarative canonical/alias/hidden metadata;
   capabilities JSON generated from it; help visibility assertions.
3. **Status vertical slice** — adapt health observation to return Result; make
   bare `safeword`, `status`, and deprecated `check` share it; prove read-only
   behavior and global flag placement.
4. **Plan and remove** — adapt reconciliation preview to typed Plan/Result;
   add `plan`/`remove`, preserve `diff`/`reset`, and enforce no-input
   destructive safety.
5. **Remaining public families** — adapt every printing/exiting handler to
   return typed data, then expose project/tracker/codex/ticket/retro hierarchy
   metadata and compatibility aliases. No output-capturing wrapper qualifies.
6. **Policy and hooks** — effect-policy validation, no-input/offline
   enforcement, hidden helper inventory, hook no-network/no-lifecycle tests,
   and existing latency suite.
7. **Convergence and docs** — setup-twice proof, golden human output, complete
   architecture update, migration notes.

Each slice begins with a focused failing test, implements the minimum behavior,
then refactors with the focused and affected suites green.

### Verification map

- Contract/renderers: unit tests and TypeScript exhaustiveness.
- Catalog/capabilities/help: unit plus CLI subprocess golden tests.
- Read-only invariants: temp-project integration with before/after tree hashes
  and network/package witnesses.
- Destructive confirmation: temp-project CLI integration.
- Alias compatibility/global flags/exit codes: subprocess integration.
- Every catalog entry owns a deterministic argv/environment fixture; a
  subprocess contract suite invokes each fixture through the built CLI.
- Static architecture tests reject `console.*`, output utilities,
  `process.exit`, and `process.exitCode` below the executable/renderer boundary
  for migrated public handlers.
- Hook constraints/latency: existing hook E2E/performance harness extended
  with fail-fast network and lifecycle witnesses.
- Full acceptance: Cucumber feature plus real CLI steps.

## Decisions

| Decision | Choice | Rejected alternative | Reason |
| --- | --- | --- | --- |
| Execution boundary | Typed Plan/Result pipeline | Capture existing console output | Captured prose cannot provide semantic parity or effect integrity |
| Discovery | Declarative command catalog | Derive metadata from Commander | Commander registration cannot express effect, prompt, network, compatibility, or fixture policy |
| Machine interface | One JSON-v1 Result envelope | Per-command JSON shapes | Agents need one stable protocol and error model |
| Compatibility | Aliases retained for two release lines | Immediate command removal | Existing scripts and installed integrations must continue working |
| Destructive consent | Plan identity plus precondition digest | Boolean `--yes` alone | Consent must bind to the exact current effects |

## Arch alignment

The catalog becomes the command-schema counterpart to the managed-file schema:
one declaration governs public discovery and policy. Domain modules remain
independent of Commander and presentation. Reconciliation remains the only
file mutation engine.

## Known deviations

- Existing public handlers do not yet obey the renderer boundary. Each is
  migrated in slice 5; catalog metadata alone is not accepted as completion.
- Hook hot paths may retain a direct executable adapter to protect latency, but
  remain hidden catalog entries governed by hook effect policy.

## Assessment triggers

- If more than one mutating command needs bespoke result translation, introduce
  a legacy adapter interface instead of weakening Result.
- If Commander cannot accept global flags after subcommands reliably, normalize
  only known global flags before parse and preserve `--` semantics.
- If hook latency regresses, keep hook helpers on their current direct adapter
  while enforcing the same hidden/effect metadata; do not route hot hooks
  through optional discovery work.
