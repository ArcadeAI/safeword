# Spec: Route ready PRs with a safe advisory review

## Intent

Give every ready pull request one current, understandable advisory route without executing its code or creating a GitHub merge signal.

## Intake Brief

- **Requested by:** Alex, by accepting a phased delivery of issue #1909.
- **Cost of inaction:** The smallest useful review loop still does not exist; unfamiliar artifacts remain easy to miss and builders must manually triage every ready PR.
- **Reversibility:** Two-way door with a public receipt schema. The workflow is default-off, but route and evidence vocabulary become compatibility edges once adopted.

## References

- Parent initiative: P0D6S2 and GitHub issues [#1908](https://github.com/ArcadeAI/safeword/issues/1908) / [#1909](https://github.com/ArcadeAI/safeword/issues/1909).
- Implementation evidence only: draft [#1917](https://github.com/ArcadeAI/safeword/pull/1917) and preserved `spike/pr-review-integrity-flow`.
- [GitHub secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use).
- [GitHub required-check behavior](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## Personas

- **Technical Builder (TBU)** — needs the ready queue routed with auditable evidence.
- **Non-Technical Builder (NTB)** — needs one plain-English next action without mistaking it for approval.
- **Safeword Maintainer (SWM)** — needs a safe default across unfamiliar and forked repositories.

## Surfaces

Affected:

- **Safeword CLI** — owns evidence acquisition, model review, routing, and the serialized result contract.
- **GitHub pull request conversation** — owns the sole current ordinary-comment receipt.

Unaffected:

- **Claude Code, OpenAI Codex, and Cursor interactive authoring sessions** — this reviews the resulting PR only.

## Vocabulary

- **Current receipt:** The single ordinary conversation comment for the current head. It records the reviewed SHA, route, run state, evidence, unknowns, available usage/noise, and findings.
- **Fresh review:** A complete model review of the current SHA. In this MVP every new SHA requires one; there is no materiality shortcut.
- **Integrity floor:** Technology-neutral review of intent, contracts, permissions, safety boundaries, and consequential assumptions for every changed text artifact.

## Jobs To Be Done

### safe-advisory-core.TBU1 — Route the ready pull-request queue

**Persona:** Technical Builder (TBU)

> When agent-written pull requests arrive faster than I can inspect them, I want each ready current revision reviewed from trustworthy evidence, so I know which change needs human attention.

#### safe-advisory-core.TBU1.R1 — Every eligible head receives exactly one automatic review

#### safe-advisory-core.TBU1.R2 — Every changed text artifact receives the same technology-neutral integrity floor

#### safe-advisory-core.TBU1.R3 — Only a complete clean current review may report `looks ready`

#### safe-advisory-core.TBU1.R4 — Every new head invalidates the old conclusion and requires a fresh review

### safe-advisory-core.NTB1 — Act from one honest receipt

**Persona:** Non-Technical Builder (NTB)

> When I cannot audit the diff myself, I want one plain-English receipt with evidence, uncertainty, and a next action, so I can act without interpreting bot ceremony.

#### safe-advisory-core.NTB1.R1 — The current receipt exposes what the review did and did not establish

#### safe-advisory-core.NTB1.R2 — Receipt findings are actionable without claiming approval or tested remedies

### safe-advisory-core.SWM1 — Keep advisory review outside execution and merge authority

**Persona:** Safeword Maintainer (SWM)

> When I enable review in an unfamiliar repository, I want untrusted changes inspected only as data and the result published outside GitHub's merge signals, so the reviewer cannot become an execution or approval path.

#### safe-advisory-core.SWM1.R1 — Inspection and publication remain split across least-privilege boundaries

#### safe-advisory-core.SWM1.R2 — The receipt cannot approve a PR or satisfy a required check

## Rave Moment

skip: inherited from parent epic #1908.

## Outcomes

- A ready PR gets one exact-head route and one current receipt.
- The unfamiliar Flux regression reaches the same reviewer as recognized source and routes to a human.
- Failures, missing evidence, and stale runs are visible and cannot look ready.
- Forks remain reviewable without checkout or execution, and publication cannot change merge eligibility.

## Open Questions

None.
