# Required-result recovery evidence

Cross-agent executable review 02557913 approved all three independently run RED
examples. The normal receipt gate approved them. The three actual CLI tests now
pass for absent, skipped and failed required results, with exact named recovery,
retained diagnostics and read-only refusal verification. Production correction:
dfc49fb24. The unchanged full-lane positive proof also passed afterward, covering
all 37 cases and 46 distinct required results followed by current verification.

The review asked why the skipped control's runner exited nonzero. A separate
real run retained its full report in skipped-result-actual-report.json.gz and
its diagnosis in skipped-result-runner-diagnosis.json. The selected required
assertion is actually reported as skipped. Exactly one other assertion fails:
the existing bdd-proof-tags registration check rejects a non-executable skipped
declaration. No stale bundle, missing tool or unrelated test caused that failure.

This control proves named skipped-result recovery alongside that registration
failure. The successful-aggregate skipped-result check is supporting unit proof
in bounded-observation.test.ts; it is not a second public-CLI runner-zero claim.
Both actual runner-exit paths use the same required-result grader. The complete
unmodified positive proof confirms the real lane remains runnable.

These are new observer proofs. No historical RED is reconstructed, no original
ledger is closed, and all 33 historical deferrals remain unverified.
