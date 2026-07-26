---
id: 4PCMAE
slug: parity-order-assertion
type: task
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1463
scope:
  - "recordingWriter records ONE ordered call log so the live path's true interleaved call sequence is recoverable (creates/updates/graphs are separate arrays today, so concatenating them reconstructs rather than records the order)"
  - the ordering test compares the plan's intent sequence against the live path's actual call sequence — the property its name claims
  - test name and comments describe exactly what is asserted
out_of_scope:
  - production behavior — computePlan and the gh path already share orderTicketsForProjection and agree; this is a test-strength fix only
  - the other parity assertions (kind/ref/payload/graph), which are already sound
done_when:
  - "a plan whose order differs from the live path's fails the ordering test (verified by mutation: rotating plan intents while preserving parent-before-child passes green today)"
  - reversing the projection sort on either side fails the test
  - full tracker-sync suite green; lint + typecheck clean
created: 2026-07-26T02:49:40.472Z
last_modified: 2026-07-26T02:49:40.472Z
---

# plan-gh-parity: assert plan order against live order, not just membership

**Goal:** Make `plan-gh-parity.test.ts`'s ordering test actually compare plan order against live order — today it computes `liveOrder` and then discards the order in a `Set` comparison, so it reads as coverage it doesn't provide (#1463).

**Why:** This is the named-but-weaker shape safeword's own invariant-binding lens (#1433) exists to flag — a test whose title names an invariant while its assertions establish something weaker, so it reads as coverage. Worth fixing in the codebase that ships that lens.

## Work Log

- 2026-07-26T02:49:40.472Z Started: Created ticket 4PCMAE
- 2026-07-26T02:55:00.000Z Investigated #1463 and confirmed it empirically before fixing: a mutant that rotates plan intents (order genuinely differs from live, parent-before-child preserved) passed all 5 tests GREEN. The ordering test computed `liveOrder` and then discarded it in a Set comparison, so its two index assertions were internal to planOrder only — it could not fail on cross-path divergence.
- 2026-07-26T02:56:00.000Z Fixed: recordingWriter now records ONE ordered call log (WriteCall[]) instead of separate creates/updates arrays, so the live path's real interleaved sequence is recoverable rather than reconstructed. The ordering test asserts `planOrder` equals `liveWriteOrder(live)` exactly, plus the dependency-first property. Renamed to 'emits intents in the exact sequence the live path wrote them' so name == assertion. Mutation-verified: (A) the rotate mutant that previously passed now fails, (B) reversing the sort on the plan side fails, (C) reversing the shared sort fails too. 138 tracker-sync tests green; lint + typecheck clean. Production code untouched — the two paths already agreed.
