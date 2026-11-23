# Authenticated Reduced-Independence Planning Review Fallback

**Date:** 2026-09-20
**Status:** Historical fallback design. [Current route eligibility](independent-review-never-blocks.md) supersedes the prior-attempt and reviewer-strength requirements.

When headless routes cannot complete a planning review, the coordinator can hand the sealed packet to the host. The continuation must remain bound to the original job, the reviewed inputs, and the tier that completed the review. The resulting receipt records reduced independence. A host cannot grant a stronger receipt by describing its own work as independent.

The original proposal required a failed independent launch before fallback. Later proposals compared the author and reviewer models to classify their capabilities and decide which reviewers could launch. Those restrictions could strand a plan when no independent candidate could launch. K8VPME retired them. The [coordinator](../../packages/cli/src/review/coordinator.ts) owns routing and the [ledger tests](../../packages/cli/tests/hooks/review-ledger.test.ts) cover reduced receipt admission.
