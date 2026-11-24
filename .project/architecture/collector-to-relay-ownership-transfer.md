# Collector-to-relay ownership transfer

**Status:** Accepted
**Date:** 2026-09-05

**Context.** Once the collector accepts an anonymous submission, the client can exit. The collector must retain the submission without GitHub credentials, and time in its queue must leave the relay’s retry window intact.

**Decision.** The collector owns immutable accepted bytes until the private worker receives relay acceptance. Lease expiry returns work to the collector without a retry deadline. Relay acceptance starts a fresh relay-owned 24-hour retry window. Cutover remains disabled until per-harness canary records bind one request ID and session scope to distinct collector and relay receipts plus reviewed artifact evidence.

**Consequences.** Queue delays leave the full retry window available. Once the relay acknowledges handoff, it alone owns recovery. Production cutover requires evidence linking the same handoff to the build that ran it. The collector, worker, and relay remain separate deployable services and require an independently rotated `collector-worker` credential.

**Alternatives.** Synchronous collector forwarding loses accepted work on handoff failure; a collector-owned filing deadline consumes recovery before relay acceptance; colocating intake and filing authority weakens the trust boundary; dual filing permits duplicates.

**Reassess when.** The collector or worker needs more than one replica, Railway private networking changes, GitHub adds a trustworthy create-idempotency key, or the single-host SQLite queue misses its operational targets.
