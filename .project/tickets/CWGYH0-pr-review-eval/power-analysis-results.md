# Paired benchmark power analysis

The analysis code is `power-analysis.ts`. It uses seed `5453573`, three trials
per prompt/case/variant, 1,000 PR-clustered bootstrap resamples, and 5,000
simulated experiments per scenario. Outcomes are generated as paired
discordances (`A-only`, `B-only`, both, or neither), and a simulated experiment
passes only when the 2.5th percentile of the bootstrapped A-minus-B case mean is
strictly greater than zero.

| Independent PR cases | Power at +0.15 | Power at +0.30 | Power at +0.45 |
| ---: | ---: | ---: | ---: |
| 20 | 44.9% | 93.8% | 99.9% |
| 30 | 59.4% | 99.1% | 100.0% |
| 40 | 71.5% | 99.9% | 100.0% |
| 60 | 86.4% | 100.0% | 100.0% |

## Frozen sample decision

- Primary holdout: **30 independent PR cases**.
- Frozen reserves: **10 additional independent PR cases**.
- Trials: **3 per prompt per variant**.
- Minimum practically meaningful effect: **+0.30 paired verified-defect
  recall**, equivalent to roughly one additional named-defect recovery per
  three independent cases.

Thirty cases exceed 99% simulated power for the target effect while avoiding
the much larger corpus needed to establish a marginal +0.15 difference. The
ten reserves handle only pre-declared infrastructure exclusions; they are not
optional cherry-picked replacements.

## Fixed-twin safety rule

The zero-named-hit rule is intentionally severe. With 30 cases and 90 fixed
trials, even a 1% per-trial named-defect hallucination rate has only a 40.5%
chance of producing zero hits. This is not a reason to weaken the rule: each
fixed twin has executable proof that its named defect is absent. A reviewer
that repeatedly asserts it is not ready to ship.

This analysis does not account for directly falsified *additional* findings;
those remain a separate zero-tolerance decision condition and require direct
verification against the pinned tree.
