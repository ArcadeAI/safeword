---
id: 4PCMAE
slug: parity-order-assertion
type: task
phase: done
status: done
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
- 2026-07-26T03:10:00.000Z Independent review returned REQUEST CHANGES on my own fix and was right on all counts. MUST-FIX: my refactor DROPPED a vacuity guard main had — removing `expect(parentIndex).toBeGreaterThanOrEqual(0)` meant a drifted parent title read as `3 > -1`, a silent pass; on that axis my fix was weaker than what it replaced. Restored via explicit toContain assertions. Also fixed: a comment in test 1 still claimed ORDER while the code compares sets (order now lives in the sequence test); the dependency-first comment said 'a parent is created before...' but the fixture's parent was pre-recorded, so the real executor hazard was never exercised — added a FRESH parent/child pair listed child-first; the recordingWriter docstring said 'every writer call' when projectGraph logs separately.
- 2026-07-26T03:12:00.000Z Reviewer's mutant E (sort ignores dependsOn/blockedOn) survived THREE fixture attempts — its suggested fix (add a dependsOn ticket) is insufficient on its own, because both paths share the sort so parity moves together, and my first blocker fixtures were satisfied by corpus position or pulled into place by an existing parent edge. Probed the real orderings to find it, then added a blocker pair whose target is reachable ONLY via the dependsOn edge, plus an absolute (non-parity) ordering assertion. All five mutants now fail: rotate plan order, reverse plan-side sort, reverse shared sort, drop blocker edges, drift a fixture title. 138 tracker-sync green; lint + typecheck clean.
- 2026-07-26T03:47:27.489Z Phase: intake → verify
- 2026-07-26T03:48:00.000Z verify: verify.md written. Full suite 5459 pass / 7 skipped / 369 files, 1 failure (self-report root-chmod, environmental, fails identically on clean main b68d2d7). Full-repo lint (eslint + lint-gherkin + tsc --noEmit) zero output. Ran the two golden-path integration failures to ground: they FAILED in a targeted 3-file run on clean main and PASSED in the full run on this branch — same code, opposite outcomes, so they are FLAKY, not a property of either tree, and not caused by this diff. Recorded as an evidence limit and a follow-up ticket candidate rather than re-run until green.
- 2026-07-26T03:47:49.937Z Phase: verify → done
- 2026-07-26T03:52:00.000Z Complete: verify → done. All three done_when met: (1) a plan whose order differs from live now fails the ordering test — mutant A, which passed pre-fix, fails; (2) reversing the projection sort fails on either side — mutants B and C; (3) tracker-sync 138 green, lint + typecheck clean. Two mutants beyond the ticket's done_when also fail (E: sort ignores blocker edges; H: fixture title drift), the latter restoring a vacuity guard the first cut had dropped.
