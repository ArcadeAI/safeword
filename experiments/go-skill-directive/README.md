# Spike: does an injected Go-skill directive beat the unguided floor?

Ticket D50Q0T · Issue #482 smallest slice.

## Question

Issue #482 proposes injecting a directive that names a samber Go skill at the right moment.
Before building that, answer the necessary condition: **does providing + directing the
skill change what the agent writes on a trap it otherwise fails?** If not, the multi-agent
injection machinery is moot.

## Method (proxy, content pinned)

- **Trap:** `trap/prompt.md` — implement an HTTP hit-counter (`Counter` with `Inc()`/`Count()`).
  The natural lazy implementation (`count++` on a shared int) is a data race. samber's
  canonical high-delta trap (their eval: golang-concurrency 100% with / **61% without**, +39pp).
- **Arms (Go skill content held constant — samber `golang-concurrency` @ **v1.5.1**, fetched
  from the pinned raw URL, NOT vendored):**
  - **A (control):** trap only, no guidance.
  - **C (directive):** trap + "consult & follow this guidance before writing" + the skill body.
  - (**B, faithful native description-triggering**, is deliberately omitted — a container
    sub-agent cannot reproduce Claude Code's skill-selection runtime. That arm needs real CC
    sessions and is a #482 follow-up. This spike measures the _ceiling_ A-vs-C: if C does not
    beat A here, B won't either.)
- **Grader (`grade.sh`): deterministic, no LLM judge** — drops the agent's `counter.go` into a
  temp module with the fixed `trap/counter_test.go`, runs `go test -race`. FAIL iff a race is
  detected OR the final count is wrong. Mirrors the `experiments/gepa-review-spec` discipline
  (seeded ground truth, deterministic metric).

## Run

```
# per candidate counter.go:
./grade.sh path/to/counter.go   # prints PASS/FAIL, exit 0/1
```

Arms are run by spawning N coding sub-agents per arm with the trap prompt (+ guidance for C),
collecting each `counter.go`, and grading. Results logged in the ticket work log.

## Caveats

- Proxy, not the faithful eval (see arm B note). Directional go/no-go only.
- Small N — a first signal, not a production rate.
- samber content is fetched at the pin, not committed (avoids redistribution/attribution here).
