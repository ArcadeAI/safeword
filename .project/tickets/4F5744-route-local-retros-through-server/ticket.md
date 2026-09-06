---
id: 4F5744
slug: route-local-retros-through-server
type: feature
phase: implement
status: in_progress
phase_anchors:
  - verify: .project/tickets/4F5744-route-local-retros-through-server/test-definitions.md
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
  - Each harness artifact originates in that harness's real local session lifecycle; process or socket presence alone cannot satisfy readiness. The existing socket-only Codex artifact must be recaptured through a real Codex session before cutover.
  - Legacy collector rows are never leased, and quota overflow remains durably queued rather than creating unbounded GitHub issues.
  - Cursor Cloud Agent metadata produces a non-local host classification and cannot satisfy the local readiness gate; absence of its managed-runtime socket identifies local Cursor.
  - Maintainer canary runs prove the real server-owned path before the global default changes.
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-30T00:19:30.350Z
last_modified: 2026-09-06T14:48:00.000-07:00
---

# Route local retros through the durable server without customer setup

**Goal:** Retire direct GitHub filing for Claude Code, OpenAI Codex, and Cursor only after the public collector durably owns each accepted request through server-side filing, without customer setup.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Dependency

The existing relay readiness manifest must enable production filing before this cutover can collect terminal-filing evidence or enable.

Production relay credentials must add the independently rotatable `collector-worker` principal with only the `ingest` role before the private worker can deploy.

## Root Cause

The first Cursor canary procedure supplied a synthetic transcript and a findings object in the wrong shape. Cursor's public-retro boundary correctly rejected the unbound transcript because no hook had associated that exact conversation ID, transcript path, and project; the findings reader also correctly treated the non-array payload as empty. The resulting zero-byte legacy spool was a canary-construction failure, not a server-route failure.

Confirmed by tracing `publicRetroEligible` through `cursorPublicBindingMatches`, inspecting the private hook-created binding for the real Cursor conversation, and rerunning with that exact host transcript plus the documented findings array. The bound run created an accepted `server-v3` attempt and synthetic issue #4046. Ruled out: a missing canary build selector, because the accepted attempt is stamped `server-v3`; collector or worker failure, because the request reached an accepted terminal receipt; and duplicate suppression, because changing the invalid object's title still produced no finding until the payload shape was corrected.

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
- 2026-09-05T11:57:00.000Z Reopened: Independent Claude and Codex reviews found release blockers in the collector retry clock, shared stop budget, readiness correlation, public-intake quota, and production-evidence claim. Restored implementation status until those findings and the real production evidence gate are resolved.
- 2026-09-05T12:24:00.000Z Hardened: Fenced every terminal queue mutation by the live lease, made failed server handoffs report retained recovery truthfully, and kept local cutover fail-closed because committed hashes do not independently prove production behavior. A future enabled manifest requires authoritative collector/relay provenance; the current production-evidence work remains explicitly incomplete.
- 2026-09-05T17:26:00.000-07:00 Production RED: Railway launched the intended worker entrypoint, but its unreferenced idle poll let Node exit with code 13. Added a built-entrypoint process test that reproduced the exact failure, then kept the abortable poll referenced so an empty queue remains a live, quiet service.
- 2026-09-05T19:16:57.000-07:00 Production canary: A build-scoped Codex-local `v3` request was accepted as `69f6fb41-4359-4a1d-a56c-107bfb312a8c`, retained under the same identity through worker authorization failures, and filed once as GitHub issue #3922 after the worker received the relay-issued `swc_<id>_<secret>` credential instead of raw secret material. Raw GitHub REST confirmed the relay-owned request marker. The canary seam still needs a clean committed-artifact run, and Claude Code plus Cursor remain gated.
- 2026-09-05T19:23:29.000-07:00 Production GREEN: The Codex-local canary built from clean commit `2f0d9aa07` (CLI SHA-256 `c18df03086dc04a2c70bf013faf0131b937c048edcf8ae54b9aa3d4fa2a8658c`) submitted request `82506792-913e-42e4-bbcf-476d63f08264`, received collector receipt `990c35e1-b3af-4cdc-813b-51f215caa083`, and completed on its first private-network worker attempt as issue #3923. Raw GitHub REST confirmed the exact relay-owned request marker. Claude Code, Cursor, and the authoritative global readiness verifier remain gated.
- 2026-09-05T19:57:30.000-07:00 Review correction: The #3923 run proves the committed client-to-collector-to-private-worker-to-relay-to-GitHub transport, but not truthful Codex-local provenance: its canary selector rewrote an indeterminate host to `local`. The production readiness gate must not count that run as a Codex harness proof. The canary now preserves runtime classification, requires the Codex Desktop app-tools path to exist as a Unix socket before routing, and refuses canary builds with tracked source changes. A new production run is required.
- 2026-09-05T20:01:15.000-07:00 Corrected production GREEN: Commit `4b8a6a0dd54d69cac18f1aa7bfe7e411ec64c3f8` with no tracked source changes (CLI SHA-256 `eead740d34791e2e3c37ff0ee4ca19d85f8dc33b9da35f896f9bd59126daaf45`) observed the env-named Codex Desktop app-tools path as a Unix socket before routing request `9ea7e7e2-e3bf-4560-a185-6dd43aec98d2`. Collector receipt `66aeeb1d-3301-4c9e-be7a-b0b6c9897631` completed on its first private-worker attempt as issue #3925, and raw GitHub REST matched the independently derived relay-owned request marker. Claude Code, Cursor, fault artifacts, and the authoritative global readiness verifier remain gated.
- 2026-09-06T13:21:32.000-07:00 Claude Code production GREEN: Commit `1bd9442795a5f2bdf349706055e07fd7c546b2c0` had no tracked source changes when its canary-scoped CLI was built (SHA-256 `dafadd2b2b92396c643c13740d483ae025ffa227793234f84fc4d28ed9f2755e`) and run through a real interactive Claude Code 2.1.226 session and its normal Stop hook. The CLI hash is the binding artifact identity; the commit records its source context. The canary selector stamped the source as `server-v3`, whose exclusive route makes the direct-filing branch unreachable; the server-owned raw marker independently proves which route created the issue. Request `ea69af2d-159e-4460-ac52-5f2f64b5d24b` received collector receipt `d94059ab-4bbe-4b9d-af16-de55816cabf0` and was filed as synthetic issue #4040. Raw GitHub REST returned request marker `00a64f2b71260eb1e98a3eb5ff9d0f14943d3edef022b196730acb329617d7e0`, exactly matching an independent derivation from the production collector-worker scope and request ID; the synthetic issue was then closed. Readiness must retrieve closed canary artifacts by exact issue GET and inspect their raw REST bodies; all three harness canaries use closed synthetic issues. Claude print mode was ruled out as a canary carrier because it completed the same three tool calls without emitting a Stop hook event. The per-harness SWM1.R1 evidence ledgers remain incomplete until each artifact is verified and linked in the readiness manifest. The earlier Codex proof establishes truthful local classification and server routing but does not originate in a real Codex session; it is inadmissible for global cutover and must be recaptured. Cursor, fault artifacts, and the authoritative global readiness verifier remain gated.
- 2026-09-06T14:45:00.000-07:00 Cursor production GREEN: Clean commit `1d62d12d775a404a435fccbebdfa624a4e5d7037` produced a Cursor-canary CLI with SHA-256 `53cd6f400107bab991258df34a650e365c090c6c8b56b2ae0f427b7f8d50061b`. A real interactive Cursor Agent 2026.09.02 conversation invoked that CLI using the transcript identity its `beforeShellExecution` hook had bound to the same project. Request `abe4d145-4ff1-42a4-9b12-2bd54bc7fe90` was accepted as receipt `fd01f5d1-c931-49fc-89d5-a0560446f4d2` and filed once as synthetic issue #4046. Exact REST retrieval of the raw body returned request marker `4580168c8245f74bdab070e7347123043743fdc35905e68e41319f9e8c745ab5`, matching an independent derivation from the production collector-worker scope; the issue was then closed. The failed precursor used an unbound synthetic transcript and invalid findings shape, proving that process presence alone cannot bypass Cursor's session binding. Cursor is captured and verified but remains unlinked until the authoritative readiness manifest is built; Codex recapture, fault evidence, and that verifier remain gated.
- 2026-09-06T14:48:00.000-07:00 Codex production GREEN: Clean commit `d43e72aad` produced a Codex-canary CLI with SHA-256 `2564b86ce55fba2994b87ca77859426cdf444a97d562128b46e50e9d15b7d27d`. This active Codex Desktop session observed its app-tools path as a Unix socket and invoked the CLI itself, replacing the prior socket-only evidence. Request `730b7641-199a-4fe4-89a6-9fe491213ab1` was accepted as receipt `c4edacea-4ecb-485e-87cb-ac68a99caf2d` and filed once as synthetic issue #4047. Exact REST retrieval of the raw body returned request marker `b89920e1a237ca48452fd7471b31faa7042ca0ce3a540d89cbde963e509be5d3`, matching an independent derivation from the production collector-worker scope; the issue was then closed. All three real local harness canaries are now captured and verified but remain unlinked until the authoritative readiness manifest is built; production fault evidence and that verifier remain gated.
