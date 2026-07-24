# Dimensions — portable-tracker-transport (CBTDK8)

Behavioral variables derived from scope + done-when; each partition (or its boundary) seeds a
scenario in define-behavior.

| Dimension          | Partitions                                                                                          | Notes                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Command mode       | `--plan` · `--apply-results <file>` · no-flag (gh path) · both flags                                 | `--plan`/`--apply-results` mutually exclusive (both → error); no-flag = today's gh path, untouched. |
| Diff state → kind  | ticket absent from map → `create` · recorded → `update` · terminal status → `close`                 | Reuses `planTicketSync`; the plan is the existing decision minus writer dispatch.                   |
| Graph edges        | none · parent only · blocked-by only · both                                                          | Carried by **ticket id** on create/update intents; executor links create-then-link.                |
| Edge resolvability | referenced ticket is in the plan/map (resolvable) · referenced ticket absent (dangling)              | Dangling edge → surfaced/skipped, never a crash; resolution is the executor's, after creates land.  |
| Results validity   | well-formed create result · idempotent re-apply (no-op) · malformed                                 | Malformed = bad JSON / missing `ticketId`\|`number` / `ticketId` not in corpus / `url` tail ≠ `number`. |
| Map fold outcome   | create result → `recorded` (number+url) · update/close result → ack, no map change                  | Internal-id trap guarded structurally by the url-tail==number check.                                |
| Offline invariant  | `--plan` makes zero network calls · `--apply-results` makes zero network calls                       | Neither resolves a credential; the credential gate stays on the live executor path only.            |
| Egress discipline  | `body: minimal` default (title/status/labels/back-link) · no secret in the emitted JSON             | Same allow-list the gh path already honors; never the spec or work-log.                             |

- **Happy path:** a fresh corpus with one create + one update + a parent edge → `--plan` emits the
  intents (no network); an executor applies them and returns results; `--apply-results` records the
  create's bare number+url and the map matches what the gh path would have produced.
- **Must-cover boundaries:** both-flags → error; malformed results (each variant) → actionable error,
  map untouched; re-apply same results → no-op; `url` tail ≠ `number` → rejected (internal-id trap);
  dangling edge → no crash; no-flag invocation → gh path byte-for-byte unchanged.
- **Inherited / not re-tested here:** the create/update/close *decision* (`planTicketSync`) and the
  ticket→payload mapping (`buildPayload`) are existing, tested units — reused, not re-proven; the
  live `gh` adapter stays the untested-by-unit shim ("no live tracker in tests", #363).
- **Out of frame:** token+REST CI executor, packaged agent automation, Linear, label-rejection
  hardening (follow-on children).
