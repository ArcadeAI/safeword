# Spec: Retro recall — delta re-arm + sonnet + async hook + signature dedupe

## Intent

Make the invisible retro surface the friction a session actually hits **across the
whole session**, invisibly, at bounded cost. Today the retro fires once, early
(first Stop with ≥3 tool-uses = ~0.2% in), and `buildDigest` head-caps to the
first 180 KB — the chronological **opening**. So the maintainer's friction stream
is blind to ~90% of every session. This fixes the five **coupled** levers as one
slice (proven coupled by `/quality-review` on the superseded 0XEMEE phase plan):
delta re-arm over a pre-sliced window, sonnet at both model sites, an `async:true`
Stop hook, signature dedupe, and atomic offset state. The egress guard is
untouched and stays the security boundary.

## Intake Brief

- **Requested by:** alex@arcade.dev (Safeword Maintainer): the invisible retro
  (7D8PJP) ships but only reads the session opening — the recall is too low to be
  worth the run.
- **Cost of inaction:** the friction stream the self-observation epic (#344)
  depends on is ~90% blind. Real late-session friction (the #567 example surfaces
  at 29%, full coverage not until ~50% — measured this session) is never filed, so
  the feature looks like it works while quietly missing most of what it exists to
  catch.
- **Reversibility:** two-way door. Changes the trigger's *cadence* (fire N times
  over delta windows vs. once over the head), the extraction *model*, the hook
  *registration* (`async:true`), and the dedupe *key* (signature vs. title). The
  egress guard, schema, sanitizer, and filing pipeline are untouched. Revert =
  restore the once-per-session sentinel + haiku + sync hook + title match.

## References

- Decision: `/figure-it-out` (ticket.md "Why") — delta re-arm beats whole-transcript
  chunk-and-map (~M calls / ~$1.44 vs ~M×N / ~$15) and plain re-arm (inert: head-cap).
- `/quality-review` (isolated subprocess, 2026-06-30): design VALIDATED, scope
  sharpened — second model site (retro.ts:113), atomic offset = temp-write+rename,
  `async:true` backgrounds the whole hook tree (inner `spawnSync` stays sync),
  `buildDigest` takes a pre-sliced window, overlap/`#563`-absent/tail → refinements below.
- Parent **RV9JT4** (retro pipeline); sibling **7D8PJP** (invisible retro, built);
  **BNGK9W** (#568, cloud transport — the fallback if cloud reclaim kills in-hook async).
- Supersedes **0XEMEE** (killed: its incremental phase plan was proven inert).
- Reuses unchanged: `src/retro/` egress pipeline (`normalizeFinding`,
  `resolveSurface`, `sanitizeTextDeep`, `buildDraft`, `prepareEncounters`).

## Personas

- **Safeword Maintainer (SM)** — receives the friction stream. Wants it to reflect
  the **whole** session (not just the opening), at a model tier that surfaces real
  bugs, with **one issue per distinct friction** across re-fires and sessions.
- **Technical Builder (TB)** — runs safeword in their agent. The retro firing
  repeatedly must stay **invisible and non-blocking**, and its cost must stay
  bounded — no stolen turn, no Stop latency, no runaway spend.
- **Non-Technical Builder (NTB)** — can't read the diff. Needs the **no-leak**
  guarantee to hold for **every** delta window, not just the first.

## Vocabulary

- **Fire** — one invocation of the out-of-band extraction at a Stop. A session now
  has *multiple* fires (was: one).
- **Delta window** — the slice of transcript from the previous fire's recorded byte
  offset (minus a small overlap) to the current end. Fed to `buildDigest` instead
  of the whole transcript, so the digest cap applies to the *window*, not the head.
- **Overlap** — the last `OVERLAP_BYTES` (~2 KB) re-included before a window's start,
  so a finding straddling a window boundary appears whole in one fire. Duplicate
  findings from overlap are absorbed by signature dedupe.
- **Offset state** — per-session `{ offset, toolUses, fires }` (replaces the boolean
  once-per-session sentinel). Read→decide→write atomically (temp-write + rename).
- **Additive cadence** — re-fire each time tool-uses grow by `REARM_GROWTH` since
  the last fire (constant spacing → even tiling), bounded by `MAX_FIRES`.
- **Content signature** — `retro:<12-hex>` keyed on category + surface + normalized
  title (`retroSignature`). Stable across fires (the model-generated *title* is not).

## Jobs To Be Done

### retro-recall.SM1 — Receive safeword friction from the WHOLE session

**Persona:** Safeword Maintainer (SM)

> When a session hits friction late, I want it filed just like early friction, so
> my stream reflects the whole session instead of only its opening ~10%.

#### retro-recall.SM1.AC1 — A back-half finding is filed (delta windows tile the session)

Each fire digests the **delta window since the previous fire's offset** (plus a
small overlap), not the head; the union of windows covers the session. A friction
that appears only in the back half reaches the egress pipeline and is filed.

#### retro-recall.SM1.AC2 — Extraction defaults to a tier strong enough to surface real friction

The extraction model defaults to **sonnet** at **both** sites — `buildAutoExtractor`
(the runner, `retro.ts`) and the `runHeadlessExtraction` default (`retro-extract.ts`)
— and is config-overridable. (Measured: haiku 1–3 weak findings vs sonnet 9 strong.)

### retro-recall.SM2 — One issue per distinct friction, across re-fires and sessions

**Persona:** Safeword Maintainer (SM)

> When the retro re-fires within a session (or recurs across sessions), I want the
> same friction to land on one issue, not a pile of near-duplicates.

#### retro-recall.SM2.AC1 — Dedupe is by content signature, not the model-generated title

Triage matches an existing issue by the content **signature** (`retro:<hash>`,
embedded in the issue body and searchable), not the title (titles vary across
fires). A genuinely new signature opens a new issue; a repeat signature does not.

#### retro-recall.SM2.AC2 — A stable session id reaches the extraction child

The resolved session id is forwarded to the child so ledger session-accounting is
correct; the child no longer falls back to `'unknown'` when `CLAUDE_SESSION_ID` is
unset (e.g. cloud, where only `CLAUDE_CODE_REMOTE_SESSION_ID` is set).

#### retro-recall.SM2.AC3 — Near-simultaneous Stops don't double-fire or corrupt state

Offset state is written temp-file-then-`rename` (atomic on the same filesystem), so
two near-simultaneous Stops never read a torn state file; the offset only advances.
Signature dedupe is the filing-level backstop against any residual duplicate fire.

### retro-recall.TB1 — Repeated retro never intrudes or blocks, and stays cheap

**Persona:** Technical Builder (TB)

> When retro fires several times in my session, I want it to stay completely out of
> my way — no blocked Stop, no stolen turn — and not run up cost.

#### retro-recall.TB1.AC1 — The retro Stop hook is non-blocking (`async: true`)

The generated Claude settings register the retro Stop hook with `async: true`
(documented mode: returns immediately, runs in background, 600 s) — NOT
`asyncRewake` (which surfaces stderr into chat → breaks invisibility). The inner
`spawnSync` calls stay synchronous: the whole hook tree is backgrounded, so they
never block the user.

#### retro-recall.TB1.AC2 — Re-fire cadence is bounded and fail-open

Cadence is additive (`REARM_GROWTH` tool-uses of growth since last fire) with a
high `MAX_FIRES` runaway backstop. The `#563` "new friction since last fire" gate
is out-of-scope; when absent the cadence is **fail-open / always-fire** (bounded by
growth + backstop), never silently suppressing. The decision is recursion-guarded
(a retro child never re-fires) and fail-open on a state-write failure — it never
breaks Stop.

### retro-recall.NTB1 — No leak, on every delta window

**Persona:** Non-Technical Builder (NTB)

> I can't audit the diff, so the no-leak guarantee has to hold for every window the
> retro reads — not just the first one.

#### retro-recall.NTB1.AC1 — Every delta window passes the full egress pipeline unchanged

Findings from any window flow through `normalizeFinding → resolveSurface →
sanitizeTextDeep → buildDraft` before filing. Delta windowing slices the *input*
transcript only; it never injects a finding past the pipeline. Over-redaction is
the safe direction.

## Spec refinements (quality-review — locked here)

- **Cadence constants** (recovered from the 0XEMEE sim-rearm.ts plan-check, carried
  forward): `REARM_GROWTH = 200` tool-uses (additive, constant spacing → sim last
  fire 91–100%; ~10 fires on a 1,904-tool-use session; typical sessions fire 1–3
  times). `MAX_FIRES = 20` (high runaway backstop, a crash-loop bound — NOT a low
  cap; a low cap lands the last fire early and leaves a blind tail). Both exported
  constants, injectable in tests (like `SUBSTANCE_THRESHOLD`).
- **First fire vs re-fire:** the **first** fire keeps the existing substance gate
  (≥`SUBSTANCE_THRESHOLD` tool-uses) and digests from offset 0 (whole transcript so
  far, head-capped — unchanged for fire 1). Re-fires are gated by `REARM_GROWTH`.
- **Overlap size:** `OVERLAP_BYTES = 2048` (~2 KB, ≈ the "last ~50 lines" framing).
  A byte-slice may cut the first line; `buildDigest` already skips a malformed JSONL
  line, so the partial head line is harmlessly dropped — the overlap still carries
  whole boundary entries.
- **`#563` absent → fail-open:** with no friction gate, every armed Stop fires
  (bounded by growth + backstop). Never suppress silently.
- **Tail residual:** with constant `REARM_GROWTH` spacing the last fire ends within
  one `REARM_GROWTH` of the session end (≤ one increment). On a session exceeding
  `MAX_FIRES × REARM_GROWTH` tool-uses the backstop bites and the residual tail is
  larger — a documented, bounded cost/coverage trade (the runaway backstop).
- **Model config:** read `retro.model` from `.safeword/config.json` (default
  `sonnet`); both sites resolve through it.

## Rave Moment

Inherits 7D8PJP's "the feature with no felt presence." This slice adds: *"the bug I
hit at the very end of a three-hour session was already filed — not just the one
from the first five minutes."*

## Outcomes

- A finding present only in the back half of a session is filed (the recall win).
- Re-fires open no duplicate for the same signature; a new signature files.
- The retro Stop hook is registered `async: true` and does not block Stop.
- Fire N over a grown transcript digests the window since fire N-1 (with overlap);
  the union of deltas covers the session.
- Two near-simultaneous Stops do not corrupt offset state.
- Sonnet is the default at both model sites; cadence is bounded and fail-open.

## Open Questions

- defer (#563): the "new friction since last fire" gate is out-of-scope; cadence is
  fail-open without it. When #563 lands, re-fires gate on real new friction.
- defer (BNGK9W/#568): if cloud container reclaim kills in-hook `async` work, move
  filing to the cloud transport. Residual today: the last fire may be lost if the
  user goes idle the instant after the final Stop (bounded — loses one delta).
- defer: a validity/coverage eval scorer (regression guard) is spun out separately
  so this slice ships.
