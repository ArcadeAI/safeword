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

- **Current receipt:** The single marker-owned ordinary conversation comment for the pull request, updated in place across heads rather than recreated per revision. It records the reviewed SHA, route, run state, reviewed artifacts, evidence, unknowns, available usage/noise, and findings.
- **Receipt reconciliation:** Publication selects the oldest bot-authored comment carrying the exact Safeword marker as canonical, updates it, and deletes other bot-authored exact-marker duplicates. User-authored or malformed-marker comments are never modified.
- **Fresh review:** A complete model review of the current SHA. In this MVP every new SHA requires one; there is no materiality shortcut.
- **Integrity floor:** Technology-neutral review of intent, contracts, permissions, safety boundaries, and consequential assumptions for every changed text artifact.
- **Consequential finding:** A validated reviewer-result flag indicating that the evidence describes material user, security, correctness, or operability impact. Deterministic tests set this flag in fixtures; model prose never chooses the route directly.
- **Configured prerequisite:** A required check identity explicitly named by the customer as context plus optional GitHub App ID. An explicit empty list means no prerequisites; missing configuration is unknown and cannot start a review.
- **Run-state precedence:** When conditions overlap, `stale` overrides `failed`, which overrides `incomplete`, which overrides `complete`.
- **Unresolved unknown:** An explicitly observed uncertainty remaining after every required evidence source completed; the run may be `complete` but must route to a human.
- **Missing required evidence:** A required source that could not be acquired or completed; the run is `incomplete` and must route to a human.
- **Non-run reporting:** A ready revision with pending, missing, or terminally failed prerequisites creates or updates the sole receipt with a non-run reason and no advisory route. An always-draft pull request creates no receipt; converting a reviewed pull request to draft rewrites its existing receipt to `not ready (draft)` and removes the route.
- **Never-settling prerequisite:** A configured check identity that remains missing or pending stays conservatively `prerequisites pending`; the sole receipt names it and tells the builder to verify the check or configuration. Safeword never guesses success or invokes the model for that head.
- **Ineligible scheduled candidate:** A scheduled candidate revalidated as draft, closed, or merged performs no prerequisite/model work. It rewrites an existing marker-owned receipt to `not ready (draft|closed|merged)` with no route, and creates no receipt if none exists.
- **Inspection audit:** A deterministic workflow-contract record of the inspection job's permissions and step kinds; an empty or missing record fails the contract.
- **Publication audit:** A deterministic publisher-contract record of its validated serialized-evidence input and GitHub endpoint calls; an empty or missing record fails the contract.

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
