# Refactor Ledger: Keep quality reviews observable and actionable

Scope: `origin/main...codex/reliable-quality-review`

## Applied leaf-first

1. **Use one managed-signal name** — `consumeManagedProgressSignal` now reads
   and deletes through `MANAGED_PROGRESS_SIGNAL`, preventing a future rename
   from splitting consumption and cleanup.
2. **Name the wrapper responsibility** — renamed `reviewEnvironment` to
   `reviewChildEnvironment`; the helper sanitizes inherited state and opts only
   a JSON review child into managed progress.
3. **Remove copy-dependent filtering** — added the explicit `preparation`
   progress phase and suppress that phase structurally for managed JSON reviews.
   User-facing copy can now change without silently changing output policy.
4. **Consolidate managed-review fixtures** — the public wiring tests share one
   setup helper while keeping outcome assertions local; quiet-mode coverage now
   includes approved and action-required results.
5. **Make BDD proof traceable** — narrowed the feature to executable customer
   behavior and added a scenario-to-Vitest proof manifest checked in CI.
6. **Reuse recursive surface discovery** — Markdown discovery now filters the
   generic file walker instead of maintaining a second traversal.
7. **Consolidate repeated test cases** — descriptor-failure ordering and BDD
   manifest dispatch use parameterized cases while retaining named proof
   provenance.
8. **Name the progress phase contract** — `ProgressPhase` makes the coordinator
   and policy boundary explicit without widening runtime behavior.
9. **Scrub managed progress case-insensitively** — wrapper children remove every
   casing of the private signal before deliberate JSON-review opt-in, matching
   Windows environment semantics.
10. **Make reviewer transitions explicit** — starting a new progress stage now
    cancels the prior stage's heartbeat, preventing stale route messages.
11. **Harden source-route discovery** — the wrapper trusts a source checkout
    only when its CLI package identifies itself as Safeword.
12. **Name effect and reviewer failures precisely** — effect diagnostics use an
    explicit noun map and degraded reviews explain early process exits.
13. **Forward managed worker progress** — managed JSON jobs inherit only stderr
    and re-opt the detached CLI worker into progress, so real coordinator route
    messages reach the wrapper while stdout remains typed.
14. **Preserve managed mode and worker identity** — detached managed workers
    receive `--json`, keeping preparation filtering structural, and POSIX worker
    inspection requests untruncated command lines before matching the job ID.

## Struck or deferred

- Re-normalizing reviewer environment keys once per entry adds machinery for no
  observable clarity gain; keep the direct predicate.
- The template, dogfood, generated plugin hook, and bundled runtime copies are
  deliberate installed-surface parity, not accidental duplication.
- The filesystem acknowledgement loop in the wrapper integration test directly
  proves progress arrives before process completion; abstracting it would hide
  the temporal contract.
- Forwarding `start(message)` as `start(message, undefined)` was rejected after
  its focused test exposed an observable adapter-call-shape change; retain the
  small branch that preserves compatibility.
- Durable-job fingerprinting, liveness, and lock mechanics predate this ticket;
  they remain protected by their existing job tests and are not refactored as
  part of the managed-progress side channel.
- Repository-wide Knip, experiment, and clone findings predate this ticket and
  are outside this delivery's single purpose.

## Verification

Focused policy, public wiring, environment, wrapper parity, and BDD provenance
tests are the characterization boundary. Full local and remote verification are
recorded in `verify.md` after completion.
