# Advisory PR Review as a Split-Privilege Evidence Pipeline

**Status:** Accepted — the no-approval/check/merge-capability constraint is narrowed to model-derived publication by [Deterministic Readiness Evidence Status](deterministic-readiness-evidence-status.md) (2026-09-07); the split-privilege rationale stands
**Date:** 2026-08-04
**Supersedes:** none

**Context.** Automatic review must inspect untrusted pull requests, call a model when configured, and publish findings. Fork code must never run with privileged credentials, and model output must never approve a change, publish a required check, or merge it. Draft PR #1917 tested the trigger, parser, and poster. It also exposed three problems: model inspection shared a write-capable parent job, the receipt used a check run, and inspection could start before required checks settled.

**Decision.** The first of three phases uses one serialized, schema-managed `pull_request_target` workflow. A metadata-only job can invalidate the ordinary-comment receipt. A second job reads PR artifacts as data and calls the configured model. It has no checkout or GitHub write permission. The publisher has no checkout or model secret and accepts only a bounded advisory result that passes its schema.

Each new SHA gets a full review. Later phases may add exact-SHA inline comments, reuse of results for changes proven inert or immaterial, finding lifecycle tracking, and finally isolated same-repository execution. The provider-neutral adapter initially supports OpenAI Responses with strict structured output. Configuration selects the provider and model.

**Consequences.** The MVP has no customer-code execution, no positive remedy-verification state, no materiality classifier, and no merge-affecting publication surface. Treat unknown or unreadable artifacts conservatively. Incomplete, failed, or stale states cannot yield a positive result. GitHub stores the receipts. Workflow and endpoint contract tests become security gates. Setup adds the uniquely named workflow through schema reconciliation and remains default-off. The first complete live workflow proof requires the file on a repository's default branch or a disposable fixture.

**Alternatives.** Reuse #1917 unchanged: rejected because a check receipt can affect merge policy and model/publisher authority is not separated by job. Use `workflow_run` after one bundle workflow: rejected because one workflow completion does not mean all repository prerequisites settled and GitHub provides no wildcard workflow list. Use `check_suite` as the universal wakeup: rejected because GitHub suppresses these events for Actions-created suites. Use a single privileged process with a scrubbed child environment: rejected because process hygiene is weaker than job-scoped capability absence. Use an external queue/database: rejected as unnecessary for the first serialized release.

**Reassess when.** GitHub changes privileged-event, job-permission, required-check, concurrency, artifact, or comment semantics; a second provider ships; PR scale exceeds the bounded evidence budget; or distributed workers require a transactional claim store.

**Implementation.** Epic `P0D6S2` / issue #1909, phased into MVP `HXT3GW`, freshness/noise child `Z7M7Y3`, controlled-execution child `436EQW`, and release-hardening child `YC6JCC`. The MVP implements `packages/cli/src/pr-review/`, typed `review-pr inspect\|invalidate\|publish` commands, a default-off schema-managed router/reusable-worker pair, deterministic contract/wiring tests, and guarded `.flux` and disposable-GitHub evaluations.
