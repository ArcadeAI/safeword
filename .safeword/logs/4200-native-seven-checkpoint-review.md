# Native Implementation Plan proof checkpoint

Review the current native driver and scope fixture, including their trust and
test-quality boundaries. Seven actual examples pass in
/tmp/4200-native-seven-preflighted.json: R11 finding authority (507/508), R12
binding scope (547/548), and R13 bidirectional completeness (572/573/574).
There are 21 real qualified Sol coordinator calls, 21 pinned Sonnet judges,
seven known-bad judge calibrations, and 413 reporter steps including cleanup.
Positive admission requires a successful authenticated stamp and an allowing
installed hook; negatives require the judged named defect, the exact
changes_requested receipt refusal, and hook denial. No neutral verdict is
copied into an authenticated job. Plan bytes remain unchanged during review.

The stronger admission control found fixture mistakes, not production defects:
missing simulated author session, receipt verification through the released
instead of current generated plugin, incomplete native plan sections, missing
parent reconciliation, and omitted reviewer model on the stamp. Fix only the
fixture's author/session/configuration and existing public setup calls. Both
CLI and generated distribution recognize the same job; the released bundle
correctly sees a different canonical contract. Do not weaken currency checks.
The generated distribution is outside the reviewed fixture and is not mocked.

All seven cheap Given-only preflights pass before the live run: 399 reporter
steps, 3.7 seconds. Their temporary feature is removed. Each fixture checks the
real plan-section parser and that the initial native refusal asks for the
Implementation review, rather than some unrelated missing prerequisite.

Prior semantic passes and failed native runs remain recorded. The historical
R12 ledger row is immutable; its weaker writer-refusal claim was withdrawn and
current acceptance reopened until this corrected run. Initial R11 wiring RED
520784a8-de1a-4d8a-a1b0-1c7537c2eaa8 was approved. Initial R13 wiring RED
950aef28-1d68-4c81-83b3-c6dda6a4bc6c was rejected for skipping the actor boundary.
Do not call that rejected RED approved or invent a missing production behavior.
The applicable testing skill explicitly allows passing characterization of
existing code (lines92 and258); R13's actual result is such characterization.
Its RGR ledger decision remains open, separately from its passing live proof.

Retained fidelity limits: schema-derived local Claude hook settings after a
Cursor install do not verify native Claude profile enrollment. The hook gates
an Edit and guides the simulated author to the public coordinator; it does not
itself launch the model review. R12's positive checks dispatch, while the R11
and R13 positive controls additionally enforce real admission. Parent scope
acceptance is test-owned fixture setup through the actual reconcile command,
not a reviewer choosing human scope. Source and reviewer qualification corpora,
models, thresholds, production prompts and runtime policy remain unchanged.
