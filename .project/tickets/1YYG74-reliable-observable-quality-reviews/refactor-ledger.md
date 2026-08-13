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

## Struck or deferred

- Re-normalizing reviewer environment keys once per entry adds machinery for no
  observable clarity gain; keep the direct predicate.
- The template, dogfood, generated plugin hook, and bundled runtime copies are
  deliberate installed-surface parity, not accidental duplication.
- The filesystem acknowledgement loop in the wrapper integration test directly
  proves progress arrives before process completion; abstracting it would hide
  the temporal contract.
- Repository-wide Knip, experiment, and clone findings predate this ticket and
  are outside this delivery's single purpose.

## Verification

Focused policy, public wiring, environment, wrapper parity, and BDD provenance
tests are the characterization boundary. Full local and remote verification are
recorded in `verify.md` after completion.
