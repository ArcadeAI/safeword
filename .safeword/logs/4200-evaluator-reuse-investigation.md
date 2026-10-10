Decision: share the existing judged evaluator for remaining acceptance cases and
native review outputs without changing the fixed qualification benchmark or
turning synthetic approvals into authenticated host proof.

Options: extend the qualification corpus; add a named acceptance case set to the
existing runner; duplicate a standalone native/acceptance runner.

Investigation domains and questions:
1. Qualification/provenance: which digest binds qualification to its fixed corpus,
and would new examples revoke every currently qualified route?
2. Evaluation validity: how do existing reviewer/judge contracts distinguish
semantic correctness from authentic public coordinator output and host admission?
What can be reused without crediting a synthetic result as native proof?
3. Maintainability/cost: which provider invocation, schema and scorer already
exist, and what is the smallest seam that avoids duplicate runners or extra paid
qualification runs? Does a named case retain isolated immutable inputs?
4. Acceptance authority: which current scenario branches have no matching oracle,
and which can reuse an existing case unchanged? Do not invent expected outcomes.

Findings:
- The capability registry is bound to reviewer-capability-corpus.ts through
capabilityRevision's fixtures/rubrics/settings digests. The separate
planning-contracts-eval.ts manifest binds planningContractCases. Adding a semantic
acceptance case does not invalidate model qualification: there is no import or
shared corpus between these sets. Earlier concern about automatic qualification
invalidation was too broad.
- Existing neutral evaluation cannot prove host admission; authentic native jobs
and installed lifecycle dispatch still need their own observations. Keep this
boundary explicit. The R14 new proof already preserves this distinction.
- Existing provider call, judge calibration, schemas, scorer, immutable captured
input, named selection and result hashing are reusable. A new runner duplicates
all of them. A second case registry introduces selection plumbing without benefit.
- R16 scenario coverage cannot reuse Implementation Plan persona verdicts:
scenario-gate selects a different generated rubric. Add its rubric to the
semantic-manifest digest when introducing these two cases.
- R14 accepted/pending, R15 required/consequential guidance and R16 coverage need
additional correct oracles, not altered expectations on old cases.

Recommendation: extend the existing semantic acceptance corpus and its own
manifest, preserving the independent capability corpus/catalogue. The alternative
of a separate registry protects a benchmark that is already separate, adding
unnecessary plumbing. Duplicating a runner adds maintenance and drift.

Premortem: a correct old persona oracle is reused for the wrong planning phase;
prevent that by naming scenario-gate cases and hashing its actual rubric. Native
proof still cannot be replaced by these neutral evaluations.

Sources: repository capability-eval.ts, reviewer-capability-eval.ts,
reviewer-capability-corpus.ts, planning-contracts-eval.ts and review-rubric.ts;
https://developers.openai.com/api/docs/guides/evaluation-best-practices (task-specific
objectives, curated data and calibrated classification);
https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets
(separate evaluation sets and avoiding duplicate evidence). The dataset advice is
an analogy here, not a claim that this project trains model weights.
