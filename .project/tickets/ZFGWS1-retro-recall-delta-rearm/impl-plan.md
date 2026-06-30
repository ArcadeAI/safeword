# Impl Plan: Retro recall — delta re-arm + sonnet + async hook + signature dedupe

**Status:** planned

## Approach

**Riskiest assumption:** that slicing the transcript by a stored byte offset and
feeding only that **window** to `buildDigest` actually surfaces a back-half finding
the current head-cap misses — i.e. the recall win is real, not defeated by some
other cap in the pipeline. Cheapest proof: the SM1.AC1 *"back-half-only finding
beyond the head cap is filed"* scenario, driven through the real `runRetro` entry
with the `claude -p` subprocess + GitHub transport mocked, over a transcript larger
than the digest cap. If the design is wrong, that one wiring test fails while the
rest is still cheap — so it is sequenced as early as the window plumbing allows
(slice 4). Everything else (sonnet, dedupe, session id, async registration) is
independently valuable but not where the design risk lives.

Proof plan + build order (each builds on what's already green):

1. **Offset-state helpers** (`retro-trigger.ts` + `.safeword` mirror): read/record
   `{ offset, toolUses, fires }` keyed by session id; persist via temp-write +
   `rename`. **Unit** (injected `baseDirectory`/writer, like the existing
   `sentinelPath` tests) — proves SM2.AC3 atomic-write + strict-advance. No deps;
   foundation for cadence.
2. **Additive-cadence decision** (the `decideRetroRun` successor): recursion-guard
   first → resolve session id → first fire gated by `SUBSTANCE_THRESHOLD` →
   re-fire when `toolUses − lastFire ≥ REARM_GROWTH` → hold at `fires ≥ MAX_FIRES`
   → record state (fail-open on write throw) → return `{ transcriptPath,
   windowStart }`. **Unit** (injected deps) — proves all TB1.AC2 scenarios +
   SM2.AC2 no-resolve negative. Composes 1.
3. **Window slicer + pre-sliced digest** (`retro-extract.ts`): `windowFor(transcript,
   windowStart)` = `transcript.slice(max(0, windowStart − OVERLAP_BYTES))`;
   `buildDigest` runs over the window. **Unit** — proves SM1.AC1 first-fire,
   later-fire (offset − overlap), overlap-clamp. Composes 2's `windowStart`.
4. **Window plumbing + back-half proof** (`stop-retro.ts` → `retro.ts`): thread
   `--window-start N`; `runRetro` slices before extraction. **Integration/wiring**
   through `runRetro` (subprocess + transport mocked) — the load-bearing SM1.AC1
   back-half proof. Composes 1–3.
5. **Sonnet at both sites** (`retro.ts` `buildAutoExtractor`, `retro-extract.ts`
   default; `retro.model` config read): **Unit** on argv (default sonnet, not
   haiku) + config-override partition — SM1.AC2.
6. **Signature dedupe** (`finding.ts` `assembleBody` embeds the signature marker;
   `triage.ts` matches via a new `searchBySignature`; `github-rest.ts` impl;
   mock tracker): **Module** test vs a mock `IssueTracker` — repeat-no-issue /
   new-creates / fuzzy-near-miss-rejected — SM2.AC1. The body-marker is a focused
   unit on `assembleBody`/`retroSignature`.
7. **Stable session id forward** (`stop-retro.ts` passes the resolved id to the
   child; `retro.ts` uses it over `'unknown'`): **Wiring** unit — SM2.AC2 happy.
8. **`async: true` registration** (`config.ts` `asyncHook` helper; register
   `stop-retro`; update the settings/parity fixtures): **Config** test on
   `SETTINGS_HOOKS.Stop` — TB1.AC1 (async true; not asyncRewake).
9. **Egress non-bypass** (NTB1.AC1): no new code path — windowed findings flow
   through the unchanged `prepareEncounters`. Dedicated secret-redaction +
   unresolved-surface-drop tests over a window-derived finding confirm the
   boundary still fails closed.

Supporting proof: pure-logic edge cases (clamp-at-zero, inclusive `REARM_GROWTH`
boundary, backstop boundary) get focused unit cases; no eval needed (no AI-output
quality claim — the sonnet choice is config, the *quality* evidence is the ticket's
measured eval, not a regression scorer, which is deferred).

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Re-fire state | Per-session `{ offset, toolUses, fires }` file replacing the boolean sentinel | Keep sentinel + a 2nd offset file | Two files desync; one atomic state file is simpler |
| Cadence | **Additive** re-fire each `REARM_GROWTH`=200 tool-uses, backstop `MAX_FIRES`=20 | Geometric backoff; fire-every-Stop; low fire cap | Sim (0XEMEE plan-check): geometric front-loads → last fire 38%, blind tail; low cap exhausts at 7%. Additive → 91–100% |
| Window boundary | Byte offset; window = `slice(max(0, offset − OVERLAP_BYTES))`; `OVERLAP_BYTES`=2048 | Line offset; no overlap | Byte offset matches `transcript.length`/`rename` atomicity; a cut first line is skipped by `buildDigest`; overlap keeps a straddling finding whole |
| Concurrency | temp-write + `rename` (atomic, last-writer-wins) | Advisory lock; CAS/max-wins | Ticket forbids locks; max-wins needs a lock. Last-writer-wins + signature dedupe absorbs the rare duplicate |
| Dedupe key | Content `signature` (`retro:<hash>`) embedded in body, matched via `searchBySignature` (`in:body` + exact-filter) | Match by title (`searchByTitle`) | Titles vary across fires → duplicate issues; signature is stable |
| Extraction model | `sonnet` default at both sites, `retro.model` config override | Keep haiku; sonnet hardcoded | haiku 1–3 weak vs sonnet 9 strong (measured); config keeps it tunable |
| Hook execution | `async: true` registration (whole hook tree backgrounded); inner `spawnSync` unchanged | `asyncRewake`; make spawns async | asyncRewake surfaces stderr → breaks invisibility; spawns already non-blocking once the tree backgrounds |
| Window plumbing | Decision computes `windowStart`; CLI slices via `--window-start` | CLI owns all state | Keeps state read/write in one place (the hook decision), CLI stays a thin boundary |

## Arch alignment

- **Reconciliation Engine / Schema (`src/schema.ts`)** — every `templates/hooks/**`
  change is byte-mirrored to `.safeword/hooks/**` and registered in `schema.ts`
  (the parity contract); the new `asyncHook` registration and any hook edits keep
  the three contracts in sync.
- **Retro egress boundary (secretlint)** — windowing changes the *input* slice only;
  the `@secretlint`-backed `sanitizeTextDeep` → `resolveSurface` → `buildDraft`
  pipeline is reused unchanged (NTB1.AC1 honors the deny-by-default egress guard).
- **Phase-exit review gate (NMSD94)** — this ticket honored the scenario-gate Tier-2
  independent fresh-context review before stamping.

## Known deviations

- **Last-writer-wins, not max-wins** offset under true concurrency (no lock per the
  ticket). Accepted: the only effect is a rare re-covered window, absorbed by
  signature dedupe; correctness (no torn read) holds.
- **Async last-fire residual:** if the container is reclaimed the instant the user
  goes idle after the final Stop, the last delta may be lost (bounded — one delta).
  Documented; BNGK9W (#568 cloud transport) is the fallback if this proves material.

## Assessment triggers

- **#563 "new friction since last fire" gate lands** → re-fires gate on real new
  friction instead of fail-open always-fire.
- **Re-arm cost material in telemetry** → raise `REARM_GROWTH` (G=250 ≈ $2.80 vs
  G=150 ≈ $4.55 on the worst-case 25 MB session) or gate harder.
- **Debounce-to-quiet becomes viable** (cloud reclaim timing characterized) →
  replace additive cadence with a single end-of-session fire.
- **Cloud reclaim kills in-hook async work** → move filing to the BNGK9W transport.
