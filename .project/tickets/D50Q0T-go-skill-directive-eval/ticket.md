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

## Decision (figure-it-out): grader design — Option C (static-assertion on idioms)

**Evidence (current-model headroom probes, isolation fixed, message-only):**

- race-counter trap: 8/8 control safe (atomic/mutex). map-write trap: 4/4 control safe (RWMutex).
- → Deterministic-via-`-race`/crash has **~0% headroom** on the current strong model. Option A (race/crash grading) is empirically dead.

**Decision:** Grade via **static assertions on subtle idioms** (samber's actual method), NOT race/crash. Lead candidate: **`context-in-struct`** (storing `context.Context` as a struct field) — deterministically AST/grep-checkable AND samber measured headroom (3/5 without on 4.6-class). Judge (Option B) only for genuinely semantic traps, with reliability spot-check.

**Premortem / strategic:** base models keep improving past these idioms; if `context-in-struct` also shows ~0% headroom, that erosion **is the #482 answer** — Go skills add little for current strong models on common cases; lift survives only on the hardest design judgment. A valid go/no-go, not a harness failure.

**Next:** probe `context-in-struct` headroom (4 control, static grader). Fail unaided → build A-vs-C on it. Pass → switch to judged design-trap eval + record the erosion finding.
