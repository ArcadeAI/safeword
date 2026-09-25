# Skill-Eval Optimization Guide

How to decide whether a change to a **skill's prompt** is actually better — by
evidence, not taste. A seeded-defect corpus plus a regression gate adjudicate the
change before it ships. Built and proven on `review-spec` (epic 7ZLTWB).

**See:** `@.safeword/guides/llm-evals-guide.md` for evaluating AI features in
general; **this** guide is the narrower method for optimizing a skill's _prompt_.
`@.safeword/guides/llm-writing-guide.md` for prose principles.

---

## When to use this

Reach for this method when all of these hold:

- You want to change a skill's prompt (tighten, expand, compress, re-order) and
  need to know the new version is better before shipping it to users.
- The skill emits discrete **findings** (detections, flags, classifications) you
  can seed known-good and known-bad cases for.
- A defect can be **seeded deterministically** — take a clean input, introduce one
  known flaw, and the mutation itself IS the label (no human or LLM judge needed).

Do **not** use it when:

- Quality is human-judgment-bound with **no seedable ground truth** — e.g. a PR
  reviewer, where "is this a real defect worth a comment" needs a human. Seed
  nothing; use a real corpus + human triage instead (see _When this doesn't fit_).
- A normal deterministic test proves the behaviour faster (see the evals guide's
  decision tree).

---

## The method (five parts)

Each part answers a failure the one before it exposes.

### 1. Certified-clean corpus + seeded defects

Build fixtures from a **certified-clean** base (reviewed to contain zero real
defects), introducing **one mutation per fixture** — the mutation operator IS the
label. Score with **deterministic set-matching** (did the skill's findings match
the seeded defect?), never an LLM judge — that sidesteps judge bias entirely. Keep
two scores **decoupled** and never collapse them into one headline (an F1 is
gameable): **recall** over seeded defects, and **false alarms** counted ONLY on
certified-clean fixtures (precision over an under-labelled corpus is unidentifiable).

### 2. Relative recall floor

Don't require 100% recall — some defects the base model systematically misses, so
an absolute floor is unsatisfiable. Protect only what the **baseline prompt reliably
catches**: run the baseline k times, majority-vote (`⌈2k/3⌉`) the seeds it catches
into a **protected set**, and reject a candidate only if it misses a protected seed.
Systematically-missed seeds stay MEASURED but never gate. The floor is **per-seed**,
not aggregate, on purpose — that is what stops a candidate trading real recall for a
cleaner false-alarm number.

### 3. Multi-run consensus gate

A single run is too noisy to gate on — with no temperature set, default sampling
makes even the baseline miss a protected seed ~⅓ of runs, so a one-run gate
spuriously rejects good candidates. Run the candidate N times and require each
protected seed caught on a **`⌈2N/3⌉` consensus** — the same supermajority that
defined the floor.

### 4. Tier-2 real-harness gate

The bare-model API proxy **oversells** the gain — it runs the prompt in a clean,
short context the real harness never has. Run the finalist through the real harness
(`claude -p`, full system prompt + tools) as the honest ship gate. Measured on
review-spec: a candidate's win shrank from −46% (proxy) to −34% (real harness) —
still real, but the proxy inflated it.

### 5. GEPA is optional

A reflective prompt optimiser (GEPA) can propose candidates, but the eval is the
gate, never the optimiser. On review-spec the raw GEPA winner was rejected — it
dropped a real second defect ⅓ of the time to buy precision — and a
**human-authored** candidate, informed by the eval's own findings, beat it. The
optimiser serves the eval; it never replaces it.

---

## The discipline (what keeps it honest)

- **Eval-first.** Build the eval before the prompt change — it is the source of
  truth, not the logs and not the optimiser.
- **Never auto-adopt a winner.** A passing candidate goes to a human before it
  ships; inspect it for gaming (bloat, memorised fixtures, eval-shape exploits).
- **No composite headline.** Report recall and false-alarms separately; a single
  number is what an optimiser games.
- **Read the log, not the exit code.** Wrapper and background exit codes lie; the
  metric lives in the output.
- **Certify every new fixture** (a paid run) before committing it — an
  un-adjudicated "clean" base is a silent false-alarm source.

---

## When this method doesn't fit

The floor and consensus gate need a **seeded item set** — a known list of defects to
catch. A skill whose quality is human-judgment-bound (a PR reviewer: "is this worth a
comment?") has no such set. There, seed nothing: use a corpus of **real,
human-adjudicated** cases (e.g. PRs humans approved with zero comments), measure
actionable-rate / coverage / false-certainty against a **bar recorded before triage**,
and let humans — not the agent that built the skill — judge the findings. That is a
different eval _shape_; it reuses this guide's **discipline** (decoupled metrics,
pre-registered bar, never-auto-adopt), not its seeded machinery.

---

## Reference implementation

`experiments/gepa-review-spec/` is the working review-spec eval — copy and adapt it
for a new seeded-corpus skill. Its `README.md` documents the seams:

- `src/dataset.ts` — load fixtures + train/test split
- `src/task.ts` — run the skill prompt against one fixture (swap the vendor runner)
- `src/evaluator.ts` — the deterministic set-matching metric
- `src/protected.ts` — the relative floor + `⌈2N/3⌉` consensus
- `validate-skill.ts` — the multi-run accept gate; `stability.ts` — variance probe
- `compute-protected.ts` — build the protected-set manifest from k baseline runs

## Reusing the code — rule of three

Do **not** extract a shared framework for the second skill. Two seeded evals diverge
(corpus, defect taxonomy, output contract), and a premature abstraction costs more
than duplication. **Copy-adapt** the reference impl per skill; extract shared code
only at the **third** seeded-corpus consumer. The Tier-2 `claude -p` runner is the
first genuinely corpus-agnostic extraction candidate when that day comes.
