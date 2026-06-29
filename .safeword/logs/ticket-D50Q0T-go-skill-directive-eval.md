# Work Log — D50Q0T: Go-skill directive eval (spike)

Issue: #482 smallest slice. Anchors: #482 (feature), #495 (Codex dep), learnings/capability-claims-need-vendor-docs.md.

## Frame (intent · done · riskiest assumption · cheapest test)

- **Intent:** Answer #482's gating question — does *injecting a directive that names the Go skill* change what the agent writes, vs. the agent merely having the skill available?
- **Done (measurable):** A directional trap-avoidance rate for ≥1 golang trap across arms, + a reusable deterministic grader. Not a production number — a go/no-go signal.
- **What must not break / reversibility:** Lives under `experiments/` (safeword's eval home, cf. `experiments/gepa-review-spec/`); touches no product code, no `packages/cli/src`. Fully reversible.
- **Riskiest assumption:** That a container sub-agent harness can *faithfully* reproduce Claude Code's **native skill-description triggering** (arm B). It can't — sub-agents don't have CC's skill runtime. So the faithful B-vs-C is a follow-up needing real CC sessions.
- **Cheapest honest test (this spike):** A **3-arm proxy** with sub-agents, content held constant:
  - **A (control):** trap task, no skill, no directive.
  - **B' (skill available):** trap task + skill content provided, agent free to use or ignore (proxy for "installed, not surfaced").
  - **C (directive):** trap task + skill content + explicit "consult golang-error-handling before writing."
  Grade each output deterministically against the trap. This measures the *ceiling* of the directive's value (does naming it + providing it change trap-avoidance), which is necessary-but-not-sufficient: if C doesn't beat A here, the faithful version won't either.

## Pattern (from `experiments/gepa-review-spec/`)

- Deterministic grader against **seeded** ground truth — no LLM judge (sidesteps self-grading/verbosity bias the quality-reviews flagged).
- For Go: the trap is a known wrong-default; the grader is a Go-specific static check (e.g. errors checked + wrapped with `%w`), not a model.

## Plan

1. Fetch real samber `golang-error-handling` SKILL.md @ v1.5.1 (pinned — content held constant).
2. Define 1 trap with a natural wrong default (samber-style) + deterministic grader.
3. Build `experiments/go-skill-directive/` runner: 3 arms × N runs via Agent tool; grade; report rates.
4. Run, log the directional result, decide go/no-go in the ticket.

## Log

- 2026-06-27T12:56Z Started: ticket D50Q0T created; framed spike (proxy 3-arm, deterministic grader, content pinned). Faithful native-trigger arm explicitly deferred.

## Run 1 — result: harness valid, experiment design NOT yet valid (don't trust the number)

**Harness: validated.** Deterministic `-race` grader discriminates (known-racy→FAIL with race+lost-increments; known-mutex→PASS) and runs on real agent output (control-1, control-4 atomic → PASS).

**Run (4 control / 4 directive, golang-concurrency shared-counter trap):** all 8 produced `sync/atomic` → ~100% pass both arms → **no measurable A-vs-C gap.** This number is NOT trustworthy — two confounds:

1. **Filesystem contamination (harness bug).** Sub-agents share the repo working dir. A control agent *wrote* `counter.go` into `experiments/go-skill-directive/`; later agents read + echoed it (not independent samples). Removed the stray file. **Fix:** forbid file I/O in the arm prompt ("respond with code in your message only; do not read/write files"), parse code from the message, never from disk; or per-agent worktree isolation.
2. **Trap too easy → no headroom (design bug).** Even the *independent* controls (1, 4) wrote `atomic` unaided. The canonical shared-counter race is common knowledge for a current strong model. Mirrors samber's own caveat (their 61%-without was on 4.6-class models; high-baseline traps show low delta). With A already ~100%, C cannot beat it — the trap can't answer the gating question.

**Design tension surfaced (the real finding):** the traps that are *deterministically gradeable* (concurrency races, `-race`) are the ones strong models already pass; the traps with real *headroom* (premature-interface 1/5, context-in-struct 3/5 — design judgment) need an **LLM judge** — the thing I deliberately avoided. Can't have both with this trap.

**Corrected next step (before any A-vs-C number is trusted):**

- (a) Isolation fix: message-only output, parse from response.
- (b) Find a deterministically-gradeable trap *with* headroom — try subtler concurrency bugs current models still miss: concurrent map write (panic), check-then-act on a map, `sync.WaitGroup.Add` inside the goroutine, errgroup/context cancellation. If strong models clear those too →
- (c) accept a judged eval for a high-delta *design* trap (interface/context), with the judge reliability spot-checked.

**Decision point for the user:** keep chasing a deterministically-gradeable trap with headroom (cheap, rigorous, may not exist for strong models), or switch to a judged design-trap eval (real headroom, needs judge-validation). Recommend (b) first — one more round — then (c) if it clears.

- 2026-06-27T13:0xZ Run 1 logged. Harness committed; experiment design needs a harder trap + isolation before the gating question can be answered.
