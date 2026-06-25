# Logging brief — turning dogfooding into "optimize anything"

**Purpose:** what safeword must capture from internal usage so its skills become
_evaluable_ (and then GEPA-optimizable). Scope here is the **technical capture
design only** — all users are employees, so consent/privacy is out of scope.

## The one load-bearing decision

**Instrument everything; treat user behavior as _triage_, never as the
optimization target; keep a human-judged eval as the gate.**

This experiment proved twice that an optimizer (GEPA) will faithfully climb any
metric you give it — including a gamed or overfit one — so the metric is the
whole game. The research says the obvious shortcut (label each finding by whether
the developer acted on it, then optimize on that) is a **trap**:

- "Developer acted on it" is **trust/anchoring-biased** — they often act because
  the tool said so, not because it was right (Joachims 2007; Vardasbi 2020: IPS
  can't even correct trust bias).
- Optimizing on "accepted" trains **sycophancy** — findings users rubber-stamp,
  not findings that are correct (Sharma et al., Anthropic 2023).
- Non-action is **not a reliable negative** (MNAR): no-time / out-of-scope /
  fixed-for-another-reason / lost to a squash-rebase all look like "ignored."

So **disposition is a weak prior + a triage filter**, full stop. The label that
drives optimization comes from a **human-reviewed, stratified sample** — i.e. the
seeded-eval discipline this spike built, now _fed by real, diverse inputs_ (which
is exactly what would have saved the harvest from overfitting to two domains).

## What to capture — per skill invocation (the deliverable)

Logged by a hook at each skill call, append-only, to a local spool (cf. epic
\#345). Fields adapted from OpenInference/OTel trace conventions:

**Identity & linkage**

- `session_id` (the Claude Code session), `invocation_id` (this skill call),
  `parent_trace` ref (the surrounding tool-call stream), `employee_id`, timestamps
  (start/end).

**The reproducible core** (can't be backfilled — capture or lose forever)

- `skill_name` + **`skill_version`** (git SHA of the SKILL.md) + the **exact
  prompt body** that ran. _Without the version, traces are unattributable and
  prompt comparison is impossible._
- `input` — the **verbatim** thing the skill reviewed (the `.feature`/spec/diff/
  ticket), not a summary. (Enables replay.)
- `output` — the **verbatim** skill output (the findings/report).
- `model`, `temperature`, `max_tokens`, `seed`; token counts, cost, latency.
- Any tool calls the skill made (request **and** response).

**Disposition evidence — tagged WEAK / triage-only**

- What happened next in the session: did the agent/user edit the file/scenario the
  skill flagged? Was the output used verbatim or rewritten? Derived passively from
  the transcript + git. _Never wired directly to the optimizer._

**Outcome anchors — stronger, where obtainable**

- Did the flagged fix **ship and survive review** (not get reverted)? Did a bug
  later escape that the skill **missed** (a rare but real _recall_ signal that
  disposition can never give you)?

**Human label — the actual ground truth (added later, off the spool)**

- On a stratified, error-over-sampled subset: a reviewer's verdict (correct
  finding / false alarm / missed defect) + notes. This is what the eval scores
  against and what GEPA optimizes toward.

## Pipeline

1. **Capture** (hook → spool) — everything above.
2. **Triage-sample, not random** — use disposition + cheap auto-scores to surface
   candidates (edited outputs, errors); over-represent failures; dedup.
3. **Annotate** — a lightweight review queue; a few traces/week, employee confirms
   the ground-truth label.
4. **Promote** into the versioned eval corpus (extends
   `experiments/gepa-review-spec/fixtures/`), with a frozen held-out split.
5. **Optimize** — GEPA against the **human-judged** metric only, with the
   recall-floor + held-out + human-review gates this spike established.

## Caveats (each one bit us or is documented)

- **Never optimize on disposition** → sycophancy (Sharma 2023).
- **No preference leakage** — if you ever add an LLM judge, it must not share the
  model/family being optimized; scores inflate undetectably (arXiv 2502.01534).
  Safeword's eval is deterministic set-matching (no judge) — keep it that way.
- **Position bias** — if disposition is used at all, randomize finding order.
- **Drift** — re-sample fresh traffic periodically; a frozen set hides regressions.
- **Version dataset + prompt together** — a schema change should retire stale
  traces, not silently misfire.

## Scope — which skills

- **Start: `review-spec`** — clearest disposition (did the flagged scenario get
  fixed?), and this spike already has its eval.
- **Extend to** action-traceable skills: lint, audit, verify findings.
- **Out of scope:** subjective skills (brainstorm, voice/philosophy docs) — no
  objective ground truth, machine-evolution threatens auditability (the original
  E2D8S5 boundary holds).

## Bottom line

"Optimize anything" is gated on "_evaluate_ anything," which is gated on a
human-judged ground-truth signal. Logs make that signal **scalable and diverse**
(defeating the overfitting that sank the harvest) — but they do not replace the
human gate. Instrument now (it can't be backfilled); keep the human in the loop;
let the optimizer be the easy part it already is.
