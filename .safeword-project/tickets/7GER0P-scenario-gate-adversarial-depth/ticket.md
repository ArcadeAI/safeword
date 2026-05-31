---
id: 7GER0P
slug: scenario-gate-adversarial-depth
type: task
phase: intake
status: backlog
created: 2026-05-31T15:49:36.620Z
last_modified: 2026-05-31T15:49:36.620Z
---

# Deepen scenario-gate adversarial review (port review-spec depth)

**Goal:** Enrich safeword's scenario-gate (SCENARIOS.md) with the adversarial-review depth from arcade's `/review-spec`, so weak scenarios are caught before they become flaky tests or false-green passes.

**Why:** Discovered during the DXFX02 revalidation. Safeword's scenario-gate runs AODI (Atomic/Observable/Deterministic/Independent) plus a single "argue against your own list" adversarial pass. Arcade's `/review-spec` is a far richer instrument for the same intent — and the parity audit rated safeword's coverage here only **partial**. The depth worth porting:

- **Vacuous-pass test** — mentally remove the implementation; could the scenario still pass? (Named patterns: Then asserts only that a response exists; Then asserts on state the Given pre-populated; Given makes the Then trivially true.)
- **Assertion-strength ladder** — weak "request succeeds" → strong "returns 200"; weak "user sees content" → strong "response body contains X".
- **Bulk-findings shape** — when one pattern hits ≥3 scenarios, one representative finding + an affected-IDs list, not N copies.
- **Severity tiers** — Must Fix / Should Strengthen / Looks Good, with a leading tally.
- **Cross-cutting sweep** — conflict, boundary (zero/one/max/empty/null/concurrent), external-dependency failure, authn/authz.

## Scope (sketch — refine at intake)

- Additive guidance in `.claude/skills/bdd/SCENARIOS.md` (canonical `templates/skills/bdd/SCENARIOS.md` + dogfood mirror) extending the scenario-gate's adversarial pass with the checks above.
- Possibly a light touch to the `tdd-review` skill (which reviews scenario completeness).
- Likely 1–2 doc files; no new hook behavior assumed (conversational discipline, like the existing adversarial pass). Re-size to feature if it grows a hook.

## Out of scope

- The full `/review-spec` skill as a standalone — safeword folds review into the scenario-gate, not a separate phase. This ports the _checks_, not the skill structure.
- Outcomes/signals review (that's the production-metrics gap, tracked elsewhere).

## Related

- **DXFX02** (arcade) — revalidation that surfaced this (capability map: review-spec adversarial review "Partial"). Arcade-monorepo worktree.
- **DZ2NM5** (safeword) — Phase-0 merge epic; this deepens the Phase-3 scenario-gate that pairs with it.
- **tdd-review**, **testing** skills — adjacent review surfaces to keep consistent.

## Work Log

- 2026-05-31T15:49:36.620Z Started: Created ticket 7GER0P
- 2026-05-31T15:49:36.620Z Filed (backlog): Carved out of the DXFX02 revalidation — safeword's scenario-gate adversarial pass is lighter than arcade's `/review-spec`. Port the checks (vacuous-pass, assertion-strength, bulk-findings, severity tiers, cross-cutting sweep) into SCENARIOS.md. Sized task (additive doc guidance). Not started.
