# Impl Plan: Retro re-arm timing (0XEMEE — Phase 0)

**Status:** planned

## Approach

**Riskiest assumption:** that re-arming (re-running extraction on later Stops as
the transcript grows) is what recovers recall — already concept-tested this
session (the trigger fires at line 19/9,788 = 0.2%; #567 not seen until 29%; full
coverage at ~50%), so the design risk is now wiring, not hypothesis. The
load-bearing slice is the **re-arm decision** itself (`decideRetroRun` successor):
if the growth-gate math or the recursion-guard ordering is wrong, it fails on a
pure unit with zero model cost. Everything downstream composes on it.

Per-behavior ownership and proof (highest practical scope per `testing/SKILL.md`):

| Behavior (AC) | Owning component | Primary proof | Why enough |
| --- | --- | --- | --- |
| Count-state read/record, keyed by session id (NTB1.AC2) | `hooks/lib/retro-trigger.ts` (+ `.safeword` mirror) new `readLastFiredCount` / `recordFiredCount` | unit | pure fs helpers, `baseDirectory`-injected like `sentinelPath`; assert stored value + key |
| First-fire + records count; trivial doesn't (TB1.AC1) | re-arm decision (`decideRetroRun` successor) | unit | injected deps; assert run=true + recorded count value (not mere file existence) |
| Growth-gated re-fire / hold below (TB2.AC1) | re-arm decision | unit | assert re-fire once growth ≥ `REARM_GROWTH` (additive) and under the backstop; hold below; count updated/unchanged |
| Recursion-guard-first + fail-open on record (NTB1.AC1) | re-arm decision | unit | guard returns before any gate; injected writer throws → still fires, no throw |
| Re-fire reads current transcript (TB2.AC2) | re-arm decision | unit (two-call) | stateful `readFile` returns short then grown; assert second call's transcript is current |
| Back-half finding reaches pipeline (TB2.AC3) | `src/commands/retro.ts` `--auto-extract` path | integration | injected extractor over grown transcript → finding in `prepareEncounters` input; `claude -p` spawn mocked |
| Cross-fire dedupe (TB3.AC1) | occurrence ledger (RV9JT4) on the `--auto-extract` path | integration | already-filed manifestation → no issue; new manifestation → filed; transport mocked |
| Hook uses re-arm decision (wiring) | `hooks/stop-retro.ts` (+ mirror) | unit (hook) | hook calls the re-arm decision instead of the boolean sentinel |

**Build order** (leaf-first; the riskiest assumption is concept-proven, so units
sequence by dependency):

1. Count-state helpers (NTB1.AC2) — no deps; replaces the boolean sentinel file.
2. `REARM_GROWTH` (≈200, additive) + high `MAX_FIRES` backstop (≈20) + re-arm
   decision (TB1.AC1, TB2.AC1, NTB1.AC1) — composes 1; the load-bearing pure slice.
3. Re-fire-reads-current (TB2.AC2) — two-call unit on the decision from 2.
4. Back-half finding integration (TB2.AC3) — composes the existing `--auto-extract`
   pipeline, spawn mocked.
5. Dedupe (TB3.AC1) — confirm the occurrence ledger is consulted on the
   `--auto-extract` path before claiming done.
6. `stop-retro.ts` wiring — the hook uses the re-arm decision.

Boundaries mocked: the `claude -p` spawn, the GitHub transport, and the
count-state file (via injected `baseDirectory` / writer).

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Re-fire trigger | **Additive cadence**: re-fire each `REARM_GROWTH` (≈200) tool-uses of growth since last fire | Geometric backoff; re-fire every Stop; fire-once-but-late | **Simulated against this session (sim-rearm.ts):** geometric front-loads — last fire at 38%, 62% blind tail (its "5/5" was a compaction-summary artifact). Additive keeps pace — last fire 91–100%, full coverage. "Late" has no near-end signal in cloud. |
| Fire count cap | High runaway **backstop only** (≈20), NOT a low cap | Low cap (≈5) | Sim: a low cap lands the last fire early (38% geometric / 7% friction-gated) → huge blind tail. The cap must be high enough to never exhaust before the session ends; it's a crash-loop backstop, not a cadence control. |
| Extraction model | **sonnet** (folds in lever-A's cheap first step) | haiku (the shipped default) | Proven this session: haiku 1–3 weak findings vs sonnet 9 strong. Re-arming a weak extractor re-reads the session *badly* — defeats the recall purpose. |
| Sentinel → count | Replace the boolean once-per-session sentinel file with a stored last-fired tool-use count | Keep boolean + a second "last count" file | One state file per session is simpler and atomic; two files can desync |
| Dedupe across re-fires | Reuse the RV9JT4 occurrence ledger (filing layer) | New dedupe in the trigger | The ledger already dedupes filings end-to-end; re-fires flow through it unchanged |
| Cost bound | Additive cadence + fixed digest cap (per-fire input bounded) + dedup (re-fires file nothing new) + #563 "new friction since last fire" gate + high backstop | Geometric (cheaper but blind tail); haiku (cheap but weak) | Honest cost with sonnet: typical session ~$0.35–1; pathological 25 MB session ~$3–5 (G=250→$2.80/8 fires; G=150→$4.55/13). Friction gate trims typical sessions; per-fire cost is fixed. **Worst-case cost is the open #563 value call — see ticket.** |
| State-write failure | Fail-open: fire anyway, never throw (mirrors `markNudged`) | Block the fire on write failure | A Stop hook must never break Stop; worst case is a duplicate the ledger dedupes |
| Recursion guard | Keep `SAFEWORD_RETRO_CHILD=1` checked FIRST, before any gate | Check it later | A retro child must never re-trigger; ordering is load-bearing |

`REARM_GROWTH` / `MAX_FIRES` values are settled in build step 2 against the
sim-rearm.ts curve (additive G=200 → last fire ~95% of the session, ~10 fires on
this 1,904-tool-use session; typical sessions fire 1–3 times).

## Arch alignment

- **Agent-neutral trigger core** (`retro-trigger.ts`, FTCQGD) — the re-arm decision
  is a successor to `decideRetroRun` in the same module, reusing `resolveSessionId`,
  `countToolUses`, `isRetroChild`, and the `baseDirectory`-injected state pattern.
- **Deny-by-default egress guard + occurrence ledger** (RV9JT4) — reused unchanged;
  re-fires flow through the same sanitize → assemble → dedupe → file pipeline.
- **Byte-parity mirror** (`templates/**` ↔ `.safeword/**`, registered in schema.ts) —
  the trigger + hook changes mirror to `.safeword` and stay registered.

## Known deviations

skip: no deviations planned — this slice extends the existing FTCQGD trigger core
and RV9JT4 pipeline without introducing a new pattern.

## Assessment triggers

- Re-arm cost becomes material in dogfooding telemetry (#563) → raise `REARM_GROWTH`
  (G=250 → ~$2.80 vs G=150 → ~$4.55 on the worst-case session) or gate harder.
- **Debounce-to-quiet becomes viable** → replace additive cadence with a single
  fire after the session goes quiet (no Stop for D seconds) = one ~$0.35 end-fire
  instead of N. Blocked today because cloud container reclaim timing after the last
  Stop is uncharacterized (the same gap that killed SessionEnd); characterize it,
  then revisit. This is the real cost win if the timing can be made safe.
- Tier (B, coverage) lands at sonnet chunk-and-map → reconsider whether every
  re-fire runs the expensive whole-transcript pass or only the latest fire.
- A real SessionEnd / idle hook becomes available in cloud → a single late fire
  could replace re-arm entirely; re-evaluate then.
