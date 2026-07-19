# Spike: does gulf-map framing make an agent build the delegation-gulf affordances it otherwise skips?

Issue #1159 · first Done-when (headroom probe before any skill is built).

## Question

Before building a `design-the-interaction` skill, answer the necessary condition:
**when an agent builds a feature that acts on the user's behalf, does interaction-design
framing change the code it writes — or does a frontier model already handle it unprompted?**
If control already writes the affordances, headroom is zero and the skill is decorative
(`skill-pack-efficacy-gate`: prove the needle moves before building delivery).

## Pinned cell

- **Persona:** end-user (non-technical, drives it from the web UI).
- **Surface:** web app.

One cell keeps the trap gradeable. Pulled from the `personas.md` / `surfaces.md` shape a
real project would declare.

## Method (content pinned, arms differ by one thing)

- **Trap** (`trap/prompt.md`): "build a scheduled-email feature." Happy-path framing only —
  it asks for schedule + send and says nothing about cancel, recovery, or confirmation.
  Those are the delegation-gulf affordances we measure; the trap must not leak them.
- **Arms:**
  - **A — control:** trap only.
  - **B — treatment:** trap + `treatment/framing.md` (the gulf-map framing, force-fed).
    Framing is stated at the _gulf_ level ("can the user interrupt a delegated action?"),
    not as implementation instructions ("add a cancel endpoint") — so we test whether
    abstract framing yields concrete safety affordances.
- Run N≈4 coding sub-agents per arm, collect each run's produced code into its own dir,
  grade. Directional go/no-go, not a production rate (matches `go-skill-directive`).

## Grader (`grade.mjs`) — deterministic, three scorers, one dimension each

Grades the **produced code**, not the agent's plan or self-report (self-report is the
internal-seam trap that hid bug #349). Each scorer requires the affordance to be _wired_,
not just a keyword present, to resist coverage theater:

1. **interrupt** — user can cancel/stop a pending scheduled send.
2. **recovery** — an unattended send failure is retried or surfaced, not silently lost.
3. **confirmation** — the send is gated on explicit confirm/approve, not fire-on-create.

```
node grade.mjs <dir|file>   # per-scorer PASS/FAIL + n/3; exit 0 iff 3/3
node grade.mjs --calibrate  # assert fixtures: known-bad 0/3, known-good 3/3
```

## Calibration (run before trusting a single result)

`fixtures/known-bad/` (happy-path-only) must score **0/3**; `fixtures/known-good/`
(all three wired) must score **3/3**. If the grader can't separate these two, its numbers
mean nothing. `--calibrate` enforces this.

## Good-eval gate (from `llm-evals-guide.md`) — answered

1. **User-visible failure caught?** A product ships an autonomous send with no undo/recovery —
   a wrong blast can't be stopped and failures vanish. Yes.
2. **Faster deterministic test?** This _is_ deterministic (structural checks on code).
3. **Dataset has plausibly-wrong cases?** The trap is chosen so control can fail — that's the
   headroom question itself.
4. **Scorer catches known-bad?** Enforced by `--calibrate`.
5. **Clear action on result?** Swing → build the skill. No swing → don't. Go/no-go.

## Result

_Pending run. Log per-arm n/3 and the per-scorer breakdown in the issue work log._

| Arm           | interrupt | recovery | confirmation | n/3 |
| ------------- | --------- | -------- | ------------ | --- |
| A — control   |           |          |              |     |
| B — treatment |           |          |              |     |

Read: a clean **control-fails → treatment-passes** swing (esp. on interrupt + recovery)
means real headroom → build the skill. Control already passing means zero headroom → don't.

## Caveats

- Heuristic structural grader, not execution. Calibration fixtures bound the risk; ambiguous
  runs get a rubric-judge backstop (`llm-evals-guide.md` decision tree), calibrated the same way.
- Small N — a first directional signal.
- One persona × surface cell. If the skill ships, the eval grows to a persona × surface dataset
  with adversarial cases (irreversible action, multi-recipient blast, non-interactive `ci-bot`).
