---
id: N0W5KG
slug: audit-domain-docs-freshness
type: feature
phase: done
status: done
scope: |
  Add a "Namespace domain docs" subsection to /audit SKILL.md Section 5
  (Project Documentation Checks) — pure prose + bash, no new CLI code — that
  checks personas.md / surfaces.md / glossary.md for:
    - Emptiness: zero `##` entries (template scaffold only) → W008 + offer to
      fill from packages/cli/templates/<doc>-template.md, naming the path and
      the stake (BDD intake references degrade until filled). Report-only; no
      writes in the audit pass.
    - Surface drift: an @surface.<slug> tag in features/** with no matching
      `##` heading in surfaces.md → E008.
    - Persona drift: a persona code named in a comment-stripped ticket spec.md
      **Persona:** … (CODE) line, absent from personas.md → E009. (Feature
      lineage-tag source dropped — field-2 ticket-ID noise.)
  Sync all three byte-identical audit SKILL.md mirrors (.claude/skills,
  .agents/skills, packages/cli/templates/skills).
out_of_scope: |
  - New `safeword check` subcommand or CLI code (health.ts already validates
    personas/glossary STRUCTURE; this check must not duplicate it).
  - Any gating/blocking (audit reports; done-flip unaffected).
  - Auto-mutating the docs (fill happens only on user yes, outside the pass).
  - Term-by-term glossary/persona CONTENT staleness heuristics — human-curated,
    advisory warn only, never an error (R4).
done_when: |
  - Section 5 has the domain-docs subsection covering emptiness + surface drift
    + persona drift, with codes W008 / E008 / E009 and the R4 advisory rule.
  - Running /audit on this repo reports the live @surface.safeword-cli gap as E008.
  - A verbatim scaffold (zero `##` entries once HTML comments are stripped) is
    reported W008 with a fill offer.
  - A fully-populated, in-sync FIXTURE produces zero domain-doc findings. (This
    repo legitimately emits E009 `DEV` + E008 `safeword-cli` — real drifts.)
  - Human-curated content is never reported as an error.
  - All three audit SKILL.md mirrors are byte-identical.
created: 2026-07-13T19:07:06.009Z
last_modified: 2026-07-13T19:07:06.009Z
---

# Audit checks namespace domain docs for emptiness and drift

**Goal:** {One sentence: what are we trying to achieve?}

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-13T19:07:06.009Z Started: Created ticket N0W5KG
- 2026-07-13T19:25:14.458Z Phase: intake → define-behavior
- 2026-07-13T19:27:55.049Z Phase: define-behavior → scenario-gate
- 2026-07-13T19:37:05.626Z Phase: scenario-gate → plan-implementation
- 2026-07-13T19:58:42.766Z Phase: plan-implementation → implement
- 2026-07-13T20:13:59.532Z Phase: implement → verify
- 2026-07-13T20:45:28.465Z Phase: verify → done
