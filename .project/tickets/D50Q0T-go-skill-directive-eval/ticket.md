---
id: D50Q0T
slug: go-skill-directive-eval
type: task
phase: intake
status: in_progress
created: 2026-06-27T12:42:28.031Z
last_modified: 2026-06-27T12:42:28.031Z
---

# Spike: does an injected Go-skill directive beat native description-triggering? (2-arm eval, Claude-only, samber pinned)

**Goal:** {One sentence: what are we trying to achieve?}

**Why:** {One sentence: why does this matter?}

## Work Log

- 2026-06-27T12:42:28.031Z Started: Created ticket D50Q0T

## Work Log

- 2026-06-27 Started (#482 slice). Built `experiments/go-skill-directive/`: trap + deterministic `go test -race` grader (no LLM judge, per `experiments/gepa-review-spec` pattern). Grader validated (racy→FAIL, mutex→PASS).
- 2026-06-27 Run 1 (4 control / 4 directive, samber golang-concurrency @v1.5.1 pinned): **inconclusive — don't trust.** Two confounds: (1) sub-agents share the repo FS → one wrote counter.go, others echoed it (contamination); (2) trap too easy — independent controls already wrote `atomic` unaided → no headroom (matches samber's "high-without/low-delta" caveat). All 8 passed; A-vs-C gap unmeasurable.
- **Key finding:** deterministically-gradeable traps (concurrency races) are low-headroom for current strong models; high-headroom traps (interface/context design) need an LLM judge. Tension to resolve before a trustworthy number.
- **Next:** (b) isolation fix (message-only output) + a subtler deterministic concurrency trap with headroom (concurrent map write, check-then-act); if strong models clear those, (c) judged design-trap eval. Decision pending: deterministic-with-headroom vs judged.
- Status: harness done + committed-ready; experiment design needs another iteration. NOT done.
