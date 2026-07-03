---
id: V0NHT6
slug: rule-tier
type: feature
phase: scenario-gate
status: in_progress
scope:
  - 'spec.md grammar: `#### <jtbd-id>.R<n> — <invariant>` Rule headings parsed alongside AC headings (per-JTBD substitute — a JTBD carries ACs or Rules, never both); declaring Rules is the opt-in, no config flag'
  - 'lineage: `@<jtbd-id>.R<n>` combined tag recognized by the ref parser and the exactly-one-lineage-tag lint (AC ref or R ref both satisfy it; AC-match wins precedence); the `.feature` `Rule:` block carries the tag (authoritative — scenarios inherit it) and repeats the ID as its name''s first token, mismatch is a lint issue'
  - 'coverage: rule buckets (uncovered / stale / orphan) in `safeword check` advisories, plus a zero-rejection-path advisory per numbered Rule via the `@rejection` tag convention; R refs are `.feature`-only (legacy test-definitions title path stays AC-only)'
  - 'mixed-JTBD guard: a JTBD declaring both ACs and Rules is a `safeword check` issue naming the JTBD (gate stays fail-open)'
  - 'intake-exit gate: hook-side `jtbd.ts` mirror accepts ≥1 AC or ≥1 numbered Rule (or `skip:`) per JTBD, with the denial message naming Rules as an option'
  - 'templates + docs: spec-template, bdd DISCOVERY/SCENARIOS, review-spec updated with the tier, including the documented migration mapping (Arcade split-tag spelling → combined tag); hook-side mirrors kept byte-identical to templates'
out_of_scope:
  - 'split-axis tags (`@job:` / `@rule:` / `@scenario:`) — deferred compat follow-up; combined tag only in v1'
  - 'hard numbering-lock enforcement — follow-up anchored to NMSD94 review stamps; v1 ships stale/orphan drift advisories'
  - 'automated migration codemod for the Arcade corpus — documented tag-spelling mapping only'
  - 'ZRMDKD blocking-gate port — its ticket gains a tier-awareness requirement, not implemented here'
  - 'post-done `measured` state — separate filing per issue #649'
done_when:
  - 'a spec whose JTBD declares R headings and no ACs passes the intake-exit gate with a denial message that names Rules when neither kind is present; a JTBD declaring both kinds surfaces the check issue naming it'
  - 'a feature file whose `Rule:` blocks carry the `@<jtbd-id>.R<n>` tag passes lineage lint via inherited R tags (tag authoritative; name-token mismatch is a lint issue; a tag ending `.AC<n>` never parses as an R ref); repos with no R headings produce unchanged check output (existing suite green, untouched fixtures byte-identical)'
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
- 2026-07-03T20:20:00.000Z /quality-review (2nd invocation, fresh-context reviewer): pass 1 → 1 critical (mixed AC+R JTBD undefined) + 5 improvements; all applied (TB1.AC4, tag-authoritative decision, AC-wins ref precedence, .feature-only R refs, migration-mapping scope owner, de-vacuoused done_when). Pass 2 → APPROVE, no criticals.
- 2026-07-03T20:22:00.000Z Complete: intake - Understanding converged, scope established. AC + scope gates signed off (user "go"); cold-start check offered (one-way door) and declined.
- 2026-07-03T20:36:00.000Z Amendment at decider gate: NTB persona + rule-tier.NTB1.AC1 (plain-language actionable messages) + message-contract dimension added on user prompt; scenario set re-presented and accepted ("go").
- 2026-07-03T20:41:00.000Z Complete: define-behavior - 18 scenarios defined across 8 rules; features/rule-tier.feature saved (lint clean), R/G/R ledger saved.
