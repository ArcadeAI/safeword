# Test Definitions: Route ready PRs with a safe advisory review

Feature source: `features/route-ready-prs-with-a-safe-advisory-review.feature`

Each scenario follows RED → GREEN → REFACTOR during implementation.

## Rule: Every eligible head receives exactly one automatic review

### Scenario: A ready revision is reviewed once at its exact head

- [x] RED c3cdd85e6
- [x] GREEN a5df1d4d9
- [x] REFACTOR skip: first orchestration slice is already minimal and cohesive

### Scenario: A draft revision creates no receipt

- [x] RED d763c43a8
- [x] GREEN 4635b17fc
- [x] REFACTOR skip: the draft branch is a single policy decision with no duplication to extract

### Scenario: A pending prerequisite publishes a visible non-run receipt

- [x] RED 58459aa45
- [x] GREEN 0cb1af846
- [x] REFACTOR skip: the receipt union is small and the next prerequisite scenarios will determine its stable shape

### Scenario: A scheduled sweep reviews a pending head after prerequisites settle

- [x] RED c45d59875
- [x] GREEN 04ea31474
- [x] REFACTOR skip: the publication-mode contract is a single literal union with no production duplication to extract

### Scenario: A prerequisite that never appears remains conservatively pending

- [x] RED 08b759d7e
- [x] GREEN 595ff87ca
- [x] REFACTOR skip: the pending and failed receipt variants are already explicit and non-overlapping

### Scenario: A failed prerequisite publishes a terminal non-run receipt

- [x] RED a792a030e
- [x] GREEN b9a30d4cf
- [x] REFACTOR skip: GREEN already unified terminal and pending non-run publication without changing their observable states

### Scenario: Missing prerequisite configuration gives one concrete next action

- [x] RED bd4b1d8c7
- [x] GREEN 5621521bc
- [x] REFACTOR skip: configuration absence is one early-return policy branch with explicit receipt data

### Scenario: An explicit empty prerequisite list proceeds immediately

- [x] RED 1977e498f
- [x] GREEN cd67e6b9c
- [x] REFACTOR skip: GREEN already extracted prerequisite resolution to preserve orchestration complexity

### Scenario: A repeated trigger cannot produce another review attempt

- [x] RED c1f286f9a
- [x] GREEN 9ce8c08a3
- [x] REFACTOR skip: GREEN already isolated pre-review exits in one policy helper

### Scenario: An ineligible scheduled candidate invalidates its existing receipt

- [x] RED 0295da622
- [x] GREEN 45e0bfd63
- [x] REFACTOR skip: invalidation remains one cohesive pre-review lifecycle branch

### Scenario: An ineligible scheduled candidate creates no receipt when none exists

- [x] RED 6c7353618
- [x] GREEN 2664ce6b5
- [x] REFACTOR skip: the existing lifecycle branch already shares receipt and no-receipt handling cleanly

## Rule: Every changed text artifact receives the same technology-neutral integrity floor

### Scenario: Changed text is visibly covered without a technology-specific gate

- [x] RED 4b6cc66a8
- [x] GREEN 5aab71ae5
- [x] REFACTOR 022365334

### Scenario: A non-text artifact is visibly excluded instead of falsely covered

- [x] RED cf53551d4
- [x] GREEN c082f8e39
- [x] REFACTOR skip: coverage normalization is already isolated and the evidence variant is minimal

### Scenario: A skipped binary does not poison an otherwise complete clean review

- [x] RED 59e27c5f1
- [x] GREEN 5f56dcba8
- [x] REFACTOR skip: unknown evidence now travels with the existing normalized coverage payload

### Scenario: A binary-only change set cannot look complete or ready

- [x] RED 8ed19dc7d
- [x] GREEN 50a9830d4
- [x] REFACTOR skip: GREEN already extracted reviewed-receipt derivation from orchestration

### Scenario: Evidence over budget cannot look complete or ready

- [x] RED 77fab4030
- [x] GREEN f4138c283
- [x] REFACTOR skip: bounded evidence normalization is already isolated from receipt routing

### Scenario: Evidence exactly at the total-byte budget remains reviewable

- [x] RED 3b98a9913
- [x] GREEN c093d7a8f
- [x] REFACTOR skip: the inclusive boundary is a direct readable comparison in the shared reducer

### Scenario: A consequential unfamiliar-artifact finding routes to a human

- [x] RED ffe9bc1cb
- [x] GREEN 1a9c7b900
- [x] REFACTOR skip: GREEN already extracted the deterministic route policy from receipt assembly

### Scenario: The unfamiliar Flux policy regression routes to a human

_Selected live-model evaluation; excluded from deterministic CI._

- [x] RED b758dfd64
- [x] GREEN d9a0d5e6c
- [x] REFACTOR skip: provider transport and validation are already separated; live evaluation remains in verify

## Rule: Only a complete clean current review may report looks ready

### Scenario: Evidence state conservatively determines the advisory route

- [x] RED ae31fcc59
- [x] GREEN 736d20e4f
- [x] REFACTOR skip: one run-state union now drives both publication and route policy

### Scenario: Competing run conditions use conservative state precedence

- [x] RED a15e81048
- [x] GREEN 5ead5a9fc
- [x] REFACTOR 6ffbe01f4

## Rule: Every new head invalidates the old conclusion and requires a fresh review

### Scenario: Converting a reviewed pull request to draft removes its advisory route

- [x] RED 29979b908
- [x] GREEN 243361bf2
- [x] REFACTOR skip: event and scheduled invalidation already share the same lifecycle branch

### Scenario: A new head cannot inherit an earlier conclusion

- [x] RED 8965770bd
- [x] GREEN 716ae7513
- [x] REFACTOR skip: freshness invalidation remains a small pre-review policy branch

### Scenario: A new head updates the sole receipt instead of adding comment noise

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Publication reconciles duplicate marker-owned receipts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Receipt reconciliation preserves comments Safeword does not own

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The current receipt exposes what the review did and did not establish

### Scenario: Available evidence is reported with its actual values

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable evidence remains unknown instead of looking successful

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Receipt findings are actionable without claiming approval or tested remedies

### Scenario: A consequential finding gives one evidence-bounded next action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A clean current review creates no reassuring comment noise

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-consequential finding remains visible on a looks-ready receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Inspection and publication remain split across least-privilege boundaries

### Scenario: An untrusted fork is reviewed as data without execution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing audit evidence blocks publication

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Adversarial pull-request text cannot expand authority or suppress human routing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The receipt cannot approve a PR or satisfy a required check

### Scenario: Publishing the receipt leaves GitHub merge eligibility unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
