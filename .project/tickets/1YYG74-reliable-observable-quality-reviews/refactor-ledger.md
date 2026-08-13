# Refactor Ledger: Keep quality reviews observable and actionable

Scope: `origin/main...codex/reliable-quality-review`

## Applied leaf-first

1. **Use one managed-signal name** — `consumeManagedProgressSignal` now reads
   and deletes through `MANAGED_PROGRESS_SIGNAL`, preventing a future rename
   from splitting consumption and cleanup.
2. **Name the wrapper responsibility** — renamed `reviewEnvironment` to
   `reviewChildEnvironment`; the helper sanitizes inherited state and opts only
   a JSON review child into managed progress.
3. **Start progress at real reviewer work** — packet preparation emits no
   lifecycle event; progress starts at the first asynchronous reviewer route.
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
8. **Keep the reporter contract minimal** — lifecycle starts carry user-facing
   messages only; the removed preparation phase had no observable execution.
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
    receive `--json`, keeping managed progress active, and POSIX worker
    inspection requests untruncated command lines before matching the job ID.
15. **Match collection types to their use** — reviewer environment allowlists
    are readonly arrays because the filter only iterates them; the constructed
    normalized allowlist remains the sole membership set.
16. **Name worker inspection outcomes** — `WorkerInspection` distinguishes a
    matching worker, a definite mismatch, and an unavailable process probe so
    each caller states its fail-open or fail-closed policy explicitly.
17. **Name failures that never launch a review** — the typed
    `NON_ATTEMPT_FAILURES` set makes network-effect accounting follow the
    `ReviewFailure` contract without rebuilding or comparing magic strings.
18. **Make fallback outcomes mutually exclusive** — fallback effect accounting
    accepts a completed-or-failed discriminated union, so impossible flag
    combinations cannot fabricate or omit a reviewer request.
19. **Harden detached review lifecycle boundaries** — throttled synchronous
    worker inspection, external completion receipts, canonical project identity,
    and explicit launch-race cleanup make durable results safer without changing
    the public review contract.
20. **Bound untrusted reviewer prose** — terminal projections remove control and
    formatting characters and cap messages while typed JSON evidence remains
    faithful for automation.
21. **Name receipt and launch artifacts precisely** — digest helpers and the
    non-rejecting launch-settlement barrier now describe their actual values;
    the cleanup guard directly excludes legitimate terminal results.
22. **Authenticate retained review history** — one host-owned HMAC key signs
    terminal records across canonical project aliases, preserving unlimited
    retained job history without per-result external receipt pruning.
23. **Make integrity helpers explicit** — typed destructuring omits the MAC from
    serialization, and `readOrCreateIntegrityKey` names its persistence side
    effect at the signing boundary.

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
  the touched release path now checks inode ownership and early worker death.
  Replacing its synchronous lock protocol or packet fingerprinting would be a
  separate behavior-changing subsystem redesign, not a safe refactor of the
  managed-progress side channel.
- Repository-wide Knip, experiment, and clone findings predate this ticket and
  are outside this delivery's single purpose.

## Verification

Focused policy, public wiring, environment, wrapper parity, and BDD provenance
tests are the characterization boundary. Full local and remote verification are
recorded in `verify.md` after completion.
