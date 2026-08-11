---
id: SH5GSP
slug: surface-known-hollow-bdd-patterns
type: feature
phase: intake
status: in_progress
scope: 'Advisory detection of corpus-backed, high-confidence hollow-proof patterns with plain-language explanations and visible suppression'
out_of_scope: 'Blocking implementation, rejecting all shared glue, interpreting arbitrary business semantics, or enforcing one BDD framework'
done_when: 'Known hollow fixtures warn, legitimate controls remain quiet, every warning names the evidence gap and next action, and measured false positives stay within the agreed promotion threshold'
parent: AK0QJR
depends_on: [BX1T7H]
relates_to: [1698, Y9P3ZC, 9FSPM8, 73CKG4]
external_issue: https://github.com/ArcadeAI/safeword/issues/2337
created: 2026-08-10T07:58:17.849Z
last_modified: 2026-08-10T11:46:37Z
---

# Warn developers when acceptance tests only look scenario-specific

**Goal:** Detect high-confidence hollow BDD patterns early while preserving legitimate shared steps, tables, contracts, and CLI assertions.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Added Delivery Evidence

- Investigate a high-confidence advisory when a BDD step directly spawns the real CLI outside an approved fixture runner, bypassing sanitized environment and host-adapter boundaries.
- Keep the warning corpus-backed, local, explainable, and visibly suppressible; do not assume every direct process call is hollow without a neighboring valid control.

## Work Log

- 2026-08-10T07:58:17.849Z Started: Created ticket SH5GSP
- 2026-08-10T08:00:27Z Planned: Limited detection to advisory, corpus-backed patterns with explicit controls and suppressions.
- 2026-08-10T11:46:37Z Refined: Added the #2328 fixture-runner bypass pattern as a corpus-backed advisory candidate with explicit suppression and false-positive controls.
