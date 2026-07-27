# Spec: Deliver retry-safe retro findings across every harness

## Intent

Move the proven relay from a hosted foundation to the actual retro filing path.
Every supported harness gets the same fast durable acceptance contract, while
an unreachable relay leaves an inspectable local draft instead of delaying or
silently losing the user's session.

## Intake Brief

- **Requested by:** Alex Salazar through GitHub issue #1479 and this session.
- **Cost of inaction:** The Railway service remains a disconnected spike; local
  spools can still be orphaned by a later session and the documented retry,
  dead-letter, and tombstone policies never execute.
- **Reversibility:** One-way data-model change for persisted request lifecycle;
  two-way rollout because the existing GitHub-native filer remains available
  until production evidence permits retirement.

## References

- Canonical contract: <https://github.com/ArcadeAI/safeword/issues/1479>
- Relay foundation: ticket N30CKR
- Existing uniqueness, concurrency, ambiguous-create, and raw-REST migration
  regression source: `features/retry-safe-retro-filing.feature`
- Railway proof: ticket 81P5QH and its spike report
- Blocking uniqueness prerequisites: GitHub issues #1474 and #1481
- Credential-helper readiness gate, only if reused: GitHub issue #1495

## Personas

- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- Claude Code Cloud
- OpenAI Codex
- OpenAI Codex Cloud
- Cursor
- Cursor Cloud Agents
- Safeword CLI

Unaffected:

- GitHub MCP — connector reads are never marker or duplicate authority.

## Vocabulary

- **Durable acceptance:** The relay has transactionally stored the immutable
  request identity and approved payload and returns a receipt. It does not mean
  the GitHub issue is already filed.
- **Claim:** A lease granting one process temporary ownership of a spool file.
- **Tombstone:** An indefinite non-reusable identity record whose approved
  payload has been compacted.

## Jobs To Be Done

### operate-retry-safe-retro-relay.TBU1 — Finish a session without losing its retro finding

**Persona:** Technical Builder (TBU)

> When a session produces a sanitized retro finding, I want filing to finish or
> hand off durably without making my agent session wait, so I can leave without
> wondering whether the finding vanished or will be duplicated.

#### operate-retry-safe-retro-relay.TBU1.R1 — One immutable persisted request crosses every harness without acquiring a new identity

#### operate-retry-safe-retro-relay.TBU1.R2 — An unreachable relay returns control within one second and leaves a visible retryable draft

#### operate-retry-safe-retro-relay.TBU1.R3 — A local draft is acknowledged only after the relay durably accepts that exact request

#### operate-retry-safe-retro-relay.TBU1.R4 — Relay routing is fail-closed until the canonical readiness prerequisites are proven

### operate-retry-safe-retro-relay.SWM1 — Operate the relay without hidden lifecycle debt

**Persona:** Safeword Maintainer (SWM)

> When the relay is deployed, I want independently rotatable callers and
> observable lifecycle enforcement, so I can roll out one harness at a time and
> reconcile failures without weakening dedupe identity.

#### operate-retry-safe-retro-relay.SWM1.R1 — Authentication and repository authorization vary by principal while request identity does not

#### operate-retry-safe-retro-relay.SWM1.R2 — Retry, grace, dead-letter, compaction, and tombstone deadlines are durable and alertable

#### operate-retry-safe-retro-relay.SWM1.R3 — Operational state is readable without exposing approved payloads or credentials

## Rave Moment

skip: table-stakes reliability work; no honest rave moment clears the bar.

## Outcomes

- All six named local/cloud harness surfaces use the same CLI-owned relay
  operation and persisted request bytes.
- A successful relay handoff is bounded and durable; failure preserves a
  recoverable local spool.
- Operators can see lifecycle counts and alerts without reading issue payloads.
- Uniqueness rollout remains explicitly blocked on #1474, #1481, and the
  post-fix collision measurement rather than being implied by deployment.
- This slice does not change the relay's uniqueness or reconciliation
  algorithms. Their existing feature suite remains mandatory regression
  evidence, but new behavior here cannot promote them.
- Live relay routing remains disabled until #1474 and #1481 are closed and the
  required same-signature and spooled-never-filed measurements are recorded.
  Without that proof, every harness continues to use its existing filing path.

## Open Questions

- defer: Real GitHub App and client credentials are deployment inputs and are
  not available in the repository. Wiring is proven with a real HTTP server and
  network-boundary collaborator.
- defer: Global counts of spooled-but-never-filed drafts do not exist because
  current clients emit no central telemetry. This slice adds observable
  acceptance/lifecycle state but cannot reconstruct historical losses.
- resolved: The 30-day payload lifetime is an application-access guarantee.
  It does not promise forensic erasure from SQLite pages, Railway snapshots, or
  operator backups.
