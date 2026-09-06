# Behavior Dimensions: Trusted executable RED review

| Dimension | In-scope partitions and boundaries | Excluded partitions |
| --- | --- | --- |
| Execution authenticity | Safeword-produced run; fabricated or author-only output; interrupted/timed-out run | Remote execution service and signed supply-chain provenance |
| Failure attribution | Intended missing-behavior assertion; syntax/import/fixture/configuration/infrastructure failure; unrelated test failure | General scenario-completeness discovery |
| Freshness | Exact sealed inputs unchanged; scenario, proof plan, command, evidence class, proof target, or declared support file changed | Undeclared whole-repository dependency inference |
| Proof identity and reuse | One distinct proof; one Scenario Outline/shared proof implementation; materially different proof implementations | One review per Gherkin row or reused helper |
| Evidence bounds | Canonical argv/cwd/environment identity; exit or signal; bounded stdout/stderr with full-stream digests; source fingerprint | Unbounded logs or secret-bearing environment capture |
| Review availability | Approved; changes requested; routes exhausted with an actionable advisory | GREEN/done blocking before FY1NHB promotion evidence |
| Host parity | One CLI contract invoked from each supported agent runtime | Host-specific duplicate implementations |

Every material partition maps to an acceptance scenario. Exhaustive malformed-attestation fields,
byte limits, path containment, and subprocess edge cases belong in table-driven lower-level tests.
