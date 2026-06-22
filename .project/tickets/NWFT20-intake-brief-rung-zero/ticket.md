---
id: NWFT20
slug: intake-brief-rung-zero
type: task
phase: implement
status: in_progress
epic: pm-grade-intake
parent: '169'
created: 2026-06-22T13:39:25.521Z
last_modified: 2026-06-22T13:39:25.521Z
scope:
  - Add a `## Intake Brief` section (requester, cost-of-inaction, reversibility/regret) to the feature-spec template
  - Add an "Author Intake Brief" rung-0 step to DISCOVERY.md, before "Author Jobs To Be Done", and fold its confirmation into the existing JTBD sub-phase gate (with a feature-vs-task triage question)
  - Features only; advisory (content-or-`skip:` per field) — no new gate
out_of_scope:
  - A separate intake-brief.md artifact (rejected — parallel file + duplication for a single-user agent)
  - A new fifth intake sub-phase or hard gate (rejected — adds friction to an already multi-step intake)
  - Hardening into a hook-enforced gate (deferred — start advisory)
  - Restating content the spec already holds (persona, problem/JTBD, AC, done_when)
done_when:
  - The feature-spec template carries a `## Intake Brief` with the three fields
  - DISCOVERY.md authors the brief as rung 0 and confirms it at the JTBD gate, including the feature-vs-task triage question
  - Tasks and patches are unaffected (no brief required)
---

# Intake brief as rung-0 framing in BDD intake (epic 169)

**Goal:** For substantial features, capture a tiny written intake brief (who asked · cost of inaction · reversibility) at the top of the spec — the durable "should we build this, and is it worth the risk?" framing — woven into the existing intake ladder without adding a stop.

**Why:** Epic 169's goal is "an intake brief, not just frontmatter." TPP6Y2 shipped the in-the-moment readiness pointer; this persists the case for substantial work so it's reviewable. GitHub issue #330.

## Decision (from two /figure-it-out passes)

**Revalidation:** the spec already captures persona, user problem (JTBD), AC, constraints, and `done_when` (success metric). Only three fields are genuinely new — **requester** (≠ persona served), **cost-of-inaction** (what changes if we don't build it), and a **persisted reversibility/regret read** (the pointer raises it live; nothing records it). So this is three fields added to the spec, not a parallel artifact.

**Integration (jive with BDD):** the intake ladder is personas/glossary → JTBD → AC → scope, each with a present-ask-wait gate. The brief is the decide-to-build framing that logically precedes JTBD, so it slots in as **rung 0** — a `## Intake Brief` at the top of `spec.md`, authored first, **confirmed at the existing JTBD gate** (no new gate; intake stays four stops). Its one job is **triage**: low cost-of-inaction + high reversibility → "is this even a feature, or a task?" — so it can shrink the work, not just add a step.

- Rejected a separate `intake-brief.md` (parallel file + duplication) and a new 5th sub-phase/gate (friction).
- Features only; advisory (content-or-`skip:`), matching the personas/glossary/open-questions soft-prompt precedent.

**Premortem:** fails if the brief becomes a perfunctory paragraph that never changes the path — mitigate by making the JTBD-gate confirmation include the feature-vs-task triage question, so it earns its place by sometimes right-sizing the work.

## Work Log

- 2026-06-22T13:39:25.521Z Started: Created ticket NWFT20
- 2026-06-22T13:39Z Scoped from #330 + two /figure-it-out passes (revalidation → 3 new fields; integration → rung-0, confirmed at JTBD gate, no new gate). Frontmatter scope/out_of_scope/done_when set. Advisory, features-only. Ready to run /bdd.
