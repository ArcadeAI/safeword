# Architecture Review Gate (evidence + independent design review for features)

**Status:** Accepted, with reviewer eligibility revised by [Independent Review Never Blocks](independent-review-never-blocks.md).
**Date:** 2026-06-12

The opt-in `architectureReviewGate` checks eligible features as they leave implementation. Each needs cited design evidence and a current design-review receipt, or a reasoned skip. The hook checks that the evidence belongs to the current plan. A reviewer still has to judge the design. Tasks and grandfathered features are exempt.

An advisory prompt alone left design decisions unchallenged. Requiring a different model, an earlier option, also prevented completion when no such route was available. The gate now accepts a current stamp at any achieved independence. See the [receipt admission tests](../../packages/cli/tests/hooks/review-ledger.test.ts).
