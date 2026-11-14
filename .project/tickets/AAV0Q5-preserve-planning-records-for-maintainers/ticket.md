---
id: AAV0Q5
slug: preserve-planning-records-for-maintainers
type: patch
phase: done
status: done
scope:
  - preserve the existing unfinished 5GK1CN planning packet and its historical review evidence
  - preserve the 4200 completion inventory and critical-path handoff with their explicit limits
  - label preservation as distinct from implementation, scenario approval or completion credit
out_of_scope:
  - importing implementation from codex/t0fk4h-current-proof
  - implementing recovery, changing eligibility, running qualification or changing review routes
  - changing converter dependencies, deferred cases or historical RED and failure evidence
done_when:
  - preserved source records remain intact and the EP9 feature remains wip with unchecked ledger rows
  - changed JSON and Markdown and Gherkin validate without importing production files
  - independent review and current-head verification support the preservation-only delivery
created: 2026-11-13T23:02:11.526Z
last_modified: 2026-11-13T23:02:11.526Z
---

# Preserve unfinished planning and epic evidence for maintainers

**Goal:** Save the existing EP9 planning packet and epic proof records without importing implementation or granting completion credit

**Why:** User asked to push and merge the separately saved records before closing the session

## Work Log

- Preservation packet pushed as Draft PR #7368 on a fresh main-based branch, excluding the old implementation. Source packet byte comparison, 13 JSON parses, @wip and all 52 unchecked rows are verified. Historical/current handoff labels were clarified; no original evidence verdict changed.
- Independent reviews 9bf71921 and b705e3de approved bounded preservation; intake stamp earned. Partial review 899409db could not earn implement coverage, so full 33-file review 80de6945 was run and approved; its actual cross-agent Claude/opus receipt earned the implement stamp. No 5GK1CN scenario approval or completion granted.
- Complete local verification exited 1: both CLI passes (724 files / 11648 passed / 14 skipped), 599 acceptance scenarios, 52 proof checks, builds/typechecks pass, but raw Bun audit reports two inherited Astro advisories. The initial two-file Astro candidate was rejected for root Vite/Zod pins below its declared minima. A corrected, unpublished three-file candidate (Astro 7.4.7, Vite 8.3.5, Zod 4.6.7 and lock) passes audit, website build/typecheck, workspace typechecks and a Vitest compatibility smoke; generated surfaces remain current and independent review c59ee74c approves. It is not included here. Keep verify/in_progress, no Ready or merge while blocked. Converter dependencies unchanged; all missing RED, failures and 33 deferred cases retained.

- Followthrough: separate dependency PR #7397 merged as 3eb5b6f0a after final-head CI passed. Main also contains #7215's presented-plan approval fix; merged main normally, preserving a records-only 34-file diff. Its integration test passes 47/47. Full re-verification retains aggregate exit 1: CLI passes have 7 and 2 failed tests; acceptance 599/599, proof 52/52, builds/types and raw audit pass. Focused rerun passes 186/187; only the native OpenCode version probe still times out locally. No test, timeout or assertion was changed. Final independent review and final-head CI remain required before Ready/merge; historical failures, missing RED, 52 unchecked rows and all 33 deferrals remain intact.

- 2026-11-13T23:02:11.526Z Started: Created ticket AAV0Q5
