---
id: 2K46FG
slug: spec-revision-discipline
type: feature
phase: intake
status: backlog
created: 2026-05-31T15:49:36.570Z
last_modified: 2026-05-31T15:49:36.570Z
---

# Spec-revision discipline — safeword equivalent of arcade /update-spec

**Goal:** Give safeword a disciplined way to revise a ticket's `spec.md` / `test-definitions.md` after it has reached define-behavior or beyond, instead of ad-hoc editing — deliberate-the-change-before-writing, reset the phase appropriately, and flag the downstream artifacts that go stale.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes (run intake when picked up).

## Why

Discovered during the DXFX02 revalidation (arcade-side Phase-0 adoption). Arcade's `/update-spec` skill is the only sanctioned way to change a spec after authoring; it enforces three things safeword has no equivalent for:

1. **Deliberate-before-write** — present the proposed change and wait for approval before touching the file.
2. **Status reset** — a change-type → status-reset table (new JTBD → back to draft; scenarios changed → re-run codify; AC reworded → no reset). Safeword's phase machine moves forward; there's no codified "a late scenario change resets you to scenario-gate" rule.
3. **Spec-gap vs code-bug triage** — refuse to edit a correct spec to match buggy code (that codifies the bug); fix the code instead.

Safeword today has no skill that owns post-authoring spec revision with these guarantees. When a bug, incident, or requirement change reveals a ticket's `spec.md`/`test-definitions.md` is wrong, the agent edits in place with no discipline around status reset or downstream sync.

## Scope (sketch — refine at intake)

- A revision flow (skill or bdd sub-step) that: distinguishes spec-gap from code-bug, proposes the change before writing, resets the ticket phase per a change-type table, and flags stale downstream artifacts (test-definitions.md, implementation, any coverage report).
- **Resolved by the 2026-05-31 cross-repo investigation (was an open question):** safeword's phase machine does **not** cover this. The phase gate (`pre-tool-quality.ts`) is forward-only — it blocks writing scenarios too early but never resets phase backward when `spec.md`/`test-definitions.md` is edited after define-behavior. So the three guarantees split by enforcement surface:
  - **Propose-before-write** + **spec-gap-vs-code-bug triage** → conversational discipline; a skill/guide suffices (the `debug` skill is the nearest model, but it never asks "is the spec wrong?").
  - **Status/phase reset on edit** → has **zero** enforcement surface today, and every other load-bearing phase boundary in safeword is hook-enforced. A pure guide here would be the only unenforced phase transition in the system. This guarantee likely needs a **reset-on-edit hook** — which is what makes this a true `feature` (matching its sizing) rather than a thin guide.

## Out of scope

- Arcade's `.feature`/step-def regeneration on revision — that's the Gherkin-codification layer (safeword backlog 102-gherkin-executable-specs), not this.

## Related

- **5JN5E4** (revalidate-ticket-on-pickup) — the **detection half of the same seam**: 5JN5E4 detects premise drift at pickup and recommends "proceed / re-scope / close"; 2K46FG is the disciplined _execution_ of that re-scope. Build 2K46FG's reset-and-propose flow as the thing 5JN5E4 hands off to — coordinate scopes so there aren't two half-mechanisms.
- **DXFX02** (arcade) — revalidation that surfaced this gap (capability map: update-spec "Not covered" by safeword Phase 0). Lives in the arcade-monorepo worktree.
- **DZ2NM5** (safeword) — the Phase-0 merge epic; this is a follow-on capability beyond Phase 0.
- **102-gherkin-executable-specs** — sibling gap (executable codification), tracked separately.

## Roadmap gap (flagged by the 2026-05-31 investigation)

`/update-spec` is the **only** arcade spec skill with no home in the arcade Phase 0–3 adopt roadmap. Phases own: build-spec (DXFX02), review-spec + codify-spec (ZPN3Z9 / safeword 0AWSY8), implement-spec (GNZ22J / M6D315), build-signals (Z6AMF0 / S4997T). Nothing adopts update-spec. So even after 2K46FG ships the safeword capability, **no arcade ticket currently retires arcade's local `/update-spec`** — that decommission step needs an arcade-side owner (a child under an existing adopt epic, or a small new one). Surface to the user when 2K46FG is scheduled.

## Work Log

- 2026-05-31T15:49:36.570Z Started: Created ticket 2K46FG
- 2026-05-31T15:49:36.570Z Filed (backlog): Carved out of the DXFX02 revalidation as a safeword-side gap — no equivalent to arcade's `/update-spec` post-authoring revision discipline. Sized feature (new capability), but intake should first decide whether the phase machine already covers it. Not started.
- 2026-05-31T17:09:48.891Z Revalidated (cross-repo investigation): **stands — genuinely unhomed.** update-spec is the only arcade spec skill with no owner in either the safeword Phase-1 absorption epic 0AWSY8 (review-spec + codify-spec) or the arcade Phase 0–3 adopt roadmap. Sharpened scope: the phase machine does NOT cover this (forward-only gate, no reset-on-edit), so the status-reset guarantee likely needs a hook (keeps `feature` sizing). Cross-linked 5JN5E4 as the detection half of the same seam. Flagged a roadmap gap: no arcade ticket retires arcade's local `/update-spec` once this ships.
