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
| Growth-gated re-fire / hold below (TB2.AC1) | re-arm decision | unit | assert re-fire at/above `REARM_GROWTH_THRESHOLD`, hold below, count updated/unchanged |
| Recursion-guard-first + fail-open on record (NTB1.AC1) | re-arm decision | unit | guard returns before any gate; injected writer throws → still fires, no throw |
| Re-fire reads current transcript (TB2.AC2) | re-arm decision | unit (two-call) | stateful `readFile` returns short then grown; assert second call's transcript is current |
| Back-half finding reaches pipeline (TB2.AC3) | `src/commands/retro.ts` `--auto-extract` path | integration | injected extractor over grown transcript → finding in `prepareEncounters` input; `claude -p` spawn mocked |
| Cross-fire dedupe (TB3.AC1) | occurrence ledger (RV9JT4) on the `--auto-extract` path | integration | already-filed manifestation → no issue; new manifestation → filed; transport mocked |
| Hook uses re-arm decision (wiring) | `hooks/stop-retro.ts` (+ mirror) | unit (hook) | hook calls the re-arm decision instead of the boolean sentinel |

**Build order** (leaf-first; the riskiest assumption is concept-proven, so units
sequence by dependency):

1. Count-state helpers (NTB1.AC2) — no deps; replaces the boolean sentinel file.
2. `REARM_GROWTH_THRESHOLD` + re-arm decision (TB1.AC1, TB2.AC1, NTB1.AC1) —
   composes 1; the load-bearing pure slice.
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
| Re-fire trigger | Growth-gated: re-fire when tool-uses grew by ≥ `REARM_GROWTH_THRESHOLD` since last fire | Re-fire every Stop; fire-once-but-late | Every-Stop multiplies cost unboundedly; "late" has no reliable near-end signal in cloud |
| Sentinel → count | Replace the boolean once-per-session sentinel file with a stored last-fired tool-use count | Keep boolean + a second "last count" file | One state file per session is simpler and atomic; two files can desync |
| Dedupe across re-fires | Reuse the RV9JT4 occurrence ledger (filing layer) | New dedupe in the trigger | The ledger already dedupes filings end-to-end; re-fires flow through it unchanged |
| Cost bound | `REARM_GROWTH_THRESHOLD` (~25 tool-uses, tunable) + the #563 friction gate | No bound; time-based cadence | Unbounded re-fires are the premortem failure; growth gate ties cost to real session growth |
| State-write failure | Fail-open: fire anyway, never throw (mirrors `markNudged`) | Block the fire on write failure | A Stop hook must never break Stop; worst case is a duplicate the ledger dedupes |
| Recursion guard | Keep `SAFEWORD_RETRO_CHILD=1` checked FIRST, before any gate | Check it later | A retro child must never re-trigger; ordering is load-bearing |

`REARM_GROWTH_THRESHOLD` value is settled in build step 2 against the concept-test
curve (fires a handful of times over a long session, not every Stop).

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

- Re-arm cost becomes material in dogfooding telemetry (#563) → revisit
  `REARM_GROWTH_THRESHOLD` or gate re-fires harder.
- Tier (A) lands at sonnet chunk-and-map → reconsider whether every re-fire runs
  the expensive tier or only the final/largest fire (cheap-incremental/escalate-once).
- A real SessionEnd / idle hook becomes available in cloud → a single late fire
  could replace re-arm entirely; re-evaluate then.
