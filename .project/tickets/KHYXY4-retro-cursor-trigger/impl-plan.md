# Impl Plan: retro auto-trigger — Cursor

**Status:** implemented

## Reconciliation (implement-phase exit)

Built as planned. Notes:

- **Counter reuse held** — Cursor's transcript is Claude-shaped, so `countToolUses`
  is reused unchanged; a characterization test pins the reuse (no
  `countToolUsesCursor`). The exact-shape fidelity remains gated on a live spike.
- **Coexistence held** — retro evaluates only on the marker-absent (non-review)
  branch of `cursor/stop.ts`; when quality-review fires (or an automated-evidence
  run suppresses it), retro never runs, so its sentinel stays untouched. Proven by
  the integration test (quality-review wins → retro sentinel unset).
- **One addition not in the plan:** loosened a brittle exact-import assertion in
  `cursor-stop-review.test.ts` (it pinned the literal `installCrashCapture` import
  line; extending the import to add `readSelfReportConfig` broke it). Reworded to a
  regex asserting the *wiring* (imported + invoked), preserving intent.
- **Known limitation (assessment trigger):** on a session where every stop carries
  edits (quality-review always wins) and there is never a no-edit stop, retro can
  be starved. Acceptable: most real sessions have ≥1 no-edit stop, and the once-
  per-session sentinel + the later-refire scenario cover the common case.

## Approach

**Riskiest assumption:** Cursor's transcript at the hook-provided `transcript_path`
is Claude-shaped (`message.content[].type === 'tool_use'`), so the existing
`countToolUses` works unchanged. **Cheapest proof:** the counter scenario against a
Claude-shaped Cursor fixture (slice 1) — if Cursor's shape differs, this fails
first and cheaply, and the seam already supports a `countToolUsesCursor` variant.
Empirical fidelity (non-empty + Claude-shaped at stop time) is confirmed by a live
Cursor dump-payload spike, deferred (spec.md Open Questions).

The retro path adds NO new orchestration — it reuses `decideRetroNudge`, the
sentinel, and `countToolUses`; only the session-id resolver and the
`cursor/stop.ts` wiring (coexistence + output channel) are new.

**Proof plan + build order** (outside-in; each builds on the prior green):

1. **`resolveCursorSessionId(input)`** in `lib/retro-trigger.ts` — returns
   `conversation_id` (session-stable), undefined when absent. Primary proof:
   **unit** (resolves from conversation_id; absent → undefined).
2. **Counter reuse** — the existing `countToolUses` on a Cursor fixture. Primary
   proof: **unit** (three tool_use blocks → 3). No new code; a characterization
   test pinning the reuse.
3. **Retro path in `cursor/stop.ts`** — slot `decideRetroNudge` onto the
   non-quality-review (`{}`) branches: when quality-review is NOT emitting this
   stop, evaluate retro and emit its nudge as `followup_message`, else `{}`. When
   quality-review fires, retro is never evaluated (sentinel untouched). Primary
   proof: **integration/wiring** — spawn the real hook via stdin and assert:
   completed+substantial+no-marker → retro followup; trivial → `{}`; second stop →
   `{}`; marker+not-automated → quality-review message (retro yields, sentinel
   unset); aborted → `{}`; malformed/unreadable → `{}`, sentinel unset.
4. **Registration + parity** — `.cursor/hooks.json` already wires `cursor/stop.ts`
   (no new hook file); `.safeword` byte-parity mirror of the edited adapter +
   lib; schema unchanged (no new owned file). Proof: existing schema/parity tests.

## Decisions

| Decision               | Choice                                                            | Alternatives considered                          | Rejected because                                                                 |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Tool-use counter       | Reuse Claude `countToolUses` (Cursor transcript is Claude-shaped) | New `countToolUsesCursor`                        | Docs show identical `message.content[].tool_use` shape; a new counter is dead duplication until a spike proves divergence |
| Session-id source      | `conversation_id` (session-stable) via `resolveCursorSessionId`  | `generation_id`                                  | generation_id is per-generation/turn-ish; keying the sentinel on it risks >1 fire |
| Coexistence            | Retro evaluates only on the non-quality-review branches          | Append both followups; separate cursor retro hook | One followup_message per stop; a second hook racing the same output is undefined — yielding keeps quality-review intact and the sentinel unconsumed |
| Output channel         | `followup_message` (auto-submits — strongest nudge)              | —                                                | The only stop-output channel Cursor offers                                       |
| New hook file?         | No — extend existing `cursor/stop.ts`                            | New `cursor/stop-retro.ts`                        | Cursor fires one stop hook; a second would compete for the followup slot         |

## Arch alignment

Records exist (`ARCHITECTURE.md` → "Key Decisions"). Honors: the modular
per-agent adapter pattern (extends the existing Cursor adapter, as 53DQJZ added the
Codex one); fact-phrased surfacing (the nudge is a statement, reused from the
shared `buildRetroNudge`); byte-parity template mirrors; "three signal surfaces,
one egress core" — trigger only, no new egress. The per-agent counter/resolver seam
(FTCQGD) is exercised by its third consumer, validating the boundary.

## Known deviations

skip: no deviation — third consumer of the established per-agent trigger seam; the
only novelty (coexistence with an existing followup) is local to `cursor/stop.ts`.

## Assessment triggers

- A live Cursor spike showing the transcript is NOT Claude-shaped → add
  `countToolUsesCursor` (the seam supports it; this plan reused the Claude counter).
- If Cursor adds a second stop-output channel (beyond followup_message) or lifts
  the one-followup-per-stop limit → revisit the yield-to-quality-review coexistence.
