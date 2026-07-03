---
id: V0NHT6
slug: rule-tier
type: feature
phase: intake
status: in_progress
scope:
  - 'spec.md grammar: `#### <jtbd-id>.R<n> — <invariant>` Rule headings parsed alongside AC headings (per-JTBD substitute — a JTBD carries ACs or Rules, never both); declaring Rules is the opt-in, no config flag'
  - 'lineage: `@<jtbd-id>.R<n>` combined tag recognized by the ref parser and the exactly-one-lineage-tag lint (AC ref or R ref both satisfy it); `.feature` `Rule:` block names carry the ID as their first token'
  - 'coverage: rule buckets (uncovered / stale / orphan) in `safeword check` advisories, plus a zero-rejection-path advisory per numbered Rule via the `@rejection` tag convention'
  - 'intake-exit gate: hook-side `jtbd.ts` mirror accepts ≥1 AC or ≥1 numbered Rule (or `skip:`) per JTBD'
  - 'templates: spec-template, bdd DISCOVERY/SCENARIOS, review-spec updated with the tier; hook-side mirrors kept byte-identical to templates'
out_of_scope:
  - 'split-axis tags (`@job:` / `@rule:` / `@scenario:`) — deferred compat follow-up; combined tag only in v1'
  - 'hard numbering-lock enforcement — follow-up anchored to NMSD94 review stamps; v1 ships stale/orphan drift advisories'
  - 'automated migration codemod for the Arcade corpus — documented tag-spelling mapping only'
  - 'ZRMDKD blocking-gate port — its ticket gains a tier-awareness requirement, not implemented here'
  - 'post-done `measured` state — separate filing per issue #649'
done_when:
  - 'a spec whose JTBD declares R headings and no ACs passes the intake-exit gate and test-definitions creation'
  - 'a feature file with ID-carrying Rule blocks passes lineage lint via inherited R tags; repos with no R headings produce unchanged check output (existing suite green, untouched fixtures byte-identical)'
  - '`safeword check` reports rule uncovered/stale/orphan and zero-rejection-path advisories on fixtures'
  - 'templates ship the grammar; hook/template parity and full suite green'
created: 2026-07-03T16:49:49.260Z
last_modified: 2026-07-03T17:15:00.000Z
---

# Numbered Rule tier between JTBD and scenarios

**Goal:** Add an optional numbered-Rule tier (`<jtbd-id>.R<#>`) to the scenario lineage so specs carry an invariant catalog with stable IDs, tier-aware checks, and expressiveness for Arcade's existing rule-numbered corpus (issue #649).

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-03T16:49:49.260Z Started: Created ticket V0NHT6
- 2026-07-03T16:55:00.000Z /quality-review pass 1 (fresh-context reviewer): 2 criticals (enforcement-stack interaction incl. ZRMDKD; numbering-lock mechanism) folded into spec; pass 2 APPROVE, nits applied.
- 2026-07-03T17:11:00.000Z JTBD gate passed: user confirmed 4 jobs + substitute-per-JTBD coexistence ("go").
- 2026-07-03T17:15:00.000Z Intake decisions recorded in spec.md (tag scheme, catalog source, opt-in, @rejection convention, gate acceptance, enforcement-stack landing, numbering-lock v1); 2 deliberate defers kept in Open Questions; ACs authored; engineering scope drafted — AC + scope gates pending user signoff.
