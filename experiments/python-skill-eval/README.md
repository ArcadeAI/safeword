# Spike: does `jeffallan/python-pro` change what an agent writes? (#538 efficacy gate)

Necessary-condition probe before trusting the Python skill pack's always-on picker
cost. Method per `.project/learnings/skill-pack-efficacy-gate.md` and the
`experiments/go-skill-directive` precedent: novel trap, deterministic
behavior-grader, control-vs-treatment, directional go/no-go (not a production
rate).

## Trap (novel — not from any public benchmark, to dodge contamination)

`trap/prompt.md`: implement `async def fetch_all(urls, fetch)` that fetches
concurrently, returns results in input order, and **fails fast** — if any fetch
raises, cancel the other in-flight fetches and propagate.

The discriminating idiom: `asyncio.TaskGroup` (3.11+) cancels siblings on failure;
the default reach `asyncio.gather(*tasks)` propagates the first error but **leaves
siblings running** (orphaned leak). `python-pro` teaches structured concurrency /
async cleanup; bare-gather is the high-headroom default mistake. No defensible
exception: the spec explicitly requires cancellation.

## Grader (`grade.py`) — behavior, not vocabulary

Runs the candidate's `fetch_all`: (1) success path returns ordered results; (2)
fail-fast path — one fetch raises fast, a slow sibling must be **cancelled** (the
grader waits past the sibling's runtime to detect a leak). PASS iff sibling
cancelled + failed fast. A correct _manual_ cancellation solution PASSES too — we
grade the observable effect, never the API name (grader independence). No LLM
judge.

    python grade.py path/to/solution.py   # prints PASS/FAIL [api], exits 0/1

`ref/` holds two fixtures that validate the grader: `taskgroup_ok.py` (must PASS),
`gather_leak.py` (must FAIL — sibling leaks).

## Arms (staged)

- **Headroom probe (control-only, N=4):** trap prompt, no skill. If controls already
  write TaskGroup/correct cancellation → **zero headroom, pivot** (to async-context-
  manager cleanup or Protocol) before building arms. _Run this first._
- **Arm 1 — content (force-fed), N=4:** trap + `python-pro` body inline. Necessary gate.
- **Arm 2 — delivered, N=4:** trap + `python-pro` _installed_ + the real nudge line;
  the agent must choose to open it. Measures delivered value + the picker question.
  Diagnostic: Arm 1 swings but Arm 2 flat ⇒ delivery (nudge) problem, not the pack.

Pass = clean 0/N→N/N content swing **and** non-zero delivered lift. Results logged
below per run.

## Results

### Headroom probe (control-only, N=4) — structured-concurrency trap: **0 headroom, abandoned**

4/4 controls (no skill) already wrote a correct fail-fast solution that cancels
in-flight siblings — graded by `grade.py` (behavior, not API):

| Control | API reached for                   | Grade |
| ------- | --------------------------------- | ----- |
| 1       | `TaskGroup`                       | PASS  |
| 2       | `TaskGroup`                       | PASS  |
| 3       | `TaskGroup`                       | PASS  |
| 4       | manual `gather` + cancel-on-error | PASS  |

`asyncio.TaskGroup`/structured concurrency is **already default behavior** for
frontier models in 2026 — the trap has no headroom, so `python-pro` can't lift it.
Same shape as the Go race trap (12/12 controls safe). The arms were NOT built; a
no-headroom trap can't produce a meaningful swing.

**Cross-language pattern (Go + Python):** the _obvious_ idioms these packs teach —
data races, structured concurrency — are already internalized by strong models.
Headroom lives only in a narrow band of genuinely-subtle, no-defensible-exception
idioms (Go's context-in-struct was the one that swung). Python's flexibility makes
that band even thinner: most candidate idioms (Protocol vs ABC, blocking-in-async
for a tiny read, `typing.IO` vs Protocol) have a _defensible alternative_, which
disqualifies them as clean traps. Finding python-pro's equivalent of
context-in-struct, if one exists, needs more candidate probes.

Artifacts: `control/{1..4}/solution.py`, `ref/` (grader fixtures).
