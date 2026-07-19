# Impl Plan: Plain-first gate blocks

**Status:** planned

## Approach

**Riskiest assumption:** that R3's "is this internal term glossed?" test is *decidable* and doesn't false-positive on copy that legitimately glosses or replaces a term. Term *presence* is trivial (substring); the gloss/replacement judgement is the load-bearing part. The rule `checkBlock` uses: an enumerated internal term in `lead`/`next` is a violation **unless** immediately followed by a plain-word gloss — a parenthetical `(…)` or an appositive `— …`; a term that's been *replaced* (absent) is fine by construction. **Cheapest proof:** slice 1 rewrites the two densest-jargon gates (done, plan) and runs both R3 directions over them — a bare term is flagged **and** an inline-glossed term is *accepted*. If the gloss rule holds without false positives on the two worst messages, it holds for the lighter five. The other three rules are structural, not assumptions: `lead` is first → R1; exactly one `next` → R2; `/explain` only ever in the optional `detail` field → R4.

**Scope resolution (was ambiguous, now fixed).** "done", "phase", and "spec" are *families* — "done" alone emits a dozen-plus distinct `hardBlockDone(...)` strings. This ticket rewrites **one representative message per gate** (seven total); the long-tail sub-messages are out of scope (deferred follow-up under the epic). The feature's "seven … messages" completeness assert therefore means the seven in-scope blocks — exactly one per gate.

**Design.** New `.safeword/hooks/lib/block-messages.ts`: `BlockMessage = { lead: string; next: string; detail?: string }`, one builder per in-scope gate, and `renderBlock(block): string` that concatenates to the final denial string **once, inside the Claude gate process** (with `/explain` in `detail`). The plainness guard `checkBlock(block): Violation[]` encodes R1–R4 over the structured form incl. the gloss rule above. All TypeScript — the only installed pack; every scenario touches hook code, so the `typescript` skill applies throughout.

**Cross-surface parity (corrected).** The Codex/Cursor adapters don't render structured objects — they spawn `pre-tool-quality.ts` and string-process its stdout. Codex's `formatCodexReason` swaps `/explain`→`$explain`; Cursor passes the string through (keeps `/explain`, already harness-appropriate). So parity is a property of that string transform, not a per-harness renderer. Proof: `formatCodexReason(renderBlock(block))` preserves lead / one-next / no-bare-term and only swaps the command; Cursor pass-through preserves them with `/explain`. No harness param is threaded into the builders.

**Proof plan** (primary proof per scenario, `testing/SKILL.md` highest-practical-scope):

- Conforming R1/R2/R3/R4 — **unit** over the real builders (guard iterates the seven; "every one of the seven produced a message" is a registry-completeness assert). Includes the R3-accepts-glossed case.
- Rejection outlines — **unit**: crafted blocks (token-first lead per class; zero/two next lines; bare term per class; /explain-as-next; /explain-as-required).
- **Per-gate wiring** — for **all seven** gates, fire the real gate and assert its emitted denial string equals `renderBlock(<that gate's builder>)`. This is what proves each `deny()`/`hardBlockDone()` site actually calls its builder (a builder-only test would pass while a site still emits its old hardcoded string).
- Cross-surface parity — **unit** over `formatCodexReason(rendered)` + Cursor pass-through.

**Build order** (load-bearing slice first):

1. **Slice 1 (load-bearing):** `BlockMessage` + `renderBlock` + `checkBlock` (incl. gloss rule) + the **done** and **plan** builders; unit-prove R1–R4 incl. both R3 directions, plus all rejection outlines, plus the wiring assert for those two gates. A wrong gloss rule or shape fails here while cheap.
2. Add the remaining five builders (LOC, phase, spec/JTBD/criteria, bash-ledger, process-kill); the completeness assert now covers all seven; wiring assert for all seven.
3. Wire the seven `deny()`/`hardBlockDone()` sites to render from builders; update the string-asserting tests (`quality-gates`, `readiness-pointer`, `gate-escalation`).
4. Parity: prove `formatCodexReason(rendered)` + Cursor pass-through hold the properties (the cross-surface scenario).

**Surface coverage:** Claude Code — slices 1–3. Cursor + OpenAI Codex — slice 4.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Message representation | Structured `{ lead, next, detail? }` | Free-form strings, regex-parsed in the guard | Brittle parse; structure makes R1/R2/R4 true by construction (see Approach) |
| R3 gloss discriminator | Term in lead/next is a violation unless immediately followed by `(…)` or `— …` gloss | Open-ended "is this jargon glossed" heuristic; forbid term entirely in lead/next | Heuristic is nondeterministic; outright-forbid rejects the feature's allowed "gloss **or** replacement" |
| Plainness check tier | Deterministic pure guard as a unit test | LLM judge scores plainness | Observable fact, not a judgment on produced work (Principle 1) — a judge adds nondeterminism/cost for no gain |
| Parity mechanism | Prove the real string transform (`formatCodexReason`, Cursor pass-through) | Per-harness `renderBlock(harness)` in the adapters | Adapters string-process spawned stdout; no structured object crosses the boundary, so a per-harness renderer has no production call site |
| Guard scope | Test-time regression lock over builders + per-gate wiring assert | Runtime gate blocking non-plain copy | Out of scope — enforcement untouched; the lock is a dev-time test |

## Arch alignment

Honors PRINCIPLES.md #1 (enforcement hierarchy — the guard is a tier-2 observation over an observable fact) and #3 (add, never replace — text-only; no trigger/threshold/condition change). No formal ADRs govern hook message shape. skip: no ADR needed — reversible, local, within existing `hooks/lib/*` patterns (`active-ticket.ts`, `quality-state.ts`).

## Known deviations

skip: no deviations planned — `block-messages.ts` follows the existing typed-helper `hooks/lib/*` pattern, edited in lockstep with its `.safeword`/template mirror as the parity guard requires.

## Doc impact

skip: internal, agent-facing surface. `docs.sources` (README.md, packages/website docs) describe safeword's workflow, not verbatim block text. If slice 3 finds a doc quoting an in-scope block, it updates it — checked at implement.

## Assessment triggers

- A new block **among the seven in-scope gates** changes its message → re-run the guard; it must go through the builder (the completeness assert covers only the in-scope seven, not every hard block in the system).
- The long-tail follow-up is picked up → the guard's in-scope set expands to those messages.
- A new harness with a different detail command → add a case to the parity transform.
- If block copy ever needs runtime enforcement (block on non-plain text, not just a test) → revisit the test-only guard scope.
