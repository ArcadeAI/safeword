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

## Activation

The stack-neutral workflow revision created v2 and activated this ticket before
release. HWZZJ8 preserves the distinct released v1 bytes as an immutable fixture,
and its release-contract test names FFXB81 whenever current bytes drift again.

## Preserved design evidence

- Ownership history is append-only over exact released byte sequences after the
  single CRLF-to-LF comparison normalization.
- Runtime configuration and filesystem discovery cannot add ownership history.
- Historical replacement writes and syncs a fresh private file, revalidates
  ownership, and atomically renames only over an admitted predecessor. Rename is
  the commit point: failure before it preserves the predecessor; success exposes
  the complete successor.
- Deterministic test adapters may pause after preparation, after classification,
  or at publication; these are explicit proof seams, not runtime controls.
- Customer-owned or indeterminate historical revalidation results never
  authorize replacement or removal. Current Safeword bytes and absence converge
  as setup success; both remain successful terminal states for disable.
- Unknown crash residue is ignored; ordinary cleanup removes only the current
  invocation's private entry.
- H136BP's recovery design was reconciled against the actual v1→v2 packaged
  migration.

## Jobs To Be Done

### upgrade-remote-test-workflows-safely.TBU1 — Upgrade without surrendering CI ownership

**Persona:** Technical Builder (TBU)

> When Safeword improves its remote-test workflow, I want my unedited Safeword
> workflow upgraded automatically while my own changes remain untouched, so I
> can adopt the release without re-auditing lost CI work.

#### upgrade-remote-test-workflows-safely.TBU1.R1 — Only exact released Safeword workflows authorize managed lifecycle changes

#### upgrade-remote-test-workflows-safely.TBU1.R2 — Interrupted upgrades expose complete predecessor or successor bytes and retry safely

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

## Rave Moment

skip: Internal child migration beneath the remote-testing epic; the parent owns
the persona-facing moment.

## Outcomes

- Every released predecessor remains recognizable.
- Edited or unknown bytes remain customer-owned.
- The packaged CLI proves the real predecessor-to-successor migration through
  HWZZJ8's release-contract wiring test.
- A failed or interrupted upgrade never exposes partial workflow bytes.
- History retirement requires an explicit migration decision, enforced by
  HWZZJ8's release-contract test rather than an acceptance scenario here.

## Delegated lifecycle boundaries

HWZZJ8 owns first-time setup, already-current setup, absent disable, and unsafe
path handling for both setup and disable. FFXB81 covers only behavior introduced
by a distinct historical predecessor: identity admission, revalidation,
atomic replacement, and retry.

## Open Questions

None. V2 delegates dependency preparation to project configuration; v1 needs
only an exact-byte identity migration.
