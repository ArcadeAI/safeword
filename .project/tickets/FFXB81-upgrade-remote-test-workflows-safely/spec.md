# Spec: Upgrade remote-test workflows safely

## Intake Brief

- **Requested by:** Safeword customers opting into remote test execution.
- **Cost of inaction:** An older Safeword-managed workflow is misreported as
  customer-owned, so setup refuses to upgrade it and disable cannot remove it.
- **Reversibility:** Cross-release migration behavior is a one-way public
  compatibility commitment; each released identity must remain recognizable.

## Intent

When Safeword first changes its shipped remote-test workflow, upgrade every
previously released Safeword-owned version without adopting customer changes or
exposing partial workflow bytes.

## Activation condition

This feature remains blocked while only workflow v1 exists. It must move through
normal BDD intake before any pull request changes the released v1 workflow
bytes. HWZZJ8 preserves those exact bytes as an immutable fixture, and its
release-contract test names FFXB81 when current bytes drift.

## Preserved design evidence

- Ownership history is append-only over exact released byte sequences after the
  single CRLF-to-LF comparison normalization.
- Runtime configuration and filesystem discovery cannot add ownership history.
- Historical replacement writes and syncs a fresh private file, revalidates
  ownership, and atomically renames only over an admitted predecessor.
- Customer-owned, unsafe, absent, or indeterminate revalidation results never
  authorize replacement.
- Unknown crash residue is ignored; ordinary cleanup removes only the current
  invocation's private entry.
- H136BP's recovery feature is supporting input to this ticket and should be
  reconciled against the actual v1→v2 packaged migration before implementation.

## Jobs To Be Done

### upgrade-remote-test-workflows-safely.TBU1 — Upgrade without surrendering CI ownership

**Persona:** Technical Builder (TBU)

> When Safeword improves its remote-test workflow, I want my unedited Safeword
> workflow upgraded automatically while my own changes remain untouched, so I
> can adopt the release without re-auditing lost CI work.

#### upgrade-remote-test-workflows-safely.TBU1.R1 — Only an exact previously released Safeword workflow can authorize replacement

#### upgrade-remote-test-workflows-safely.TBU1.R2 — Upgrade interruption exposes a complete predecessor or successor and retry remains safe

## Product Inspiration

### Flyway versioned migration validation

- **Checked:** 2026-08-18
- **Reference:** https://documentation.red-gate.com/flyway/reference/commands/validate
- **Observed value:** Flyway records an applied migration checksum and refuses
  to silently adopt changed bytes.
- **Principle borrowed:** Durable exact identities distinguish known history
  from user-modified content.
- **Boundary not copied:** Safeword needs no database history table; its small,
  append-only released-workflow digest set is sufficient.
- **Decision informed:** Admit only immutable released byte identities; never
  infer ownership from a marker or runtime configuration.

## Surfaces

- Affected: Safeword CLI
- Affected: GitHub Actions Execution Sandbox

## Rave Moment

skip: Internal child migration beneath the remote-testing epic; the parent owns
the persona-facing moment.

## Outcomes

- Every released predecessor remains recognizable.
- Edited or unknown bytes remain customer-owned.
- The packaged CLI proves the real predecessor-to-successor migration.
- A failed or interrupted upgrade never exposes partial workflow bytes.
- History retirement requires an explicit migration decision.

## Open Questions

None. V2 delegates dependency preparation to project configuration; v1 needs
only an exact-byte identity migration.
