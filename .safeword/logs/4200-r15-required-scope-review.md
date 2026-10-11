# R15 required decision and consequential scope choice

Review scope: the two added R15 semantic inputs, their thin root Cucumber
bindings, and the semantic corpus digest. Production policy, qualification
corpus, canonical rubrics, pinned models and thresholds are unchanged.

Review questions:
- Does the required CLI denial proof resolve the decision in Execution
  Planning rather than substitute endpoint proof or expand accepted scope?
- Does the excluded target-owner capability present a genuinely consequential
  conflict, leave the decision with the user, and remain outside the design?
- Do assertions require actual judged output, with the negative finding naming
  both consent and the user-owned boundary? Are the cases distinct from the
  existing unrelated migration control?
- Is reuse limited to the established evaluator, with no manufactured receipt,
  alternate reviewer harness or added production behavior?

Sources: feature rows 610/612, ticket 5F5ZZA's accepted plans, current canonical
Execution/Implementation reviewer contracts, and the configured PRINCIPLES.md.
Relevant principle: automate ceremony, not authority. The necessary proof stays
in the owning plan; a consequential excluded capability stays a user choice.
Task-specific paired inputs and independently judged pass/fail outputs follow
the primary evaluation guidance at
https://developers.openai.com/api/docs/guides/evaluation-best-practices.
The current host date is 2026-10-10. No vendor version or live API capability is
asserted: both account-service contracts are explicitly synthetic fixtures.

The wiring-only run /tmp/4200-r15-required-scope-red.json reports two undefined
scenarios, 112 cleanup steps passed, two actor steps skipped and four undefined
steps. It is retained as wiring evidence, not a production defect RED. The
existing-behavior characterization may pass without a production change. The
RGR outline is still unchecked; do not represent review approval as retroactive
production RED or whole-epic acceptance.

The separate current-head CI collector failure occurred before authorization
assertions: its child process did not become ready within the existing one-second
polling limit. All 153 collector tests pass locally unchanged. No collector
production or test code is included in this change.

First live run passes both cases (118 reporter steps, 3m23s). Independent
review 8cebdea7-1d37-42ac-bd0b-856906d2cf50 correctly rejects the required
decision proof as non-discriminating: approval of an already-resolved plan does
not establish rejection of an endpoint-only substitute. The correction adds
the paired negative with identical accepted CLI boundary and guidance, and
requires two judged findings naming missing CLI refusal/exit-code proof. It
uses the same evaluator inside the existing Then, not a new production path.
The scope-choice assertion now requires explicit user decision or scope-choice
language rather than matching any mention of a user. Its judge continues to
reject reviewer-owned scope expansion; a broad directive regex would also
reject legitimate quotations of the candidate, so no such proxy is added.
The unresolved consent conflict is a load-bearing design decision under the
canonical Implementation contract's Direction and completeness and Focused
decision path clauses; raising that conflict does not approve a feasible
design. No wording is changed merely to force the expected verdict.

Paired evaluation selects two report directories in one Cucumber world. The
existing helper previously remembered only the latest directory; it now keeps
both and removes both after success, retaining both after a failure. The cheap
two-Given cleanup probe passes and leaves no new evaluator directories:
/tmp/4200-r15-cleanup-check.json and /tmp/4200-r15-cleanup-check.log. Its temporary
feature is removed. This is fixture cleanup evidence, not semantic acceptance.

Paired run /tmp/4200-r15-paired-required-scope-live.json passes the required-proof
case including its negative control, but fails the scope-choice local assertion.
All three retained scope-choice reviews and judges correctly reject the design
and explicitly state "Decision owner: the user". The assertion omitted that
equivalent owner declaration. It now accepts that exact declaration alongside
the existing explicit user-choice phrases; it does not restore a broad "user"
match. The prior failure remains retained. Reviewer 9187ade1-fde8-461e-90d6-15bab2656fe0
approved the paired structure with semantic-judge fidelity limits. Helper review
fb4621eb-e747-423e-8f03-52635a34fcd2 approves cleanup with optional diagnostics
warnings. The actual producer's fixed manifest and score function enforce
three runs; adding duplicate count enforcement or select-without-run guards is
unnecessary for this owned sequence. Packet-write failure cleanup is a minor
pre-existing limitation outside this change.
