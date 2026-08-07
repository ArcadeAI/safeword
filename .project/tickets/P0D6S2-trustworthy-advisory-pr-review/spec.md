# Spec: Route every ready PR with one trustworthy advisory review

## Intent

Give every ready, substantive pull request one current advisory review that
helps a builder distinguish changes that look ready from changes that need
human judgment, without overstating what Safeword actually verified.

## Intake Brief

- **Requested by:** Alex, through parent epic #1908 and the explicit instruction to proceed with #1909.
- **Cost of inaction:** Agent-written pull requests continue to outpace review; unfamiliar artifacts can be silently skipped; and incomplete or fabricated verification can look like approval to a builder who cannot audit the code.
- **Reversibility:** Two-way door with customer-facing compatibility edges. The first release is advisory and default-controllable, but receipt states, evidence language, and rerun behavior become public contracts once shipped.

## References

- Product epic: [#1908](https://github.com/ArcadeAI/safeword/issues/1908).
- Delivery slice: [#1909](https://github.com/ArcadeAI/safeword/issues/1909).
- Implementation evidence: draft [#1917](https://github.com/ArcadeAI/safeword/pull/1917), especially its trigger, verdict, poster, workflow, fork-safety, and output-contract tests.
- Live-run evidence: `spike/pr-review-integrity-flow` and `36EEMY/spike-integrity-flow.md` on the draft branch. The run found the `.flux` access-control regression and also exposed the false remedy-verification blocker.
- Evidence boundary: #1917 is a starting point, not proof that this contract is met; experimental spike commits must not be merged directly.
- [GitHub secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use) — privileged workflow triggers must not execute untrusted pull-request code.
- [GitHub checks reference](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-checks) — check runs bind to a commit SHA and carry conclusions that can participate in repository check policy.

## Personas

- **Technical Builder (TBU)** — needs the queue routed without losing the evidence needed to audit a conclusion.
- **Non-Technical Builder (NTB)** — needs one understandable recommendation and must not mistake silence or model confidence for approval.
- **Safeword Maintainer (SWM)** — must ship one safe reviewer across unfamiliar repositories with auditable failure and fork behavior.

## Surfaces

Affected:

- **Safeword CLI** — owns the technology-neutral review runner and its evidence contract.
- **GitHub pull request review** — spec-local publication surface for inline findings and the single receipt.

Unaffected:

- **Claude Code, OpenAI Codex, and Cursor interactive authoring sessions** — this slice reviews the resulting pull request; it does not change the author's local workflow.

## Vocabulary

- **Substantive change:** A changed artifact that can affect runtime behavior, permissions, generated behavior, deployment, or another operational contract. Unknown artifacts are substantive unless an inert exclusion is supported by recorded evidence.
- **Integrity floor:** The technology-neutral review of intent, contracts, safety boundaries, and consequential assumptions that applies even when Safeword does not recognize the file type or architecture.
- **Current receipt:** The sole advisory summary for the pull request. It explicitly names both the reviewed revision and current head, is updated in place as freshness changes, and is not an approval or merge gate. When no review runs, it instead names the current revision, why no review was needed, the evidence for that decision, skipped checks, remaining unknowns, and usage or finding noise not incurred.
- **Material update:** A new revision that changes behavior, permissions, generated output, deployment, an operational contract, or evidence supporting the current conclusion. A change is immaterial only when recorded evidence shows it cannot affect the reviewed behavior or conclusion; file extension alone is not proof. If materiality cannot be established, the update is treated as material.
- **Controlled execution:** Running same-repository code in an execution-eligible sandbox for one named check needed to produce review evidence. Eligibility alone is not authorization; the exact command, revision, and outcome must be recorded.
- **Terminal review attempt:** An eligible review run that has reached a published terminal state: complete, incomplete, failed, or stale. Failure does not exempt the attempt from recording the usage and noise evidence available before termination.
- **No-review evaluation:** A current-head evaluation that proves the change is all-inert or proves a freshness bridge is immaterial, so no model review runs. Its receipt records the classification evidence and explicitly distinguishes checks and usage not incurred from missing evidence.
- **Verified remedy:** An exact patch Safeword applied in an execution-eligible sandbox and checked with named commands whose results are recorded. Model text cannot create this state.

## Jobs To Be Done

### trustworthy-advisory-pr-review.TBU1 — Route the ready pull-request queue

**Persona:** Technical Builder (TBU)

> When agent-written pull requests arrive faster than I can inspect them, I want every ready substantive change reviewed at its current revision and routed from trustworthy evidence, so I can focus my attention without blindly rubber-stamping the queue.

#### trustworthy-advisory-pr-review.TBU1.R1 — Every ready substantive revision receives exactly one automatic review pinned to that head SHA

#### trustworthy-advisory-pr-review.TBU1.R2 — Every substantive artifact receives a technology-neutral integrity review, including unfamiliar file types

#### trustworthy-advisory-pr-review.TBU1.R3 — Only a complete current review with no consequential finding or unknown may report `looks ready`

### trustworthy-advisory-pr-review.TBU2 — Know exactly what the conclusion establishes

**Persona:** Technical Builder (TBU)

> When Safeword finishes or fails a review, I want one current record of the revision, checks, reviewers, unknowns, freshness, and cost, so I can audit the conclusion and distinguish silence, staleness, and failure from approval.

#### trustworthy-advisory-pr-review.TBU2.R1 — A prior conclusion is reused only for a proven immaterial update; every material or uncertain update invalidates it

#### trustworthy-advisory-pr-review.TBU2.R2 — Every current receipt records its revision, executed and skipped checks, remaining unknowns, run state, available token use, and noise or why none was incurred

#### trustworthy-advisory-pr-review.TBU2.R3 — Execution and remedy-verification claims can come only from Safeword-controlled evidence, never model text

### trustworthy-advisory-pr-review.NTB1 — Give me one understandable next action

**Persona:** Non-Technical Builder (NTB)

> When I cannot audit a pull request myself, I want one plain-English recommendation with the consequence, evidence, uncertainty, and next action, so I can act safely without interpreting bot chatter or technical ceremony.

#### trustworthy-advisory-pr-review.NTB1.R1 — Findings are actionable inline and one plain-English receipt gives the sole current routing recommendation

### trustworthy-advisory-pr-review.SWM1 — Keep the first release advisory and safe

**Persona:** Safeword Maintainer (SWM)

> When I enable the reviewer in an unfamiliar customer repository, I want it to inspect untrusted changes without executing them under write authority or gaining merge power, so the advisory product cannot silently become a code-execution or approval path.

#### trustworthy-advisory-pr-review.SWM1.R1 — The reviewer may read and comment on untrusted changes but may never execute fork code with write authority, approve, merge, or modify customer code

#### trustworthy-advisory-pr-review.SWM1.R2 — The advisory receipt uses a publication surface GitHub cannot count as an approval or required check

#### trustworthy-advisory-pr-review.SWM1.R3 — Same-repository code executes only for a named evidence-producing check whose command, revision, and outcome are recorded

## Rave Moment

skip: inherited from parent epic #1908.

## Outcomes

- Builders see one current advisory route per ready substantive revision.
- A clean result is visibly different from an incomplete, stale, or failed run and never reads as approval.
- Unknown technologies receive the same integrity floor; the preserved `.flux` regression routes to a human.
- Every execution and verification claim is backed by runner-controlled evidence.
- Forks remain reviewable as data in an unprivileged inspection stage; an isolated write-capable publication stage receives only serialized advisory evidence and never fork code or executable artifacts.
- The advisory receipt cannot become an approval or required-check primitive.
- Materiality uncertainty fails conservative and cannot preserve a stale positive conclusion.
- Same-repository execution is purpose-bound and produces an auditable evidence record.

## Open Questions

None.
