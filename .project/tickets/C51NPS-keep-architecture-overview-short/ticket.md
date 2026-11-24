---
id: C51NPS
slug: keep-architecture-overview-short
type: task
phase: done
status: done
created: 2026-11-23T18:08:35.178Z
last_modified: 2026-11-23T18:08:35.178Z
---

# Keep the architecture overview short for maintainers and reviewers

**Goal:** Move durable decisions into linked records and keep the architecture overview small enough for normal planning reviews.

**Why:** ARCHITECTURE.md reached 264,903 bytes and blocked formal planning review for YCFFNC and BSHVDP.

## Scope

- Keep `ARCHITECTURE.md` as a short map of current components, boundaries, and cross-cutting rules. Begin by moving Key Decisions into linked architecture decision records (ADRs). Preserve stable references and superseded decisions.
- Add a lightweight repository check. Proposed thresholds are a warning at 32 KiB and a CI limit of 64 KiB. Confirm the thresholds against the trimmed document before adopting them.
- Verify that formal plan review can package the overview and the cited decision records, and that missing references produce a clear error. Track any generic review-loader change separately if necessary.

## Out of scope

- Changing generated architecture documentation or rewriting feature plans.
- Raising the packet limit or silently dropping required architecture context.

## Done when

- The overview is below the chosen budget, maintainers can find each decision and its rationale, and moved links resolve.
- An oversized overview produces an actionable CI failure.
- A normal BSHVDP plan-review packet clears architecture size validation with its relevant records intact.

## Evidence

The blocked review tried to load 264,903 bytes from one file. The per-file limit was 262,144 bytes. The overview had 21,545 words. Key Decisions accounted for 15,944 words and 207,735 bytes. Both YCFFNC and BSHVDP failed before reviewer dispatch. [8JMV3Q](../8JMV3Q-architecture-guide-state-vs-adr-split/ticket.md) completed the guide split and is related prior work.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-23T18:08:35.178Z Started: Created ticket C51NPS

- 2026-11-23 Verified the 10,726-byte overview against the former 264,903-byte file. All 71 heading anchors survive and the local links in the overview and records resolve. CI warns at 32 KiB and fails above 64 KiB. Checked both boundaries at adjacent byte counts.
- Prepared an owned plan-implementation packet against copies of BSHVDP's original ticket, plan, and scenarios, using the normal dispatch contract. The serialized packet was 95,372 bytes. The configured overview and the explicit digest-bound ledger and semantic provenance records matched their source bytes. No reviewer dispatch was required.
- The loader rejects a missing explicit context file with a generic readability error. [YGH23C](../YGH23C-include-cited-architecture-records/ticket.md) tracks automatic citation capture and a path-specific diagnostic. The BSHVDP plan still describes its proposed approval change as pending.
- The planning documentation, implementation-plan document, monorepo architecture, and architecture reconciliation suites passed (108 tests).
- Fetched origin/main at 461480772, identical to the worktree base. Audited 47 records and split local PR completion and terminal handoff into separate records. The resulting 49 records total 126,911 bytes, down from 263,834. All 71 original overview anchors and 141 local links passed validation.
- Rebuilt the BSHVDP plan-implementation packet with both explicit decision records. The packet was 89,905 bytes and all three architecture inputs matched their source files. Six targeted suites passed (184 tests), including route outcomes, receipt admission, and generated architecture reconciliation.
