---
id: DBF1FW
slug: feature-surfaces-bdd
type: feature
phase: verify
status: in_progress
scope:
  - scaffold starter feature-surface inventory at <namespace-root>/surfaces.md
  - wire surfaces into the existing project-knowledge path/config contract, including paths.surfaces
  - define feature surfaces as supported product/agent/runtime/protocol/client/deployment contexts
  - teach BDD intake and feature specs to load and name affected surfaces
  - report affected surfaces missing feature-source @surface.<slug> tags as check advisories
  - prove behavior with customer-style setup/upgrade fixtures
out_of_scope:
  - hard-blocking feature work when surfaces.md is missing or empty
  - hard-blocking implementation on missing surface scenario tags
  - validating every spec-local surface against project surfaces
  - a persona-level surfaces parser or full semantic validator
  - journey maps, service blueprints, or exhaustive UX-flow modeling
done_when:
  - fresh setup creates a starter surfaces.md in the resolved namespace root without overwriting user content
  - upgrade/reset behavior for missing or configured surfaces follows the persona/glossary managed-file contract
  - BDD intake guidance loads surfaces after personas/glossary and explains when to promote recurring runtime/context surfaces
  - spec templates document an optional ## Surfaces section with Affected/Unaffected entries
  - safeword check reports affected surfaces missing @surface.<slug> coverage without failing the check
  - targeted tests cover customer-style fixtures outside the safeword dogfood layout
created: 2026-06-27T13:05:01.120Z
last_modified: 2026-06-27T21:11:25Z
external_issue: https://github.com/ArcadeAI/safeword/issues/509
---

# Let projects track feature surfaces during BDD

**Goal:** Let projects keep a durable inventory of runtime/context feature surfaces that BDD intake, specs, and scenario coverage can use during discovery and implementation.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-28T19:46:12Z Complete: verify/audit follow-up - Added explicit TypeScript, Python, Go, and Rust setup coverage proving each supported language-pack customer project receives `.project/surfaces.md`; reran lint/typecheck, targeted setup tests, full Vitest, feature BDD, generated typecheck/build plans, and audit checks. Full generated verify plan remains blocked only by the existing Python zero-test lane in `experiments/gepa-review-spec/gepa`.
- 2026-06-27T21:11:25Z Complete: verify - Lint/typecheck/format/diff checks pass; focused surfaces tests, feature BDD, and full Vitest pass. Full `safeword test-plan --kind verify` still exits on the existing Python zero-test lane in `experiments/gepa-review-spec/gepa`, so the ticket remains in verify rather than done.
- 2026-06-27T15:03:32Z Complete: implement - Reframed surfaces as runtime/context coverage, added `@surface.<slug>` advisory coverage checks, updated BDD/review guidance and dogfood surfaces, and revalidated focused BDD, targeted Vitest, lint/typecheck, and diff checks.
- 2026-06-27T13:30:53Z Superseded: implement - Initial implementation treated surfaces too much like behavior locations; later user clarification reframed them as runtime/context surfaces.
- 2026-06-27T13:10:00Z Complete: scenario-gate - Scenarios validated (AODI) + adversarial pass; impl-plan.md written.
- 2026-06-27T13:09:30Z Complete: define-behavior - 6 scenarios defined across 3 rules.
- 2026-06-27T13:08:15Z Complete: intake - Understanding converged, scope established; entering define-behavior.
- 2026-06-27T13:07:29Z Complete: intake frontmatter filled from GitHub issue #509; proceeding with spec and scenario artifacts.
- 2026-06-27T13:05:01.120Z Started: Created ticket DBF1FW
