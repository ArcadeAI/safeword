---
id: 1SVCB9
slug: rule-tier-convergence
type: feature
phase: verify
status: in_progress
scope:
  - 'Single Rule tier in all authoring surfaces: spec-template (×2), bdd DISCOVERY/SCENARIOS (×3), review-spec, guides — scaffold `#### <jtbd>.R<n>` + `@<jtbd>.R<n>`, remove the "one criteria kind, never both" doctrine and AC-as-co-equal framing'
  - 'Retire the mixed-criteria guard: delete `findMixedCriteriaJtbds` + its health issue; collapse coverage/health advisories to one Rule vocabulary (uncovered/stale/orphan worded once)'
  - 'Intake-exit gate (`jtbd.ts` ×2 byte-identical mirrors): require ≥1 Rule (or skip) per JTBD; denial names `.R<n>`'
  - 'Soft-deprecate `.AC`: keep AC ref/heading parsing + AC-wins precedence as a legacy alias (coverage + gate never block); add a plain-language deprecation advisory in `safeword check` naming the codemod'
  - 'New command `safeword migrate-ac`: rewrites `.AC<n>` → `.R<n>` across spec.md headings, `.feature` tags, legacy test-definitions.md scenario refs — same number, both sides together; idempotent, `--dry-run`, collision-aware (refuses rather than renumbers)'
  - "Migrate this repo's LIVE AC surface via the codemod (resolved: features/ + packages/cli/features/ running lanes + active in-progress specs); completed/ historical tickets left untouched"
  - 'Docs to single vocabulary: glossary AC entry, README/ARCHITECTURE/SAFEWORD.md/workflow.mdx lineage lines'
out_of_scope:
  - 'Hard removal of `.AC` parsing — deferred to a later major (grace release per #716 resolved decision)'
  - 'Personas & surfaces concepts — untouched (issue explicitly excludes)'
  - 'Migrating completed/ historical ticket specs — the health.ts-exempt pre-scheme migration case (pending Open Question A/B)'
  - 'Split-axis tags (`@job:`/`@rule:`/`@scenario:`) — already deferred by V0NHT6'
done_when:
  - 'A fresh scaffold/template/skill presents only the Rule tier; grep finds zero "one criteria kind, never both" doctrine and no AC-co-equal option in authoring surfaces'
  - 'A JTBD declaring both `.AC` and `.R` no longer raises a `safeword check` issue; `findMixedCriteriaJtbds` is deleted'
  - 'An `.AC`-only spec/feature passes the intake-exit gate and traces uncovered/stale/orphan coverage identically, and `safeword check` emits a deprecation advisory naming `safeword migrate-ac`'
  - '`safeword migrate-ac` rewrites `.AC`→`.R` across spec headings + feature tags + legacy refs (same number, both sides), is idempotent, supports `--dry-run`, and refuses a colliding JTBD; proven on fixtures'
  - "This repo's in-scope AC corpus is migrated to Rules; full suite + Gherkin acceptance lane green; hook/template mirrors byte-identical"
created: 2026-07-04T03:49:30.927Z
last_modified: 2026-07-04T03:49:30.927Z
---

# Converge spec grammar on a single Rule tier

**Goal:** Collapse the two coexisting criteria names (Acceptance Criterion + Rule) into one tier named Rule — retiring `.AC` to a soft-deprecated legacy alias with a codemod — so safeword carries a single BDD vocabulary the Gherkin tooling actually acts on.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-04T03:49:30.927Z Started: Created ticket 1SVCB9
- 2026-07-04T03:52:00.000Z Intake research: read #716 + resolved comment (soft-deprecate); mapped all AC/Rule touchpoints (core parsers, jtbd.ts ×2, health.ts, 3× skill mirrors, 2× spec-template, glossary/README/ARCHITECTURE/SAFEWORD.md, ~95 spec.md + ~39 .feature + ~27 test-definitions.md all AC-only). Authored spec.md (JTBD + Rules — dogfooding the Rule tier) + proposed engineering scope. Awaiting user signoff on JTBD/criteria/scope gates + migration-breadth question.
- 2026-07-04T04:22:00.000Z Intake gates signed off (user): migration breadth = live surface only (leave completed/ untouched); codemod name = `safeword migrate-ac`. Open Questions resolved (deprecation wording deferred to define-behavior). Cold-start check (one-way door) skipped given deep shared context and explicit proceed. Complete: intake - Understanding converged, scope established.
- 2026-07-04T04:41:00.000Z /quality-review (fresh subagent, define-behavior): verified both #716 premises against primary Cucumber sources (Example Mapping = one blue-card tier; Gherkin `Rule:` real keyword, no AC keyword). Fixed 1 vacuous SM1.R3 denial scenario + 5 coverage/AODI strengthenings → 24→30 scenarios. APPROVE.
- 2026-07-04T04:52:00.000Z Complete: define-behavior - 30 scenarios across 7 criteria (8 Gherkin Rule blocks); features/rule-tier-convergence.feature saved (lint clean, dogfooding `.R` lineage), R/G/R ledger saved, dimensions.md written.
- 2026-07-04T05:00:00.000Z Complete: scenario-gate - Independent /review-spec (Tier 2, fresh subagent): PASS WITH FIXES (0 must-fix) → 5 should-strengthen applied (SM1.R2 positive co-assertion + Rule-noun discriminator on both coverage outlines; SM1.R1 doctrine split into 2 atomic; per-file collision atomicity pinned + multi-file scenario; valid-skip-with-reason pass). impl-plan.md written (riskiest assumption = guard-delete-while-keeping-internal-AC/R-split, proved by slice 1; 7-slice build order, load-bearing coverage-collapse first). Stamp written.
- 2026-07-04T06:00:00.000Z Complete: implement - 7 slices RGR'd (coverage/guard collapse → gate rewording → legacy-AC back-compat → deprecation nudge → migrate-ac codemod → authoring-surface/docs vocabulary → repo live-surface migration). Ledger 30/30 marked with SHAs (retained-behavior scenarios skip-annotated). Full vitest suite green (4577 pass); phase0-walkthrough doc test reconciled. Gherkin acceptance lane: 277 scenarios pass — new steps/rule-tier-convergence.steps.ts (CLI-process proofs, no CLI-src import) + predecessor rule-tier.feature/steps reconciled to the converged behavior. impl-plan reconciled → implemented.
