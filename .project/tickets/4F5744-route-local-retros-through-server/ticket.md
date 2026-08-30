---
id: 4F5744
slug: route-local-retros-through-server
type: feature
phase: done
status: done
phase_anchors:
  - verify: .project/tickets/4F5744-route-local-retros-through-server/test-definitions.md
  - done: .project/tickets/4F5744-route-local-retros-through-server/verify.md
external_issue: https://github.com/ArcadeAI/safeword/issues/3514
scope:
  - Route eligible sanitized local retros from Claude Code, OpenAI Codex, and Cursor through public intake that requires no customer credential and holds no filing authority.
  - Add a server-owned envelope version that is leasable only after the emitting client has disabled direct filing; keep every legacy collector row inert.
  - Extend the public collector with truthful local Cursor admission, relay-compatible validation and limits, durable queue visibility, and a least-privilege read-and-claim boundary for the private worker while keeping filing credentials out.
  - Update the CLI client to accept truthful local Cursor metadata, persist request identity and bytes before transport, enforce the 256 KiB serialized envelope limit, and derive its timeout from the 750 ms budget.
  - Add a private server-side filing worker that leases accepted collector records with a dedicated claim principal and submits them through a new `collector-worker` relay principal with only `ingest` authority.
  - Preserve local recovery until collector acceptance and prevent direct agent-side GitHub fallback after acceptance.
  - Gate cutover on production evidence for all three current local filing carriers and eventual filing.
  - Bound automatic GitHub creation with configurable global and per-project worker quotas while preserving excess accepted records.
  - Add a global public-intake rate bound and a build-attested per-source canary mode for non-circular production proof.
  - Extend relay credential parsing and attribution for the fifth `collector-worker` ingest-only principal.
out_of_scope:
  - Cloud-hosted agent carriers; tracked by #3476.
  - OpenCode retrospective dispatch, which does not exist today.
  - Retention policy, dashboards, background daemons, customer accounts, customer credentials, or customer infrastructure.
  - Moving relay or GitHub credentials into the internet-facing public collector.
  - Consolidating similar findings from genuinely later sessions onto an existing issue; this cutover preserves exact-request idempotency and ambiguity recovery only.
done_when:
  - A fresh local install needs no customer action or secret to submit eligible sanitized findings.
  - Collector acceptance durably guarantees transfer through a terminal filing disposition under one request identity.
  - The collector accepts Cursor with truthful local host metadata, and the production proof asserts that exact provenance.
  - Collector acceptance persists its acceptance timestamp and a server-derived digest of the stored bytes; the relay anchors a fresh retry deadline at first relay acceptance and preserves it across retries.
  - Pre-acceptance failures retain local recovery; post-acceptance handling never invokes direct agent-side GitHub create.
  - Exact duplicate decisions use a complete raw REST body scan, never sanitized reads or similarity alone.
  - Build-attested production tests prove Claude Code, OpenAI Codex, and Cursor before the cutover gate can enable.
  - Existing opt-out behavior remains authoritative and normal operation is silent and bounded.
  - Pre-cutover drafts finish through the established path; rejected or oversized new requests remain locally recoverable.
  - An accepted record stays durable and operator-visible throughout a full worker outage; fault injection proves exactly-once recovery after the worker returns.
  - Collector admission enforces every relay constraint checkable before filing, and every cutover route rejects user identity before storage.
  - A crash after collector claim but before relay acceptance expires the lease and recovers the same request exactly once.
  - Build-attested evidence correlates each real harness's durable local request identity and session scope with the collector and terminal relay receipt.
  - Legacy collector rows are never leased, and quota overflow remains durably queued rather than creating unbounded GitHub issues.
  - Cursor Cloud Agent metadata produces a cloud host class and cannot satisfy the local readiness gate; absence of its managed-runtime socket identifies local Cursor.
  - Maintainer canary runs prove the real server-owned path before the global default changes.
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-30T00:19:30.350Z
last_modified: 2026-08-30T00:19:30.350Z
---

# Route local retros through the durable server without customer setup

**Goal:** Retire direct GitHub filing for Claude Code, OpenAI Codex, and Cursor only after the public collector durably owns each accepted request through server-side filing, without customer setup.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Dependency

The existing relay readiness manifest must enable production filing before this cutover can collect terminal-filing evidence or enable.

Production relay credentials must add the independently rotatable `collector-worker` principal with only the `ingest` role before the private worker can deploy.

## Work Log

- 2026-08-30T00:19:30.350Z Started: Created ticket 4F5744
- 2026-08-30T00:22:00.000Z Found: Existing local batch delivery shipped in #3477; cloud transport remains independently scoped by #3476. This feature owns only the zero-touch local server cutover.
- 2026-08-30T01:05:00.000Z Reviewed: Defined collector acceptance versus filing ownership, limited the harness set to the three current retro carriers, preserved opt-out and local recovery, and made end-to-end server transfer a cutover invariant.
- 2026-08-30T01:12:00.000Z Reviewed: Kept the public collector credentialless by assigning pull-and-file authority to a private server-side worker; made truthful Cursor acceptance, stable envelope identity, bounded delivery, and pre-cutover handling explicit.
- 2026-08-30T01:18:00.000Z Reviewed: Added a ten-minute accepted-but-unclaimed alert contract and recovery fault proof; kept public request bytes immutable, forbade user identity, and retained oversize or conflict failures locally without splitting identities.
- 2026-08-30T01:24:00.000Z Reviewed: Aligned collector admission with the relay, made user-identity rejection universal, reused the durable alert outbox, and recorded relay readiness as an explicit dependency.
- 2026-08-30T01:31:00.000Z Converged: Removed a needless claim-time alert subsystem. Collector acceptance now transfers recovery to a durable visible queue; the existing relay owns post-claim retry and ambiguity. Raised collector intake to the relay's 256 KiB limit and specified negative identity/privacy proofs.
- 2026-08-30T01:38:00.000Z Converged: Made collector claims expiring leases, reserved a least-privilege relay filing principal for the worker, separated payload-free lifecycle reads from claim payload access, and proved the existing finding bounds keep every normalized batch below 256 KiB.
- 2026-08-30T01:45:00.000Z Converged: Put the 256 KiB limit on both client and collector, persisted request identity before transport, derived public timeouts from the 750 ms budget, and defined session scope as a secondary reservation key for later windows.
- 2026-08-30T02:00:00.000Z Converged: Named `v3`, added per-source canary rollout, bounded intake and FIFO quota aging, grounded Cursor cloud detection in its documented metadata socket, and separated collector-envelope and relay-payload digests.
- 2026-08-30T02:08:00.000Z Advanced: User confirmed the Rules and engineering contract. Consolidated review mechanics into 13 persona-facing invariants and entered define-behavior. A separate cold-start check was not repeated because multiple cross-agent reviews already exercised the contract from bounded context.
- 2026-08-30T02:18:00.000Z Drafted: Derived eight behavioral dimensions and authored 26 representative scenarios covering all 13 Rules, affected surfaces, happy paths, and rejection paths; awaiting the required completeness confirmation.
- 2026-08-30T02:22:00.000Z Advanced: User confirmed the scenario set fully covers intended behavior and important boundaries; entered the independent scenario-quality gate.
- 2026-08-30T01:52:00.000Z Converged: Made the new server-owned envelope the atomic cutover boundary, kept all legacy quarantine rows inert, bound production proof to real harness artifacts, and added minimal global/per-project filing quotas with durable overflow.
- 2026-08-30T08:15:00.000Z Reviewed: Independent quality review found the accepted batch could exceed GitHub's issue-body limit, delayed collector work inherited an expired relay clock, terminal relay receipts were flattened, and two delivery routes could own one window. Bounded the rendered body before acceptance, anchored retry at relay acceptance, preserved terminal state, and made route ownership exclusive.
- 2026-08-30T09:16:00.000Z Verified: Full package pass reached relay 189/189, collector 134/134, and CLI 8,740/8,740 with 13 intentional skips. BDD reached 1,484 passing scenarios plus three skips; its sole failure was dogfood parity, then reconciled and proven directly across 255 pairs and eight contracts. Builds, TypeScript/Astro checks, lint, and dependency audits passed. The repository-wide Python lane remains red on pre-existing duplicate experiment module names outside this branch; the load-sensitive review-route test passed in the first full run and in isolated rerun.
- 2026-08-30T09:20:00.000Z Reviewed: Rejected blank-title v3 envelopes before durable acceptance, proved the routine operator route cannot read v3 payloads, removed the unused collector timestamp header, and made relay mode fail closed without a project directory.
- 2026-08-30T15:08:00.000Z Reopened: Test-quality review found the collector-to-worker-to-relay seam was proved only against a permissive relay stub, allowing the collector acceptance timestamp and authorization contracts to drift while all suites stayed green. Resumed implementation with a real-collaborator RED.
- 2026-08-30T16:43:00.000Z Completed: Replaced the permissive relay stub with a real collector-to-worker-to-relay integration, anchored relay ownership at relay acceptance, pinned the exact 60 KB boundary, closed authorization/readiness/version/legacy-row proof gaps, clarified exact-request versus cross-session deduplication, restored collector-route observability, and removed the idle worker's abort-listener leak. Full package, acceptance, build, type, lint, and supply-chain lanes passed except the unchanged repository-wide Python duplicate-module baseline recorded in verify.md.
