---
id: AK0QJR
slug: trustworthy-bdd-proofs
type: epic
phase: intake
status: in_progress
children: ['BX1T7H', '7B1AMC', 'SH5GSP', 'FY1NHB', 'RXSGXP', 'EBTNER']
relates_to: [1698, NMSD94, QZAFT2, 7ZLTWB, BFCWDB, ZA0JQR, Y9P3ZC]
external_issue: https://github.com/ArcadeAI/safeword/issues/2334
created: 2026-08-10T07:57:41.992Z
last_modified: 2026-08-10T08:00:27Z
---

# Keep acceptance proofs trustworthy for coding-agent users

**Goal:** Prevent Safe Word from accepting BDD suites that look green without proving their scenarios.

**Why:** Recent plugin work exposed a class of false-green acceptance tests where strong Gherkin was wired to shared umbrella verdicts instead of scenario behavior. Safe Word needs layered prevention, early independent review, measurable skill quality, and targeted high-risk falsification without a bloated universal mutation gate.

## Ranked Roadmap

| Rank | Ticket | Outcome | Impact | Effort |
| --- | --- | --- | --- | --- |
| 1 | 7B1AMC | Review executable RED before implementation | 5 | 2 |
| 2 | BX1T7H | Preserve a shared trustworthy/hollow regression corpus | 5 | 2 |
| 3 | SH5GSP | Surface high-confidence hollow-proof patterns | 4 | 2–3 |
| 4 | FY1NHB | Measure skill quality across agents and models | 5 | 4 |
| 5 | RXSGXP | Falsify the highest-risk Safe Word behaviors | 4 | 3–4 |
| 6 | EBTNER | Reassess broader mutation from measured evidence | 5 potential | 5+ |

The proof-plan self-check is bundled into 7B1AMC because it is a low-effort prerequisite for a useful independent review, not a separate deliverable.

## Program Boundaries

- Improve evidence quality without forcing every project into one test framework.
- Prefer early, understandable feedback over ceremony after implementation.
- Keep shared steps, Scenario Outlines, contract tests, and real CLI assertions valid.
- Do not commit to universal semantic mutation or make advisory heuristics blocking until measured evidence justifies it.
- Reuse the existing per-phase review, cross-agent dispatch, executable-Gherkin, proof-fidelity, and eval-discipline foundations instead of rebuilding them.

## Done When

- The historical false-green class is preserved as executable regression evidence.
- New or changed primary acceptance proofs receive an independent executable RED review before production implementation.
- High-confidence hollow-proof patterns produce useful, suppressible guidance with acceptable false-positive rates.
- Maintainers can compare BDD skill revisions across supported coding agents and representative model families.
- Curated defects prove that acceptance scenarios catch regressions on Safe Word's highest-risk boundaries.
- A recorded evidence-based decision accepts, narrows, or rejects broader mutation automation.

## Work Log

- 2026-08-10T07:57:41.992Z Started: Created ticket AK0QJR
- 2026-08-10T08:00:27Z Planned: Ranked the prevention layers and recorded the boundary against premature universal mutation.
