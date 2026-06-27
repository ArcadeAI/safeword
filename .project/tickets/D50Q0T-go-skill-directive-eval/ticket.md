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

## A-vs-C round 1 (context-in-struct) — headroom real, but trap too gray

**Grader:** AST checker for a `context.Context` struct field. Validated (ctx-field→FAIL, ctx-per-call→PASS) AND aligned with samber `golang-context` rule #3 ("NEVER store context in a struct — pass explicitly through function parameters").

**Result (background-worker task, 4 control / 4 directive, isolation fixed):**

- Control: **0/4 pass** (all stored ctx) → **headroom CONFIRMED** (unlike races: 0% headroom).
- Directive (read golang-context skill first): **1/4 pass** (grader-confirmed).

**The catch (read the outputs, not the count):** the 3 "failing" directive agents stored ctx **with explicit justification comments** — they engaged rule #3 and chose the *defensible* lifecycle-ctx exception. A background worker with no incoming per-call context is the contested gray-area case; storing ctx+cancel for it is genuinely debated. So the binary grader marks reasoned-exception == lazy-violation and **undercounts the directive's visible effect** (it changed reasoning + got 1 full compliance).

**Meta:** even a "validated" grader had a validity gap (too strict for a gray task) — caught only by reading the actual source, not the pass/fail tally. (Same lesson as `capability-claims-need-vendor-docs`: look at the artifact.)

**Next:** refine to an **unambiguous** context-in-struct trap — a request-scoped context stashed in a struct (e.g. an HTTP service that stores the incoming request's `ctx` in a field for later use). No defensible exception → the skill should produce a clean A-vs-C lift. Re-run, then commit the (refined) trap + AST grader into `experiments/go-skill-directive/`.

## A-vs-C round 2 (request-scoped context-in-struct) — CLEAN SIGNAL

Refined to an unambiguous trap (request-scoped `RequestScope` carrier; no lifecycle-ctx defense). Grader: AST checker (committed, `experiments/go-skill-directive/grade-ctx.sh`, catches embedded + named `context.Context` fields), validated + aligned with golang-context rule #3.

**Result: control 0/4 pass · directive 4/4 pass** — clean 0→100% swing, grader-confirmed.

- Control: all 4 stored ctx in the struct (1 embedded `context.Context`).
- Directive (read+follow golang-context skill): all 4 refused; several cite rule #3.

**Answers #482's gating question:** surfacing the Go judgment skill eliminates an idiom error the model otherwise makes every time, on a deterministically-graded trap with real headroom.

**Caveats (honest):** strongest arm-C form ("read this skill + follow it") — proves the *content* moves behavior, not yet that the prompt-hook *directive* triggers it live (next layer). n=4. Round-1 lifecycle-ctx trap abandoned (too gray).

**Committed harness:** `experiments/go-skill-directive/{trap-context/,checker/,grade-ctx.sh}`. Status: gating question answered YES; next = test the faithful injection mechanism (prompt-hook directive in a real session) per #482.

## 3-arm result — the directive adds NOTHING over availability (reframes #482)

Added arm B (skill AVAILABLE, agent chooses — the native-triggering analog):

| Arm | Pass | |
|-----|------|--|
| A control (no skill) | **0/4** | model makes the error every time |
| B skill available ("read if useful") | **4/4** | agent reads it + follows it |
| C directive (read+follow mandated) | **4/4** | no better than B |

**B == C.** Once the agent is *aware a relevant skill exists*, it uses it — whether merely told it's available (B) or explicitly directed (C). The deterministic directive's marginal value over awareness is **zero** here. The only thing that moves the needle is the agent KNOWING the skill exists (A had no skill at all → 0/4).

**Reframe for #482:** the value is **awareness**, which **native description-triggering already provides** (the skill's description sits in the agent's available-skills list). The elaborate prompt-hook *directive* machinery (the #482 "integration layer") is likely **unnecessary** — this is the no-bloat answer: *just deliver the skill; let native triggering surface it.*

**The one caveat that could still justify a directive — RELIABILITY:** arm B pointed at ONE clearly-relevant skill ("a Go context skill is available, read if useful"). Real native triggering puts the skill's description among ~40 others; the agent must self-notice it's relevant. So the directive's *only* possible remaining value is improving awareness **reliability** (closing silent-misses where native triggering doesn't fire) — NOT changing behavior once aware. That is exactly the "silent-miss" risk, and it needs the **live multi-skill session test** to measure (can't be done in a sub-agent harness).

**Recommendation pivot (pending user):** make native-description-triggering the primary (just install the skill); treat the prompt-hook directive as a *deferred reliability backstop*, built only if live testing shows native triggering silently misses. Update #482 accordingly.

## CORRECTION — both arms pointed at the specific skill (self-selection untested)

Review caught an overreach: arm B and arm C BOTH handed the agent `golang-context` by file path (B: "read if useful"; C: "read and follow"). So:

- **Proven:** skill content fixes the error when surfaced (0→4/4); force vs offer makes no difference (B==C).
- **NOT proven:** that the agent self-finds the right skill among ~40 unaided — both arms pre-solved that.
- The full-list reminder (impl-plan + each scenario) exists to assist that untested self-selection step. The "reminders are redundant" pivot was wrong; the live picker-only-vs-reminder test is the genuine go/no-go.
