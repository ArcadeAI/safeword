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
- **Open question for intake:** does safeword's existing phase machine + re-entry flow already cover most of this, making a thin guide sufficient, or is a full `/update-spec`-style skill warranted? Don't assume the skill — evaluate first.

## Out of scope

- Arcade's `.feature`/step-def regeneration on revision — that's the Gherkin-codification layer (safeword backlog 102-gherkin-executable-specs), not this.

## Related

- **DXFX02** (arcade) — revalidation that surfaced this gap (capability map: update-spec "Not covered" by safeword Phase 0). Lives in the arcade-monorepo worktree.
- **DZ2NM5** (safeword) — the Phase-0 merge epic; this is a follow-on capability beyond Phase 0.
- **102-gherkin-executable-specs** — sibling gap (executable codification), tracked separately.

## Work Log

- 2026-05-31T15:49:36.570Z Started: Created ticket 2K46FG
- 2026-05-31T15:49:36.570Z Filed (backlog): Carved out of the DXFX02 revalidation as a safeword-side gap — no equivalent to arcade's `/update-spec` post-authoring revision discipline. Sized feature (new capability), but intake should first decide whether the phase machine already covers it. Not started.
