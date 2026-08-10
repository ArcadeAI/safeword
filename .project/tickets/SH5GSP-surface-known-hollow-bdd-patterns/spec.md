# Spec: Warn developers when acceptance tests only look scenario-specific

## Intent

Give coding agents and maintainers an early, plain-language warning when acceptance glue has a known high-confidence shape that can make many scenarios pass without proving their individual outcomes.

## Intake Brief

- **Requested by:** Safeword maintainers after finding scenario-specific Gherkin backed by a shared umbrella test result.
- **Cost of inaction:** The same mechanical false-green patterns remain cheap for coding agents to produce and expensive for humans to notice during review.
- **Reversibility:** Two-way door. Detection begins advisory, each rule is independently measurable and suppressible, and low-quality rules can be removed without migration.

## References

- Parent program: [AK0QJR](../AK0QJR-trustworthy-bdd-proofs/ticket.md)
- Shared examples: [BX1T7H](../BX1T7H-preserve-bdd-proof-regression-corpus/ticket.md)
- Evaluation: [FY1NHB](../FY1NHB-measure-bdd-skill-agent-quality/ticket.md)
- Existing proof-fidelity and adversarial-review foundations: 1698, Y9P3ZC, 9FSPM8, 73CKG4

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- Claude Code Cloud
- OpenAI Codex
- OpenAI Codex Cloud
- Cursor
- Cursor Cloud Agents

Unaffected:

- Safeword CLI — initial feedback belongs in the shared agent workflow; a future CLI check requires separate evidence and scope.

## Vocabulary

- **Hollow proof:** Executable test glue that can report success without observing the scenario-specific behavior it claims to prove.
- **Umbrella verdict:** One suite-level or helper-level result reused as the Then result for otherwise distinct scenarios.
- **Control:** A legitimate neighboring test design that a detector must not warn about.
- **Suppression:** A visible, reasoned exception attached to one detector finding rather than a silent global bypass.

## Jobs To Be Done

### hollow-warning.TBU1 — Fix suspicious test glue while context is fresh

**Persona:** Technical Builder (TBU)

> When my agent writes acceptance glue with a known hollow shape, I want an immediate explanation of the evidence gap and a concrete repair, so we fix it before implementation hides the mistake behind green tests.

#### hollow-warning.TBU1.R1 — A warning identifies the exact scenario-to-proof connection that may be hollow

#### hollow-warning.TBU1.R2 — A warning explains the risk and next action without claiming a semantic defect it cannot prove

#### hollow-warning.TBU1.R3 — A developer can visibly suppress a false positive with a local reason

### hollow-warning.NTB1 — Hear a useful warning without test jargon

**Persona:** Non-Technical Builder (NTB)

> When Safeword suspects that an agent's tests only look convincing, I want a loud but understandable warning that does not stop unrelated work, so I can ask the agent to strengthen the proof without deciphering framework internals.

#### hollow-warning.NTB1.R1 — Advisory findings do not block work during the evidence-gathering rollout

#### hollow-warning.NTB1.R2 — User-facing text states what may be unproved, why that matters, and what the agent will do next

### hollow-warning.SWM1 — Add detectors without teaching the checker bad generalizations

**Persona:** Safeword Maintainer (SWM)

> When I add a hollow-proof detector, I want paired regression and control fixtures plus measured false positives, so Safe Word catches known theater without punishing legitimate shared test design.

#### hollow-warning.SWM1.R1 — Every detector is justified by a corpus negative and protected by neighboring positive controls

#### hollow-warning.SWM1.R2 — Shared steps, Scenario Outlines, scenario-local setup, contract tests, real CLI exit-code assertions, and reused actor adapters remain valid

#### hollow-warning.SWM1.R3 — A detector can become harder enforcement only through a separately reviewed promotion threshold based on measured precision and user cost

## Rave Moment

skip: child feature under a program; accurate warnings are table-stakes.

## Outcomes

- The historical umbrella-verdict and cached-shared-state fixtures warn.
- Legitimate corpus controls remain quiet.
- Findings are advisory, local, understandable, and suppressible during rollout.
- Each rule reports precision, false positives, suppressions, and user cost through FY1NHB.
- No single heuristic pretends to solve arbitrary semantic proof quality.

## Open Questions

defer: Exact promotion thresholds belong to FY1NHB after baseline measurements exist; until then every detector remains advisory.
