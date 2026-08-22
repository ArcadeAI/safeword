# Impl Plan: Upgrade remote-test workflows safely

**Status:** implemented
**Planned on:** 2026-08-18

## Approach

The riskiest assumption is that setup and disable can re-check released v1
immediately before their irreversible operation without overwriting or removing
a concurrent customer change. The cheapest proof is the paired setup/disable
outlines against a temporary real workflow path. The injected adapter pauses
setup after private preparation and disable after initial historical
classification; both pauses occur before the commit-time revalidation read.

Use the existing exact-digest classifier and filesystem adapter. Admit only the
immutable v1 digest after CRLF-to-LF normalization, prepare and sync one private
file, reclassify the visible workflow, then rename only when it is still the
admitted predecessor. Never infer ownership from markers or configuration.

Proof and build order:

1. **Concurrent setup and disable revalidation (load-bearing, fail-first)** —
   integration tests use a real temporary checkout and the existing
   constructor-injected filesystem adapter. Pause setup after private preparation
   and disable after initial historical classification, before either handler's
   commit-time revalidation read; mutate the real target; then assert exact final
   state. Each line-ending example seeds explicit LF or CRLF bytes at runtime and
   first asserts the visible file has that exact byte form, so the guard fails
   before the handler runs if checkout or helper normalization collapses a CRLF
   case into LF. Setup removes its private file; disable creates none. Customer-owned
   and injected-read-failure states fail closed. Current bytes and absence
   converge as setup success and are successful terminal states for disable. These commit-time
   behaviors were identified as absent during plan review and begin RED.
2. **Plain-language refusal outcomes (fail-first)** — table-driven command tests
   cover concurrent customer bytes, revalidation read failure, private
   preparation failure, and publication failure for each applicable lifecycle
   command. Every action-required result must name the workflow path, say whether
   bytes were preserved or no file remains, and give the concrete recovery:
   move aside the customer file or retry after the filesystem recovers. This is the NTB proof for the
   exact-digest lockout and new commit-time failures.
3. **Append-only release-history contract (characterization)** — replace the
   anonymous digest set with one ordered, versioned source manifest whose literal
   entries are `{ version, normalizedSha256 }`. FFXB81 extends
   `packages/cli/tests/test-execution/remote-workflow-contract.test.ts` to
   enumerate every checked-in `packages/cli/tests/fixtures/remote-workflow-v*.yml`
   fixture and require exact ordered equality with that complete literal manifest.
   The same test retains HWZZJ8's current-template drift tripwire: changing
   current bytes fails until the former current bytes become the next immutable
   numbered fixture and the manifest gains the matching next-version literal.
   Retiring any identity therefore requires an explicit edit to the release
   manifest rather than disappearing through fixture discovery. The test also
   pins the full current manifest literal, including v1, so fixture/manifest drift
   fails in either direction. This records an existing invariant; it is not
   presented as fail-first evidence.
4. **Every released predecessor must migrate and disable (characterization)** — a table-driven integration test
   enumerates the same versioned fixtures, seeds a temporary checkout with each
   one, and exercises both public handlers: setup must reach exact current bytes
   and clean its private file; disable must remove the workflow. Adding a fixture
   therefore creates both obligations automatically.
5. **Atomic publication regression guard** — adapter call-log proof asserts that no write-mode
   open, truncate, or write targets the visible workflow path, the per-invocation
   inert private sibling contains complete synced bytes, and rename is the sole
   publication operation. This fails if implementation returns to in-place writes.
6. **Preparation, rename failure, and retry evidence** — integration tests fail private
   sync and publication rename separately, prove v1 survives and invocation
   residue is removed, then prove retry ignores another unique private path and
   converges to current bytes. Record fail-first only for an assertion that fails
   against the current implementation; otherwise record characterization honestly.
7. **Public composition** — CLI contract tests assert packaged setup/disable expose
   only documented inputs and construct the production adapter without pause or
   failure controls.
8. **Characterization of retained identity/lifecycle behavior** — existing state,
   lifecycle, and CLI tests prove LF/CRLF admission, lone-CR rejection,
   customer-owned setup/disable rejection, historical disable, and real command
   wiring. These postdate implementation and are regression evidence, not
   fail-first evidence.
9. Reconcile the ledger, run focused tests, then the final full suite.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://documentation.red-gate.com/flyway/reference/commands/validate | 2026-08-18 | Current hosted Flyway documentation | Safeword 0.78.6 | Flyway validates recorded migration checksums instead of silently adopting changed content | Exact immutable identities separate released history from user edits | Concept only; no Flyway code or dependency is reused |

**Decision impact:** retained: the implemented digest allowlist is the smallest
durable ownership record and matches the proven migration model.
**Decision informed:** Admit historical ownership only through immutable released digests.

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Admit historical ownership only through immutable released digests. | Keep an append-only normalized SHA-256 set compiled into the CLI. | Workflow markers; discover old templates at runtime. | Markers can survive customer edits; runtime discovery is unavailable and mutable. |
| Publish an admitted successor through one revalidated atomic rename. | Prepare and sync a private sibling, reclassify the target, then rename. | Rewrite in place; overwrite after the initial classification. | In-place writes expose partial bytes; initial classification alone can overwrite a concurrent customer change. |
| Publish canonical LF workflow bytes after normalized admission. | Accept exact LF or CRLF v1, then install the bundled LF successor. | Preserve observed predecessor line endings. | The successor must retain one immutable packaged identity; preserving line endings creates an untracked variant. |
| Converge commit-time absence by command intent. | Setup publishes its already-prepared current workflow; disable returns success because no workflow is its goal state. | Treat absence as action required for both commands. | Refusal contradicts setup convergence and makes disable report failure after its goal was reached. |
| Keep recovery local and residue-specific. | Remove only this invocation's private entry and ignore foreign residue. | Sweep matching temporary files; add a recovery database. | Sweeping can delete another invocation's state; a database adds machinery without improving this single-file transaction. |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Every refusal names the affected path, what Safeword preserved, and the concrete retry or cleanup action. | packages/cli/tests/test-execution/test-execution-command.test.ts | none |
| 1. Structure enforces; instructions suggest | Exact digest admission, append-only fixture enumeration, and commit-time revalidation make accidental ownership adoption fail closed. | packages/cli/tests/test-execution/remote-workflow-contract.test.ts | none |
| 3. Add, never replace | Unknown or edited workflow bytes remain customer-owned under setup and disable. | packages/cli/tests/test-execution/remote-workflow-lifecycle.test.ts | none |
| 5. Correct and safe; then clear; then simple | One classifier and one filesystem publication path serve setup, upgrade, and disable without a second migration engine. | packages/cli/tests/test-execution/remote-workflow-lifecycle.test.ts | none |

Architecture decisions honored: reconciliation preserves customer-owned files;
typed CLI commands report explicit effects. No new ADR is warranted because the
historical workflow path extends those existing decisions without changing a
cross-feature boundary.

## Known deviations

Final revalidation and rename/unlink are adjacent but not one kernel transaction.
An ordinary editor, checkout, second Safeword process, or agent could still write
in that instruction-scale window and have its bytes replaced or removed without
a recovery copy. Descriptor-relative cross-platform replacement would add
substantial platform machinery, so that residual window is accepted; all changes
observable before the commit call fail closed. Private siblings use unique
per-invocation names without `.yml` or `.yaml` extensions, and existing lifecycle
output reports residue that Safeword cannot clean up.

## Doc impact

HWZZJ8 owns the README and website remote-testing contract. Its documentation
task must add one recovery note: an interrupted upgrade can leave a uniquely
named, extensionless private sibling that status reports and the builder may
remove after confirming no setup is active.

## Assessment triggers

Revisit the design when a new workflow version ships, a released identity is
proposed for retirement, customers need multi-file workflow transactions, or a
supported runtime exposes portable descriptor-relative replacement that closes
the final path-swap window without substantial complexity.
