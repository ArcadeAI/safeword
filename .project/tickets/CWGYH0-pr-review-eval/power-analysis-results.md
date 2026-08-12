# Paired benchmark power analysis

The analysis code is `power-analysis.ts`. It uses seed `5453573`, three trials
per prompt/case/variant, 1,000 PR-clustered bootstrap resamples, and 5,000
simulated experiments per scenario. For planning, all three trials within one
PR are treated as perfectly correlated; only PR cases contribute independent
information. Outcomes are generated as paired discordances (`A-only`, `B-only`, both, or neither), and a simulated experiment
passes only when the 2.5th percentile of the bootstrapped A-minus-B case mean is
strictly greater than zero.

| Independent PR cases | Power at +0.15 | Power at +0.30 | Power at +0.45 |
| -------------------: | -------------: | -------------: | -------------: |
|                   20 |          16.1% |          49.1% |          87.3% |
|                   30 |          22.1% |          68.1% |          96.7% |
|                   40 |          28.6% |          78.8% |          99.4% |
|                   60 |          40.5% |          93.3% |         100.0% |
|                   80 |          49.4% |          97.8% |         100.0% |
|                  100 |          60.9% |          99.5% |         100.0% |

## Frozen sample decision

- Primary holdout: **80 independent PR cases**.
- Frozen reserves: **20 additional independent PR cases**.
- Trials: **3 per prompt per variant**.
- Minimum practically meaningful effect: **+0.30 paired verified-defect
  recall**, equivalent to roughly one additional named-defect recovery per
  three independent cases.

Eighty cases exceed 97% simulated power for the target effect under the
conservative dependence bound. The previously frozen 30-case holdout has only
68% power under this model and is underpowered for a confirmatory claim; it
must not authorize scaling. A fresh 80-case holdout and 20 reserves must be
registered before a confirmatory run. The reserves handle only pre-declared infrastructure exclusions; they are not
optional cherry-picked replacements.

## Fixed-twin safety rule

The zero-named-hit rule is intentionally severe. Under the conservative
perfect-correlation bound, 80 cases give a 44.8% chance of zero hits at a 1%
per-case named-defect hallucination rate. This is not a reason to weaken the rule: each
fixed twin has executable proof that its named defect is absent. A reviewer
that repeatedly asserts it is not ready to ship.

This analysis does not account for directly falsified _additional_ findings;
those remain a separate zero-tolerance decision condition and require direct
verification against the pinned tree.
