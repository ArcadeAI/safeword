# Impl Plan: retro auto-trigger (Claude-first)

**Status:** planned

## Approach

**Riskiest assumption:** that counting tool-use entries in the Claude Code JSONL
transcript is a reliable, parseable substance signal — i.e. that the transcript
shape the Stop hook hands us matches what RV9JT4 already parses, and that a count
threshold discriminates "real work" from a trivial session. **Cheapest proof:**
the substance-gate `Scenario Outline` (below/at/above), run against a real-shaped
JSONL fixture — if the shape or counting assumption is wrong, this fails on slice 1
while the design is still cheap to change. This is the load-bearing slice; build it
first.

The hook surfaces a nudge only — it never extracts or files (RV9JT4 owns egress),
so there is no network/egress proof here; the proofs are pure-logic + fs-boundary
wiring.

**Proof plan + build order** (outside-in; each builds on the prior green):

1. **Substance gate** (`lib/retro-trigger.ts` → `isSubstantial(transcriptText)` /
   `countToolUses`). Primary proof: **unit** (pure function over transcript text) —
   the below/at/above outline + a real-shaped JSONL fixture. Load-bearing → first.
2. **Session-id precedence resolver** (`resolveSessionId(input, env)`). Primary
   proof: **unit** — the precedence outline (input > cloud > local) with the
   contention rows.
3. **Once-per-session sentinel** (`sentinelPath(id)`, `isNudged`, `markNudged`).
   Primary proof: **integration** (fs boundary, temp dir) — set/check keyed by id;
   different id ⇒ independent.
4. **Nudge assembly** (`buildRetroNudge(transcriptPath)`). Primary proof: **unit**
   — contains the transcript path, points at the retro guide, contains no
   imperative command (anchored to the `stop-self-report.ts` fact-phrasing).
5. **Orchestration** (`decideRetroNudge(deps)` with injected `readFile` + sentinel
   + env). Primary proof: **integration/wiring** from real collaborators, mocking
   only the fs boundary — proves: substantial+unnudged ⇒ additionalContext with
   path+guide; trivial ⇒ none + sentinel unset; second Stop (sentinel set) ⇒ none;
   different id ⇒ nudge; bad input ⇒ fail-open.
6. **Claude adapter** (`stop-retro.ts`). Primary proof: **wiring** for the new
   entry point — mock the process boundary (stdin/stdout/exit); proves exit 0, the
   `hookSpecificOutput.additionalContext` shape, and fail-open. Mirrors
   `stop-self-report.ts` (incl. `installCrashCapture`).
7. **Registration + parity** (settings.json Stop entry; `schema.ts` for the new
   template files; `.safeword/` byte-parity mirrors). Proof: the existing
   schema-drift + parity-check tests (no new test authoring).

## Decisions

| Decision              | Choice                                                              | Alternatives considered                                  | Rejected because                                                                 |
| --------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Substance signal      | Count tool-use entries in the transcript JSONL; inclusive `>=` N    | Cross-Stop counter file; gate on self-report spool       | Counter = extra state + racy across turns; spool-gating defeats retro's purpose (it catches what the spool can't) |
| Threshold value       | Named constant `SUBSTANCE_THRESHOLD` (tunable); scenarios pin the boundary symbolically (below/at/above) | Hardcode a number in scenarios                           | Hardcoding couples scenarios to a magic number; symbolic boundary survives tuning |
| Sentinel storage      | `/tmp/safeword-retro-<sessionid>` marker file                      | Under `.safeword/`; in-memory                            | `.safeword/` pollutes the working tree; in-memory can't survive across Stop invocations (separate processes) |
| Nudge phrasing        | Fact-phrased `additionalContext` (mirror `stop-self-report.ts`)    | Imperative directive                                     | Imperatives trip prompt-injection defenses → surfaced verbatim instead of acted on (repo learning) |
| Trigger config gate   | `selfReport.surface` reused (the nudge is a surfacing action)      | New `retro.autoTrigger` block                            | Avoids config sprawl; the nudge is conceptually the same "surface a signal" act stop-self-report performs — confirm during implement, can split later if it needs independent control |
| Shared core location  | `templates/hooks/lib/retro-trigger.ts` (+ `.safeword` mirror)      | Inline in `stop-retro.ts`                                | 53DQJZ (Codex) + KHYXY4 (Cursor) must reuse the gate/sentinel/resolver core      |

## Arch alignment

Records exist (`ARCHITECTURE.md` → "Key Decisions"). This implementation honors:

- **Modular hook pattern** — a new per-event hook under `templates/hooks/` wired in
  `settings.json`, exactly like the existing `stop-*` hooks; no new hook
  infrastructure.
- **Self-report fact-phrased surfacing** — reuses the `stop-self-report.ts`
  contract: surface a factual one-liner via `hookSpecificOutput.additionalContext`
  on exit 0, never an imperative, never blocking Stop.
- **Byte-parity template mirrors** — new `templates/**` files are mirrored to
  `.safeword/**` and registered in `schema.ts`, enforced by the existing
  schema-drift/parity tests.
- **"Three signal surfaces, one egress core"** (RV9JT4 spec) — this is the trigger
  for surface 2 (retrospective); it adds no parallel egress, only a firing
  mechanism for the existing pipeline.

## Known deviations

skip: no deviation from arch guidance — this is a new consumer of established
patterns (modular hook + fact-phrased self-report surfacing + template mirrors),
introducing no new cross-cutting pattern.

## Assessment triggers

- Adding the Codex (53DQJZ) or Cursor (KHYXY4) adapter — revisit whether the
  `lib/retro-trigger.ts` core boundary (gate/sentinel/resolver) is the right shared
  seam, or whether per-agent transcript parsing forces a different split.
- If the nudge's compliance rate is poor (agent reads the fact but doesn't run
  retro), revisit Q1 (nudge vs headless shellout) — the premortem's named failure.
- If `selfReport.surface` reuse proves too coarse (users want retro-trigger off but
  self-report surfacing on), split out a dedicated `retro.autoTrigger` config.
