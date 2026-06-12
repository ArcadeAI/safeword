---
id: MR5M3A
slug: architecture-gate
type: feature
phase: intake
status: in_progress
created: 2026-06-12T01:36:37.466Z
last_modified: 2026-06-12T01:36:37.466Z
scope:
  - Require a per-feature architecture record (options considered, cited evidence, reconcile record) as a gated artifact before a feature exits intake
  - Add a fresh-context fork review of that architecture record, adversarial (refute the design against its cited sources), whose pass is required to proceed — reusing the Tier 2 review-ledger/stamp mechanism
  - Scope enforcement to features only; reuse the existing classify (patch/task/feature) boundary
  - Provide an auditable `skip: <reason>` escape valve for both the artifact and the review
  - Ship default-off behind a config flag (mirror `reviewGate`), enforcing only when explicitly enabled
out_of_scope:
  - Gating patches or tasks (would be box-ticking — the friction must match blast radius)
  - A voting panel / multi-agent ensemble reviewer (research shows the "popularity trap" underperforms a single adversarial reviewer)
  - Auto-judging architecture quality in a hook (hooks enforce presence; quality comes from forced evidence + the fork review)
  - Hook-enforced intake sub-phase tracking (separate concern — epic 172)
  - Reviving the retired standalone decomposition phase
done_when:
  - With the flag enabled, a feature ticket cannot advance to implementation without an architecture record carrying >=1 cited source plus a matching fork-review stamp (or an auditable skip for either)
  - Patches and tasks are never blocked by this gate
  - With the flag off, behavior is identical to today (gate inert)
  - The full suite passes (targeted hook/gate tests + smoke)
---

# Independent evidence-backed architecture gate for features

**Goal:** Make exceptional architecture _reliable_ on every feature by requiring an evidence-cited architecture record and an independent fresh-context challenge before implementation — closing safeword's last ungated, unreviewed workflow surface.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-12T01:36:37.466Z Started: Created ticket MR5M3A
