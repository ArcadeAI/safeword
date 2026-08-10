---
id: Z45MTC
slug: clarify-review-coverage
type: feature
phase: done
status: done
scope:
  - Reframe completed non-independent review as standard coverage across review-facing CLI, runtime, and host workflow language.
  - Present independent coverage as an optional actionable upgrade through quiet detail or status surfaces.
  - Preserve explicit independence requirements, raw provenance, and their unsatisfied outcomes.
  - Supply the accepted retry command when an explicit independence requirement is blocked because the author host has no CLI reviewer route.
out_of_scope:
  - Change reviewer routing, install/authentication behavior, or fallback selection.
  - Weaken any explicit `require` independence policy.
  - Rewrite GitHub pull-request advisory receipts.
done_when:
  - Standard, independent, and explicit-required coverage have distinct tested user-facing language.
  - Normal completed reviews do not emit a degradation warning merely because independent review was unavailable.
  - Explicit required independence remains visibly unsatisfied without independent evidence.
  - Required no-route host fallback receives a deterministic capable-environment recovery command instead of having to invent one.
created: 2026-08-08T01:14:45.122Z
last_modified: 2026-08-09T08:39:00.000Z
---

# Make review coverage clear without false alarms

**Goal:** Let builders trust standard review coverage while presenting independent review as a quiet, actionable upgrade.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-08T01:14:45.122Z Started: Created ticket Z45MTC
- 2026-08-08T02:25:00.000Z Complete: intake — JTBDs confirmed for normal standard coverage, optional independent coverage, and strict explicit requirements; advancing to define-behavior.
- 2026-08-08T15:01:00.000Z Complete: define-behavior — nine scenarios cover standard, independent, incomplete, optional-upgrade, explicit-requirement, and provenance partitions across all affected surfaces; advancing to scenario-gate.
- 2026-08-08T15:10:37.000Z Progress: scenario-gate — the first twelve-scenario draft passed its gate, then implementation review exposed missing malformed-domain and exact-distribution cases; the lane was expanded and returned for review.
- 2026-08-08T16:05:00.000Z Progress: scenario-gate — expanded the eleven definitions to 44 finite cases, including unsupported identities, status/verdict mismatches, policy-field preservation, prohibited host claims, and exact generated/inventory/schema asset sets; 44/44 scenarios and 1906/1906 steps pass locally and the corrected packet is under review.
- 2026-08-08T17:35:00.000Z Progress: scenario-gate — added blocked-`prefer` preservation, both remaining cross-agent requested-change directions, transitive Cursor pointer proof, and exact mandatory host safety clauses; 46/46 scenarios and 1995/1995 steps pass locally.
- 2026-08-08T17:50:00.000Z Progress: scenario-gate — added a real-process `require` lane for independent success and route failure, exact structured recovery preservation, and capable-environment host guidance; the final lane now contains 48 expanded cases.
- 2026-08-08T18:00:00.000Z Progress: scenario-gate — pinned reviewer summary/finding ordering after the coverage line for approval and requested changes, including verbose-tail behavior, and made Cursor's transitive contract/pointer assertions explicit; 50/50 scenarios and 2167/2167 steps pass locally.
- 2026-08-08T18:20:00.000Z Progress: scenario-gate — added public-CLI `require` proof for a failed external reviewer plus valid same-agent requested changes, mirrored all six recovery suggestions across Claude and Codex, and reject any completed-coverage language outside the mandatory supplemental-denial clauses; 56/56 scenarios and 2424/2424 steps pass locally.
- 2026-08-08T18:30:00.000Z Progress: scenario-gate — completed all same-agent and supported cross-agent requested-change identity edges and corrected proof claims to match the static host contract; 59/59 scenarios and 2556/2556 steps pass locally.
- 2026-08-08T18:45:00.000Z Progress: scenario-gate — added every non-eligible suggestion state, a genuinely absent assigned reviewer, and blocked quiet/JSON lanes. This exposed and fixed a renderer bug where invalid approved provenance could still receive upgrade advice; 66/66 scenarios and 2855/2855 steps pass locally.
- 2026-08-08T18:55:00.000Z Progress: implementation — focused renderer/wiring/host-parity verification passes 94/94 tests after the invalid-completion suggestion fix; generated Claude/Codex plugin assets and inventories are current at 0.74.4.
- 2026-08-09T05:24:08.000Z Complete: scenario-gate — approved after 124 expanded cases and 1993 steps passed. RED evidence included the legacy alarming degraded-review wording, invalid approved provenance still receiving upgrade advice, stale/unbuilt CLI fixture risk, and four contradictory top-level state/status tuples that were falsely presented as completed coverage. GREEN evidence covers the complete provenance/verdict/policy/failure domains, real standard and independent CLI output, required-policy recovery, machine-envelope values, and every generated host surface. REFACTOR evidence includes the extracted `review-presentation` module, atomic real-process fixtures, exact tuple-domain maps, sanitized fixture environments, and six independently diagnosable distribution facets. Claude was unavailable; the separate headless Codex reviewer approved with no findings and reported same-model independence degradation only.
- 2026-08-09T07:11:08.000Z Complete: implementation — final provenance cases bring the focused feature to 126/126 scenarios and 2027/2027 steps. The deep quality review found and fixed a fail-open reviewer-identity projection; its final rerun approved with no findings. Refactor completed the leaf-first ledger (shared tuple consistency, retryable-failure set, named distribution graph, typed fixture factories, and deduplicated assertions). Audit passed with 0 errors and 0 warnings after correcting principle metadata. Verification passed 7299 automated tests, the 1483-scenario repository Gherkin lane, build, lint, typecheck, dependency audit, release packaging, and generated-asset parity. The branch was then rebased onto main `02995b369`; the overlapping CLI lifecycle work already contained stronger host-profile isolation, and the rebased 126-case feature plus 97 focused tests passed unchanged.
- 2026-08-09T07:22:00.000Z Progress: quality-review — the post-rebase reviewer found a contradictory required-policy no-route boundary: Cursor returned no recovery while the host contract required copying one. Added the accepted `review run ... -- ...` recovery only for explicit `require`, kept `prefer` unchanged, and bound the real Cursor coordinator tuple to the host contract. RED: 1/45 focused wiring tests failed. GREEN: 45/45 tests and 127/127 focused scenarios (2042/2042 steps) pass.
- 2026-08-09T08:30:29.000Z Complete: verification — final review found and fixed missing `review_policy` on source-change/write-attempt blocked envelopes, with real-CLI coverage under both `prefer` and `require`; its rerun approved with no findings. Audit tightened one weak machine-envelope assertion to exact result codes and otherwise passed with 0 errors and 0 warnings. Final verification passed 7309 automated tests, 1489 repository scenarios (1486 passed, 3 skipped), 63877 steps (63873 passed, 4 skipped), build, lint, typecheck, dependency audit, and generated-package checks. An initial Gherkin attempt exhausted the temp volume; deleting only abandoned `safeword-*` fixtures recovered 85 GiB, and the full rerun passed.
- 2026-08-09T08:37:00.000Z Progress: quality-review — the post-verification reviewer found that the new renderer hid existing `REVIEW_ROUTES_EXHAUSTED` and `REVIEW_INDEPENDENCE_REQUIRED` explanations. The renderer now suppresses only the two findings fully replaced by successful coverage headlines and preserves actionable blocked/incomplete findings after the new first line. Real-CLI required and exhaustion assertions plus 104/104 focused protocol/package tests pass.
- 2026-08-09T08:39:00.000Z Complete: done — final quality re-review approved with no findings; the refreshed diff audit passed with 0 errors and 0 warnings; formatting, dependency boundaries, generated catalogue, package contracts, and diff integrity are clean. Ready for remote CI.
