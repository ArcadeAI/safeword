# Work Log: Let parallel sessions share test capacity safely

**Anchored to:** `.project/tickets/2RZDMP-share-test-capacity-across-parallel-sessions/ticket.md`

---

## Session: 2026-08-07

- [17:31] Created the feature ticket while quality-reviewing BBNZ68; local scheduling and remote execution have separate state machines, risks, and release value.
- [17:32] Reused issue #419's machine-global mutex and stale-owner recovery as the safety baseline.
- [17:32] Chose two focused permits for v1, with broad runs consuming all capacity, a checkout-local mutex preserving build safety, writer preference preventing broad-run starvation, and a machine-scoped capacity override that can restore capacity one.
- [17:32] Re-review corrected broad acquisition to mean all resolved permits at any configured capacity and required atomic, partial-allocation-free ownership with PID-birth-safe crash recovery.
- [17:32] Re-review rejected per-process capacity overrides as incoherent machine-wide authority. Replaced them with one persisted integer in `1..8`, mutable only while idle, and fixed global guard order to checkout mutex then machine capacity with reverse-order cleanup.
- [17:32] Defined per-user/machine versioned state, owner-only permissions, OS process-creation identity on macOS/Linux/Windows, fail-closed corrupt or unverifiable state, idle-only migration, and a legacy-mutex coordinator so old and new runner versions cannot overlap.
- [17:32] Removed the unprovable legacy-coordinator promise. Derived capacity domains from OS machine plus user identity, fall back to the legacy capacity-one mutex when identity is unsafe, and explicitly defer continuous mixed-old/new wrapper interoperability.
- [17:32] Defaulted the scheduler safely to capacity one and made higher capacity an explicit all-participating-worktrees protocol migration. Replaced informal writer preference with an atomic FIFO ticket queue whose head admits either a focused batch or one exclusive broad run.
- [17:32] Removed the contradictory attempt to change capacity while a legacy owner is active. Higher-capacity migration is idle-only; detectable legacy activity makes new clients refuse, while continuous mixed-version execution is explicitly outside v1's bounded-capacity guarantee.
- [17:32] Narrowed every machine-wide capacity claim to participating new-wrapper sessions; mixed-version execution is deferred rather than presented as safely enforceable.
- [17:32] Gave queued waiters the same PID-plus-process-creation identity as owners and required dead-waiter pruning under the state guard before every FIFO head decision, with unverifiable identity failing closed.
- [17:32] Bound process identity to concrete OS evidence: Linux boot ID plus proc start ticks, Windows process creation time, and conservative macOS PID start time with ambiguous same-second reuse treated as live.
- [17:32] Narrowed capacity language throughout to participating current-protocol wrappers; v1 explicitly makes no machine-wide guarantee against a legacy process launched later.
- [17:32] Defined the concrete atomic state protocol: guarded versioned state, monotonic tickets, weighted owner records, temp-and-rename persistence, empty-owner broad admission, and the same crash-safe process identity for scheduler and checkout guards.
- [17:32] Added flushed file/directory state commits and descendant-aware ownership using POSIX process groups or Windows Job Objects; permits remain held until the execution container is proven empty.
- [17:32] Removed non-atomic legacy-owner detection from the new protocol. Capacity above one now claims safety only among explicit current-protocol participants; atomic mixed-version handoff remains out of v1.
- [17:32] Added staged `reserved` to `active` ownership: POSIX children block on a handshake pipe and Windows children remain suspended in a Job Object until container identity is durably recorded.
- [17:32] Narrowed POSIX descendant guarantees to non-detaching tools; process groups cannot contain code that deliberately daemonizes, so arbitrary escaped descendants are an explicit v1 limitation.
- [18:06] Fresh quality review corrected the document outline so machine identity, lock ordering, state compatibility, and mixed-version limits remain Decisions rather than being mislabeled as next-phase evidence.
- [18:06] Added POSIX supervisor birth identity and guarded group-incarnation checks; leader exit, surviving descendants, group disappearance, and PGID reuse are now mandatory real-process scenarios.
- [18:06] Closed identity-loss split-brain: initialized schedulers refuse new work until the recorded domain is located and idle; legacy capacity-one fallback is allowed only before initialization or after explicit idle reset.
- [18:34] Final quality-review pass returned healthy for spec quality with no remaining correctness, security, or cross-spec contradiction. Independent Claude remained unavailable; provenance is degraded separate-process Codex. Process-level proof remains next-phase work.
- [18:53] Entered define-behavior after reconciling the newly merged 72WMQ5 lock hardening as the capacity-one compatibility baseline; saved 14 partition dimensions before Gherkin.
- [18:58] Authored and linted 15 scenarios across all 6 rules, including 8 rejection scenarios, all four affected host surfaces, real-process/platform boundaries, and a matching R/G/R ledger; entered scenario-gate pending user completeness confirmation.
- [03:42] Completed the full scenario-quality loop at 56 feature scenarios and 56 ledger entries. Added deterministic proof for first use, strict CLI parsing, FIFO/accounting, process and checkout teardown, crash-safe journaling, platform identity, native CI attestations, evidence idempotency, reset races, and stranded-state recovery. Corrected the affected surface to Safeword CLI only; host sessions consume the wrapper transparently. Gherkin and diff checks pass. A separate headless Codex review approved with no findings after Claude was unavailable, so independence remains degraded.
