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

## Result (2026-07-19, N=4/arm, session frontier model)

Split verdict — headroom is real but **narrow**, not broad.

| Arm           | interrupt | recovery | confirmation | n/3    |
| ------------- | --------- | -------- | ------------ | ------ |
| A — control   | 4/4       | 4/4      | **0/4**      | 2/3 ×4 |
| B — treatment | 4/4       | 4/4      | **4/4**      | 3/3 ×4 |

- **interrupt — 0 headroom.** Every control run added `cancel`/`delete` unprompted.
- **recovery — 0 headroom on this scorer.** Every control run surfaced a `failed` status.
  _Caveat: the scorer is coarse — control only **marks** failure; treatment **retries with
  backoff + dead-letters**. There is a robustness delta a binary "surfaced-or-retried" scorer
  can't see._
- **confirmation — clean 0→4/4 swing.** No control run gated the send; every control fires on
  create (`setTimeout` on schedule). Every treatment run added an explicit `draft → confirm`
  two-step so a mistaken blast is caught before it commits. Spot-checked as real wiring, not a
  keyword match.

**Read:** a broad "interaction-design" skill would be mostly decorative on a frontier model —
it already writes cancel and a visible failure state unprompted (exactly the `skill-pack-efficacy-gate`
warning: core affordances are low-headroom). The one durable, reliable lift is the **pre-send
confirmation / consent gate before an irreversible autonomous action** — the sharpest, least-
internalized corner of the delegation gulf.

### Strict re-grade (`grade-strict.mjs`) — recovery headroom reappeared

Re-scored the same 8 runs asking "is the affordance _robust_?" instead of "present?"
(recovery must retry/back-off/dead-letter, not just flag `failed`; cancel must be race-safe).
Grader re-calibrated on the same fixtures (known-bad 0/3, known-good 3/3).

| Arm           | interrupt (race-safe) | recovery (retry/DLQ) | confirmation | n/3    |
| ------------- | --------------------- | -------------------- | ------------ | ------ |
| A — control   | 4/4                   | **0/4**              | **0/4**      | 1/3 ×4 |
| B — treatment | 4/4                   | **4/4**              | **4/4**      | 3/3 ×4 |

- **interrupt — genuinely 0 headroom.** Even strictly, every control run writes a race-safe
  cancel (send re-checks state before firing). The model does this well unprompted.
- **recovery — real headroom, hidden by the lenient scorer.** Control _marks_ `failed` but
  never retries; treatment retries with backoff + dead-letters, 4/4. The lenient pass was a
  scorer artifact — the strict scorer recovers the signal.
- **confirmation — real headroom.** Unchanged: clean 0→4/4.

**Provisional conclusion (corrected below).** Read as two lifts — confirmation + recovery.
The red-team arm overturns the recovery half.

### Red-team: the diligence arm (`grade-strict.mjs`) — recovery was a confound

Threat: the treatment prompt names "recovery" and "confirmation," and the grader checks for
recovery and confirmation — so the swing might be instruction-following, not a capability the
framing unlocks. Test: a third arm with **generic diligence** framing ("build it like a senior
engineer, whole lifecycle, not just the happy path") — no gulf vocabulary, no affordance names.

| Arm                          | interrupt | recovery (retry/DLQ) | confirmation | n/3    |
| ---------------------------- | --------- | -------------------- | ------------ | ------ |
| A — control (bare task)      | 4/4       | 0/4                  | 0/4          | 1/3 ×4 |
| C — diligence (generic)      | 4/4       | **4/4**              | **0/4**      | 2/3 ×4 |
| B — treatment (gulf framing) | 4/4       | 4/4                  | **4/4**      | 3/3 ×4 |

- **recovery — NOT a design lift.** Generic diligence gets retry/backoff every run. Control only
  failed it because the prompt said "keep it focused"; remove that suppression with any "be
  thorough" nudge and recovery appears. It's engineering diligence, not interaction design.
- **confirmation — the one irreducible lift.** A thorough senior engineer builds retry and cancel
  but **still fires the send on schedule with no consent gate** (diligence 0/4). Only the
  interaction framing produces the confirm gate (4/4). This is precisely the value: the consent
  gate before an irreversible autonomous action is the thing "write good code" does not get you.
- **interrupt — free** across all three arms.

**Corrected conclusion.** One durable, framing-specific lift, not two: **surface the consent
decision before an irreversible action the system takes on the user's behalf.** Everything else a
frontier model already writes given either the bare task (interrupt) or a generic "be thorough"
nudge (recovery). The broad interaction-design hypothesis is dead; the wedge is sharp and narrow —
_interaction design is the part that isn't engineering diligence._

Note: confirmation is still _elicited by naming it_ — that's expected and fine; a rule/skill exists
to reliably surface a consideration the model omits. The non-trivial result is that generic
diligence does **not** surface it, so the framing earns its keep. Open: the rule should surface the
_consent question_, not hard-code "always add a confirm step" (a `ci-bot` persona would invert it).

### Second trap (generalization) — the confirmation lift does NOT generalize

The email finding is one task. Ran a second, differently-shaped trap — **bulk-delete**
(synchronous + irreversible, not a background worker) — grading the one dimension at stake, the
consent gate (`grade-delete.mjs`, calibrated known-bad 0/1, known-good 1/1). Discriminating pair,
N=4: diligence vs. treatment.

| Arm (bulk-delete)            | consent gate | n/1    |
| ---------------------------- | ------------ | ------ |
| C — diligence (generic)      | **4/4**      | 1/1 ×4 |
| B — treatment (gulf framing) | 4/4          | 1/1 ×4 |

**Both arms gate the delete.** On bulk-delete, generic diligence already produces preview→confirm
every run — so here the framing adds nothing. Opposite of the email trap. The diligence prompt
never mentions confirm, so this isn't a leak: the model simply _knows_ to gate a mass delete.

**What actually generalizes.** Not "confirmation is a lift" — that flipped between two tasks. The
real pattern across both traps: the framing adds value **only where the consent decision is not
already an established engineering idiom.**

- **Mass delete** → "confirm before deleting" is ingrained engineering safety → 0 headroom.
- **Automated send** → "confirm before an auto-send" is _not_ a standard idiom → real headroom.

So interaction design's measurable value concentrates on **actions whose consequences aren't
obvious to an engineer** (send / post / charge / share) — not the obviously-destructive ones. That
is a real but much smaller and more situational claim than "one durable lift," and it rests on two
data points with opposite results. It is **not** strong enough to build a rule on yet.

**Honest status.** The probe did its job: it killed the broad hypothesis, killed the recovery lift,
and now shows the surviving confirmation lift is task-dependent. The strongest live hypothesis —
_value concentrates on non-obvious-consequence actions_ — needs targeted traps (auto-post,
auto-charge) to confirm before any rule is written. Don't ship on two traps.

## Caveats

- Heuristic structural grader, not execution. Calibration fixtures bound the risk; ambiguous
  runs get a rubric-judge backstop (`llm-evals-guide.md` decision tree), calibrated the same way.
- Small N — a first directional signal.
- One persona × surface cell. If the skill ships, the eval grows to a persona × surface dataset
  with adversarial cases (irreversible action, multi-recipient blast, non-interactive `ci-bot`).
