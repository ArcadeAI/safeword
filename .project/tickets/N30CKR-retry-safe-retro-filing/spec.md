# Spec: Guarantee retry-safe retro filing across harnesses

## Intent

Give every supported harness one durable filing operation so retrying the same
persisted retro request cannot lose the finding or create another GitHub issue.
This slice implements request idempotency only. Semantic dedupe is deliberately
deferred until #1474 and #1481 land and the collision rate is remeasured.

## Intake Brief

- **Requested by:** Alex Salazar through GitHub issue #1479.
- **Cost of inaction:** ambiguous GitHub creates and simultaneous harnesses can
  either file twice or lose a finding; ephemeral runtimes cannot make that
  trade safe with local spools.
- **Reversibility:** one-way-adjacent. The public request identity, durable state
  model, and retention rules become a cross-harness contract, although the
  initial single-host store can be migrated behind the boundary.

## References

- Canonical contract: https://github.com/ArcadeAI/safeword/issues/1479
- Credential-absence issue intended to be superseded after deployment and fallback retirement:
  https://github.com/ArcadeAI/safeword/issues/834
- Client token validation/redaction issue, not a gate unless those helpers are
  reused: https://github.com/ArcadeAI/safeword/issues/1495
- GitHub raw issue-body media type and repository issue API:
  https://docs.github.com/en/rest/issues/issues
- GitHub App installation token scope and expiry:
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
- SQLite WAL constraints: https://sqlite.org/wal.html

## Personas

- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor

Unaffected:

- Safeword CLI — the slice exposes a relay HTTP boundary and client library;
  deployment/operations are not a customer CLI command yet.

## Vocabulary

- **Request identity:** the caller-generated `requestId`, persisted before the
  first delivery and reused verbatim across harnesses.
- **Semantic evidence:** versioned canonical and legacy keys carried in the
  approved encrypted payload, but not consulted for dedupe in this slice.
- **Ambiguous:** GitHub may have created the issue, but the relay did not
  durably persist the issue number.
- **Tombstone:** the payload-free, non-reusable durable record that preserves a
  request's payload hash and outcome after resolved payload retention ends.

## Jobs To Be Done

### retry-safe-retro-filing.TBU1 — Retry a finding without choosing loss or duplication

**Persona:** Technical Builder (TBU)

> When a retro filing is interrupted or retried from another harness, I want
> the same persisted request to converge on one durable outcome, so I do not
> have to choose between silently losing feedback and creating duplicate
> tracker noise.

#### retry-safe-retro-filing.TBU1.R1 — Request identity is stable across every harness and payload changes are rejected

#### retry-safe-retro-filing.TBU1.R2 — First attempts and retries create at most one GitHub issue per request

#### retry-safe-retro-filing.TBU1.R3 — Uncertain delivery remains visible and recoverable without automatic recreation

### retry-safe-retro-filing.SWM1 — Operate one auditable filing trust boundary

**Persona:** Safeword Maintainer (SWM)

> When safeword files retro findings from untrusted and ephemeral runtimes, I
> want one authorized relay to own credentials, retention, and reconciliation,
> so every harness follows the same security and durability rules.

#### retry-safe-retro-filing.SWM1.R1 — Authorization is repository-scoped and independent of dedupe identity

#### retry-safe-retro-filing.SWM1.R2 — Only raw REST issue bodies are marker authority

## Rave Moment

skip: internal reliability plumbing; the observable outcome is table-stakes.

## Outcomes

- A request first sent from Claude and retried from Codex or Cursor returns the
  same issue and ignores harness identity for dedupe.
- Concurrent first attempts produce one downstream create.
- A create/persist crash window becomes `ambiguous`; no success acknowledgement
  or automatic second create occurs.
- The destination policy is fixed at a 24-hour automatic retry deadline,
  one-hour in-flight grace, 30-day resolved-payload retention, and indefinite
  tombstones; both client and server enforce the deadline and the server runs
  the maintenance worker.
- Ambiguous request markers are reconciled only from raw REST Markdown bodies.
- Existing canonical/legacy marker adoption and cross-request aliasing remain
  deferred behind #1474, #1481, and collision remeasurement.
- Relay credentials authorize a tenant, installation, and repository; the
  server-held GitHub token is never stored with request payloads.

## Open Questions

skip: all slice-blocking questions are resolved in design.md.
