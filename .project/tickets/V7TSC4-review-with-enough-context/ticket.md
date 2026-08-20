---
id: V7TSC4
slug: review-with-enough-context
type: task
phase: implement
status: in_progress
scope:
  - guide quality-review to keep authored work as the review target while passing only directly relevant source, tests, contracts, or plans as supporting context
  - prove the target/context distinction, minimum-context rule, and context-dumping rejection in the shipped skill contract
out_of_scope:
  - changing review packet limits, coordinator routing, reviewer models, or runtime sandboxing
  - automatically discovering context in the CLI or adding an outer agent wrapper
  - rerunning the remaining benchmark corpus before the default workflow carries the corrected context contract
done_when:
  - quality-review tells every supported agent to pass the minimum evidence needed to validate each target through the existing context boundary
  - guidance keeps supporting files out of the judged target set and rejects broad repository dumps
  - template, Claude, Codex, and dogfood copies remain synchronized and focused contract tests pass
created: 2026-08-20T04:54:38.359Z
last_modified: 2026-08-20T04:54:38.359Z
---

# Review work with enough context to avoid false findings

**Goal:** Give independent quality reviewers the minimum supporting evidence needed to validate each target without reviewing or dumping unrelated files

**Why:** A paired canary showed patch-only review produced a false blocker, while bounded source-and-test context found the real production wiring gap more accurately than an expensive outer agent.

## Behavior

Keep the work-product under review as the accepted target. When a finding cannot
be validated from that target alone, pass the smallest directly relevant source,
test, contract, or plan files through `--context`. Supporting context remains
untrusted evidence: it is not additional work under review and must not become a
repository dump.

## Tests

- [x] The shipped quality-review contract requires minimum relevant context when
      the target alone cannot validate a finding.
- [x] The contract keeps targets distinct from supporting context and shows the
      existing `--context` command shape.
- [x] The contract rejects broad context dumping and names the narrow evidence
      classes that are appropriate.
- [x] Generated and dogfood skill copies stay byte-identical to the template.

## Work Log

- 2026-08-20T04:54:38.359Z Started: Created ticket V7TSC4
- 2026-08-20T05:00:00Z Spike handoff: One paired canary showed that bounded
  implementation-and-test context found the historical production-wiring gap
  that both patch-only review and the outer Terra wrapper missed. Selected a
  guidance-only change over new coordinator architecture.
- 2026-08-20T05:02:00Z TDD: Added a four-surface contract test, confirmed all
  four assertions RED, then added one bounded-context paragraph and command
  example to the canonical skill and regenerated installed copies. Focused
  review guidance, freshness, and coordinator parity suites pass 41/41.
