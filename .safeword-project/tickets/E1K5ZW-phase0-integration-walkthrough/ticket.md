---
id: E1K5ZW
slug: phase0-integration-walkthrough
type: task
phase: done
status: done
epic: bdd-phase-zero-merge
created: 2026-05-31T01:35:26.075Z
last_modified: 2026-05-31T04:39:33.277Z
---

# DZ2NM5 integration: end-to-end Phase 0 worked example + demo

**Goal:** Close out DZ2NM5's two epic-level integration deliverables — a DISCOVERY.md worked example that exercises **all four** Phase 0 artifact types (persona refs → JTBDs → ACs → engineering scope, plus the scenario-lineage numbering) in one walkthrough, and an end-to-end test (or example ticket) demonstrating the merged Phase 0 flow.

**Why:** Each child shipped its own slice of DISCOVERY.md / SAFEWORD.md, but no artifact yet shows the four layers working together. DISCOVERY.md's current "Concrete example" (line ~81) is engineering-scope only (a `--verbose` flag) — it predates the merge. The epic's done-when requires a unified walkthrough + an e2e demo; without a ticket they fall through the cracks when the last two children (B0JZQN, 1J6JKP) close.

**Parent epic:** DZ2NM5

**Depends on:** the product-layer children (7YN5QB, YR6C49, Y2HCNJ, 31W8M3, XT1FFM, K7N2QM) — all done. Does NOT depend on B0JZQN or 1J6JKP (signoff gates / lint hygiene are orthogonal to the worked example); if B0JZQN lands first, fold its gate turns into the walkthrough.

## Scope

- Replace or augment DISCOVERY.md's single-artifact "Concrete example" with a unified walkthrough: one feature, showing persona reference → JTBD ("When I…, I want…, so I can…") → AC under the JTBD → engineering scope/done-when → a numbered Phase-3 scenario title (`<jtbd-id>.AC<#>.<scenario_name>`).
- Update SAFEWORD.md's Phase 0 narrative to reflect the merged four-artifact flow end-to-end (it currently mentions the pieces but not as one arc).
- Add an end-to-end demo: an integration test (or a checked-in example ticket fixture) that walks a feature ticket through the new flow — spec.md scaffold → JTBD/AC gates → numbered scenarios → `safeword check` coverage report — proving the layers compose.
- Keep canonical `templates/` and the `.safeword//.claude/` mirrors in sync.

## Out of scope

- New Phase 0 behavior — all of it shipped in the children; this is documentation + a demonstrating test only (hence task, not feature).
- B0JZQN's signoff-gate dialogue and 1J6JKP's lint fixes — separate children.

## Done when

- DISCOVERY.md has a worked example exercising all four artifact types in one walkthrough.
- SAFEWORD.md Phase 0 narrative reflects the merged flow.
- An e2e test or example-ticket fixture demonstrates the flow end-to-end and is green.
- Full suite + lint green; mirrors synced.
- With this done, DZ2NM5's epic-level done-when is satisfied (only B0JZQN + 1J6JKP children remain).

## Work Log

- 2026-05-31T01:35:26.075Z Started: Created ticket E1K5ZW
- 2026-05-31T01:36:00.000Z Drafted: Carved out of DZ2NM5's unticketed epic-level integration deliverables (worked example + e2e demo), found during the Phase-0 revalidation pass. Sized task (docs + demo test, no new behavior). Depends only on the done product-layer children.
- 2026-05-31T04:39:33.277Z Complete: Shipped both deliverables. (1) DISCOVERY.md "Worked example: Phase 0 end to end" capstone replaces the engineering-scope-only `--verbose` example — one feature (`oauth-flow` / Platform Operator) walked through persona ref → JTBD → AC → engineering scope → numbered Phase-3 scenario + `safeword check` coverage advisory, with B0JZQN sub-phase gates (JTBD/AC/Scope gate) at each transition. (2) SAFEWORD.md Clarify exit reordered into one arc (personas → JTBD → AC → scope → scenario lineage), `personas.md` anchor added. (3) `tests/integration/phase0-walkthrough.test.ts` drives the real pre-tool-quality hook + `safeword check` over one ticket (spec scaffold → JTBD/AC gates → numbered scenarios → coverage clears) + describe.each doc-presence guard over canonical+dogfood. Verified: test:done 209/209, demo 11/11, parity 13/13, build OK, lint clean, mirrors byte-identical; /audit + /verify passed. Committed 9a8b1631.
