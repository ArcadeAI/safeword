# Independent Review Never Blocks

**Status:** Implemented ([K8VPME](../tickets/K8VPME-judge-review-independence-by-reviewer-agent/ticket.md))
**Date:** 2026-11-07

**Context.** In a user trial, every Claude-authored Execution Plan ended in `REVIEW_ROUTES_EXHAUSTED`. Codex had no admission to review Execution Plans, and the coordinator required a failed independent attempt before it could fall back to Claude. The SessionStart author-model capture also never reached `safeword review run` (the env line lacked `export`; headless `claude -p` sends no model), so every Claude-authored planning review was downgraded, and Codex authors always were.

**Decision.** A review counts as independent when a different agent performs it. Safeword still tries a different agent first, but when none can review for any reason (absent, signed out, failed, unfunded by the run budget, or stopped after an unstoppable reviewer) it falls back to the same agent and records `reduced` independence. If no route completes, the planning review continues on the host. Reviewers are not ranked against the author's model. `require` is retired and read as `prefer`.

**Consequences.** Receipts name the reviewer and record the independence achieved. A `reduced` receipt can satisfy phase admission. Reviewers are not qualified: every review kind uses the latest Opus (`opus`) or Sol (`gpt-6.1-sol`) first and may retry on Sonnet or Terra.

**Supersedes.** The [planning fallback precondition](authenticated-reduced-independence-planning-review-fallback.md) ("at least one actual independent attempt"), the 5F5ZZA capability-classification extension (author-model capability pairs, `reviewer_capability_unknown` / `reviewer_capability_weaker`, `AUTHOR_CAPABILITY_UNKNOWN`), `require` enforcement, the MR5M3A `crossModelReview` ceiling, and Execution Plan reviewer qualification (the 63-case conformance corpus and admission evidence).

**Alternatives.** Fix the author-model `export` and keep strength ranking: rejected because strength ranking would exclude specialist reviewers and headless hosts still supply no model. Keep `require` as opt-in: rejected because it reintroduces blocking.

**Reassess when.** A host can attest the author model, or reduced-independence reviews show materially worse defect detection.

**Implementation.** Ticket `K8VPME`; `coordinator.ts` route loop and host continuation, `policy.ts`, `phase-admission.ts`, `delivery-admission.ts`, `review-ledger.ts`; `session-author-model.ts`, the Execution Plan conformance corpus and admission, and the reviewer capability harness removed.
