# Impl Plan: Plain-first gate blocks

**Status:** planned

## Approach

**Riskiest assumption:** that R3's "is this internal term glossed?" test is *decidable* and doesn't false-positive on copy that legitimately glosses or replaces a term. Term *presence* is trivial (substring); the gloss/replacement judgement is the load-bearing part. The rule `checkBlock` uses: an enumerated internal term in `lead`/`next` is a violation **unless** immediately followed by a plain-word gloss — a parenthetical `(…)` or an appositive `— …` — **whose content differs from the term** (non-equal, non-substring, so `phase name (phase name)` doesn't self-satisfy); a term that's been *replaced* (absent) is fine by construction. **Cheapest proof:** slice 1 rewrites the two densest-jargon gates (done, plan) and runs both R3 directions over them — a bare term is flagged **and** an inline-glossed term is *accepted*. If the gloss rule holds without false positives on the two worst messages, it holds for the lighter five.

The other three rules are structural, not assumptions: `lead` is first → R1; exactly one `next` → R2; the builder **never emits `/explain`** (the next action is always a real step) → R4. `/explain` stays exactly where it already lives — the optional `EXPLAIN_HINT` line that `deny()`/`hardBlockDone()` append after every rendered block. The builder doesn't touch it, so no gate's `/explain` plumbing changes.

**Scope resolution (was ambiguous, now fixed).** "done", "phase", and "spec" are *families* — "done" alone emits a dozen-plus distinct `hardBlockDone(...)` strings. This ticket rewrites **one representative message per gate** (seven total); the long-tail sub-messages are out of scope (deferred follow-up under the epic). The feature's "seven … messages" completeness assert means the seven in-scope blocks — exactly one per gate.

**Design.** New `.safeword/hooks/lib/block-messages.ts`: `BlockMessage = { lead: string; next: string }`, one builder per in-scope gate, and `renderBlock(block): string` that concatenates `lead` + `next`. `/explain` is **not** part of the builder or `renderBlock` — `deny()` (`pre-tool-quality.ts:144`) and `hardBlockDone()` (`stop-quality.ts:459`) keep appending `\n\n${EXPLAIN_HINT}` after the rendered block, unchanged, so the hint remains the single optional-deepening line and `formatCodexReason` still finds the exact constant to swap. The plainness guard `checkBlock(block): Violation[]` encodes R1–R4 over the structured form: lead-first and no leading token (R1); exactly one `next` line (R2); the gloss rule above (R3); neither `lead` nor `next` contains `/explain` (R4). All TypeScript — the only installed pack; every scenario touches hook code, so the `typescript` skill applies throughout.

**Cross-surface parity (corrected).** The Codex/Cursor adapters don't render structured objects — they spawn `pre-tool-quality.ts` and string-process its stdout. Codex's `formatCodexReason` (`codex/pre-tool-quality.ts:45`) does `replaceAll(CLAUDE_EXPLAIN_HINT, CODEX_EXPLAIN_HINT)` — it swaps the exact hint *sentence*; Cursor passes the string through (keeps `/explain`). So parity is a property of that transform over the **real emitted string** (rendered block **plus** the wrapper's `EXPLAIN_HINT` tail), not a per-harness renderer. No harness param is threaded into the builders.

**Proof plan** (primary proof per scenario, `testing/SKILL.md` highest-practical-scope):

- Conforming R1/R2/R3/R4 — **unit** over the real builders. The completeness assert compares the builder registry's key set to the exact seven gate identities (LOC, phase, plan, done, spec/JTBD/criteria, bash-ledger-write, process-kill), so a missing, duplicated, or extra builder fails loudly — not a count. Includes the R3-accepts-glossed case.
- Rejection outlines — **unit**: crafted blocks (token-first lead per class; zero/two next lines; bare term per class; /explain-as-next; /explain-as-required).
- **Per-gate wiring** — for **all seven** gates, fire the real gate and assert its emitted denial string **starts with** `renderBlock(<that gate's builder>)` (the wrapper appends `\n\n${EXPLAIN_HINT}`). This proves each `deny()`/`hardBlockDone()` site renders from its builder, not a stale hardcoded string — a builder-only test would pass while the site is unchanged.
- Cross-surface parity — **unit** over `formatCodexReason(renderBlock(block) + "\n\n" + EXPLAIN_HINT)` (asserts `/explain`→`$explain` on the tail + properties preserved) and the Cursor pass-through.

**Build order** (load-bearing slice first):

1. **Slice 1 (load-bearing):** `BlockMessage` + `renderBlock` + `checkBlock` (incl. gloss rule) + the **done** and **plan** builders; unit-prove R1–R4 incl. both R3 directions, all rejection outlines, and the wiring assert for those two gates. A wrong gloss rule or shape fails here while cheap.
2. Add the remaining five builders (LOC, phase, spec/JTBD/criteria, bash-ledger, process-kill); completeness assert now covers all seven identities; wiring assert for all seven.
3. Wire the seven `deny()`/`hardBlockDone()` sites to render from builders (leaving the `EXPLAIN_HINT` append untouched); update the string-asserting tests (`quality-gates`, `readiness-pointer`, `gate-escalation`).
4. Parity: prove `formatCodexReason(emitted)` swaps the hint + the Cursor pass-through hold the properties (the cross-surface scenario).

**Surface coverage:** Claude Code — slices 1–3. Cursor + OpenAI Codex — slice 4.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Message representation | Structured `{ lead, next }` | Free-form strings, regex-parsed in the guard | Brittle parse; structure makes R1/R2 true by construction |
| `/explain` ownership | Wrapper keeps appending `EXPLAIN_HINT`; builder never emits `/explain` | Builder owns a `detail` field carrying `/explain` | Would double-append (wrapper still adds it) and force editing shared `deny()`/`hardBlockDone()` touching out-of-scope gates; the exact-constant swap must be preserved for Codex |
| R3 gloss discriminator | Term in lead/next flagged unless immediately followed by `(…)`/`— …` gloss whose content differs from the term | Open-ended jargon heuristic; forbid term entirely in lead/next | Heuristic is nondeterministic; outright-forbid rejects the feature's allowed "gloss **or** replacement" |
| Plainness check tier | Deterministic pure guard as a unit test | LLM judge scores plainness | Observable fact, not a judgment on produced work (Principle 1) — a judge adds nondeterminism/cost for no gain |
| Parity mechanism | Prove the real string transform over the emitted string | Per-harness `renderBlock(harness)` in the adapters | Adapters string-process spawned stdout; no structured object crosses the boundary, so a per-harness renderer has no production call site |
| Guard scope | Test-time regression lock + per-gate wiring assert | Runtime gate blocking non-plain copy | Out of scope — enforcement untouched; the lock is a dev-time test |

## Arch alignment

Honors PRINCIPLES.md #1 (enforcement hierarchy — the guard is a tier-2 observation over an observable fact) and #3 (add, never replace — text-only; no trigger/threshold/condition change). skip: no ADR needed — reversible, local, within existing `hooks/lib/*` patterns (`active-ticket.ts`, `quality-state.ts`).

## Known deviations

skip: no deviations planned — `block-messages.ts` follows the existing typed-helper `hooks/lib/*` pattern, edited in lockstep with its `.safeword`/template mirror as the parity guard requires.

## Doc impact

skip: internal, agent-facing surface. `docs.sources` (README.md, packages/website docs) describe safeword's workflow, not verbatim block text. If slice 3 finds a doc quoting an in-scope block, it updates it — checked at implement.

## Assessment triggers

- A block **among the seven in-scope gates** changes its message → re-run the guard; it must go through the builder (the completeness assert covers only the in-scope seven, not every hard block in the system).
- The long-tail follow-up is picked up → the guard's in-scope identity set expands to those messages.
- A new harness with a different detail command → add a case to the parity transform.
- If block copy ever needs runtime enforcement (block on non-plain text, not just a test) → revisit the test-only guard scope.
