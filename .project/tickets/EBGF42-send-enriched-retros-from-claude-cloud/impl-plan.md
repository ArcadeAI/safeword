# Impl Plan: Send enriched retros from Claude Cloud

**Status:** planned
**Planned on:** 2026-08-29

## Approach

The first kill-risk is whether a real reclaimed Claude Cloud environment keeps
the documented remote session identity, registers the project-declared Stop
carrier, and can reach the collector. Probe that before application code. The
load-bearing implementation risk is then that two reclaimed workspaces send the
same session batch as byte-identical raw JSON and receive one durable receipt;
prove it first in TDD with the real builder, HTTP client, collector, and SQLite
store.

Keep one pipeline. The shared builder accepts an ordered non-empty finding
array and emits the exact v2 object `{version, findings, source, sessionScope}`.
Local Claude and Claude Cloud both call it. The collector parses exact v1 or v2
field sets on the existing route, extracts the same session scope, and stores
the untouched raw bytes. The shipped session scope remains the tuple of
`harness`, project UUID, and session ID. The only store behavior added is for a
new header request ID within that same scope: byte-identical raw REST bodies
return the original receipt. The complete matrix remains: same request ID plus
equal bytes reuses the receipt; same request ID plus unequal bytes conflicts;
new request ID in the same scope plus equal bytes reuses the receipt; new
request ID in the same scope plus unequal bytes conflicts. Different scopes
remain isolated. `PublicRetroStore.accept` in
`packages/retro-collector/src/store.ts` and the existing concurrent-scope and
byte-different-scope integration cases pin every outcome except new request ID
plus equal bytes; this ticket changes only that branch from conflict to receipt
reuse. No migration, table, queue, retry loop, or alternate destination is added.

Claude's route resolver changes its current remote-session suppression into an
explicit `claude-code` / `cloud` binding only when `CLAUDE_CODE_REMOTE` is
exactly `true` and `CLAUDE_CODE_REMOTE_SESSION_ID` is non-empty. This matches
the official environment contract checked against installed Claude Code
2.1.226. `GITHUB_ACTIONS=true` disables the public route regardless of the
remote pair. Otherwise a partial or malformed pair fails closed, while both
absent retains local Claude's shipped `unknown` host class. Generic CI variables and payload metadata never grant cloud
provenance, and Codex/Cursor cloud remain disabled. Cloud session scope uses
the carrier-owned `CLAUDE_CODE_REMOTE_SESSION_ID`; local Claude retains the Stop
payload session ID. Combining them is rejected because a workspace-local ID may
change after reclamation and would defeat the once-only scope.

### Proof plan and build order

| Order | Scenarios | Primary proof | Why this boundary |
| --- | --- | --- | --- |
| 1 | Pre-build cloud identity, carrier, egress, and RC-install probe | In one real Claude Cloud session, record the literal values and presence of both `CLAUDE_CODE_REMOTE` and `CLAUDE_CODE_REMOTE_SESSION_ID`, the actual Stop JavaScript runtime/version, and the complete discovered source profile; require the marker to equal `true`; let its environment be reclaimed; reopen the same cloud session in a fresh environment; compare the session ID and source profile. Build and pack the branch artifact, install it through the same project-scoped plugin declaration used by ordinary installs, confirm Stop registration without an interactive prompt, and attempt the production collector health endpoint | The marker result directly confirms or refutes **Bind cloud provenance at the native Claude carrier boundary**; identity stability directly confirms or refutes **Use carrier-owned session identity**. A mismatch or inability to reprovision the same cloud session in a fresh environment is inconclusive and blocks application-code implementation until alternate real evidence or a redesigned identity contract exists. Source drift is recorded and safely conflicts, but refutes receipt reuse. Failed packed-artifact installation, unregistered Stop, or blocked egress blocks activation. Existing conformance tests prove the published marketplace locator resolves to this declaration. |
| 2 | Minimum v2 walking skeleton: canonical byte identity; repeated completion before and after workspace reclamation; distinct sessions; request/receipt correlation | Build the v2 builder, exact collector parser, Claude route binding, and equal-body receipt-reuse branch needed for one packaged-CLI → real HTTP client → real collector → SQLite path. Run it under Node 22.22.3, Node 24.16.0, and Bun 1.3.14 with a fixed session and full source profile; re-run the inherited conflict/isolation matrix | Proves the new equal-body receipt reuse and unchanged conflict/isolation behavior. Orders 3–5 extend this skeleton rather than introducing parallel implementations; order 6 owns its silent Stop exit. |
| 3 | Multiple, one, zero, and mixed valid/invalid findings; batched egress sanitization; exact top-level fields; 65,536-byte acceptance; oversized all-or-nothing | Drive raw findings through `prepareEncounters` and the real builder/client; place provider-format secrets in the second and final findings and assert neither appears in raw bytes received by the collector; also assert schema-invalid content is absent | Proves every batch element crosses the existing `sanitizeTextDeep`/secretlint wall before serialization, not only the first finding, while covering filtering and cardinality without a second sanitizer. |
| 4 | Exact carrier-produced v2 accepted by real collector intake; invalid v2 rejection; released v1 compatibility; same v2 from updated local Claude | Collector integration with the exact builder bytes and released raw v1 fixture; table-driven rejection of empty findings, missing sessionScope, unknown root fields, unknown versions, and non-string/empty elements; local CLI lifecycle integration | Closes the sender/collector schema seam, makes the credential-free v2 parser exact, protects old clients, and proves v2 is shared rather than cloud-only. |
| 5 | Cloud provenance, payload spoofing, generic-CI local regression, GitHub Actions disablement, unsupported cloud hosts, and collector host-class acceptance | Route unit matrix, installed Claude Stop/CLI integration, and exact collector source-schema tests | Extends the closed host-class enum with `cloud` while current local producers retain `unknown` and released-client `local` remains accepted; exhausts fail-closed precedence and payload isolation. |
| 6 | Cloud and local eligibility/opt-out; local v2 acceptance recovery; one attempt on timeout; immediate network-policy refusal; silent success/failure; no-valid-finding and oversized-batch recovery | Named local and cloud retro-command/Stop-carrier integration tests with a configured short handoff deadline; one real local collector socket accepts a request and never responds, while a separate closed process-boundary port proves one immediate refused connection and no retry | Proves NTB1's invisible bounded lifecycle across both transport failure branches and specifically proves the changed local multi-finding path neither consumes recovery nor bypasses local opt-out. |
| 7 | Real source collaborators and degraded-source delegation | Integration fixture with fixed project UUID and git remote; existing #3429 source tests remain the degraded matrix | Prevents extra cloud metadata and proves the existing source-field allowlist with only the host-class enum extended. |
| 8 | Documentation and architecture | Contract assertions plus docs review update `README.md`, website public-retro docs, and `ARCHITECTURE.md` | Records v2, accepted host classes, local multi-finding expansion, Claude Cloud support, GitHub Actions exclusion, and the collector contract in the implementation PR. |
| 9 | Manual real-cloud receipt and readiness verdict | Through the project-declared packed release candidate, run an eligible Stop in a real Claude Cloud workspace and resolve its request identity through the production operator read. Record the matching identity pair only when it resolves; explicitly reject no receipt, mismatched receipt, local-only, injected-transport, reserved-canary, and non-production evidence | Owns all SWM1.R3 scenarios and is the publication gate. Only the real carrier plus the production collector can mark readiness proven. |

Rollout follows the completed build: first deploy collector acceptance and prove
reserved synthetic v1/v2 canary receipts; then install the packed release
candidate through the project declaration in a real cloud workspace and record
a matching production operator receipt in `ticket.md`. Missing, mismatched,
local, injected, canary, or non-production evidence cannot prove readiness.
Publication remains the activation boundary.

Affected-surface coverage: Claude Code Cloud is covered by installed Stop/CLI
integration plus the manual receipt; local Claude by the local v2 lifecycle
test; Railway Public Retro Collector by source and packaged collector
integration; GitHub Actions Execution Sandbox by the exact `GITHUB_ACTIONS=true`
suppression matrix. Retro Filer behavior is unchanged; order 6 observes its inherited
candidate/ack state without changing drain semantics. Claude Code GitHub
Actions, Codex Cloud, and Cursor Cloud remain negative route-matrix rows.
Order 6 proves NTB1's bounded, silent experience; order 9 gives SWM1 the
explicit evidence needed to decide whether the Claude Cloud route is releasable.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://tc39.es/ecma262/2025/multipage/#sec-json.stringify | 2026-08-28 | ECMAScript 2025 | Bun 1.3.14 actual carrier runtime plus supported Node 22.22.3 and 24.16.0 engines | Defines JSON serialization and ordered object-property enumeration used by the existing dependency-free builder | Construct one fixed-shape object and serialize it once; transport those exact bytes | Specification only; prove exact bytes in each supported runtime rather than claim general canonical JSON or accept dynamic object shapes |
| https://opentelemetry.io/docs/specs/otel/trace/sdk/ | 2026-08-28 | Current stable tracing SDK specification | SafeWord 0.81.0 | Treats batching as one bounded export and prioritizes honoring the export timeout | One bounded session batch with a whole-request limit and deadline | Telemetry architecture is far broader; no queue, scheduled processor, retry policy, SDK, or copied code |
| https://code.claude.com/docs/en/env-vars | 2026-08-29 | Current docs checked with Claude Code 2.1.226 installed | Claude Code 2.1.226 | Documents `CLAUDE_CODE_REMOTE=true` in cloud sessions and `CLAUDE_CODE_REMOTE_SESSION_ID` as the current cloud session ID | Require both native values at the Stop boundary; never infer cloud from generic CI or payload | Environment is carrier provenance, not authentication; GitHub Actions is disabled because its official guide does not document these values |

**Decision impact:** changed: replace single-finding suppression with one bounded,
deterministic session batch while retaining the existing transport and timeout.
**Decision informed:** Use one deterministic v2 session batch on the existing endpoint and retain v1 intake

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Use one deterministic v2 session batch on the existing endpoint and retain v1 intake | Fixed ordered `findings` array, one serialization, one request identity and receipt; exact v1/v2 union parser | Pick one finding; send one request per finding; add `/v2` and a parallel pipeline | Picking loses evidence; per-finding requests conflict with session identity and deadlines; a new route duplicates transport for no user value. |
| Bind cloud provenance at the native Claude carrier boundary | Disable `GITHUB_ACTIONS=true`; otherwise require `CLAUDE_CODE_REMOTE=true` plus a non-empty `CLAUDE_CODE_REMOTE_SESSION_ID`, fail closed on a partial/malformed pair, and keep both absent as shipped `unknown`; ignore payload and generic CI claims | Generic environment inference; caller-supplied host flag; cloud-specific script or MCP service | Generic inference misclassifies local/CI runs; caller flags are spoofable; another carrier or service duplicates the proven Stop path. |
| Preserve raw-body duplicate authority across reclaimed workspaces | Keep the shipped `(harness, project UUID, session ID)` scope and unequal-byte conflict. Add only this result: a new header request ID with byte-identical raw bytes returns the existing receipt | Depend only on local attempt markers; semantic finding dedupe; new dedupe table; change scope identity | Local state disappears with the workspace; semantic reads violate raw REST authority; the existing row already owns the receipt and bytes; changing scope would broaden the ticket. |
| Use carrier-owned session identity | Cloud feeds `CLAUDE_CODE_REMOTE_SESSION_ID` into the shipped scope derivation; local Claude keeps the Stop payload session ID | Payload ID everywhere; hash the remote and payload IDs together | Anthropic documents the value as the current cloud session ID, but stability across environment reclamation is not documented. Either alternative includes workspace-local identity that can change the scope; order 1 empirically gates this choice before application code. |
| Keep the existing project opt-in as consent for multi-finding batches | Existing `publicRetros.enabled` consent continues to authorize eligible sanitized session retros; document plainly that projects whose multi-finding sessions were effectively never delivered will now begin delivering every eligible finding | Version-gated re-consent; first-run notice | For many opted-in users this is first effective egress, not merely more volume. The choice remains acceptable because the destination, data class, eligibility, sanitizer, deadline, and opt-out they authorized are unchanged; a Stop-time notice would violate the explicitly invisible experience, while same-PR release notes and the immediate opt-out disclose and control the correction. |

These choices came from the ticket's figure-it-out investigation: observed
Claude extraction batches were 4, 4, and 7 findings; per-finding delivery was
incompatible with the one-session scope, while a single batch retained the
existing request, deadline, and storage boundaries.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| 1. Structure enforces; instructions suggest | Exact v1/v2 parsers and carrier-owned source construction make invalid shape and spoofed provenance impossible to accept by convention alone. | `packages/retro-collector/tests/public-retro.integration.test.ts`; `packages/cli/tests/retro/public-delivery.test.ts` | |
| 2. Fire at boundaries, not every turn | Delivery remains attached only to the existing Stop carrier and makes one bounded request per session batch. | `packages/cli/tests/integration/public-retro-lifecycle.test.ts`; Stop-carrier integration tests | |
| Optimize for the NTB without constraining the TBU | NTBs finish without setup or narration; TBUs retain the project opt-out, bounded deadline evidence, and unchanged private recovery path. | Order 6 silence, opt-out, deadline, and recovery integration tests | |
| 3. Add, never replace | The collector accepts released v1 unchanged while adding exact v2 intake; private recovery remains available. | Released v1 fixture, v2 integration, and recovery tests | Claude GitHub Actions' accidental local/unknown publication path is intentionally removed because that CI boundary lacks the native cloud-session evidence required by the approved provenance contract. |
| 5. Correct and safe; then clear; then simple | Reuse one builder, endpoint, transport, SQLite row, and receipt; add no dependency or background mechanism. | Full diff, dependency manifests, and integration proof | |

Architecture decisions honored: `ARCHITECTURE.md`'s Public Retro boundary
(credential-free quarantine, raw-body authority, operator-only reads) and
Registry-Driven Agent Integrations with Native Trust Boundaries. Update the
`### Public retrospective collector boundary` section with the four-outcome
store contract, `cloud` host class, and versioned session batches. No separate
ADR is warranted because this is a backward-compatible extension of that named
boundary, not a new component or storage owner.

## Known deviations

- Existing local Claude users with multi-finding sessions currently publish
  nothing because the sender requires exactly one finding. This ticket
  intentionally begins publishing the full eligible sanitized batch. The
  existing project opt-out, silence, one-attempt deadline, and private recovery
  remain unchanged; README and website docs make the expanded volume explicit.
- Claude Code GitHub Actions currently falls through the local/unknown route
  when no remote pair exists. This ticket intentionally suppresses it because
  the GitHub-hosted action lacks the native cloud-session evidence required to
  distinguish that CI authority boundary from an ordinary local session; it
  can be added later when its provenance is documented and proven.
  This suppression is confined to the Claude carrier resolver; local Codex
  behavior in GitHub Actions remains unchanged.
- A session teleported between cloud and local may keep one session ID while
  changing `hostClass`; the same scope with unequal raw bytes safely conflicts,
  remains silent, and preserves recovery rather than weakening duplicate authority.

## Doc impact

- `README.md`: public retros now send all sanitized session findings and support
  Claude Cloud silently.
- `packages/website/src/content/docs`: update the public-retro explanation and
  CLI behavior without exposing internal carrier mechanics as user setup.
- `ARCHITECTURE.md`: record v1 compatibility, v2 batch shape, accepted host
  classes, raw-byte dedupe across reclaimed workspaces, and unchanged collector isolation.

These updates are build-order task 8 and ship in the same PR.

## Assessment triggers

- A second cloud host proves a native completion carrier and outbound receipt;
  revisit only the carrier allowlist, not the envelope or collector.
- Real batches regularly approach 65,536 bytes; measure before considering
  chunking or a larger limit.
- Source discovery differs across independent Claude Cloud clones; revisit the
  deterministic source inputs before weakening raw-body authority.
- Either `CLAUDE_CODE_REMOTE` or `CLAUDE_CODE_REMOTE_SESSION_ID` changes,
  disappears, or is documented for GitHub Actions; revalidate the route matrix
  against the then-current Claude Code release before widening or retaining it.
- More than one collector replica or host is required; revisit SQLite and
  session-scope conflict handling together.
- A future envelope needs dynamic or unordered fields; adopt an explicit
  canonical-JSON scheme rather than assuming fixed construction order.
